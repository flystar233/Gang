# 创建 GitHub Release 并上传构建产物
param(
    [string]$Tag = "v1.0.1-beta.1",
    [string]$Repo = "flystar233/Gang"
)

$apiUrl = "https://api.github.com/repos/$Repo/releases"
$distDir = "dist"
$version = $Tag.Replace('v', '')
$exeFile = "$distDir\gang-$version.exe"
$blockmapFile = "$exeFile.blockmap"

# 检查文件是否存在
if (-not (Test-Path $exeFile)) {
    Write-Host "错误: 找不到文件 $exeFile" -ForegroundColor Red
    Write-Host "请先运行: pnpm build" -ForegroundColor Yellow
    exit 1
}

# 读取 CHANGELOG 获取 release notes
$changelog = Get-Content "CHANGELOG.md" -Raw -Encoding UTF8
$version = $Tag.Replace('v', '')
$changelogPattern = "(?s)### \[$version\].*?(?=### |$)"
if ($changelog -match $changelogPattern) {
    $releaseNotes = $matches[0].Trim()
} else {
    $releaseNotes = "Release $Tag"
}

# 检查是否已有 release
try {
    $existing = Invoke-RestMethod -Uri "$apiUrl/tags/$Tag" -Method Get -ErrorAction SilentlyContinue
    if ($existing) {
        Write-Host "Release $Tag 已存在: $($existing.html_url)" -ForegroundColor Yellow
        Write-Host "是否要删除并重新创建? (y/N): " -NoNewline -ForegroundColor Yellow
        $confirm = Read-Host
        if ($confirm -eq 'y' -or $confirm -eq 'Y') {
            Write-Host "正在删除现有 Release..." -ForegroundColor Yellow
            $headers = @{
                "Authorization" = "token $env:GITHUB_TOKEN"
                "Accept" = "application/vnd.github.v3+json"
            }
            Invoke-RestMethod -Uri "$apiUrl/$($existing.id)" -Method Delete -Headers $headers -ErrorAction Stop
            Write-Host "已删除现有 Release" -ForegroundColor Green
        } else {
            Write-Host "跳过创建 Release" -ForegroundColor Yellow
            exit 0
        }
    }
} catch {
    # Release 不存在，继续创建
}

# 提示输入 token
if (-not $env:GITHUB_TOKEN) {
    Write-Host "需要 GitHub Personal Access Token 来创建 Release" -ForegroundColor Yellow
    Write-Host "如果没有 token，请访问: https://github.com/settings/tokens" -ForegroundColor Yellow
    Write-Host "Token 需要 'repo' 权限" -ForegroundColor Yellow
    Write-Host ""
    $token = Read-Host "请输入您的 GitHub Personal Access Token (或按 Enter 跳过)"
    if ([string]::IsNullOrWhiteSpace($token)) {
        Write-Host ""
        Write-Host "未提供 token，无法创建 Release" -ForegroundColor Red
        Write-Host ""
        Write-Host "请手动创建 Release:" -ForegroundColor Yellow
        Write-Host "1. 访问: https://github.com/$Repo/releases/new" -ForegroundColor Cyan
        Write-Host "2. 选择 tag: $Tag" -ForegroundColor Cyan
        Write-Host "3. 标题: $Tag" -ForegroundColor Cyan
        Write-Host "4. 描述: 复制 CHANGELOG.md 文件内容" -ForegroundColor Cyan
        Write-Host "5. 上传文件: $exeFile" -ForegroundColor Cyan
        exit 0
    }
    $env:GITHUB_TOKEN = $token
}

$headers = @{
    "Authorization" = "token $env:GITHUB_TOKEN"
    "Accept" = "application/vnd.github.v3+json"
}

