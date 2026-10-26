# Metrics Report

Run from repo root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\metrics-report.ps1
hugo --gc --minify
```

Outputs:

- `reports/metrics/latest.json`
- `reports/metrics/latest.html`
- `reports/metrics/public-assets.json`
- `reports/metrics/history/<timestamp>.json`
- `data/metrics/latest.json` and `data/metrics/history_timeline.json`, which feed the public dashboard.

Audit an existing Hugo destination directory:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\public-asset-audit.ps1 -PublicDir .\public_test -JsonOut .\reports\metrics\public-assets.json
```

Notes:

- `scripts/metrics-report.ps1` collects measurements and writes JSON. `scripts/metrics-html.ps1` renders the local HTML report. The script builds Hugo into a temp destination path and does not write to `public/`.
- Run the report before rebuilding or publishing the site. Commit the two `data/metrics/` files to publish the refreshed snapshot; a normal Hugo or Vercel build does not collect new measurements.
- The dashboard identifies the measurement time, base commit, and whether tracked files had uncommitted changes. Measurements describe a local build, not deployment uptime or production traffic. CSS and main JavaScript sizes are minified file bytes before transport compression.
- `latest.html` includes trend charts (build time, cache reuse share, missing local references) based on recent `history/*.json`.
- `latest.json`, `latest.html`, `public-assets.json`, and `history/` are ignored by git to avoid churn.

## Measurement scope

- The production duration comes from `hugo --gc --minify` using the existing resource cache. It is one local sample, not a cold-cache or repeated benchmark.
- The cache reuse share divides cached calls by all template calls, including uncached templates. It is not the hit rate of `partialCached` calls. Template reuse comes from a separate `--templateMetrics --templateMetricsHints --renderToMemory` run. Template timing is not the production-build duration.
- `quality.cssBundleBytes` and `jsBundleBytes` describe the shared bundles. `quality.pageBundles` uses scope `initial-local-files-v1`: distinct local stylesheet/script files referenced by initial HTML, including vendor files under `/lib/`. Inline code, remote URLs, fonts and runtime-loaded files are excluded. Maximum inline JS bytes and remote-script counts are recorded separately; this is not a complete browser/network audit.
- The asset card keeps CSS and JS rows. Each shows the largest raw per-page total, its page class, and a gzip estimate for that same page. Gzip estimates sum independent file compression, not measured server responses. Hover the row label for the breakdown by page class.
- Asset changes compare against the saved measurement at the locally tracked `origin/main` ref only when its scope matches. The baseline records the ref commit and measurement time; it is not verification of a live deployment. No fetch or publish occurs. Missing refs or older scopes display `Baseline not set`; there is no arbitrary pass/fail size limit.
- The cache card displays `Unassessed` because cache-key isolation and output correctness have not been tested. The measured reuse share remains supporting information. The empty ring does not represent a zero health score; no numeric health score is computed.
- `measurement` records the platform, cache policy, command arguments and asset scope. `git` is captured before report files are written.
- Refresh after code changes are committed: run the report, build the site, then commit only the two `data/metrics/` snapshots. A normal deployment serves that saved measurement.
- If the Git revision or status changes while collecting measurements, the script stops before writing public snapshots.

- The build-duration and generated-page cards compare the latest measurement with the immediately preceding one; their small charts show up to 12 measurements. The history chart shows up to 30 measurements, with dates and full timestamps/commits on hover. Points are evenly spaced by measurement, not elapsed time. Its mean and P95 describe those samples across different revisions and page counts.
- Generated pages include articles, archives and taxonomy pages; this is not an article count. Homepage referenced domains include outgoing links and resource URLs found in homepage HTML, not only network requests.
- HTML quality checks local root-relative and page-relative `href`/`src` references, including scripts, stylesheets and media. External URLs, fragment targets, `srcset` and references embedded inside CSS/JavaScript are not checked. Canonical URLs must be non-empty HTTP(S) URLs or resolvable relative paths; page languages must be zh/en or a two-letter regional variant.
- Quality fields are `brokenInternalReferenceCount`, `brokenInternalReferenceTop`, `invalidCanonicalCount` and `invalidHtmlLangCount`. Older history points retain their original narrower audit results. A local report using the old scope is not reused as a comparison baseline or reimported into history.
