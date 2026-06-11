param(
    [string]$PublicDir = (Join-Path (Resolve-Path (Join-Path $PSScriptRoot "..")).Path "public"),
    [string]$JsonOut = "",
    [int]$TopFiles = 30,
    [int]$TopImages = 30,
    [switch]$Quiet
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Format-Bytes {
    param([int64]$Bytes)

    if ($Bytes -ge 1GB) {
        return "{0:N2} GB" -f ($Bytes / 1GB)
    }
    if ($Bytes -ge 1MB) {
        return "{0:N2} MB" -f ($Bytes / 1MB)
    }
    if ($Bytes -ge 1KB) {
        return "{0:N2} KB" -f ($Bytes / 1KB)
    }

    return "$Bytes B"
}

function Get-RelativePath {
    param(
        [string]$Root,
        [string]$Path
    )

    $rootFull = [System.IO.Path]::GetFullPath($Root)
    if (-not $rootFull.EndsWith([System.IO.Path]::DirectorySeparatorChar)) {
        $rootFull += [System.IO.Path]::DirectorySeparatorChar
    }

    $rootUri = New-Object System.Uri($rootFull)
    $pathUri = New-Object System.Uri([System.IO.Path]::GetFullPath($Path))
    $relative = [System.Uri]::UnescapeDataString($rootUri.MakeRelativeUri($pathUri).ToString())

    return $relative -replace "/", [System.IO.Path]::DirectorySeparatorChar
}

function Convert-ToReportPath {
    param([string]$Path)

    return $Path -replace "\\", "/"
}

function New-FileRecord {
    param(
        [System.IO.FileInfo]$File,
        [string]$Root
    )

    $relative = Get-RelativePath -Root $Root -Path $File.FullName

    return [pscustomobject]@{
        path      = Convert-ToReportPath $relative
        bytes     = [int64]$File.Length
        size      = Format-Bytes ([int64]$File.Length)
        extension = $File.Extension.ToLowerInvariant()
    }
}

function Get-TotalLength {
    param([object[]]$Files)

    $sum = ($Files | Measure-Object -Property Length -Sum).Sum
    if ($null -eq $sum) {
        return [int64]0
    }

    return [int64]$sum
}

function Get-LanguageFromPath {
    param([string]$Path)

    $parts = $Path -split "[/\\]"
    if ($parts.Count -gt 0 -and $parts[0] -eq "en") {
        return "en"
    }

    return "zh"
}

function Write-FileRows {
    param(
        [string]$Title,
        [object[]]$Rows
    )

    Write-Host ""
    Write-Host $Title

    if ($Rows.Count -eq 0) {
        Write-Host "  (none)"
        return
    }

    $index = 1
    foreach ($row in $Rows) {
        Write-Host ("  {0,2}. {1,10}  {2}" -f $index, $row.size, $row.path)
        $index++
    }
}

if (-not (Test-Path -Path $PublicDir -PathType Container)) {
    throw "Public directory not found: $PublicDir"
}
$resolvedPublicDir = (Resolve-Path $PublicDir).Path

$files = @(Get-ChildItem -Path $resolvedPublicDir -Recurse -File -Force)
$imageExtensions = @(".avif", ".bmp", ".gif", ".ico", ".jpg", ".jpeg", ".png", ".svg", ".tif", ".tiff", ".webp")

$imageFiles = @($files | Where-Object { $imageExtensions -contains $_.Extension.ToLowerInvariant() })
$cssFiles = @($files | Where-Object { $_.Extension -ieq ".css" })
$jsFiles = @($files | Where-Object { $_.Extension -ieq ".js" })
$htmlFiles = @($files | Where-Object { $_.Extension -ieq ".html" })
$searchIndexFiles = @(
    $files |
        Where-Object { $_.Extension -ieq ".json" -and $_.BaseName -match "^search[-_]?index$" } |
        Sort-Object FullName
)

$topFilesRows = @(
    $files |
        Sort-Object Length -Descending |
        Select-Object -First $TopFiles |
        ForEach-Object { New-FileRecord -File $_ -Root $resolvedPublicDir }
)

$largestImageRows = @(
    $imageFiles |
        Sort-Object Length -Descending |
        Select-Object -First $TopImages |
        ForEach-Object { New-FileRecord -File $_ -Root $resolvedPublicDir }
)

$cssRows = @(
    $cssFiles |
        Sort-Object Length -Descending |
        ForEach-Object { New-FileRecord -File $_ -Root $resolvedPublicDir }
)

$jsRows = @(
    $jsFiles |
        Sort-Object Length -Descending |
        ForEach-Object { New-FileRecord -File $_ -Root $resolvedPublicDir }
)

$htmlRows = @(
    $htmlFiles |
        Sort-Object Length -Descending |
        Select-Object -First $TopFiles |
        ForEach-Object { New-FileRecord -File $_ -Root $resolvedPublicDir }
)

$searchIndexRows = @(
    $searchIndexFiles |
        ForEach-Object {
            $record = New-FileRecord -File $_ -Root $resolvedPublicDir
            [pscustomobject]@{
                language = Get-LanguageFromPath $record.path
                path     = $record.path
                bytes    = $record.bytes
                size     = $record.size
            }
        }
)

$searchIndexesByLanguage = @()
foreach ($group in ($searchIndexRows | Group-Object language | Sort-Object Name)) {
    $sum = ($group.Group | Measure-Object -Property bytes -Sum).Sum
    if ($null -eq $sum) { $sum = 0 }

    $searchIndexesByLanguage += [pscustomobject]@{
        language = $group.Name
        bytes    = [int64]$sum
        size     = Format-Bytes ([int64]$sum)
        files    = @($group.Group)
    }
}

$totalBytes = Get-TotalLength -Files $files
$imageBytes = Get-TotalLength -Files $imageFiles
$cssBytes = Get-TotalLength -Files $cssFiles
$jsBytes = Get-TotalLength -Files $jsFiles
$htmlBytes = Get-TotalLength -Files $htmlFiles

$audit = [pscustomobject]@{
    generatedAt = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssK")
    publicDir   = $resolvedPublicDir
    totals      = [pscustomobject]@{
        files = $files.Count
        bytes = $totalBytes
        size  = Format-Bytes $totalBytes
    }
    images      = [pscustomobject]@{
        files   = $imageFiles.Count
        bytes   = $imageBytes
        size    = Format-Bytes $imageBytes
        largest = @($largestImageRows)
    }
    css         = [pscustomobject]@{
        files   = $cssFiles.Count
        bytes   = $cssBytes
        size    = Format-Bytes $cssBytes
        bundles = @($cssRows)
    }
    js          = [pscustomobject]@{
        files   = $jsFiles.Count
        bytes   = $jsBytes
        size    = Format-Bytes $jsBytes
        bundles = @($jsRows)
    }
    html        = [pscustomobject]@{
        files         = $htmlFiles.Count
        bytes         = $htmlBytes
        size          = Format-Bytes $htmlBytes
        largestRoutes = @($htmlRows)
    }
    searchIndex = @($searchIndexesByLanguage)
    topFiles    = @($topFilesRows)
}

if (-not $Quiet) {
    Write-Host "Public asset audit"
    Write-Host ("  Directory:      {0}" -f $resolvedPublicDir)
    Write-Host ("  Total files:    {0}" -f $audit.totals.files)
    Write-Host ("  Total size:     {0} ({1} bytes)" -f $audit.totals.size, $audit.totals.bytes)
    Write-Host ("  Image size:     {0} ({1} files)" -f $audit.images.size, $audit.images.files)
    Write-Host ("  CSS size:       {0} ({1} files)" -f $audit.css.size, $audit.css.files)
    Write-Host ("  JS size:        {0} ({1} files)" -f $audit.js.size, $audit.js.files)
    Write-Host ("  HTML size:      {0} ({1} files)" -f $audit.html.size, $audit.html.files)

    Write-Host ""
    Write-Host "Search indexes"
    if ($audit.searchIndex.Count -eq 0) {
        Write-Host "  (none)"
    } else {
        foreach ($language in $audit.searchIndex) {
            Write-Host ("  {0}: {1} ({2} bytes)" -f $language.language, $language.size, $language.bytes)
            foreach ($file in $language.files) {
                Write-Host ("      {0,10}  {1}" -f $file.size, $file.path)
            }
        }
    }

    Write-FileRows -Title "CSS bundles" -Rows $audit.css.bundles
    Write-FileRows -Title "JS bundles" -Rows $audit.js.bundles
    Write-FileRows -Title "Largest HTML routes" -Rows $audit.html.largestRoutes
    Write-FileRows -Title "Top largest files" -Rows $audit.topFiles
    Write-FileRows -Title "Largest images" -Rows $audit.images.largest
}

if (-not [string]::IsNullOrWhiteSpace($JsonOut)) {
    $jsonPath = $JsonOut
    if (-not [System.IO.Path]::IsPathRooted($jsonPath)) {
        $jsonPath = Join-Path (Get-Location).Path $jsonPath
    }

    $jsonDir = Split-Path -Parent $jsonPath
    if (-not [string]::IsNullOrWhiteSpace($jsonDir)) {
        New-Item -ItemType Directory -Path $jsonDir -Force | Out-Null
    }

    $json = $audit | ConvertTo-Json -Depth 8
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($jsonPath, $json, $utf8NoBom)

    if (-not $Quiet) {
        Write-Host ""
        Write-Host ("JSON written: {0}" -f $jsonPath)
    }
}
