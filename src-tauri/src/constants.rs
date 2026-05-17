//! 应用常量定义模块
//! 
//! 集中管理应用中使用的所有常量

/// 应用常量定义
pub const USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
pub const BILIBILI_REFERER: &str = "https://www.bilibili.com";
pub const BILIBILI_ORIGIN: &str = "https://www.bilibili.com";
pub const PROXY_PORT_RANGE_START: u16 = 8000;
pub const PROXY_PORT_RANGE_END: u16 = 9000;

/// 生成 B 站需要的 buvid3 设备指纹（格式: 8-4-4-4-12 无横线 hex）
/// 格式参考: https://github.com/SocialSisterYi/bilibili-API-collect
pub fn generate_buvid3() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis();
    // 用简单的时间戳+随机数拼出符合格式的 hex 串
    let mut buf = String::with_capacity(32);
    buf.push_str(&format!("{:x}", now));
    // 补到 32 位
    while buf.len() < 32 {
        use std::collections::hash_map::RandomState;
        use std::hash::{BuildHasher, Hasher};
        let h = RandomState::new().build_hasher().finish();
        buf.push_str(&format!("{:x}", h));
    }
    buf.truncate(32);
    buf
}

/// 文件扩展名
pub mod file_ext {
    pub const VIDEO: &str = ".mp4";
    pub const AUDIO: &str = ".m4a";
}

/// 非法文件名字符
pub const INVALID_FILENAME_CHARS: &str = "<>:\"/\\|?*";
