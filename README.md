# Universal AI Auto Broker

White-label platform (by Making Science) that helps customers import cars from US auctions (Copart / IAAI) to Georgia — search live auction inventory, get transparent to-the-door cost estimates to Poti port, and hand qualified leads to a certified human broker. The AI never places bids itself.

Multi-tenant: brand identity is injected per client (Caucasus Auto Import, Lion Auto, …) via a session parameter.

## Repository layout

| Path | What it is |
|---|---|
| `demo-page/` | The public website (this is what GitHub Pages serves) |
| `demo-page/index.html` | Landing page + embedded AI chat assistant |
| `demo-page/inventory.html` | Auction inventory browser (filters, photos, pagination) |
| `demo-page/calculator.html` | To-the-door landed-cost calculator |
| `demo-page/crm.html` | Broker Portal — leads dashboard (login demo) |
| `demo-page/assets/` | Shared CSS + the chat widget loader / lead bridge |
| `demo-page/*.json` | Vehicle inventory data (real bid.cars/Copart lots) |
| `data/bidcars_scraper.js` | Browser-console scraper that refreshes the inventory data |
| `data/bidcars_diagnose.js` | One-off helper to inspect the bid.cars API response |

## The AI assistant

The chat widget embeds a Google **CX Agent Studio** agent ("Auto Import Manager") that runs
in Google Cloud. It searches the inventory, calculates landed cost, answers general car
questions, and captures purchase-intent leads — all with safety guardrails (no bid execution,
no data leakage, PII redaction in logs). The website only embeds it; the agent lives in CES.

## Run locally

```bash
python3 -m http.server 8787 --directory demo-page
# open http://localhost:8787
```

## Hosting

GitHub Pages auto-deploys `demo-page/` on every push to `main` (see
`.github/workflows/deploy.yml`). Enable it once under **Settings → Pages → Source: GitHub Actions**.

## Refreshing inventory data

Run `data/bidcars_scraper.js` in a browser console logged into bid.cars; it downloads
`bidcars_inventory.json`. Replace `demo-page/bidcars_inventory.json` with it and push.
