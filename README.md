# 纲一下

随机播放郭德纲相声的跨端应用，支持桌面（Windows/macOS/Linux）与 Android。内置单口/对口分类、收藏、下载、托盘、移动端适配等功能。

## 功能亮点
- 一键「纲一下」：随机获取并播放郭德纲相声
- 单口 / 对口分类：独立关键词池，自动去重
- 播放模式：顺序、列表循环、单曲循环、自动纲一下
- 收藏：收藏/收藏列表，安卓顶部三按钮快捷入口
- 下载：支持进度、路径设置

## 技术栈
- 前端：React 18 + TypeScript + Vite 5 + Tailwind CSS + Zustand
- 桌面：Tauri 2（Rust 后端，提供本地代理解决音频 CORS）
- 移动：Tauri Android + Capacitor（WebView），本地 127.0.0.1 代理支持流式音频

## 开发与构建

### 环境
- Node.js ≥ 18，推荐 pnpm
- Rust + cargo
- Android 开发：Android SDK + NDK（示例 `E:\Android\Sdk\ndk\29.0.14206865`），已在 `.cargo/config.toml` 配置

### 安装依赖
```bash
pnpm install
```

### 开发模式（桌面）
```bash
pnpm tauri:dev
```
### 前端构建
```bash
pnpm run build:web
```

### Android 调试
```bash
pnpm tauri:android:dev
```

### Android 打包
- APK：`pnpm tauri:android:build:apk`
- AAB：`pnpm tauri:android:build:aab`

签名：预先设置环境变量（示例）
```powershell
$env:TAURI_ANDROID_KEYSTORE_PATH="E:\keys\gang.keystore"
$env:TAURI_ANDROID_KEYSTORE_PASSWORD="你的keystore密码"
$env:TAURI_ANDROID_KEY_ALIAS="gang"
$env:TAURI_ANDROID_KEY_PASSWORD="你的key密码"
```

### 桌面打包
```bash
pnpm tauri:build
```

## 项目结构
```
├─src/                      # 前端（React + TS）
│  ├─api/                   # API 封装
│  │   ├─bilibili.ts        # B 站接口与音频代理调用
│  │   └─request/           # axios 实例、拦截器
│  ├─assets/                # 图片等静态资源
│  ├─components/            # UI 组件（播放器、列表、抽屉、标题栏等）
│  ├─constants/             # 常量配置（关键词、缓存大小等）
│  ├─store/                 # Zustand 状态（player/settings/favorites）
│  ├─types/                 # TS 类型定义
│  ├─utils/                 # 工具（平台检测、格式化、缓存等）
│  ├─App.tsx                # 前端入口
│  └─main.tsx               # React 挂载入口
│
├─src-tauri/                # Tauri 后端（Rust）
│  ├─src/                   # Rust 源码
│  │   ├─commands.rs        # 前端可调用的命令
│  │   ├─http_client.rs     # 带 B 站头的 HTTP 客户端
│  │   ├─proxy.rs           # 本地 127.0.0.1 代理，解决音频 CORS
│  │   └─lib.rs             # 入口，移动端含 mobile_entry_point
│  ├─gen/android/           # 生成的 Android 工程（Gradle）
│  ├─icons/permissions/...  # Tauri 配置附带资源
│  ├─Cargo.toml             # Rust 依赖
│  └─tauri.conf.json        # Tauri 配置
│
├─scripts/                  # 辅助脚本（如 Android 环境设置）
├─package.json              # 前端与脚本
└─pnpm-workspace.yaml       # pnpm 工作区
```

## 许可证
仅供学习交流使用。若有问题欢迎提交 Issue / PR。

