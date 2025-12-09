//! HTTP 客户端模块
//! 
//! 提供全局 HTTP 客户端管理和 B 站请求头处理

use crate::constants::{BILIBILI_ORIGIN, BILIBILI_REFERER, USER_AGENT};
use lazy_static::lazy_static;
use std::sync::Arc;
use tokio::sync::Mutex;

// 全局 HTTP 客户端（带 Cookie 存储）
lazy_static! {
    static ref HTTP_CLIENT: Arc<Mutex<Option<reqwest::Client>>> = Arc::new(Mutex::new(None));
}

/// 获取或创建 HTTP 客户端
pub async fn get_http_client() -> Result<reqwest::Client, String> {
    let mut client_guard = HTTP_CLIENT.lock().await;
    
    if let Some(ref client) = *client_guard {
        return Ok(client.clone());
    }
    
    // 创建带 Cookie 存储的客户端
    let client = reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .cookie_store(true)
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;
    
    // 预访问 bilibili.com 获取 cookies
    let _ = add_bilibili_headers(client.get("https://www.bilibili.com"))
        .send()
        .await;
    
    *client_guard = Some(client.clone());
    Ok(client)
}

/// 为请求添加 B 站标准请求头
pub fn add_bilibili_headers(request: reqwest::RequestBuilder) -> reqwest::RequestBuilder {
    request
        .header("Referer", BILIBILI_REFERER)
        .header("Origin", BILIBILI_ORIGIN)
        .header("User-Agent", USER_AGENT)
}
