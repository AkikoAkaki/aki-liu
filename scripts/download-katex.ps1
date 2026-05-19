# download-katex.ps1
# Automates the self-hosting of KaTeX assets to achieve fully localized, CDN-free math rendering.

$baseDir = "static/lib/katex"
$fontsDir = "$baseDir/fonts"

# 1. Create directory paths
if (!(Test-Path $fontsDir)) {
    New-Item -ItemType Directory -Force -Path $fontsDir | Out-Null
    Write-Host "Created local KaTeX directories." -ForegroundColor Green
}

$cdnBase = "https://cdn.jsdelivr.net/npm/katex@0.16.8/dist"

# 2. Files to download
$coreFiles = @(
    @{ Url = "$cdnBase/katex.min.css"; Out = "$baseDir/katex.min.css" },
    @{ Url = "$cdnBase/katex.min.js"; Out = "$baseDir/katex.min.js" },
    @{ Url = "$cdnBase/contrib/auto-render.min.js"; Out = "$baseDir/auto-render.min.js" }
)

# 3. Brotli-compressed WOFF2 Fonts list
$fonts = @(
    "KaTeX_AMS-Regular.woff2",
    "KaTeX_Caligraphic-Bold.woff2",
    "KaTeX_Caligraphic-Regular.woff2",
    "KaTeX_Fraktur-Bold.woff2",
    "KaTeX_Fraktur-Regular.woff2",
    "KaTeX_Main-Bold.woff2",
    "KaTeX_Main-BoldItalic.woff2",
    "KaTeX_Main-Italic.woff2",
    "KaTeX_Main-Regular.woff2",
    "KaTeX_Math-BoldItalic.woff2",
    "KaTeX_Math-Italic.woff2",
    "KaTeX_SansSerif-Bold.woff2",
    "KaTeX_SansSerif-Italic.woff2",
    "KaTeX_SansSerif-Regular.woff2",
    "KaTeX_Script-Regular.woff2",
    "KaTeX_Size1-Regular.woff2",
    "KaTeX_Size2-Regular.woff2",
    "KaTeX_Size3-Regular.woff2",
    "KaTeX_Size4-Regular.woff2",
    "KaTeX_Typewriter-Regular.woff2"
)

Write-Host "Starting downloading KaTeX core stylesheets and scripts..." -ForegroundColor Cyan

# Download JS / CSS
foreach ($file in $coreFiles) {
    Write-Host "Downloading $($file.Url) -> $($file.Out)" -ForegroundColor Gray
    try {
        Invoke-WebRequest -Uri $file.Url -OutFile $file.Out -UseBasicParsing
    } catch {
        Write-Error "Failed to download $($file.Url)"
    }
}

Write-Host "Downloading Brotli WOFF2 mathematical fonts..." -ForegroundColor Cyan

# Download Fonts
foreach ($font in $fonts) {
    $fontUrl = "$cdnBase/fonts/$font"
    $fontOut = "$fontsDir/$font"
    Write-Host "Downloading $fontUrl -> $fontOut" -ForegroundColor Gray
    try {
        Invoke-WebRequest -Uri $fontUrl -OutFile $fontOut -UseBasicParsing
    } catch {
        Write-Error "Failed to download $font"
    }
}

Write-Host "KaTeX assets localization completed successfully!" -ForegroundColor Green
