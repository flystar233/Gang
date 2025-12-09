# Android 交叉编译环境变量设置脚本
# 使用方法：在构建 Android 应用前运行此脚本，或在 PowerShell 中执行：
# . .\scripts\setup-android-env.ps1

# 检查并设置 ANDROID_HOME
if (-not $env:ANDROID_HOME) {
    $defaultAndroidHome = "$env:LOCALAPPDATA\Android\Sdk"
    if (Test-Path $defaultAndroidHome) {
        $env:ANDROID_HOME = $defaultAndroidHome
        Write-Host "设置 ANDROID_HOME: $env:ANDROID_HOME" -ForegroundColor Green
    }
    else {
        Write-Host "警告: 未找到 ANDROID_HOME，请手动设置" -ForegroundColor Yellow
    }
}
else {
    Write-Host "ANDROID_HOME 已设置: $env:ANDROID_HOME" -ForegroundColor Green
}

# 检查并设置 NDK_HOME
if (-not $env:NDK_HOME) {
    if ($env:ANDROID_HOME) {
        $ndkPath = "$env:ANDROID_HOME\ndk"
        if (Test-Path $ndkPath) {
            $ndkVersions = Get-ChildItem $ndkPath -Directory | Sort-Object Name -Descending
            if ($ndkVersions.Count -gt 0) {
                $latestNdk = $ndkVersions[0].FullName
                $env:NDK_HOME = $latestNdk
                Write-Host "设置 NDK_HOME: $env:NDK_HOME" -ForegroundColor Green
            }
            else {
                Write-Host "警告: 未找到 NDK，请通过 Android Studio 安装" -ForegroundColor Yellow
            }
        }
        else {
            Write-Host "警告: NDK 目录不存在: $ndkPath" -ForegroundColor Yellow
        }
    }
}
else {
    Write-Host "NDK_HOME 已设置: $env:NDK_HOME" -ForegroundColor Green
}

# 设置 Cargo 交叉编译环境变量
if ($env:NDK_HOME) {
    $llvmBin = "$env:NDK_HOME\toolchains\llvm\prebuilt\windows-x86_64\bin"
    if (Test-Path $llvmBin) {
        $env:PATH = "$llvmBin;$env:PATH"
        $env:CC_x86_64_linux_android = "$llvmBin\x86_64-linux-android30-clang.cmd"
        $env:AR_x86_64_linux_android = "$llvmBin\llvm-ar.exe"
        $env:RANLIB_x86_64_linux_android = "$llvmBin\llvm-ranlib.exe"
        $env:CC_aarch64_linux_android = "$llvmBin\aarch64-linux-android30-clang.cmd"
        $env:AR_aarch64_linux_android = "$llvmBin\llvm-ar.exe"
        $env:RANLIB_aarch64_linux_android = "$llvmBin\llvm-ranlib.exe"
        $env:CC_armv7_linux_androideabi = "$llvmBin\armv7a-linux-androideabi30-clang.cmd"
        $env:AR_armv7_linux_androideabi = "$llvmBin\llvm-ar.exe"
        $env:RANLIB_armv7_linux_androideabi = "$llvmBin\llvm-ranlib.exe"
        $env:CC_i686_linux_android = "$llvmBin\i686-linux-android30-clang.cmd"
        $env:AR_i686_linux_android = "$llvmBin\llvm-ar.exe"
        $env:RANLIB_i686_linux_android = "$llvmBin\llvm-ranlib.exe"
        Write-Host "已设置交叉编译环境变量" -ForegroundColor Green
    }
    else {
        Write-Host "警告: 未找到 LLVM 工具链: $llvmBin" -ForegroundColor Yellow
    }
}
else {
    Write-Host "警告: NDK_HOME 未设置，无法配置交叉编译环境" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "环境变量设置完成！" -ForegroundColor Cyan
Write-Host "现在可以运行: pnpm tauri:android:build:apk" -ForegroundColor Cyan
