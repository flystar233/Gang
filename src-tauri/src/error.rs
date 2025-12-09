use serde::{Deserialize, Serialize};

/// 应用错误类型
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AppError {
    /// 网络错误
    Network(String),
    /// IO 错误
    Io(String),
    /// 无效参数
    InvalidInput(String),
    /// 系统错误
    System(String),
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AppError::Network(msg) => write!(f, "网络错误: {}", msg),
            AppError::Io(msg) => write!(f, "IO 错误: {}", msg),
            AppError::InvalidInput(msg) => write!(f, "无效参数: {}", msg),
            AppError::System(msg) => write!(f, "系统错误: {}", msg),
        }
    }
}

impl std::error::Error for AppError {}

impl From<reqwest::Error> for AppError {
    fn from(err: reqwest::Error) -> Self {
        AppError::Network(err.to_string())
    }
}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        AppError::Io(err.to_string())
    }
}

/// 将 AppError 转换为 String（用于 Tauri 命令返回）
impl From<AppError> for String {
    fn from(err: AppError) -> Self {
        err.to_string()
    }
}
