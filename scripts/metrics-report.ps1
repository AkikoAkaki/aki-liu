param(
    [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
    [int]$TopTemplates = 10
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

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
    if ($v -match "^([0-9]*\.?[0-9]+)ns$") {
        return [double]$Matches[1] / 1000000.0
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

function Get-HtmlAttribute {
    param([string]$Tag, [string]$Name)

    $pattern = '(?<![\w:-])' + [regex]::Escape($Name) + '\s*=\s*(?:"([^"]*)"|''([^'']*)''|([^\s>]+))'
    $match = [regex]::Match($Tag, $pattern, 'IgnoreCase')
    return [System.Net.WebUtility]::HtmlDecode($match.Groups[1].Value + $match.Groups[2].Value + $match.Groups[3].Value)
}

function Get-LocalTargetPath {
    param([string]$Reference, [string]$PagePath, [string]$DestRoot)

    if ([string]::IsNullOrWhiteSpace($Reference)) { return $null }
    $Reference = $Reference.Trim()
    if ($Reference -match '^(?:[#?]|//|[a-z][a-z0-9+.-]*:)') {
        return $null
    }

    $page = $PagePath.Substring($DestRoot.Length).TrimStart('\', '/') -replace '\\', '/'
    $resolved = [uri]::new([uri]("https://local.invalid/" + $page), $Reference.Trim())
    $relative = [uri]::UnescapeDataString($resolved.AbsolutePath).TrimStart('/')
    $candidate = [IO.Path]::GetFullPath((Join-Path $DestRoot $relative))
    $rootPrefix = [IO.Path]::GetFullPath($DestRoot).TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
    if ($candidate -ne $rootPrefix.TrimEnd('\', '/') -and -not $candidate.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Local reference leaves the output directory: $Reference"
    }
    if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
    if ((Test-Path -LiteralPath $candidate -PathType Container) -or $resolved.AbsolutePath.EndsWith('/') -or -not [IO.Path]::GetExtension($candidate)) {
        return Join-Path $candidate 'index.html'
    }
    return $candidate
}

function Get-GzipByteCount {
    param([byte[]]$Bytes)

    $stream = [IO.MemoryStream]::new()
    $gzip = [IO.Compression.GZipStream]::new($stream, [IO.Compression.CompressionLevel]::Optimal, $true)
    try {
        $gzip.Write($Bytes, 0, $Bytes.Length)
        $gzip.Dispose()
        return $stream.Length
    }
    finally {
        $gzip.Dispose()
        $stream.Dispose()
    }
}

function Get-AssetBaseline {
    param($Current, [string]$Root)

    $result = @{ status = 'unavailable'; source = 'origin/main'; reason = 'No reference measurement with the same scope.' }
    try {
        $saved = Invoke-GitCapture -Arguments @('show', 'origin/main:data/metrics/latest.json') -Root $Root | ConvertFrom-Json
        if ($saved.quality.pageBundles.scope -eq $Current.scope) {
            $result = @{
                status = 'available'
                source = 'origin/main'
                commit = Invoke-GitCapture -Arguments @('rev-parse', 'origin/main') -Root $Root
                measuredAt = $saved.generatedAt
                cssBytes = $saved.quality.pageBundles.maxCssBytes
                jsBytes = $saved.quality.pageBundles.maxJsBytes
                cssDeltaBytes = $Current.maxCssBytes - $saved.quality.pageBundles.maxCssBytes
                jsDeltaBytes = $Current.maxJsBytes - $saved.quality.pageBundles.maxJsBytes
            }
        }
    }
    catch {
        # Missing ref or older measurement scope has no comparable baseline.
    }
    return $result
}

function Analyze-BuiltHtml {
    param([string]$DestRoot)

    $htmlFiles = @(Get-ChildItem -LiteralPath $DestRoot -Recurse -File -Filter "*.html")

    $invalidCanonicalCount = 0
    $invalidLang = 0
    $missingXDefault = 0
    $brokenLinks = New-Object System.Collections.Generic.List[object]
    $assetSizes = @{}
    $pageBundles = @{
        scope = 'initial-local-files-v1'
        maxCssBytes = [int64]0; maxJsBytes = [int64]0
        cssGzipBytes = [int64]0; jsGzipBytes = [int64]0
        cssPage = ''; jsPage = ''; cssGroup = ''; jsGroup = ''
        maxInlineJsBytes = [int64]0; maxRemoteScripts = 0
    }
    $pageGroups = @{}

    foreach ($file in $htmlFiles) {
        $raw = Get-Content -Raw -LiteralPath $file.FullName -Encoding UTF8

        $pageAssets = @{}
        $remoteScripts = 0
        $pagePath = $file.FullName.Substring($DestRoot.Length).TrimStart('\', '/') -replace '\\', '/'
        $groupPath = $pagePath -replace '^en/', ''
        $section = ($groupPath -split '/')[0]
        $label = switch ($section) {
            'index.html' { 'Home' }
            'about' { 'About' }
            'dashboard' { 'Dashboard' }
            'notes' { 'Notes' }
            'textlab' { 'Text Lab' }
            'weeknotes' { 'Weeknotes' }
            'microblog' { 'Microblog' }
            'tags' { 'Tags' }
            default { 'Other' }
        }
        if (-not $pageGroups.ContainsKey($label)) {
            $pageGroups[$label] = @{
                label = $label; maxCssBytes = [int64]0; maxJsBytes = [int64]0
                cssGzipBytes = [int64]0; jsGzipBytes = [int64]0
                cssPage = ''; jsPage = ''
            }
        }
        foreach ($tag in [regex]::Matches($raw, '<(?:link|script)\b[^>]*>', 'IgnoreCase')) {
            $isScript = $tag.Value -match '^<script\b'
            if (-not $isScript -and (Get-HtmlAttribute -Tag $tag.Value -Name 'rel') -ne 'stylesheet') { continue }
            $attributeName = if ($isScript) { 'src' } else { 'href' }
            $reference = Get-HtmlAttribute -Tag $tag.Value -Name $attributeName
            if ([string]::IsNullOrWhiteSpace($reference)) { continue }
            $assetTarget = Get-LocalTargetPath -Reference $reference -PagePath $file.FullName -DestRoot $DestRoot
            if ($null -eq $assetTarget) {
                if ($isScript -and $reference.Trim() -match '^(?:https?:|//)') { $remoteScripts++ }
                continue
            }
            if (-not (Test-Path -LiteralPath $assetTarget -PathType Leaf)) { continue }
            $kind = if ($isScript) { 'js' } else { 'css' }
            if (-not $assetSizes.ContainsKey($assetTarget)) {
                $bytes = [IO.File]::ReadAllBytes($assetTarget)
                $assetSizes[$assetTarget] = @{ bytes = $bytes.Length; gzipBytes = Get-GzipByteCount -Bytes $bytes; kind = $kind }
            }
            $pageAssets[$assetTarget] = $assetSizes[$assetTarget]
        }
        foreach ($kind in @('css', 'js')) {
            $bytes = [int64]0
            $gzipBytes = [int64]0
            foreach ($asset in $pageAssets.Values) {
                if ($asset.kind -eq $kind) { $bytes += $asset.bytes; $gzipBytes += $asset.gzipBytes }
            }
            $key = if ($kind -eq 'css') { 'maxCssBytes' } else { 'maxJsBytes' }
            $gzipKey = if ($kind -eq 'css') { 'cssGzipBytes' } else { 'jsGzipBytes' }
            foreach ($record in @($pageBundles, $pageGroups[$label])) {
                if ($bytes -gt $record[$key]) {
                    $record[$key] = $bytes
                    $record[$gzipKey] = $gzipBytes
                    $record["${kind}Page"] = $pagePath
                }
            }
            if ($pageBundles["${kind}Page"] -eq $pagePath) { $pageBundles["${kind}Group"] = $label }
        }
        $inlineBytes = [int64]0
        foreach ($inline in [regex]::Matches($raw, '<script\b([^>]*)>([\s\S]*?)</script>', 'IgnoreCase')) {
            $type = Get-HtmlAttribute -Tag $inline.Groups[1].Value -Name 'type'
            $src = Get-HtmlAttribute -Tag $inline.Groups[1].Value -Name 'src'
            if (-not $src -and $type -in @('', 'module', 'text/javascript', 'application/javascript')) {
                $inlineBytes += [Text.Encoding]::UTF8.GetByteCount($inline.Groups[2].Value)
            }
        }
        $pageBundles.maxInlineJsBytes = [math]::Max($pageBundles.maxInlineJsBytes, $inlineBytes)
        $pageBundles.maxRemoteScripts = [math]::Max($pageBundles.maxRemoteScripts, $remoteScripts)

        $canonicalLinks = @([regex]::Matches($raw, '<link\b[^>]*>', 'IgnoreCase') | Where-Object {
            ((Get-HtmlAttribute -Tag $_.Value -Name 'rel') -split '\s+') -contains 'canonical'
        })
        $canonical = if ($canonicalLinks.Count -eq 1) { Get-HtmlAttribute -Tag $canonicalLinks[0].Value -Name 'href' } else { '' }
        $canonicalUri = $null
        if ([string]::IsNullOrWhiteSpace($canonical) -or $canonical -match '[\s]|^[#?]' -or
            -not [uri]::TryCreate([uri]'https://local.invalid/', $canonical, [ref]$canonicalUri) -or
            $canonicalUri.Scheme -notin @('http', 'https')) {
            $invalidCanonicalCount++
        }
        $htmlTag = [regex]::Match($raw, '<html\b[^>]*>', 'IgnoreCase').Value
        $language = Get-HtmlAttribute -Tag $htmlTag -Name 'lang'
        if ($language -notmatch '^(?:zh|en)(?:-[a-z]{2})?$') {
            $invalidLang++
        }
        if (($raw -match "hreflang\s*=") -and ($raw -notmatch 'hreflang\s*=\s*["'']?x-default["'']?')) {
            $missingXDefault++
        }

        $references = @([regex]::Matches($raw, '<(?:a|area|link|script|img|source|video|audio|iframe|track|input|embed)\b[^>]*>', 'IgnoreCase') | ForEach-Object {
            Get-HtmlAttribute -Tag $_.Value -Name 'href'
            Get-HtmlAttribute -Tag $_.Value -Name 'src'
        } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Sort-Object -Unique)
        foreach ($reference in $references) {
            $target = Get-LocalTargetPath -Reference $reference -PagePath $file.FullName -DestRoot $DestRoot
            if ($null -eq $target) { continue }
            if (-not (Test-Path -LiteralPath $target -PathType Leaf)) {
                $brokenLinks.Add([pscustomobject]@{
                    page = $file.FullName.Substring($DestRoot.Length).TrimStart('\', '/')
                    href = $reference
                })
            }
        }
    }

    $pageBundles.groups = @($pageGroups.Values | Sort-Object label)

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
        invalidCanonicalCount        = $invalidCanonicalCount
        invalidHtmlLangCount         = $invalidLang
        missingXDefaultForAlternates = $missingXDefault
        brokenInternalReferenceCount = $brokenLinks.Count
        brokenInternalReferenceTop   = @($brokenLinks | Select-Object -First 20)
        cssBundleBytes               = $cssBytes
        jsBundleBytes                = $jsBytes
        pageBundles                  = $pageBundles
        homeExternalHosts            = @($homeExternalHosts)
    }
}

$measurementHead = Invoke-GitCapture -Arguments @("rev-parse", "HEAD") -Root $ProjectRoot
$measurementStatus = Invoke-GitCapture -Arguments @("status", "--porcelain", "--untracked-files=all") -Root $ProjectRoot
$gitContext = @{
    commit = Invoke-GitCapture -Arguments @("rev-parse", "--short", "HEAD") -Root $ProjectRoot
    branch = Invoke-GitCapture -Arguments @("rev-parse", "--abbrev-ref", "HEAD") -Root $ProjectRoot
    dirty = -not [string]::IsNullOrWhiteSpace($measurementStatus)
}

$templateOutput = Invoke-HugoCapture -Arguments @("--templateMetrics", "--templateMetricsHints", "--renderToMemory") -Root $ProjectRoot
$unusedOutput = Invoke-HugoCapture -Arguments @("--printUnusedTemplates", "--renderToMemory") -Root $ProjectRoot

$tempDest = Join-Path $env:TEMP ("aki-liu-metrics-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $tempDest -Force | Out-Null

try {
    $buildOutput = Invoke-HugoCapture -Arguments @("--gc", "--minify", "--destination", $tempDest) -Root $ProjectRoot
    $quality = Analyze-BuiltHtml -DestRoot $tempDest
    $quality.pageBundles.baseline = Get-AssetBaseline -Current $quality.pageBundles -Root $ProjectRoot
}
finally {
    if (Test-Path $tempDest) {
        Remove-Item -Path $tempDest -Recurse -Force
    }
}

$siteCounts = Parse-SiteCounts -Output $buildOutput
$templateMetrics = Parse-TemplateMetrics -Output $templateOutput -TopN $TopTemplates
$unusedTemplates = Parse-UnusedTemplates -Output $unusedOutput

$currentHead = Invoke-GitCapture -Arguments @("rev-parse", "HEAD") -Root $ProjectRoot
$currentStatus = Invoke-GitCapture -Arguments @("status", "--porcelain", "--untracked-files=all") -Root $ProjectRoot
if ($currentHead -ne $measurementHead -or $currentStatus -ne $measurementStatus) {
    throw "Git revision or status changed during measurement; public snapshots were not updated. Run again from a stable worktree."
}

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
        assetScope = "initial local stylesheet and script files, including vendor; inline, remote and runtime-loaded code excluded; independent gzip estimates"
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

if ($metrics.build.totalMs -le 0) { throw "Could not read the build time from the Hugo output." }

$dataDir = Join-Path $ProjectRoot "data\metrics"
$historyPath = Join-Path $dataDir "history_timeline.json"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$stamp = Get-Date
$history = @()
if (Test-Path -LiteralPath $historyPath) {
    $history = Get-Content -Raw -LiteralPath $historyPath | ConvertFrom-Json
}
$history = @(@($history) + [pscustomobject]@{
    stamp       = $stamp.ToString("yyyyMMdd-HHmmss")
    label       = $stamp.ToString("yyyy-MM-dd HH:mm:ss")
    buildMs     = [math]::Round($metrics.build.totalMs, 3)
    cacheRatio  = [math]::Round($metrics.templates.aggregateCacheRatio, 3)
    brokenLinks = $metrics.quality.brokenInternalReferenceCount
    zhPages     = $metrics.build.zhPages
    enPages     = $metrics.build.enPages
    commit      = $metrics.git.commit
} | Select-Object -Last 30)

New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
[System.IO.File]::WriteAllText((Join-Path $dataDir "latest.json"), ($metrics | ConvertTo-Json -Depth 8), $utf8NoBom)
[System.IO.File]::WriteAllText($historyPath, (ConvertTo-Json -InputObject $history -Depth 8), $utf8NoBom)

Write-Host "Metrics written to data/metrics/ ($($history.Count) history points)"
Write-Host "  Build total: $($metrics.build.totalMs) ms"
Write-Host "  Missing local references: $($metrics.quality.brokenInternalReferenceCount)"
Write-Host "  Missing or invalid canonical: $($metrics.quality.invalidCanonicalCount)"
Write-Host "  Template cache reuse share: $($metrics.templates.aggregateCacheRatio)%"
