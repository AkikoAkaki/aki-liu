param(
    [switch]$Audit
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Warnings = New-Object System.Collections.Generic.List[string]
$Failures = New-Object System.Collections.Generic.List[string]

function Normalize-RepoPath {
    param([string]$Path)

    return ($Path -replace "\\", "/").TrimStart("/")
}

function Normalize-YamlScalar {
    param([string]$Value)

    $trimmed = $Value.Trim()
    if ($trimmed -match '^"(.*)"$') {
        return $Matches[1] -replace '\\"', '"'
    }
    if ($trimmed -match "^'(.*)'$") {
        return $Matches[1] -replace "''", "'"
    }

    return $trimmed
}

function Invoke-CheckedCommand {
    param(
        [string]$FilePath,
        [string[]]$Arguments,
        [string]$WorkingDirectory
    )

    Push-Location $WorkingDirectory
    try {
        $output = & $FilePath @Arguments 2>&1 | ForEach-Object { "$_" }
        if ($LASTEXITCODE -ne 0) {
            $text = ($output -join [System.Environment]::NewLine).Trim()
            if ([string]::IsNullOrWhiteSpace($text)) {
                $text = "no output"
            }
            throw "$FilePath failed with exit code $LASTEXITCODE.$([System.Environment]::NewLine)$text"
        }
        return $output
    }
    finally {
        Pop-Location
    }
}

function Write-AssetSummary {
    $root = Join-Path $ProjectRoot "public_test"
    $files = @(Get-ChildItem -LiteralPath $root -Recurse -File)
    $images = ".avif", ".gif", ".ico", ".jpg", ".jpeg", ".png", ".svg", ".webp"
    $groups = [ordered]@{
        "All files"    = $files
        "Images"       = @($files | Where-Object { $images -contains $_.Extension.ToLowerInvariant() })
        "CSS"          = @($files | Where-Object { $_.Extension -eq ".css" })
        "JS"           = @($files | Where-Object { $_.Extension -eq ".js" })
        "HTML"         = @($files | Where-Object { $_.Extension -eq ".html" })
        "Search index" = @($files | Where-Object { $_.Name -eq "search-index.json" })
    }
    Write-Host "Asset audit: public_test/"
    foreach ($name in $groups.Keys) {
        $bytes = ($groups[$name] | Measure-Object -Property Length -Sum).Sum
        Write-Host ("  {0,-13} {1,10:N1} KB  {2,5} file(s)" -f $name, ($bytes / 1KB), $groups[$name].Count)
    }
    Write-Host "  Largest files:"
    foreach ($file in ($files | Sort-Object Length -Descending | Select-Object -First 10)) {
        Write-Host ("  {0,10:N1} KB  {1}" -f ($file.Length / 1KB), (Normalize-RepoPath $file.FullName.Substring($root.Length)))
    }
}

function Get-StagedPaths {
    Push-Location $ProjectRoot
    try {
        $output = & git diff --cached --name-only 2>&1 | ForEach-Object { "$_" }
        if ($LASTEXITCODE -ne 0) {
            $Warnings.Add(("Could not inspect staged files: {0}" -f (($output -join " ").Trim())))
            return @()
        }

        return @($output | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | ForEach-Object { Normalize-RepoPath $_ })
    }
    finally {
        Pop-Location
    }
}

function Test-StagedPaths {
    $stagedPaths = @(Get-StagedPaths)
    $generatedPrefixes = @(
        "public/",
        "public_test/",
        "content/microblog/2099/"
    )

    foreach ($path in $stagedPaths) {
        foreach ($prefix in $generatedPrefixes) {
            if ($path.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase) -or $path.Equals($prefix.TrimEnd("/"), [System.StringComparison]::OrdinalIgnoreCase)) {
                $Warnings.Add("Generated path is staged: $path")
                break
            }
        }
    }

    return $stagedPaths.Count
}

function Get-FrontMatter {
    param([string]$Path)

    $lines = [System.IO.File]::ReadAllLines($Path)
    if ($lines.Count -lt 3 -or $lines[0].Trim() -ne "---") {
        throw "missing YAML frontmatter delimiters"
    }

    $endIndex = -1
    for ($index = 1; $index -lt $lines.Count; $index++) {
        if ($lines[$index].Trim() -eq "---") {
            $endIndex = $index
            break
        }
    }

    if ($endIndex -lt 0) {
        throw "missing closing YAML frontmatter delimiter"
    }

    $frontMatter = @{}
    for ($index = 1; $index -lt $endIndex; $index++) {
        $line = $lines[$index]
        if ($line -match "^\s*([A-Za-z0-9_-]+):\s*(.*)\s*$") {
            $frontMatter[$Matches[1]] = $Matches[2]
        }
    }

    return $frontMatter
}

