//! HTTP 客户端模块
//!
//! 提供全局 HTTP 客户端管理和 B 站请求头处理

use crate::constants::{BILIBILI_ORIGIN, BILIBILI_REFERER, USER_AGENT, generate_buvid3};
use lazy_static::lazy_static;
use std::sync::Arc;
use tokio::sync::Mutex;

lazy_static! {
    /// buvid3 设备指纹（全局生成一次即可）
    static ref BUVID3: String = generate_buvid3();
    /// buvid4 格式: buvid3前24位-后8位
    static ref BUVID4: String = format!("{}-{}", &BUVID3[..24], &BUVID3[24..32]);
    /// b_nut: 冷启动时间戳（毫秒）
    static ref B_NUT: String = {
        use std::time::{SystemTime, UNIX_EPOCH};
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis()
            .to_string()
    };
    /// Cookie 头字符串（buvid3 / buvid4 / b_nut 是关键设备指纹 cookie）
    static ref FIXED_COOKIE: String = format!(
        "buvid3={}; buvid4={}; b_nut={}",
        *BUVID3, *BUVID4, *B_NUT
    );

    static ref HTTP_CLIENT: Arc<Mutex<Option<reqwest::Client>>> = Arc::new(Mutex::new(None));
}

/// 获取或创建 HTTP 客户端（无 cookie_store，Cookie 由 FIXED_COOKIE 统一管理）
pub async fn get_http_client() -> Result<reqwest::Client, String> {
    let mut client_guard = HTTP_CLIENT.lock().await;

    if let Some(ref client) = *client_guard {
        return Ok(client.clone());
    }

    let client = reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

    *client_guard = Some(client.clone());
    Ok(client)
}

/// 为请求添加 B 站标准请求头（含设备指纹 Cookie）
pub fn add_bilibili_headers(request: reqwest::RequestBuilder) -> reqwest::RequestBuilder {
    request
        .header("Referer", BILIBILI_REFERER)
        .header("Origin", BILIBILI_ORIGIN)
        .header("User-Agent", USER_AGENT)
        .header("Cookie", FIXED_COOKIE.as_str())
}
