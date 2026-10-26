param(
    [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
    [int]$TopTemplates = 10
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "metrics-html.ps1")

function Invoke-HugoCapture {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments,
        [Parameter(Mandatory = $true)]
        [string]$Root
    )

    Push-Location $Root
    $oldEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $output = & hugo @Arguments 2>&1 | ForEach-Object { "$_" }
        $text = ($output -join "`n")
        if ($LASTEXITCODE -ne 0) {
            throw "hugo failed (`$LASTEXITCODE=$LASTEXITCODE):`n$text"
        }
        return $text
    }
    finally {
        $ErrorActionPreference = $oldEap
        Pop-Location
    }
}

function Invoke-GitCapture {
    param([string[]]$Arguments, [string]$Root)

    $value = & git -C $Root @Arguments 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) {
        throw "git $($Arguments -join ' ') failed: $value"
    }
    return $value.Trim()
}

function Convert-DurationToMs {
    param([string]$Value)

    if ([string]::IsNullOrWhiteSpace($Value)) { return 0.0 }
    $v = $Value.Trim()

    if ($v -match "^([0-9]*\.?[0-9]+)ms$") {
        return [double]$Matches[1]
    }
    if ($v -match "^([0-9]*\.?[0-9]+)s$") {
        return [double]$Matches[1] * 1000.0
    }
    if ($v -match "^([0-9]*\.?[0-9]+)us$") {
        return [double]$Matches[1] / 1000.0
    }
    if ($v -match "^([0-9]*\.?[0-9]+)[^a-zA-Z0-9]s$") {
        return [double]$Matches[1] / 1000.0
    }

    return 0.0
}

function Parse-TotalBuildMs {
    param([string]$Output)

    if ($Output -match "Total in\s+([0-9]*\.?[0-9]+)\s*([^\s0-9]+)") {
        return [math]::Round((Convert-DurationToMs "$($Matches[1])$($Matches[2])"), 3)
    }

    return 0.0
}

function Parse-SiteCounts {
    param([string]$Output)

    $result = @{
        zhPages   = 0
        enPages   = 0
        zhNonPage = 0
        enNonPage = 0
        zhStatic  = 0
        enStatic  = 0
        zhAliases = 0
        enAliases = 0
    }

    $lines = $Output -split "`n"
    $map = @{
        "Pages"          = @("zhPages", "enPages")
        "Non-page files" = @("zhNonPage", "enNonPage")
        "Static files"   = @("zhStatic", "enStatic")
        "Aliases"        = @("zhAliases", "enAliases")
    }

    foreach ($label in $map.Keys) {
        $line = $lines | Where-Object { $_ -match ("^\s*" + [regex]::Escape($label) + "\s") } | Select-Object -First 1
        if ($line) {
            $nums = [regex]::Matches($line, "\d+") | ForEach-Object { [int]$_.Value }
            if ($nums.Count -ge 2) {
                $result[$map[$label][0]] = $nums[0]
                $result[$map[$label][1]] = $nums[1]
            }
        }
    }

    return $result
}

function Parse-TemplateMetrics {
    param(
        [string]$Output,
        [int]$TopN
    )

    $rows = @()
    $pattern = "^\s*(\S+)\s+(\S+)\s+(\S+)\s+([0-9]+)\s+([0-9]+)\s+([0-9]+)\s+([0-9]+)\s+(.+)$"

    foreach ($line in ($Output -split "`n")) {
        if ($line -match $pattern) {
            $rows += [pscustomobject]@{
                template       = $Matches[8].Trim()
                cumulativeMs   = [math]::Round((Convert-DurationToMs $Matches[1]), 3)
                averageMs      = [math]::Round((Convert-DurationToMs $Matches[2]), 3)
                maxMs          = [math]::Round((Convert-DurationToMs $Matches[3]), 3)
                cachePotential = [int]$Matches[4]
                percentCached  = [int]$Matches[5]
                cachedCount    = [int]$Matches[6]
                totalCount     = [int]$Matches[7]
            }
        }
    }

    $top = $rows | Sort-Object cumulativeMs -Descending | Select-Object -First $TopN
    $cachedSum = ($rows | Measure-Object -Property cachedCount -Sum).Sum
    $totalSum = ($rows | Measure-Object -Property totalCount -Sum).Sum

    if (-not $cachedSum) { $cachedSum = 0 }
    if (-not $totalSum) { $totalSum = 0 }

    $ratio = if ($totalSum -gt 0) {
        [math]::Round(($cachedSum * 100.0) / $totalSum, 2)
    } else {
        0.0
    }

    return @{
        top                  = @($top)
        totalTemplatesParsed = $rows.Count
        aggregateCached      = [int]$cachedSum
        aggregateCalls       = [int]$totalSum
        aggregateCacheRatio  = $ratio
    }
}