# 创建 Release
try {
    $releaseData = @{
        tag_name = $Tag
        name = $Tag
        body = $releaseNotes
        draft = $false
        prerelease = $true
    } | ConvertTo-Json -Depth 10
    
    Write-Host "正在创建 Release..." -ForegroundColor Yellow
    $release = Invoke-RestMethod -Uri $apiUrl `
        -Method Post `
        -Headers $headers `
        -Body $releaseData `
        -ContentType "application/json"
    
    Write-Host "✅ Release 创建成功！" -ForegroundColor Green
    Write-Host "Release URL: $($release.html_url)" -ForegroundColor Cyan
    
    # 上传文件
    Write-Host ""
    Write-Host "正在上传安装包..." -ForegroundColor Yellow
    
    # 上传 exe 文件
    $uploadUrl = $release.upload_url -replace '\{.*\}', "?name=gang-$version.exe"
    $fileBytes = [System.IO.File]::ReadAllBytes($exeFile)
    $boundary = [System.Guid]::NewGuid().ToString()
    $fileEnc = [System.Text.Encoding]::GetEncoding('ISO-8859-1').GetBytes($exeFile)
    
    $bodyLines = (
        "--$boundary",
        "Content-Disposition: form-data; name=`"file`"; filename=`"gang-$version.exe`"",
        "Content-Type: application/octet-stream",
        "",
        [System.Text.Encoding]::GetEncoding('ISO-8859-1').GetString($fileBytes),
        "--$boundary--"
    ) -join "`r`n"
    
    $uploadHeaders = @{
        "Authorization" = "token $env:GITHUB_TOKEN"
        "Accept" = "application/vnd.github.v3+json"
        "Content-Type" = "multipart/form-data; boundary=$boundary"
    }
    
    try {
        $uploadResponse = Invoke-RestMethod -Uri $uploadUrl `
            -Method Post `
            -Headers $uploadHeaders `
            -Body ([System.Text.Encoding]::GetEncoding('ISO-8859-1').GetBytes($bodyLines))
        
        Write-Host "✅ 安装包上传成功！" -ForegroundColor Green
        Write-Host "文件: $($uploadResponse.browser_download_url)" -ForegroundColor Cyan
    } catch {
        Write-Host "⚠️ 上传安装包失败: $($_.Exception.Message)" -ForegroundColor Yellow
        Write-Host "请手动上传文件: $exeFile" -ForegroundColor Yellow
    }
    
    # 上传 blockmap 文件（如果存在）
    if (Test-Path $blockmapFile) {
        Write-Host ""
        Write-Host "正在上传 blockmap 文件..." -ForegroundColor Yellow
        $blockmapUploadUrl = $release.upload_url -replace '\{.*\}', "?name=gang-$version.exe.blockmap"
        $blockmapBytes = [System.IO.File]::ReadAllBytes($blockmapFile)
        $blockmapBodyLines = (
            "--$boundary",
            "Content-Disposition: form-data; name=`"file`"; filename=`"gang-$version.exe.blockmap`"",
            "Content-Type: application/octet-stream",
            "",
            [System.Text.Encoding]::GetEncoding('ISO-8859-1').GetString($blockmapBytes),
            "--$boundary--"
        ) -join "`r`n"
        
        try {
            $blockmapUploadResponse = Invoke-RestMethod -Uri $blockmapUploadUrl `
                -Method Post `
                -Headers $uploadHeaders `
                -Body ([System.Text.Encoding]::GetEncoding('ISO-8859-1').GetBytes($blockmapBodyLines))
            
            Write-Host "✅ Blockmap 文件上传成功！" -ForegroundColor Green
        } catch {
            Write-Host "⚠️ 上传 blockmap 文件失败: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
    
    Write-Host ""
    Write-Host "🎉 Release 创建完成！" -ForegroundColor Green
    Write-Host "访问: $($release.html_url)" -ForegroundColor Cyan
    
} catch {
    Write-Host ""
    Write-Host "❌ 创建 Release 失败: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "错误详情: $responseBody" -ForegroundColor Yellow
    }
    Write-Host ""
    Write-Host "请检查:" -ForegroundColor Yellow
    Write-Host "1. Token 是否有效" -ForegroundColor Yellow
    Write-Host "2. Token 是否有 'repo' 权限" -ForegroundColor Yellow
    Write-Host "3. 网络连接是否正常" -ForegroundColor Yellow
    Write-Host "4. Tag $Tag 是否已存在" -ForegroundColor Yellow
}

