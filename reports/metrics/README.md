# Metrics Report

Run from repo root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\metrics-report.ps1
```

Outputs:

- `reports/metrics/latest.json`
- `reports/metrics/latest.html`
- `reports/metrics/public-assets.json`
- `reports/metrics/history/<timestamp>.json`

Audit an existing Hugo destination directory:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\public-asset-audit.ps1 -PublicDir .\public_test -JsonOut .\reports\metrics\public-assets.json
```

Notes:

- The script builds Hugo into a temp destination path and does not write to `public/`.
- `latest.html` includes trend charts (build time, cache ratio, broken links) based on recent `history/*.json`.
- `latest.json`, `latest.html`, `public-assets.json`, and `history/` are ignored by git to avoid churn.
