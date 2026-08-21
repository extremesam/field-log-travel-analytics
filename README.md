# Field Log — Nine Years of Movement, Mapped

A personal GIS analytics project built from a real Google Timeline export (February 2017 – August 2026, 33,000+ location segments). Turns nine years of raw location history into a static, data-driven web app: yearly trends, travel-mode shifts, seasonality, a mapped home/work migration across four Nigerian states, and an interactive density map of every visited place.

**Live site:** _add your GitHub Pages URL after deploy_

## What it shows

| Section | Description |
|---------|-------------|
| **Overview** | Hero banner with live coordinate ticker, headline stats: total distance, years tracked, trips logged, places visited. |
| **Yearly trends** | Bar chart of distance and visit volume per year (2017–2026). |
| **Travel modes** | Stacked bar chart of passenger vehicle / walking / motorcycling / cycling / bus per year, plus monthly seasonality and hour-of-day rhythm charts. |
| **Weekly rhythm** | Weekday × hour heatmap grid showing commuter peaks and quiet days. |
| **Places & States Visited** | Complete index across all 12 Nigerian states in the dataset, categorised into **Primary Residence Hubs** (Ekiti, Lagos, Oyo, Ogun), **Visited & Explored States** (Kaduna, Osun, Abuja FCT, Edo, Ondo, Kogi, Rivers / Port Harcourt), and **Transit Corridors** (Niger State) with active years, visit volumes, and direct "View on Map" zoom actions. |
| **Distance by state** | Horizontal bar chart of kilometers tracked across all Nigerian states. |
| **Home & work migration** | Year-by-year log of Google's inferred home/work locations, tracking real relocations across Nigeria. |
| **Interactive GIS map** | Leaflet + Leaflet.heat map of 4,500+ density points on CARTO dark tiles, with region quick-jump navigation (🇳🇬 All Nigeria, 📍 Kaduna & North, 🌊 Port Harcourt & South, 🏛️ Abuja, 🏙️ Southwest Hubs), custom interactive state markers with popups, and the home migration route overlaid. |
| **Longest trips** | Table of top single-trip outliers, including one flagged GPS anomaly (~1,885 km in 13 hours) — kept visible rather than silently dropped, excluded only from aggregate distance totals. |

## Data pipeline

`data_pipeline/build_data.py` reads a Google Takeout `Timeline.json` export and produces 12 aggregated JSON files in `site/data/`. The raw export (35+ MB) is never shipped to the browser — only the lightweight aggregates are.

To regenerate from a new export:

1. Place your `Timeline.json` in the repository root (next to `README.md`).
2. Run:

```bash
python data_pipeline/build_data.py
```

The script automatically locates `Timeline.json` relative to its own directory using `pathlib`, so it works on any OS without editing paths.

**Output files:** `overview.json`, `yearly.json`, `modes_by_year.json`, `monthly.json`, `dow_hour.json`, `state_summary.json`, `home_work_by_year.json`, `visit_heatmap.json`, `top_clusters.json`, `longest_trips.json`, `visit_stats.json`, `all_places.json`.

## Stack

- Static HTML / CSS / vanilla JS — no build step, no bundler
- [Chart.js 4](https://www.chartjs.org/) for charts
- [Leaflet 1.9](https://leafletjs.com/) + [Leaflet.heat](https://github.com/Leaflet/Leaflet.heat) for the interactive map
- [CARTO](https://carto.com/) dark basemap tiles
- Google Fonts: Space Grotesk, Inter, IBM Plex Mono

## Local development

```bash
# Serve the site locally
python -m http.server 8000
# Open http://localhost:8000/site/index.html
```

## Deploy

This is a static site — GitHub Pages can serve `site/` directly:

1. Push this repo to GitHub.
2. In repo **Settings → Pages**, set source to the `main` branch, folder `/site`.
3. Done — no build step, no GitHub Actions required, since the data is precomputed once and committed as static JSON.

## Privacy note

This project intentionally displays exact home/work coordinates by the data owner's own choice. If reusing this pipeline with someone else's data, consider rounding/jittering coordinates in `label_cluster()` and the heatmap export before publishing.

## Author

Built by [@extremesam](https://github.com/extremesam).
