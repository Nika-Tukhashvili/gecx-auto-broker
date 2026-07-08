# Universal AI Auto Broker — Demo Site

White-label demo site for the multi-tenant auto-import agent built in CX Agent Studio.
Making Science branding (magenta `#f0076f` / navy `#073763`).

## Pages

| Page | Purpose |
|---|---|
| `index.html` | Landing page with the three platform pillars and chat CTA |
| `inventory.html` | Browsable auction inventory (80 real Copart lots from `inventory.json`), filters by make / body / damage / year / budget, "Ask AI" button per lot pre-fills a question into the chat widget |
| `calculator.html` | To-the-door landed-cost calculator (bid + auction fees + inland towing + ocean freight to Poti + service fee + Georgian customs estimate) — mirrors the `logistics_cost_calculator` sub-agent's tool |

## Run locally

```bash
python3 -m http.server 8787 --directory demo-page
# open http://localhost:8787
```

(Must be served over HTTP — `inventory.html` fetches `inventory.json`.)

## Connect the chat widget

All pages load the widget via `assets/widget.js`. Edit the `WIDGET_CONFIG` block at the top:

1. In the Conversational Agents / CX Agent Studio console, open your agent →
   **Integrations → Dialogflow Messenger** (or **Deploy → Web widget** in the new console).
2. Copy `project-id`, `agent-id` and `location` into `WIDGET_CONFIG`.
3. Set `brandName` per tenant (`"Caucasus Auto Import"`, `"Lion Auto"`, …) — it is passed
   as the `brand_name` session parameter, which the agent reads via
   `$session.params.brand_name`.

If the agent is in the **new CX Agent Studio console**, swap the df-messenger script for the
newer `chat-messenger` widget (supports voice):
`https://www.gstatic.com/ces-console/fast/chat-messenger/prod/v1/chat-messenger.js`
— snippet is generated in the console's Deploy → Web widget page.

## Data

The inventory page loads whichever of these it finds first:

1. **`bidcars_inventory.json`** (preferred) — real bid.cars listings **with real photos
   and real prices**. Produced by running `../data/bidcars_scraper.js` in a browser
   logged into bid.cars (see below). Drop the downloaded file next to `inventory.html`.
2. **`inventory.json`** (fallback, committed) — 24,256 real lots from
   [rebrowser/copart-dataset](https://github.com/rebrowser/copart-dataset) (30 daily
   files, deduplicated). Real fields: year, make, model, damage, title, mileage,
   location, sale date. `estimatedBid` is **synthetic** (premium price/photo fields are
   redacted `[PREMIUM]` in the free tier), and there are no photos — cards use branded
   gradient tiles.

### Getting real photos (bid.cars)

bid.cars sits behind Cloudflare, so a server can't scrape it — but a logged-in browser
can. `../data/bidcars_scraper.js` fetches the site's JSON search API from inside your
browser session and downloads `bidcars_inventory.json` directly in the page's schema.
Images hotlink fine from `images.bid.cars` (verified), so no image download is needed.

1. Open the bid.cars search-results page while logged in.
2. F12 → Console → paste `bidcars_scraper.js` → Enter.
3. It downloads `bidcars_inventory.json` (tune `MAX_CARS` at the top).
4. Move that file into this `demo-page/` folder. The inventory page picks it up
   automatically and shows real cars with real photos.

`../data/bidcars_diagnose.js` is a one-off helper that dumps the raw API response, in
case the site's format changes and the scraper needs updating.

For a fully hands-off live feed later, [apiauctions.io](https://apiauctions.io/)
($0.01/req PAYG or $150/mo) serves the same Copart+IAAI data via a paid API token.
