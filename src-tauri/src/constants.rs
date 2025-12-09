//! 应用常量定义模块
//! 
//! 集中管理应用中使用的所有常量

/// 应用常量定义
pub const USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
pub const BILIBILI_REFERER: &str = "https://www.bilibili.com";
pub const BILIBILI_ORIGIN: &str = "https://www.bilibili.com";
pub const PROXY_PORT_RANGE_START: u16 = 8000;
pub const PROXY_PORT_RANGE_END: u16 = 9000;

/// 文件扩展名
pub mod file_ext {
    pub const VIDEO: &str = ".mp4";
    pub const AUDIO: &str = ".m4a";
}

/// 非法文件名字符
pub const INVALID_FILENAME_CHARS: &str = "<>:\"/\\|?*";
