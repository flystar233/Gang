//! 代理服务器模块
//! 
//! 提供 HTTP 代理服务器功能，用于绕过 CORS 限制和实现流式播放

use crate::constants::{PROXY_PORT_RANGE_END, PROXY_PORT_RANGE_START};
use crate::http_client::{add_bilibili_headers, get_http_client};
use axum::{
    body::Body,
    extract::{Path, Request},
    http::{header, HeaderName, HeaderValue, StatusCode},
    response::Response,
    routing::get,
    Router,
};
use futures::StreamExt;
use lazy_static::lazy_static;
use std::sync::Arc;
use tokio::sync::Mutex;
use tower::ServiceBuilder;
use tower_http::cors::CorsLayer;

// 代理服务器端口
lazy_static! {
    static ref PROXY_SERVER_PORT: Arc<Mutex<Option<u16>>> = Arc::new(Mutex::new(None));
}

async fn bind_available_port() -> Result<(u16, tokio::net::TcpListener), String> {
    for port in PROXY_PORT_RANGE_START..PROXY_PORT_RANGE_END {
        match tokio::net::TcpListener::bind(format!("127.0.0.1:{}", port)).await {
            Ok(listener) => return Ok((port, listener)),
            Err(_) => continue,
        }
    }
    Err("无法找到可用端口".into())
}

/// 启动代理服务器（返回代理端口）
pub async fn start_proxy_server() -> Result<u16, String> {
    let mut port_guard = PROXY_SERVER_PORT.lock().await;
    if let Some(port) = *port_guard {
        return Ok(port);
    }

    // 直接绑定端口，避免“先探测后绑定”期间的抢占
    let (port, listener) = bind_available_port().await?;
    let port_clone = port;

    tokio::spawn(async move {
        let app = Router::new()
            .route("/proxy/:encoded_url", get(handle_proxy_request))
            .layer(ServiceBuilder::new().layer(CorsLayer::permissive()));

        if let Err(err) = axum::serve(listener, app).await {
            eprintln!("[Proxy] 启动失败: {:?}", err);
        }
    });

    *port_guard = Some(port_clone);
    Ok(port_clone)
}

/// 处理代理请求（支持 Range 请求，实现流式播放）
async fn handle_proxy_request(
    Path(encoded_url): Path<String>,
    request: Request,
) -> Result<Response<Body>, StatusCode> {
    let url = match urlencoding::decode(&encoded_url) {
        Ok(url) => url.to_string(),
        Err(_) => return Err(StatusCode::BAD_REQUEST),
    };
    
    let client = match get_http_client().await {
        Ok(c) => c,
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };
    
    // 构建请求，支持 Range 请求
    let mut req_builder = add_bilibili_headers(client.get(&url));
    
    // 转发 Range 请求头
    if let Some(range) = request.headers().get("range") {
        if let Ok(range_str) = range.to_str() {
            req_builder = req_builder.header("Range", range_str);
        }
    }
    
    let response = match req_builder.send().await {
        Ok(r) => r,
        Err(e) => {
            eprintln!("[Proxy] 请求失败: {:?}", e);
            return Err(StatusCode::BAD_GATEWAY);
        }
    };
    
    let reqwest_status = response.status();
    let status_u16 = reqwest_status.as_u16();
    
    // 检查状态码
    if !reqwest_status.is_success() && status_u16 != 206 {
        // 403 是链接过期的正常情况，前端会自动刷新，不打印日志
        if status_u16 != 403 {
            eprintln!("[Proxy] B站返回错误状态码: {}", status_u16);
        }
        return Err(StatusCode::BAD_GATEWAY);
    }
    
    // 转换状态码
    let axum_status = StatusCode::from_u16(status_u16)
        .unwrap_or(StatusCode::OK);
    
    // 先保存所有需要的响应头信息（在移动 response 之前）
    let content_type = response.headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("audio/mp4")
        .to_string();
    
    let content_length = response.headers()
        .get("content-length")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());
    
    let content_range = response.headers()
        .get("content-range")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());
    
    // 保存其他响应头（排除 Content-Type，因为我们会单独设置）
    let mut headers_to_copy = Vec::new();
    for (key, value) in response.headers() {
        let key_str = key.as_str();
        // 跳过 Content-Type, Content-Length, Content-Range（我们会单独处理）
        if key_str != "content-type" && key_str != "content-length" && key_str != "content-range" {
            if let Ok(header_name) = HeaderName::from_bytes(key_str.as_bytes()) {
                if let Ok(value_str) = value.to_str() {
                    if let Ok(header_value) = HeaderValue::from_str(value_str) {
                        headers_to_copy.push((header_name, header_value));
                    }
                }
            }
        }
    }
    
    // 将响应体转换为流（这会移动 response）
    let stream = response.bytes_stream()
        .map(|result| result.map_err(|err| std::io::Error::new(std::io::ErrorKind::Other, err)));
    
    // 构建响应
    let mut response_builder = Response::builder()
        .status(axum_status)
        .header(header::CONTENT_TYPE, content_type)
        .header(header::ACCEPT_RANGES, "bytes")
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .header(header::ACCESS_CONTROL_ALLOW_METHODS, "GET, HEAD, OPTIONS")
        .header(header::ACCESS_CONTROL_ALLOW_HEADERS, "Range");
    
    // 添加 Content-Length（如果存在）
    if let Some(length) = content_length {
        if let Ok(header_value) = HeaderValue::from_str(&length) {
            response_builder = response_builder.header(header::CONTENT_LENGTH, header_value);
        }
    }
    
    // 添加 Content-Range（Range 请求时）
    if let Some(range) = content_range {
        if let Ok(header_value) = HeaderValue::from_str(&range) {
            response_builder = response_builder.header(header::CONTENT_RANGE, header_value);
        }
    }
    
    // 添加保存的响应头
    for (header_name, header_value) in headers_to_copy {
        response_builder = response_builder.header(header_name, header_value);
    }
    
    Ok(response_builder.body(Body::from_stream(stream)).unwrap())
}

/// 代理音频文件（返回代理 URL，支持流式播放）
pub async fn proxy_audio(url: String) -> Result<String, String> {
    if url.is_empty() {
        return Err("URL 为空".to_string());
    }
    
    // 启动代理服务器（如果还没启动）
    let port = start_proxy_server().await?;
    
    // 返回代理 URL
    let encoded_url = urlencoding::encode(&url);
    Ok(format!("http://127.0.0.1:{}/proxy/{}", port, encoded_url))
}
