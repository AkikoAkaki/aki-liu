function Convert-ToHtmlSafe {
    param([AllowNull()][object]$Value)

    if ($null -eq $Value) { return "" }
    return [System.Net.WebUtility]::HtmlEncode([string]$Value)
}

function Convert-ToInvariantNumber {
    param([double]$Value)

    return $Value.ToString("0.###", [System.Globalization.CultureInfo]::InvariantCulture)
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

    $brokenItems = if ($Metrics.quality.brokenInternalReferenceTop.Count -gt 0) {
        ($Metrics.quality.brokenInternalReferenceTop | ForEach-Object {
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
      <h3>&#27169;&#26495;&#32531;&#23384;&#22797;&#29992;&#21344;&#27604;&#36235;&#21183;(%)</h3>
      $cacheChart
    </div>
    <div>
      <h3>&#26029;&#38142;&#25968;&#36235;&#21183;</h3>
      $brokenChart
    </div>
  </div>
  <h3>&#26368;&#36817;&#35760;&#24405;</h3>
  <table class='history-table'>
    <thead><tr><th>&#26102;&#38388;</th><th>&#24635;&#32791;&#26102;(ms)</th><th>&#32531;&#23384;&#22797;&#29992;&#21344;&#27604;(%)</th><th>&#26029;&#38142;&#25968;</th></tr></thead>
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
    <li>&#26412;&#22320;&#38142;&#25509;&#19982;&#36164;&#28304;&#32570;&#22833;&#25968;&#21464;&#21270;: <strong>$($Delta.brokenLinksDelta)</strong></li>
    <li>canonical &#32570;&#22833;&#25110;&#26080;&#25928; &#21464;&#21270;: <strong>$($Delta.invalidCanonicalCountDelta)</strong></li>
    <li>&#27169;&#26495;&#32531;&#23384;&#22797;&#29992;&#21344;&#27604;&#21464;&#21270;: <strong>$($Delta.templateCacheRatioDelta)%</strong></li>
  </ul>
</div>
"@
    } else {
@"
<div class='card'>
  <h2>&#19982;&#19978;&#27425;&#25253;&#21578;&#23545;&#27604;</h2>
  <p>&#26242;&#26080;&#30456;&#21516;&#26816;&#26597;&#33539;&#22260;&#30340;&#23545;&#27604;&#22522;&#32447;&#12290;</p>
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
        <li>canonical &#32570;&#22833;&#25110;&#26080;&#25928;: <strong>$($Metrics.quality.invalidCanonicalCount)</strong></li>
        <li>lang &#32570;&#22833;&#25110;&#19981;&#21463;&#25903;&#25345;: <strong>$($Metrics.quality.invalidHtmlLangCount)</strong></li>
        <li>&#32570;&#22833; hreflang x-default: <strong>$($Metrics.quality.missingXDefaultForAlternates)</strong></li>
        <li>&#26412;&#22320;&#38142;&#25509;&#19982;&#36164;&#28304;&#32570;&#22833;&#25968;: <strong>$($Metrics.quality.brokenInternalReferenceCount)</strong></li>
        <li>CSS bundle &#22823;&#23567;(&#23383;&#33410;): <strong>$($Metrics.quality.cssBundleBytes)</strong></li>
      </ul>
    </div>
    <div class="card">
      <h2>&#27169;&#26495;&#24615;&#33021;</h2>
      <ul>
        <li>&#27169;&#26495;&#32531;&#23384;&#22797;&#29992;&#21344;&#27604;: <strong>$($Metrics.templates.aggregateCacheRatio)%</strong></li>
        <li>&#32531;&#23384;&#22797;&#29992;/&#20840;&#37096;&#27169;&#26495;&#35843;&#29992;: <strong>$($Metrics.templates.aggregateCached) / $($Metrics.templates.aggregateCalls)</strong></li>
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
