# Metrics Report

Run from repo root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\metrics-report.ps1
```

Outputs:

- `reports/metrics/latest.json`
- `reports/metrics/latest.html`
- `reports/metrics/history/<timestamp>.json`

Notes:

- The script builds Hugo into a temp destination path and does not write to `public/`.
- `latest.html` includes trend charts (build time, cache ratio, broken links) based on recent `history/*.json`.
- `latest.json`, `latest.html`, and `history/` are ignored by git to avoid churn.
