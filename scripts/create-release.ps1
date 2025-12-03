# 创建 GitHub Release 脚本
param(
    [string]$Tag = "v1.0.0",
    [string]$Title = "v1.0.0 - 第一个版本",
    [string]$NotesFile = "RELEASE_NOTES_v1.0.0.md"
)

$repo = "flystar233/Gang"
$apiUrl = "https://api.github.com/repos/$repo/releases"

# 读取 release notes
if (Test-Path $NotesFile) {
    $notes = Get-Content $NotesFile -Raw -Encoding UTF8
} else {
    Write-Host "错误: 找不到文件 $NotesFile"
    exit 1
}

# 构建 JSON 数据
$releaseData = @{
    tag_name = $Tag
    name = $Title
    body = $notes
    draft = $false
    prerelease = $false
} | ConvertTo-Json -Depth 10

# 检查是否已有 release
try {
    $existing = Invoke-RestMethod -Uri "$apiUrl/tags/$Tag" -Method Get -ErrorAction SilentlyContinue
    if ($existing) {
        Write-Host "Release $Tag 已存在: $($existing.html_url)"
        exit 0
    }
} catch {
    # Release 不存在，继续创建
}

# 提示输入 token
Write-Host "需要 GitHub Personal Access Token 来创建 Release"
Write-Host "如果没有 token，请访问: https://github.com/settings/tokens"
Write-Host "Token 需要 'repo' 权限"
Write-Host ""
$token = Read-Host "请输入您的 GitHub Personal Access Token (或按 Enter 跳过)"

if ([string]::IsNullOrWhiteSpace($token)) {
    Write-Host ""
    Write-Host "未提供 token，无法自动创建 Release"
    Write-Host ""
    Write-Host "请手动创建 Release:"
    Write-Host "1. 访问: https://github.com/$repo/releases/new"
    Write-Host "2. 选择 tag: $Tag"
    Write-Host "3. 标题: $Title"
    Write-Host "4. 描述: 复制 $NotesFile 文件内容"
    exit 0
}

# 创建 Release
try {
    $headers = @{
        "Authorization" = "token $token"
        "Accept" = "application/vnd.github.v3+json"
    }
    
    Write-Host "正在创建 Release..."
    $response = Invoke-RestMethod -Uri $apiUrl `
        -Method Post `
        -Headers $headers `
        -Body $releaseData `
        -ContentType "application/json"
    
    Write-Host ""
    Write-Host "✅ Release 创建成功！" -ForegroundColor Green
    Write-Host "Release URL: $($response.html_url)" -ForegroundColor Cyan
} catch {
    Write-Host ""
    Write-Host "❌ 创建 Release 失败: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "错误详情: $responseBody" -ForegroundColor Yellow
    }
    Write-Host ""
    Write-Host "请检查:"
    Write-Host "1. Token 是否有效"
    Write-Host "2. Token 是否有 'repo' 权限"
    Write-Host "3. 网络连接是否正常"
    Write-Host "4. Tag $Tag 是否已存在"
}


