//! Tauri 命令模块
//! 
//! 包含所有暴露给前端的 Tauri 命令函数

use crate::constants::{file_ext, INVALID_FILENAME_CHARS};
use crate::http_client::{add_bilibili_headers, get_http_client};
use crate::proxy;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use tauri::{Emitter, Manager};
use tauri::WebviewWindow;

/// 下载进度事件
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DownloadProgress {
    pub progress: i32,
}

/// 窗口控制命令：最小化窗口
#[tauri::command]
#[allow(unused_variables)]
pub async fn minimize_window(window: WebviewWindow) -> Result<(), String> {
    #[cfg(desktop)]
    {
        window.minimize().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// 窗口控制命令：关闭窗口
#[tauri::command]
#[allow(unused_variables)]
pub async fn close_window(window: WebviewWindow) -> Result<(), String> {
    #[cfg(desktop)]
    {
        window.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// 窗口控制命令：隐藏窗口
#[tauri::command]
#[allow(unused_variables)]
pub async fn hide_window(window: WebviewWindow) -> Result<(), String> {
    #[cfg(desktop)]
    {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// 选择文件夹
#[tauri::command]
#[cfg_attr(not(desktop), allow(unused_variables))]
pub async fn select_folder(app: tauri::AppHandle) -> Result<Option<String>, String> {
    #[cfg(desktop)]
    {
        use tauri_plugin_dialog::DialogExt;
        use std::path::PathBuf;
        use tokio::sync::oneshot;
        
        let home_dir = std::env::var("HOME")
            .ok()
            .map(PathBuf::from)
            .or_else(|| std::env::var("USERPROFILE").ok().map(PathBuf::from));
        
        let (tx, rx) = oneshot::channel();
        
        app.dialog()
            .file()
            .set_directory(home_dir.unwrap_or_else(|| PathBuf::from(".")))
            .pick_folder(move |path| {
                let _ = tx.send(path);
            });
        
        let path = rx.await.map_err(|e| format!("接收对话框结果失败: {}", e))?;
        
        Ok(path.map(|p| p.to_string()))
    }
    #[cfg(not(desktop))]
    {
        Ok(None)
    }
}

/// 清理文件名中的非法字符
fn sanitize_filename(name: &str) -> String {
    name.chars()
        .map(|c| if INVALID_FILENAME_CHARS.contains(c) { '_' } else { c })
        .collect::<String>()
}

/// 下载文件
#[tauri::command]
pub async fn download_file(
    app: tauri::AppHandle,
    window: WebviewWindow,
    url: String,
    filename: String,
    file_type: Option<String>,
    save_path: Option<String>,
    sub_folder: Option<String>,
) -> Result<serde_json::Value, String> {
    let ext = if file_type.as_deref() == Some("video") {
        file_ext::VIDEO
    } else {
        file_ext::AUDIO
    };
    
    let safe_name = sanitize_filename(&filename) + ext;
    
    let safe_folder = sub_folder.map(|f| sanitize_filename(&f));
    
    let file_path = if let Some(save_path) = save_path {
        let mut target_dir = PathBuf::from(save_path);
        if let Some(folder) = &safe_folder {
            target_dir.push(folder);
            fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;
        }
        target_dir.push(&safe_name);
        target_dir
    } else {
        // 使用默认下载目录
        let mut download_dir = app.path()
            .app_data_dir()
            .map_err(|e| format!("无法获取应用数据目录: {}", e))?;
        download_dir.push("downloads");
        if let Some(folder) = &safe_folder {
            download_dir.push(folder);
        }
        fs::create_dir_all(&download_dir).map_err(|e| e.to_string())?;
        download_dir.push(&safe_name);
        download_dir
    };
    
    // 下载文件（复用HTTP客户端）
    let client = get_http_client().await?;
    let mut response = add_bilibili_headers(client.get(&url))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    if !response.status().is_success() {
        return Err("下载失败".to_string());
    }
    
    let total_size = response.content_length().unwrap_or(0);
    let mut file = fs::File::create(&file_path).map_err(|e| e.to_string())?;
    let mut downloaded: u64 = 0;
    
    // 发送初始进度
    window.emit("download-progress", DownloadProgress { progress: 0 })
        .ok();
    
    while let Some(chunk) = response.chunk().await.map_err(|e| e.to_string())? {
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;
        
        if total_size > 0 {
            let progress = ((downloaded * 100) / total_size) as i32;
            window.emit("download-progress", DownloadProgress { progress })
                .ok();
        }
    }
    
    // 发送完成进度
    window.emit("download-progress", DownloadProgress { progress: 100 })
        .ok();
    
    Ok(serde_json::json!({
        "success": true,
        "path": file_path.to_string_lossy().to_string()
    }))
}

/// 获取应用版本
#[tauri::command]
pub async fn get_app_version() -> Result<String, String> {
    Ok(env!("CARGO_PKG_VERSION").to_string())
}

/// 检查更新（暂未实现）
#[tauri::command]
pub async fn check_for_update() -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({
        "success": false,
        "error": "更新功能暂未实现"
    }))
}

/// 下载更新（暂未实现）
#[tauri::command]
pub async fn download_update() -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({
        "success": false,
        "error": "更新功能暂未实现"
    }))
}

/// 安装更新（暂未实现）
#[tauri::command]
pub async fn install_update() -> Result<(), String> {
    Err("更新功能暂未实现".to_string())
}

/// HTTP 代理请求（用于绕过 CORS）
#[tauri::command]
pub async fn http_request(
    url: String,
    method: Option<String>,
    headers: Option<std::collections::HashMap<String, String>>,
    params: Option<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    let client = get_http_client().await?;
    
    let method = method.as_deref().unwrap_or("GET");
    let mut request = match method {
        "GET" => client.get(&url),
        "POST" => client.post(&url),
        "PUT" => client.put(&url),
        "DELETE" => client.delete(&url),
        _ => return Err(format!("不支持的 HTTP 方法: {}", method)),
    };
    
    // 添加默认请求头
    request = add_bilibili_headers(request)
        .header("Accept", "application/json, text/plain, */*")
        .header("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8");
    
    // 添加自定义请求头（忽略 Cookie，由 cookie_store 自动管理）
    if let Some(custom_headers) = headers {
        for (key, value) in custom_headers {
            if key.to_lowercase() != "cookie" {
                request = request.header(&key, &value);
            }
        }
    }
    
    // 添加查询参数（将 JSON Value 转换为字符串 HashMap）
    if let Some(query_params_json) = params {
        let mut query_map = std::collections::HashMap::new();
        if let Some(obj) = query_params_json.as_object() {
            for (key, value) in obj {
                let str_value = match value {
                    serde_json::Value::String(s) => s.clone(),
                    serde_json::Value::Number(n) => n.to_string(),
                    serde_json::Value::Bool(b) => b.to_string(),
                    serde_json::Value::Null => String::new(),
                    _ => value.to_string(),
                };
                query_map.insert(key.clone(), str_value);
            }
        }
        request = request.query(&query_map);
    }
    
    let response = request
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;
    
    let status = response.status();
    
    let headers_map: std::collections::HashMap<String, String> = response
        .headers()
        .iter()
        .map(|(k, v)| {
            (k.to_string(), v.to_str().unwrap_or("").to_string())
        })
        .collect();
    
    let body = response
        .text()
        .await
        .map_err(|e| format!("读取响应失败: {}", e))?;
    
    // 尝试解析为 JSON，如果失败则返回文本
    let json_value = serde_json::from_str(&body).unwrap_or_else(|_| {
        serde_json::json!({ "text": body })
    });
    
    Ok(serde_json::json!({
        "status": status.as_u16(),
        "headers": headers_map,
        "data": json_value
    }))
}

/// 启动代理服务器
#[tauri::command]
pub async fn start_proxy_server() -> Result<u16, String> {
    proxy::start_proxy_server().await
}

/// 代理音频文件
#[tauri::command]
pub async fn proxy_audio(url: String) -> Result<String, String> {
    proxy::proxy_audio(url).await
}

use std::sync::Mutex;

/// 关闭行为状态
#[derive(Default)]
pub struct CloseActionState {
    action: Mutex<String>,
}

impl CloseActionState {
    #[allow(dead_code)]
    pub fn new() -> Self {
        Self {
            action: Mutex::new("quit".to_string()),
        }
    }
    
    pub fn set(&self, action: String) {
        if let Ok(mut action_guard) = self.action.lock() {
            *action_guard = action;
        }
    }
    
    pub fn get(&self) -> String {
        self.action.lock()
            .map(|a| a.clone())
            .unwrap_or_else(|_| "quit".to_string())
    }
}

/// 设置关闭行为
#[tauri::command]
pub async fn set_close_action(app: tauri::AppHandle, action: String) -> Result<(), String> {
    app.state::<CloseActionState>().set(action);
    Ok(())
}

/// 获取关闭行为
#[tauri::command]
pub async fn get_close_action(app: tauri::AppHandle) -> Result<String, String> {
    Ok(app.state::<CloseActionState>().get())
}
