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

- The script builds Hugo into a temp destination path and does not write to `public/`.
- Run the report before rebuilding or publishing the site. Commit the two `data/metrics/` files to publish the refreshed snapshot; a normal Hugo or Vercel build does not collect new measurements.
- The dashboard identifies the measurement time, base commit, and whether tracked files had uncommitted changes. Measurements describe a local build, not deployment uptime or production traffic. CSS and main JavaScript sizes are minified file bytes before transport compression.
- `latest.html` includes trend charts (build time, cache ratio, broken links) based on recent `history/*.json`.
- `latest.json`, `latest.html`, `public-assets.json`, and `history/` are ignored by git to avoid churn.
