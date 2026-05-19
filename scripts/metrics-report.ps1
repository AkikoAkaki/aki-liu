param(
    [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
    [int]$TopTemplates = 10
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-HugoCapture {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Args,
        [Parameter(Mandatory = $true)]
        [string]$Root
    )

    Push-Location $Root
    $oldEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $output = & hugo @Args 2>&1 | ForEach-Object { "$_" }
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

function Invoke-GitSafe {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Args,
        [Parameter(Mandatory = $true)]
        [string]$Root
    )

    try {
        Push-Location $Root
        try {
            $value = (& git @Args 2>$null | Out-String).Trim()
            if ([string]::IsNullOrWhiteSpace($value)) {
                return "unknown"
            }
            return ($value -split "`r?`n" | Select-Object -First 1).Trim()
        }
        finally {
            Pop-Location
        }
    }
    catch {
        return "unknown"
    }
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

    foreach ($file in $htmlFiles) {
        $raw = Get-Content -Raw -Path $file.FullName

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

function Convert-ToHtmlSafe {
    param([AllowNull()][object]$Value)

    if ($null -eq $Value) { return "" }
    return [System.Net.WebUtility]::HtmlEncode([string]$Value)
}

function Convert-ToInvariantNumber {
    param([double]$Value)

    return $Value.ToString("0.###", [System.Globalization.CultureInfo]::InvariantCulture)
}

function Get-HistorySeries {
    param(
        [string]$HistoryDir,
        [int]$Limit = 30
    )

    $files = Get-ChildItem -Path $HistoryDir -Filter "*.json" -File -ErrorAction SilentlyContinue |
        Sort-Object Name |
        Select-Object -Last $Limit

    $series = @()
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

        $series += [pscustomobject]@{
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

    return @($series)
}

function New-LineChartSvg {
    param(
        [double[]]$Values,
        [string]$Stroke = "#2563eb",
        [string]$Fill = "rgba(37,99,235,0.18)",
        [int]$Width = 640,
        [int]$Height = 220
    )

    if ($null -eq $Values -or $Values.Count -eq 0) {
        return "<svg class='chart' viewBox='0 0 640 220' preserveAspectRatio='none'><text x='16' y='40' fill='#666' font-size='12'>&#26080;&#21382;&#21490;&#25968;&#25454;</text></svg>"
    }

    $paddingLeft = 44.0
    $paddingRight = 14.0
    $paddingTop = 12.0
    $paddingBottom = 24.0
    $plotWidth = $Width - $paddingLeft - $paddingRight
    $plotHeight = $Height - $paddingTop - $paddingBottom

    $min = ($Values | Measure-Object -Minimum).Minimum
    $max = ($Values | Measure-Object -Maximum).Maximum
    if ($max -le $min) {
        $max = $min + 1.0
    }

    $count = $Values.Count
    $points = @()
    $dots = @()
    for ($i = 0; $i -lt $count; $i++) {
        $x = if ($count -eq 1) {
            $paddingLeft + ($plotWidth / 2.0)
        } else {
            $paddingLeft + ($i * $plotWidth / ($count - 1))
        }
        $value = [double]$Values[$i]
        $y = $paddingTop + (($max - $value) * $plotHeight / ($max - $min))

        $xText = Convert-ToInvariantNumber $x
        $yText = Convert-ToInvariantNumber $y
        $points += "$xText,$yText"
        $dots += "<circle cx='$xText' cy='$yText' r='2.5' fill='$Stroke'></circle>"
    }

    $grid = @()
    for ($i = 0; $i -le 4; $i++) {
        $ratio = $i / 4.0
        $y = $paddingTop + ($ratio * $plotHeight)
        $value = $max - (($max - $min) * $ratio)
        $yText = Convert-ToInvariantNumber $y
        $valueText = Convert-ToInvariantNumber ([math]::Round($value, 2))
        $xEnd = Convert-ToInvariantNumber ($paddingLeft + $plotWidth)
        $grid += "<line x1='$paddingLeft' y1='$yText' x2='$xEnd' y2='$yText' stroke='#ececec' stroke-width='1'></line>"
        $grid += "<text x='2' y='$yText' fill='#777' font-size='11' dominant-baseline='middle'>$valueText</text>"
    }

    $pointsText = $points -join " "
    $area = ""
    if ($points.Count -gt 1) {
        $baselineY = Convert-ToInvariantNumber ($paddingTop + $plotHeight)
        $area = "$($points[0].Split(',')[0]),$baselineY $pointsText $($points[-1].Split(',')[0]),$baselineY"
    }

    $gridText = $grid -join ""
    $dotsText = $dots -join ""
    $minText = Convert-ToInvariantNumber ([math]::Round($min, 3))
    $maxText = Convert-ToInvariantNumber ([math]::Round($max, 3))
    $latestText = Convert-ToInvariantNumber ([math]::Round($Values[-1], 3))
    $xAxisY = Convert-ToInvariantNumber ($paddingTop + $plotHeight)
    $xStart = Convert-ToInvariantNumber $paddingLeft
    $xEnd = Convert-ToInvariantNumber ($paddingLeft + $plotWidth)

    $areaSvg = ""
    if ($area) {
        $areaSvg = "<polygon points='$area' fill='$Fill'></polygon>"
    }

    return @"
<svg class='chart' viewBox='0 0 $Width $Height' preserveAspectRatio='none'>
  <rect x='0' y='0' width='$Width' height='$Height' fill='#fff'></rect>
  $gridText
  <line x1='$xStart' y1='$xAxisY' x2='$xEnd' y2='$xAxisY' stroke='#d8d8d8' stroke-width='1'></line>
  $areaSvg
  <polyline points='$pointsText' fill='none' stroke='$Stroke' stroke-width='2'></polyline>
  $dotsText
</svg>
<div class='chart-meta'>min: $minText | max: $maxText | latest: $latestText</div>
"@
}

function Write-ReportHtml {
    param(
        [hashtable]$Metrics,
        [hashtable]$Delta,
        [string]$Path,
        [object[]]$HistoryPoints = @()
    )

    $rows = @()
    foreach ($t in $Metrics.templates.top) {
        $templateName = Convert-ToHtmlSafe $t.template
        $rows += "<tr><td>$templateName</td><td>$($t.cumulativeMs)</td><td>$($t.averageMs)</td><td>$($t.maxMs)</td><td>$($t.cachedCount)/$($t.totalCount)</td></tr>"
    }
    $rowsHtml = ($rows -join "`n")

    $unusedItems = if ($Metrics.unusedTemplates.Count -gt 0) {
        ($Metrics.unusedTemplates | ForEach-Object { "<li><code>$(Convert-ToHtmlSafe $_)</code></li>" }) -join "`n"
    } else {
        "<li>&#26080;</li>"
    }

    $brokenItems = if ($Metrics.quality.brokenRootRelativeLinkTop.Count -gt 0) {
        ($Metrics.quality.brokenRootRelativeLinkTop | ForEach-Object {
            "<li><code>$(Convert-ToHtmlSafe $_.page)</code> -> <code>$(Convert-ToHtmlSafe $_.href)</code></li>"
        }) -join "`n"
    } else {
        "<li>&#26080;</li>"
    }

    $historyHtml = "<div class='card'><h2>&#21382;&#21490;&#36235;&#21183;</h2><p>&#26080;&#21382;&#21490;&#25968;&#25454;</p></div>"
    if ($HistoryPoints.Count -gt 0) {
        $buildValues = @($HistoryPoints | ForEach-Object { [double]$_.buildMs })
        $cacheValues = @($HistoryPoints | ForEach-Object { [double]$_.cacheRatio })
        $brokenValues = @($HistoryPoints | ForEach-Object { [double]$_.brokenLinks })

        $buildChart = New-LineChartSvg -Values $buildValues -Stroke "#2563eb" -Fill "rgba(37,99,235,0.16)"
        $cacheChart = New-LineChartSvg -Values $cacheValues -Stroke "#059669" -Fill "rgba(5,150,105,0.16)"
        $brokenChart = New-LineChartSvg -Values $brokenValues -Stroke "#dc2626" -Fill "rgba(220,38,38,0.16)"

        $historyRows = @()
        foreach ($point in ($HistoryPoints | Sort-Object stamp -Descending | Select-Object -First 12)) {
            $label = Convert-ToHtmlSafe $point.label
            $build = Convert-ToInvariantNumber ([double]$point.buildMs)
            $cache = Convert-ToInvariantNumber ([double]$point.cacheRatio)
            $broken = [int]$point.brokenLinks
            $historyRows += "<tr><td><code>$label</code></td><td>$build</td><td>$cache</td><td>$broken</td></tr>"
        }
        $historyRowsHtml = $historyRows -join "`n"

        $historyHtml = @"
<div class='card'>
  <h2>&#21382;&#21490;&#36235;&#21183;&#65288;&#26368;&#36817; $($HistoryPoints.Count) &#27425;&#65289;</h2>
  <div class='grid'>
    <div>
      <h3>&#26500;&#24314;&#32791;&#26102;&#36235;&#21183;(ms)</h3>
      $buildChart
    </div>
    <div>
      <h3>&#27169;&#26495;&#32531;&#23384;&#21629;&#20013;&#29575;&#36235;&#21183;(%)</h3>
      $cacheChart
    </div>
    <div>
      <h3>&#26029;&#38142;&#25968;&#36235;&#21183;</h3>
      $brokenChart
    </div>
  </div>
  <h3>&#26368;&#36817;&#35760;&#24405;</h3>
  <table class='history-table'>
    <thead><tr><th>&#26102;&#38388;</th><th>&#24635;&#32791;&#26102;(ms)</th><th>&#32531;&#23384;&#21629;&#20013;&#29575;(%)</th><th>&#26029;&#38142;&#25968;</th></tr></thead>
    <tbody>
      $historyRowsHtml
    </tbody>
  </table>
</div>
"@
    }

    $deltaHtml = if ($Delta.hasBaseline) {
@"
<div class='card'>
  <h2>&#19982;&#19978;&#27425;&#25253;&#21578;&#23545;&#27604;</h2>
  <ul>
    <li>&#26500;&#24314;&#24635;&#32791;&#26102;&#21464;&#21270;(ms): <strong>$($Delta.buildMsDelta)</strong></li>
    <li>&#26681;&#30456;&#23545;&#26029;&#38142;&#21464;&#21270;: <strong>$($Delta.brokenLinksDelta)</strong></li>
    <li>&#32570;&#22833; canonical &#21464;&#21270;: <strong>$($Delta.missingCanonicalDelta)</strong></li>
    <li>&#27169;&#26495;&#32531;&#23384;&#21629;&#20013;&#29575;&#21464;&#21270;: <strong>$($Delta.templateCacheRatioDelta)%</strong></li>
  </ul>
</div>
"@
    } else {
@"
<div class='card'>
  <h2>&#19982;&#19978;&#27425;&#25253;&#21578;&#23545;&#27604;</h2>
  <p>&#39318;&#27425;&#29983;&#25104;&#25253;&#21578;&#65292;&#26242;&#26080;&#21487;&#27604;&#36739;&#22522;&#32447;&#12290;</p>
</div>
"@
    }

    $html = @"
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hugo &#21487;&#35266;&#27979;&#24615;&#25253;&#21578;</title>
  <style>
    body { font-family: Segoe UI, Arial, sans-serif; margin: 24px; color: #111; background: #f7f7f8; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; }
    .card { background: #fff; border: 1px solid #ddd; border-radius: 10px; padding: 16px; }
    h1 { margin-top: 0; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border-bottom: 1px solid #ececec; padding: 8px; text-align: left; font-size: 13px; }
    code { background: #f1f1f3; padding: 2px 4px; border-radius: 4px; }
    h3 { margin: 8px 0; font-size: 14px; }
    .chart { width: 100%; height: 220px; display: block; }
    .chart-meta { margin-top: 4px; color: #666; font-size: 12px; }
    .history-table th, .history-table td { font-size: 12px; }
  </style>
</head>
<body>
  <h1>Hugo &#21487;&#35266;&#27979;&#24615;&#25253;&#21578;</h1>
  <p>&#29983;&#25104;&#26102;&#38388;: <strong>$($Metrics.generatedAt)</strong> | Git &#25552;&#20132;: <strong>$(Convert-ToHtmlSafe $Metrics.git.commit)</strong> | Git &#20998;&#25903;: <strong>$(Convert-ToHtmlSafe $Metrics.git.branch)</strong></p>
  <div class="grid">
    <div class="card">
      <h2>&#26500;&#24314;&#27010;&#35272;</h2>
      <ul>
        <li>&#24635;&#32791;&#26102;: <strong>$($Metrics.build.totalMs) ms</strong></li>
        <li>&#39029;&#38754;&#25968; ZH/EN: <strong>$($Metrics.build.zhPages) / $($Metrics.build.enPages)</strong></li>
        <li>&#38750;&#39029;&#38754;&#25991;&#20214; ZH/EN: <strong>$($Metrics.build.zhNonPage) / $($Metrics.build.enNonPage)</strong></li>
        <li>&#38745;&#24577;&#25991;&#20214; ZH/EN: <strong>$($Metrics.build.zhStatic) / $($Metrics.build.enStatic)</strong></li>
      </ul>
    </div>
    <div class="card">
      <h2>&#39029;&#38754;&#36136;&#37327;</h2>
      <ul>
        <li>HTML &#25991;&#20214;&#25968;: <strong>$($Metrics.quality.htmlFiles)</strong></li>
        <li>&#32570;&#22833; canonical: <strong>$($Metrics.quality.missingCanonical)</strong></li>
        <li>&#32570;&#22833; html lang: <strong>$($Metrics.quality.missingHtmlLang)</strong></li>
        <li>&#32570;&#22833; hreflang x-default: <strong>$($Metrics.quality.missingXDefaultForAlternates)</strong></li>
        <li>&#26681;&#30456;&#23545;&#38142;&#25509;&#26029;&#38142;&#25968;: <strong>$($Metrics.quality.brokenRootRelativeLinkCount)</strong></li>
        <li>CSS bundle &#22823;&#23567;(&#23383;&#33410;): <strong>$($Metrics.quality.cssBundleBytes)</strong></li>
      </ul>
    </div>
    <div class="card">
      <h2>&#27169;&#26495;&#24615;&#33021;</h2>
      <ul>
        <li>&#24635;&#20307;&#32531;&#23384;&#21629;&#20013;&#29575;: <strong>$($Metrics.templates.aggregateCacheRatio)%</strong></li>
        <li>&#32531;&#23384;&#21629;&#20013;/&#24635;&#35843;&#29992;: <strong>$($Metrics.templates.aggregateCached) / $($Metrics.templates.aggregateCalls)</strong></li>
        <li>&#24050;&#32479;&#35745;&#27169;&#26495;&#25968;: <strong>$($Metrics.templates.totalTemplatesParsed)</strong></li>
      </ul>
    </div>
  </div>
  $historyHtml
  $deltaHtml
  <div class="card">
    <h2>&#27169;&#26495;&#32791;&#26102; Top $($Metrics.templates.top.Count)&#65288;&#27627;&#31186;&#65289;</h2>
    <table>
      <thead><tr><th>&#27169;&#26495;</th><th>&#32047;&#35745;(ms)</th><th>&#24179;&#22343;(ms)</th><th>&#26368;&#22823;(ms)</th><th>&#32531;&#23384;/&#24635;&#35843;&#29992;</th></tr></thead>
      <tbody>
        $rowsHtml
      </tbody>
    </table>
  </div>
  <div class="grid">
    <div class="card">
      <h2>&#26410;&#20351;&#29992;&#27169;&#26495;</h2>
      <ul>
        $unusedItems
      </ul>
    </div>
    <div class="card">
      <h2>&#26029;&#38142;&#26679;&#20363;&#65288;&#26368;&#22810; 20 &#26465;&#65289;</h2>
      <ul>
        $brokenItems
      </ul>
    </div>
  </div>
</body>
</html>
"@

    # Force UTF-8 without BOM to keep report output deterministic.
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $html, $utf8NoBom)
}
$reportsDir = Join-Path $ProjectRoot "reports\metrics"
$historyDir = Join-Path $reportsDir "history"
New-Item -ItemType Directory -Path $reportsDir -Force | Out-Null
New-Item -ItemType Directory -Path $historyDir -Force | Out-Null

$templateOutput = Invoke-HugoCapture -Args @("--templateMetrics", "--templateMetricsHints", "--renderToMemory") -Root $ProjectRoot
$unusedOutput = Invoke-HugoCapture -Args @("--printUnusedTemplates", "--renderToMemory") -Root $ProjectRoot

$tempDest = Join-Path $env:TEMP ("aki-liu-metrics-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $tempDest -Force | Out-Null

try {
    $buildOutput = Invoke-HugoCapture -Args @("--gc", "--minify", "--destination", $tempDest) -Root $ProjectRoot
    $quality = Analyze-BuiltHtml -DestRoot $tempDest
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
    git             = @{
        commit = Invoke-GitSafe -Args @("rev-parse", "--short", "HEAD") -Root $ProjectRoot
        branch = Invoke-GitSafe -Args @("rev-parse", "--abbrev-ref", "HEAD") -Root $ProjectRoot
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

$historyPoints = Get-HistorySeries -HistoryDir $historyDir -Limit 30
Write-ReportHtml -Metrics $metrics -Delta $delta -Path $latestHtmlPath -HistoryPoints $historyPoints

# Direct Hugo-accessible static data feeding
$dataMetricsDir = Join-Path $ProjectRoot "data\metrics"
New-Item -ItemType Directory -Path $dataMetricsDir -Force | Out-Null

$dataLatestJsonPath = Join-Path $dataMetricsDir "latest.json"
$dataHistoryJsonPath = Join-Path $dataMetricsDir "history_timeline.json"

[System.IO.File]::WriteAllText($dataLatestJsonPath, $json, $utf8NoBom)
$historyJson = $historyPoints | ConvertTo-Json -Depth 8
[System.IO.File]::WriteAllText($dataHistoryJsonPath, $historyJson, $utf8NoBom)

Write-Host "Metrics report generated:"
Write-Host "  JSON        $latestJsonPath"
Write-Host "  HTML        $latestHtmlPath"
Write-Host "  History     $historyJsonPath"
Write-Host "  Hugo latest $dataLatestJsonPath"
Write-Host "  Hugo series $dataHistoryJsonPath"
Write-Host ""
Write-Host "Summary:"
Write-Host "  Build total: $($metrics.build.totalMs) ms"
Write-Host "  Broken root-relative links: $($metrics.quality.brokenRootRelativeLinkCount)"
Write-Host "  Missing canonical: $($metrics.quality.missingCanonical)"
Write-Host "  Template cache ratio: $($metrics.templates.aggregateCacheRatio)%"