function Test-MicroblogFrontMatter {
    $microblogRoot = Join-Path $ProjectRoot "content\microblog"
    if (-not (Test-Path -LiteralPath $microblogRoot)) {
        $Failures.Add("Missing content/microblog directory.")
        return 0
    }

    $files = @(Get-ChildItem -LiteralPath $microblogRoot -Recurse -Filter "index.md" -File)
    $publicSlugs = New-Object 'System.Collections.Generic.HashSet[string]'
    foreach ($file in $files) {
        $relativePath = Normalize-RepoPath $file.FullName.Substring($ProjectRoot.Length)
        if ($relativePath -notmatch "^content/microblog/(\d{4})/(\d{2})/(\d{2})-(\d{6})/index\.md$") {
            $Failures.Add("Invalid microblog path shape: $relativePath")
            continue
        }

        $expectedSlug = $Matches[1] + $Matches[2] + $Matches[3] + $Matches[4]

        try {
            $frontMatter = Get-FrontMatter -Path $file.FullName
        }
        catch {
            $Failures.Add(("{0}: {1}" -f $relativePath, $_.Exception.Message))
            continue
        }

        foreach ($requiredField in @("date", "slug", "draft")) {
            if (-not $frontMatter.ContainsKey($requiredField) -or [string]::IsNullOrWhiteSpace([string]$frontMatter[$requiredField])) {
                $Failures.Add("$relativePath missing required frontmatter field: $requiredField")
            }
        }

        if ($frontMatter.ContainsKey("slug")) {
            $rawSlug = ([string]$frontMatter["slug"]).Trim()
            $slug = Normalize-YamlScalar $rawSlug
            if ($rawSlug -notmatch '^("[0-9]+"|''[0-9]+'')$') {
                $Failures.Add("$relativePath slug must be a quoted numeric string")
            }
            if ($slug -notmatch '^\d{1,6}$' -and $slug -ne $expectedSlug) {
                $Failures.Add("$relativePath slug '$slug' must preserve a legacy URL or match '$expectedSlug'")
            }
            if (-not $publicSlugs.Add($slug)) {
                $Failures.Add("$relativePath duplicates public microblog slug '$slug'")
            }
        }

        if ($frontMatter.ContainsKey("date")) {
            $date = Normalize-YamlScalar ([string]$frontMatter["date"])
            if ($date -notmatch "(Z|[+-]\d{2}:\d{2})$") {
                $Failures.Add("$relativePath date is missing a timezone offset: $date")
            }
            elseif ($date -notmatch "\+08:00$") {
                $Failures.Add("$relativePath date offset is not +08:00: $date")
            }
        }
    }

    return $files.Count
}

Write-Host "Local pre-push check"
Write-Host ("Root: {0}" -f $ProjectRoot)

$stagedCount = Test-StagedPaths
Write-Host ("Staging: checked {0} staged path(s)" -f $stagedCount)

Invoke-CheckedCommand -FilePath "hugo" -Arguments @("--gc", "--minify", "--destination", "public_test") -WorkingDirectory $ProjectRoot | Out-Null
Write-Host "Hugo: built public_test/"

$microblogCount = Test-MicroblogFrontMatter
Write-Host ("Microblog: checked {0} entry file(s)" -f $microblogCount)

if ($Audit.IsPresent) {
    Write-AssetSummary
}
else {
    Write-Host "Asset audit: skipped (use -Audit)"
}

if ($Warnings.Count -gt 0) {
    Write-Host ""
    Write-Host "Warnings:"
    foreach ($warning in $Warnings) {
        Write-Host ("- {0}" -f $warning)
    }
}

if ($Failures.Count -gt 0) {
    Write-Host ""
    Write-Host "Failures:"
    foreach ($failure in $Failures) {
        Write-Host ("- {0}" -f $failure)
    }
    Write-Host ""
    Write-Host "Summary: FAIL"
    exit 1
}

Write-Host ""
Write-Host "Summary: PASS"
Write-Host "Reminder: public_test/ is generated output; do not commit it."