function Parse-UnusedTemplates {
    param([string]$Output)

    $unused = @()
    foreach ($line in ($Output -split "`n")) {
        if ($line -match "WARN\s+Template\s+(.+?)\s+is unused") {
            $unused += $Matches[1].Trim()
        }
    }

    return @($unused | Sort-Object -Unique)
}

function Get-HrefValues {
    param([string]$Html)

    $values = New-Object System.Collections.Generic.List[string]

    foreach ($m in [regex]::Matches($Html, 'href\s*=\s*["'']([^"'']+)["'']', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
        $values.Add($m.Groups[1].Value)
    }
    foreach ($m in [regex]::Matches($Html, 'href\s*=\s*([^"''\s>]+)', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
        $values.Add($m.Groups[1].Value)
    }

    return @($values | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Sort-Object -Unique)
}

function Get-RootRelativeTargetPath {
    param(
        [string]$Href,
        [string]$DestRoot
    )

    $trimmed = $Href.Split("#")[0].Split("?")[0]
    if (-not $trimmed.StartsWith("/")) { return $null }

    if ($trimmed -eq "/") {
        return Join-Path $DestRoot "index.html"
    }

    $rel = $trimmed.TrimStart("/") -replace "/", [IO.Path]::DirectorySeparatorChar
    if ($trimmed.EndsWith("/")) {
        return Join-Path (Join-Path $DestRoot $rel) "index.html"
    }

    $candidate = Join-Path $DestRoot $rel
    if ([IO.Path]::GetExtension($candidate)) {
        return $candidate
    }

    return Join-Path $candidate "index.html"
}

function Analyze-BuiltHtml {
    param([string]$DestRoot)

    $htmlFiles = Get-ChildItem -Path $DestRoot -Recurse -File -Filter "*.html"

    $missingCanonical = 0
    $missingLang = 0
    $missingXDefault = 0
    $brokenLinks = New-Object System.Collections.Generic.List[object]
    $assetSizes = @{}
    $pageBundles = @{ maxCssBytes = [int64]0; maxJsBytes = [int64]0; cssPage = ""; jsPage = "" }

    foreach ($file in $htmlFiles) {
        $raw = Get-Content -Raw -Path $file.FullName

        $pageAssets = @{}
        foreach ($tag in [regex]::Matches($raw, '<(?:link|script)\b[^>]*>', 'IgnoreCase')) {
            $attribute = [regex]::Match($tag.Value, '(?:href|src)\s*=\s*(?:"([^"]*)"|''([^'']*)''|([^\s>]+))', 'IgnoreCase')
            if (-not $attribute.Success) { continue }
            $assetPath = ($attribute.Groups[1].Value + $attribute.Groups[2].Value + $attribute.Groups[3].Value) -replace '[?#].*$', ''
            if ($assetPath -notmatch '^/(css|js)/') { continue }
            if (-not $assetSizes.ContainsKey($assetPath)) {
                $assetSizes[$assetPath] = (Get-Item -LiteralPath (Join-Path $DestRoot $assetPath.TrimStart('/'))).Length
            }
            $pageAssets[$assetPath] = $assetSizes[$assetPath]
        }
        foreach ($kind in @('css', 'js')) {
            $bytes = [int64]0
            foreach ($assetPath in $pageAssets.Keys) {
                if ($assetPath.StartsWith("/$kind/")) { $bytes += $pageAssets[$assetPath] }
            }
            $key = if ($kind -eq 'css') { 'maxCssBytes' } else { 'maxJsBytes' }
            if ($bytes -gt $pageBundles[$key]) {
                $pageBundles[$key] = $bytes
                $pageBundles["${kind}Page"] = $file.FullName.Substring($DestRoot.Length).TrimStart('\', '/') -replace '\\', '/'
            }
        }

        if ($raw -notmatch 'rel\s*=\s*["'']?canonical["'']?') {
            $missingCanonical++
        }
        if ($raw -notmatch "<html[^>]*\blang\s*=") {
            $missingLang++
        }
        if (($raw -match "hreflang\s*=") -and ($raw -notmatch 'hreflang\s*=\s*["'']?x-default["'']?')) {
            $missingXDefault++
        }

        foreach ($href in (Get-HrefValues $raw)) {
            if (
                $href.StartsWith("#") -or
                $href.StartsWith("mailto:", [System.StringComparison]::OrdinalIgnoreCase) -or
                $href.StartsWith("tel:", [System.StringComparison]::OrdinalIgnoreCase) -or
                $href.StartsWith("javascript:", [System.StringComparison]::OrdinalIgnoreCase) -or
                $href.StartsWith("data:", [System.StringComparison]::OrdinalIgnoreCase) -or
                $href.StartsWith("http://", [System.StringComparison]::OrdinalIgnoreCase) -or
                $href.StartsWith("https://", [System.StringComparison]::OrdinalIgnoreCase)
            ) {
                continue
            }

            $target = Get-RootRelativeTargetPath -Href $href -DestRoot $DestRoot
            if ($null -eq $target) { continue }

            if (-not (Test-Path -Path $target -PathType Leaf)) {
                $brokenLinks.Add([pscustomobject]@{
                    page = $file.FullName.Substring($DestRoot.Length).TrimStart('\', '/')
                    href = $href
                })
            }
        }
    }

    $cssBundle = Get-ChildItem -Path (Join-Path $DestRoot "css") -Filter "bundle*.css" -File -ErrorAction SilentlyContinue | Select-Object -First 1
    $cssBytes = if ($cssBundle) { [int64]$cssBundle.Length } else { 0 }
    $jsBundle = Get-ChildItem -LiteralPath (Join-Path $DestRoot "js") -Filter "main*.js" -File | Select-Object -First 1
    $jsBytes = if ($jsBundle) { [int64]$jsBundle.Length } else { 0 }

    $homeFile = Join-Path $DestRoot "index.html"
    $homeExternalHosts = @()
    if (Test-Path $homeFile) {
        $homeHtml = Get-Content -Raw -Path $homeFile
        $urls = @()

        foreach ($m in [regex]::Matches($homeHtml, '(?:href|src)\s*=\s*["''](https?://[^"'']+)["'']', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
            $urls += $m.Groups[1].Value
        }
        foreach ($m in [regex]::Matches($homeHtml, "(?:href|src)\s*=\s*(https?://[^\s>]+)", [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
            $urls += $m.Groups[1].Value
        }

        $homeExternalHosts = @(
            $urls |
            ForEach-Object {
                try { ([uri]$_).Host } catch { $null }
            } |
            Where-Object { $_ } |
            Sort-Object -Unique
        )
    }

    return @{
        htmlFiles                    = $htmlFiles.Count
        missingCanonical             = $missingCanonical
        missingHtmlLang              = $missingLang
        missingXDefaultForAlternates = $missingXDefault
        brokenRootRelativeLinkCount  = $brokenLinks.Count
        brokenRootRelativeLinkTop    = @($brokenLinks | Select-Object -First 20)
        cssBundleBytes               = $cssBytes
        jsBundleBytes                = $jsBytes
        pageBundles                  = $pageBundles
        homeExternalHosts            = @($homeExternalHosts)
    }
}

function New-Delta {
    param(
        $Current,
        $Previous
    )

    if ($null -eq $Previous) {
        return @{
            hasBaseline = $false
        }
    }

    return @{
        hasBaseline             = $true
        buildMsDelta            = [math]::Round(($Current.build.totalMs - $Previous.build.totalMs), 3)
        brokenLinksDelta        = ($Current.quality.brokenRootRelativeLinkCount - $Previous.quality.brokenRootRelativeLinkCount)
        missingCanonicalDelta   = ($Current.quality.missingCanonical - $Previous.quality.missingCanonical)
        templateCacheRatioDelta = [math]::Round(($Current.templates.aggregateCacheRatio - $Previous.templates.aggregateCacheRatio), 3)
    }
}

function Get-HistorySeries {
    param(
        [string]$HistoryDir,
        [string]$TimelinePath,
        [int]$Limit = 30
    )

    $files = Get-ChildItem -Path $HistoryDir -Filter "*.json" -File -ErrorAction SilentlyContinue |
        Sort-Object Name

    $series = @{}
    if (Test-Path -LiteralPath $TimelinePath) {
        foreach ($point in (Get-Content -Raw -LiteralPath $TimelinePath | ConvertFrom-Json)) {
            $series[$point.stamp] = $point
        }
    }
    foreach ($file in $files) {
        try {
            $item = Get-Content -Raw -Path $file.FullName | ConvertFrom-Json
        }
        catch {
            continue
        }

        $stamp = $file.BaseName
        $label = $stamp
        if ($stamp -match "^\d{8}-(\d{2})(\d{2})(\d{2})$") {
            $label = "$($Matches[1]):$($Matches[2]):$($Matches[3])"
        }

        $buildMs = 0.0
        $cacheRatio = 0.0
        $brokenLinks = 0
        $zhPages = 0
        $enPages = 0
        $commit = "unknown"
        try { $buildMs = [double]$item.build.totalMs } catch {}
        try { $cacheRatio = [double]$item.templates.aggregateCacheRatio } catch {}
        try { $brokenLinks = [int]$item.quality.brokenRootRelativeLinkCount } catch {}
        try { $zhPages = [int]$item.build.zhPages } catch {}
        try { $enPages = [int]$item.build.enPages } catch {}
        try { $commit = [string]$item.git.commit } catch {}
        if ($buildMs -le 0) {
            continue
        }

        $series[$stamp] = [pscustomobject]@{
            stamp       = $stamp
            label       = $label
            buildMs     = [math]::Round($buildMs, 3)
            cacheRatio  = [math]::Round($cacheRatio, 3)
            brokenLinks = $brokenLinks
            zhPages     = $zhPages
            enPages     = $enPages
            commit      = $commit
        }
    }

    return @($series.Values | Sort-Object stamp | Select-Object -Last $Limit)
}

$reportsDir = Join-Path $ProjectRoot "reports\metrics"
$historyDir = Join-Path $reportsDir "history"
$assetAuditJsonPath = Join-Path $reportsDir "public-assets.json"
New-Item -ItemType Directory -Path $reportsDir -Force | Out-Null
New-Item -ItemType Directory -Path $historyDir -Force | Out-Null

$gitContext = @{
    commit = Invoke-GitCapture -Arguments @("rev-parse", "--short", "HEAD") -Root $ProjectRoot
    branch = Invoke-GitCapture -Arguments @("rev-parse", "--abbrev-ref", "HEAD") -Root $ProjectRoot
    dirty = -not [string]::IsNullOrWhiteSpace((Invoke-GitCapture -Arguments @("status", "--porcelain", "--untracked-files=no") -Root $ProjectRoot))
}

$templateOutput = Invoke-HugoCapture -Arguments @("--templateMetrics", "--templateMetricsHints", "--renderToMemory") -Root $ProjectRoot
$unusedOutput = Invoke-HugoCapture -Arguments @("--printUnusedTemplates", "--renderToMemory") -Root $ProjectRoot

$tempDest = Join-Path $env:TEMP ("aki-liu-metrics-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $tempDest -Force | Out-Null

try {
    $buildOutput = Invoke-HugoCapture -Arguments @("--gc", "--minify", "--destination", $tempDest) -Root $ProjectRoot
    $quality = Analyze-BuiltHtml -DestRoot $tempDest
    & (Join-Path $ProjectRoot "scripts\public-asset-audit.ps1") -PublicDir $tempDest -JsonOut $assetAuditJsonPath -Quiet
}
finally {
    if (Test-Path $tempDest) {
        Remove-Item -Path $tempDest -Recurse -Force
    }
}

$siteCounts = Parse-SiteCounts -Output $buildOutput
$templateMetrics = Parse-TemplateMetrics -Output $templateOutput -TopN $TopTemplates
$unusedTemplates = Parse-UnusedTemplates -Output $unusedOutput

$metrics = @{
    generatedAt     = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssK")
    hugoVersion     = (& hugo version) -replace '^hugo (v[0-9]+\.[0-9]+\.[0-9]+).*', '$1'
    git             = $gitContext
    measurement     = @{
        scope = "local-production-build"
        platform = [System.Environment]::OSVersion.Platform.ToString()
        cache = "existing-resource-cache"
        buildArgs = @("--gc", "--minify")
        templateArgs = @("--templateMetrics", "--templateMetricsHints", "--renderToMemory")
        assetScope = "largest per-page /css/ and /js/ bundles; excludes fonts and vendor libraries"
    }
    build           = @{
        totalMs   = Parse-TotalBuildMs -Output $buildOutput
        zhPages   = $siteCounts.zhPages
        enPages   = $siteCounts.enPages
        zhNonPage = $siteCounts.zhNonPage
        enNonPage = $siteCounts.enNonPage
        zhStatic  = $siteCounts.zhStatic
        enStatic  = $siteCounts.enStatic
        zhAliases = $siteCounts.zhAliases
        enAliases = $siteCounts.enAliases
    }
    templates       = $templateMetrics
    unusedTemplates = @($unusedTemplates)
    quality         = $quality
}

$latestJsonPath = Join-Path $reportsDir "latest.json"
$latestHtmlPath = Join-Path $reportsDir "latest.html"

$previous = $null
if (Test-Path $latestJsonPath) {
    try {
        # Keep compatibility with Windows PowerShell, which lacks -AsHashtable.
        $previous = Get-Content -Raw $latestJsonPath | ConvertFrom-Json
    }
    catch {
        $previous = $null
    }
}

$delta = New-Delta -Current $metrics -Previous $previous

$json = $metrics | ConvertTo-Json -Depth 8
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($latestJsonPath, $json, $utf8NoBom)

$stamp = (Get-Date).ToString("yyyyMMdd-HHmmss")
$historyJsonPath = Join-Path $historyDir "$stamp.json"
[System.IO.File]::WriteAllText($historyJsonPath, $json, $utf8NoBom)

$historyPoints = Get-HistorySeries -HistoryDir $historyDir -TimelinePath (Join-Path $ProjectRoot "data\metrics\history_timeline.json") -Limit 30
Write-ReportHtml -Metrics $metrics -Delta $delta -Path $latestHtmlPath -HistoryPoints $historyPoints

# Direct Hugo-accessible static data feeding
$dataMetricsDir = Join-Path $ProjectRoot "data\metrics"
New-Item -ItemType Directory -Path $dataMetricsDir -Force | Out-Null

$dataLatestJsonPath = Join-Path $dataMetricsDir "latest.json"
$dataHistoryJsonPath = Join-Path $dataMetricsDir "history_timeline.json"

[System.IO.File]::WriteAllText($dataLatestJsonPath, $json, $utf8NoBom)
$historyJson = ConvertTo-Json -InputObject @($historyPoints) -Depth 8
[System.IO.File]::WriteAllText($dataHistoryJsonPath, $historyJson, $utf8NoBom)

Write-Host "Metrics report generated:"
Write-Host "  JSON        $latestJsonPath"
Write-Host "  HTML        $latestHtmlPath"
Write-Host "  Asset audit $assetAuditJsonPath"
Write-Host "  History     $historyJsonPath"
Write-Host "  Hugo latest $dataLatestJsonPath"
Write-Host "  Hugo series $dataHistoryJsonPath"
Write-Host ""
Write-Host "Summary:"
Write-Host "  Build total: $($metrics.build.totalMs) ms"
Write-Host "  Broken root-relative links: $($metrics.quality.brokenRootRelativeLinkCount)"
Write-Host "  Missing canonical: $($metrics.quality.missingCanonical)"
Write-Host "  Template cache ratio: $($metrics.templates.aggregateCacheRatio)%"
