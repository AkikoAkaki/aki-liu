param(
    [string]$At,
    [string[]]$Tags = @(),
    [switch]$Draft
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-ShanghaiTimeZone {
    foreach ($timeZoneId in @("China Standard Time", "Asia/Shanghai")) {
        try {
            return [System.TimeZoneInfo]::FindSystemTimeZoneById($timeZoneId)
        }
        catch {
            continue
        }
    }

    return $null
}

function Get-ShanghaiNow {
    $timeZone = Get-ShanghaiTimeZone
    if ($null -ne $timeZone) {
        return [System.TimeZoneInfo]::ConvertTime([System.DateTimeOffset]::UtcNow, $timeZone)
    }

    return [System.DateTimeOffset]::UtcNow.ToOffset([System.TimeSpan]::FromHours(8))
}

function ConvertTo-YamlSingleQuotedScalar {
    param([string]$Value)

    return "'$($Value.Replace("'", "''"))'"
}

$shanghaiOffset = [System.TimeSpan]::FromHours(8)

if ([string]::IsNullOrWhiteSpace($At)) {
    $entryTime = (Get-ShanghaiNow).ToOffset($shanghaiOffset)
}
elseif ($At -match "(Z|[+-]\d{2}:?\d{2})$") {
    $entryTime = ([System.DateTimeOffset]::Parse(
            $At,
            [System.Globalization.CultureInfo]::InvariantCulture,
            [System.Globalization.DateTimeStyles]::AllowWhiteSpaces
        )).ToOffset($shanghaiOffset)
}
else {
    $formats = @(
        "yyyy-MM-dd'T'HH:mm:ss",
        "yyyy-MM-dd HH:mm:ss",
        "yyyy-MM-dd'T'HH:mm",
        "yyyy-MM-dd HH:mm"
    )
    $localDateTime = [System.DateTime]::ParseExact(
        $At,
        [string[]]$formats,
        [System.Globalization.CultureInfo]::InvariantCulture,
        [System.Globalization.DateTimeStyles]::None
    )
    $entryTime = [System.DateTimeOffset]::new($localDateTime, $shanghaiOffset)
}

$year = $entryTime.ToString("yyyy")
$month = $entryTime.ToString("MM")
$day = $entryTime.ToString("dd")
$time = $entryTime.ToString("HHmmss")
$date = $entryTime.ToString("yyyy-MM-ddTHH:mm:sszzz")
$bundleName = "$day-$time"

$repoRoot = Split-Path -Parent $PSScriptRoot
$contentRoot = Join-Path -Path $repoRoot -ChildPath "content"
$microblogRoot = Join-Path -Path $contentRoot -ChildPath "microblog"
$yearPath = Join-Path -Path $microblogRoot -ChildPath $year
$monthPath = Join-Path -Path $yearPath -ChildPath $month
$bundlePath = Join-Path -Path $monthPath -ChildPath $bundleName
$indexPath = Join-Path -Path $bundlePath -ChildPath "index.md"

if (Test-Path -LiteralPath $bundlePath) {
    throw "Microblog bundle already exists: $bundlePath"
}

$normalizedTags = @(
    foreach ($tag in $Tags) {
        foreach ($part in ($tag -split ",")) {
            $trimmed = $part.Trim()
            if (-not [string]::IsNullOrWhiteSpace($trimmed)) {
                $trimmed
            }
        }
    }
)

if ($normalizedTags.Count -eq 0) {
    $tagsLine = "tags: []"
}
else {
    $quotedTags = @($normalizedTags | ForEach-Object { ConvertTo-YamlSingleQuotedScalar $_ })
    $tagsLine = "tags: [$($quotedTags -join ", ")]"
}

$draftValue = if ($Draft.IsPresent) { "true" } else { "false" }

$content = @(
    "---",
    "date: $date",
    "slug: `"$time`"",
    $tagsLine,
    "draft: $draftValue",
    "---",
    ""
) -join [System.Environment]::NewLine

New-Item -ItemType Directory -Path $bundlePath | Out-Null
[System.IO.File]::WriteAllText($indexPath, $content, [System.Text.UTF8Encoding]::new($false))

$relativePath = $indexPath.Substring($repoRoot.Length).TrimStart([char[]]@("\", "/"))
Write-Output "Created: $relativePath"
Write-Output "URL: /microblog/$time/"
