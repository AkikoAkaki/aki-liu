param(
    [switch]$Audit
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Warnings = New-Object System.Collections.Generic.List[string]
$Failures = New-Object System.Collections.Generic.List[string]

function Add-Warning {
    param([string]$Message)
    $Warnings.Add($Message) | Out-Null
}

function Add-Failure {
    param([string]$Message)
    $Failures.Add($Message) | Out-Null
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
    return [System.Uri]::UnescapeDataString($rootUri.MakeRelativeUri($pathUri).ToString())
}

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

function Invoke-AssetAudit {
    Push-Location $ProjectRoot
    try {
        & (Join-Path $PSScriptRoot "public-asset-audit.ps1") -PublicDir ".\public_test" -JsonOut ".\reports\metrics\public-assets-check.json" -Quiet 2>&1 | Out-Null
    }
    finally {
        Pop-Location
    }
}

function Get-StagedPaths {
    Push-Location $ProjectRoot
    try {
        $output = & git diff --cached --name-only 2>&1 | ForEach-Object { "$_" }
        if ($LASTEXITCODE -ne 0) {
            Add-Warning ("Could not inspect staged files: {0}" -f (($output -join " ").Trim()))
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
        "content/ideas/test-archetype/",
        "content/microblog/2099/"
    )

    foreach ($path in $stagedPaths) {
        foreach ($prefix in $generatedPrefixes) {
            if ($path.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase) -or $path.Equals($prefix.TrimEnd("/"), [System.StringComparison]::OrdinalIgnoreCase)) {
                Add-Warning "Generated path is staged: $path"
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
        Add-Failure "Missing content/microblog directory."
        return 0
    }

    $files = @(Get-ChildItem -LiteralPath $microblogRoot -Recurse -Filter "index.md" -File)
    foreach ($file in $files) {
        $relativePath = Normalize-RepoPath (Get-RelativePath -Root $ProjectRoot -Path $file.FullName)
        if ($relativePath -notmatch "^content/microblog/(\d{4})/(\d{2})/(\d{2})-(\d{6})/index\.md$") {
            Add-Failure "Invalid microblog path shape: $relativePath"
            continue
        }

        $expectedSlug = $Matches[4]

        try {
            $frontMatter = Get-FrontMatter -Path $file.FullName
        }
        catch {
            Add-Failure ("{0}: {1}" -f $relativePath, $_.Exception.Message)
            continue
        }

        foreach ($requiredField in @("date", "slug", "draft")) {
            if (-not $frontMatter.ContainsKey($requiredField) -or [string]::IsNullOrWhiteSpace([string]$frontMatter[$requiredField])) {
                Add-Failure "$relativePath missing required frontmatter field: $requiredField"
            }
        }

        if ($frontMatter.ContainsKey("slug")) {
            $slug = Normalize-YamlScalar ([string]$frontMatter["slug"])
            if ($slug -ne $expectedSlug) {
                Add-Failure "$relativePath slug '$slug' does not match directory time '$expectedSlug'"
            }
        }

        if ($frontMatter.ContainsKey("date")) {
            $date = Normalize-YamlScalar ([string]$frontMatter["date"])
            if ($date -notmatch "(Z|[+-]\d{2}:\d{2})$") {
                Add-Failure "$relativePath date is missing a timezone offset: $date"
            }
            elseif ($date -notmatch "\+08:00$") {
                Add-Failure "$relativePath date offset is not +08:00: $date"
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
    Invoke-AssetAudit
    Write-Host "Asset audit: wrote reports/metrics/public-assets-check.json"
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
