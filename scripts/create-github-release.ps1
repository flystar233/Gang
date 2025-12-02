# Create GitHub Release and upload build artifacts
param(
    [string]$Tag = "v1.0.1-beta.3",
    [string]$Repo = "flystar233/Gang"
)

$apiUrl = "https://api.github.com/repos/$Repo/releases"
$distDir = "dist"
$version = $Tag.Replace('v', '')
$exeFile = "$distDir\gang-$version.exe"
$blockmapFile = "$exeFile.blockmap"

# Token config file path (in user home directory)
$tokenFile = Join-Path $env:USERPROFILE ".github_release_token"

# Function to load token from file
function Get-SavedToken {
    if (Test-Path $tokenFile) {
        return Get-Content $tokenFile -Raw -ErrorAction SilentlyContinue
    }
    return $null
}

# Function to save token to file
function Save-Token {
    param([string]$Token)
    $Token | Out-File -FilePath $tokenFile -Encoding UTF8 -NoNewline
    Write-Host "Token saved to: $tokenFile" -ForegroundColor Green
}

# Check if file exists
if (-not (Test-Path $exeFile)) {
    Write-Host "Error: File not found $exeFile" -ForegroundColor Red
    Write-Host "Please run: pnpm build" -ForegroundColor Yellow
    exit 1
}

# Read CHANGELOG for release notes
$changelog = Get-Content "CHANGELOG.md" -Raw -Encoding UTF8
$changelogPattern = "(?s)### \[$version\].*?(?=### \[|$)"
if ($changelog -match $changelogPattern) {
    $releaseNotes = $matches[0].Trim()
}
else {
    $releaseNotes = "Release $Tag"
}

# Check if release already exists
try {
    $existing = Invoke-RestMethod -Uri "$apiUrl/tags/$Tag" -Method Get -ErrorAction SilentlyContinue
    if ($existing) {
        Write-Host "Release $Tag already exists: $($existing.html_url)" -ForegroundColor Yellow
        exit 0
    }
}
catch {
    # Release does not exist, continue
}

# Get token: env var > saved file > prompt
if (-not $env:GITHUB_TOKEN) {
    $savedToken = Get-SavedToken
    if ($savedToken) {
        $env:GITHUB_TOKEN = $savedToken.Trim()
        Write-Host "Using saved token from: $tokenFile" -ForegroundColor Green
    }
    else {
        Write-Host "GitHub Personal Access Token required" -ForegroundColor Yellow
        Write-Host "Get one at: https://github.com/settings/tokens" -ForegroundColor Yellow
        Write-Host "Token needs 'repo' permission" -ForegroundColor Yellow
        Write-Host ""
        $token = Read-Host "Enter your GitHub Personal Access Token (or press Enter to skip)"
        if ([string]::IsNullOrWhiteSpace($token)) {
            Write-Host ""
            Write-Host "No token provided, cannot create Release" -ForegroundColor Red
            Write-Host ""
            Write-Host "Please create Release manually:" -ForegroundColor Yellow
            Write-Host "1. Visit: https://github.com/$Repo/releases/new" -ForegroundColor Cyan
            Write-Host "2. Select tag: $Tag" -ForegroundColor Cyan
            Write-Host "3. Title: $Tag" -ForegroundColor Cyan
            Write-Host "4. Description: Copy from CHANGELOG.md" -ForegroundColor Cyan
            Write-Host "5. Upload file: $exeFile" -ForegroundColor Cyan
            exit 0
        }
        $env:GITHUB_TOKEN = $token
        
        # Ask if user wants to save token
        $saveChoice = Read-Host "Save token for future use? (y/N)"
        if ($saveChoice -eq 'y' -or $saveChoice -eq 'Y') {
            Save-Token -Token $token
        }
    }
}

$headers = @{
    "Authorization" = "token $env:GITHUB_TOKEN"
    "Accept"        = "application/vnd.github.v3+json"
}

# Create Release
try {
    $releaseData = @{
        tag_name   = $Tag
        name       = $Tag
        body       = $releaseNotes
        draft      = $false
        prerelease = $Tag -match "beta|alpha|rc"
    } | ConvertTo-Json -Depth 10

    Write-Host "Creating Release..." -ForegroundColor Yellow
    $release = Invoke-RestMethod -Uri $apiUrl -Method Post -Headers $headers -Body $releaseData -ContentType "application/json"

    Write-Host "Release created successfully!" -ForegroundColor Green
    Write-Host "Release URL: $($release.html_url)" -ForegroundColor Cyan

    # Upload exe file
    Write-Host ""
    Write-Host "Uploading installer..." -ForegroundColor Yellow

    $uploadUrl = $release.upload_url -replace '\{.*\}', ''
    $uploadUrl = "$uploadUrl`?name=gang-$version.exe"

    $fileBytes = [System.IO.File]::ReadAllBytes((Resolve-Path $exeFile).Path)

    $uploadHeaders = @{
        "Authorization" = "token $env:GITHUB_TOKEN"
        "Content-Type"  = "application/octet-stream"
    }

    $uploadResponse = Invoke-RestMethod -Uri $uploadUrl -Method Post -Headers $uploadHeaders -Body $fileBytes
    Write-Host "Installer uploaded successfully!" -ForegroundColor Green
    Write-Host "Download: $($uploadResponse.browser_download_url)" -ForegroundColor Cyan

    # Upload blockmap file if exists
    if (Test-Path $blockmapFile) {
        Write-Host ""
        Write-Host "Uploading blockmap file..." -ForegroundColor Yellow

        $blockmapUploadUrl = $release.upload_url -replace '\{.*\}', ''
        $blockmapUploadUrl = "$blockmapUploadUrl`?name=gang-$version.exe.blockmap"

        $blockmapBytes = [System.IO.File]::ReadAllBytes((Resolve-Path $blockmapFile).Path)
        $blockmapResponse = Invoke-RestMethod -Uri $blockmapUploadUrl -Method Post -Headers $uploadHeaders -Body $blockmapBytes
        Write-Host "Blockmap uploaded successfully!" -ForegroundColor Green
    }

    Write-Host ""
    Write-Host "Release completed!" -ForegroundColor Green
    Write-Host "Visit: $($release.html_url)" -ForegroundColor Cyan
}
catch {
    Write-Host ""
    Write-Host "Failed to create Release: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        try {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            Write-Host "Error details: $responseBody" -ForegroundColor Yellow
        }
        catch {
            # Ignore read error
        }
    }
    Write-Host ""
    Write-Host "Please check:" -ForegroundColor Yellow
    Write-Host "1. Token is valid" -ForegroundColor Yellow
    Write-Host "2. Token has 'repo' permission" -ForegroundColor Yellow
    Write-Host "3. Network connection is working" -ForegroundColor Yellow
    Write-Host "4. Tag $Tag exists" -ForegroundColor Yellow
    exit 1
}
