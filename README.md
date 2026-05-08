# OAR Citations Coverage Dashboard

A data-driven view of the 1.37 million outgoing citations made by Thailand-affiliated researchers in their 2025 publications, mapped against the journal title lists of the databases the Office of Academic Resources (OAR), Chulalongkorn University, currently subscribes to.

This is the **curated dashboard** (Tier A in the hybrid architecture). A second `/explore` page with arbitrary SQL via DuckDB-WASM, and a MotherDuck integration for ad-hoc internal exploration, are being built in subsequent phases.

## Quick start

```bash
npm install
npm run dev
```

Then open <http://localhost:5173>.

## Project layout

```
oar-citations-dashboard/
├── README.md
├── index.html              fonts pre-connected, OAR branded title
├── package.json            React 18, Vite 5, Tailwind 3, Recharts, Lucide
├── tailwind.config.js
├── postcss.config.js
├── vite.config.js          base set to './' for any host
├── public/
│   ├── oar_logo.png        OAR Chula logo (you supply this)
│   └── data/               pre-aggregated JSON from the Python pipeline
│       ├── meta.json
│       ├── summary.json
│       ├── coverage.json
│       ├── overlap.json
│       ├── by_year.json    (Turn 2)
│       ├── by_type.json    (Turn 2)
│       ├── by_publisher.json   (Turn 2)
│       ├── institutions.json   (Turn 2)
│       └── institution_types.json   (Turn 2)
└── src/
    ├── Dashboard.jsx       the dashboard component
    ├── index.css           Tailwind directives + paper-grain texture
    └── main.jsx
```

## Refreshing the data

The dashboard reads pre-aggregated JSON from `public/data/`. To regenerate it after harvesting new citation data:

1. On the data-pipeline machine, run `python pipeline.py export`
2. Copy the contents of `dashboard_data/` into this project's `public/data/`
3. Commit and push. Vercel will rebuild and redeploy automatically.

## Deploying

### Vercel (easiest)

1. Push this repo to GitHub.
2. Go to [vercel.com](https://vercel.com), click *Add New Project*, pick the repo.
3. Click *Deploy*. Vercel auto-detects Vite. A working URL appears in about a minute.

### Netlify

Same flow as Vercel; Netlify also auto-detects Vite.

### GitHub Pages

GitHub Pages doesn't run Vite, so you need a build step. The simplest path is a GitHub Actions workflow:

1. Edit `vite.config.js` and change `base: './'` to `base: '/oar-citations-dashboard/'` (replace with your repo name if different).
2. Add `.github/workflows/deploy.yml`:
   ```yaml
   name: Deploy to GitHub Pages
   on:
     push:
       branches: [main]
   permissions:
     contents: read
     pages: write
     id-token: write
   jobs:
     build:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with: { node-version: 20 }
         - run: npm ci
         - run: npm run build
         - uses: actions/upload-pages-artifact@v3
           with: { path: dist }
     deploy:
       needs: build
       runs-on: ubuntu-latest
       environment: { name: github-pages, url: '${{ steps.deployment.outputs.page_url }}' }
       steps:
         - id: deployment
           uses: actions/deploy-pages@v4
   ```
3. In repo *Settings*, *Pages*, set Source to *GitHub Actions*.

## OAR logo

Save the OAR Chulalongkorn logo as `public/oar_logo.png`. The header silently hides the broken-image icon if it's missing, so the dashboard still works without it during development.

## Acknowledgements

Built by the Office of Academic Resources, Chulalongkorn University. Data pipeline, dashboard scaffolding, and visual design developed in collaboration with [Claude](https://www.anthropic.com/claude), Anthropic's AI assistant.

Citation graph data from [OpenAlex](https://openalex.org) (CC0 license). Indexing lists from publisher KBART exports and database title-list downloads (DOAJ, Scopus, Web of Science SCIE/SSCI/AHCI/ESCI, ScienceDirect, Wiley, EBSCO Academic Search Complete/Premier/Ultimate).
