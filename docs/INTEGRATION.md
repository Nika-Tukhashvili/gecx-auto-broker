# Universal AI Auto Broker — Partner Integration Guide

**Audience:** technical teams at auction marketplaces, salvage networks, and dealer platforms (e.g., Copart, IAAI, or regional aggregators) adopting the white-label AI Auto Broker.

**What the agent does:** conversational (chat + voice) assistant that searches your vehicle inventory, presents lots with photos and links, produces landed-cost and repair estimates, answers vehicle questions (including analyzing customer-uploaded photos), and captures qualified purchase leads for human brokers. The agent **never places bids** and never writes to inventory — it is read-only on vehicles and write-only on leads.

There are two ways to connect your inventory. Pick one per deployment:

| | **Mode A — you host the data** | **Mode B — we host the data** |
|---|---|---|
| Who stores inventory | You | Us (your licensed copy) |
| What you provide | Live REST API endpoints | Bulk export + ongoing sync feed |
| Freshness | Always live | Depends on sync cadence (target ≤ 15 min) |
| Your ongoing effort | Keep API within SLA | Keep feed/webhooks flowing |
| Best when | Data cannot leave your systems | You'd rather ship data than run a public API |

**Lead capture (§4) is independent of the inventory mode** — every deployment needs one of the §4 delivery options, whichever mode you choose for inventory.

Either way, everything is normalized behind our internal Vehicle API, so the agent behaves identically:

```
                        ┌────────────  Mode A: your live REST API
Customer ↔ AI Agent ↔ our Vehicle API ┤
                        └────────────  Mode B: our DB ← ingestion ← your feed
                    ↘ our Lead Service → your CRM (§4)
```

---

## 1. Mode A — Partner-hosted APIs

You expose the endpoints below (HTTPS + JSON). Naming is illustrative — we adapt to your existing API if it covers the same contract.

### 1.1 `GET /v1/vehicles/search` — structured search *(required)*

The workhorse. Called on nearly every conversation turn that involves finding cars.

**Query parameters** (all optional, ANDed together):

| Param | Type | Notes |
|---|---|---|
| `make` | string | e.g. `Toyota` |
| `model` | string | free-text tokens matched against model/trim (`corolla se`) |
| `year_min`, `year_max` | int | model year bounds |
| `price_max`, `price_min` | number | against the **effective price** (below), USD |
| `mileage_max` | int | |
| `damage` | string[] | values from your facet dictionary (§1.9) |
| `title_status` | string[] | values from your facet dictionary (§1.9) |
| `fuel`, `transmission`, `drive`, `body_style`, `color` | string | exact-match facets (§1.9) |
| `runs_drives`, `has_keys` | bool | |
| `region` / `state` | string | location filter |
| `sort` | string | `price_asc` (default), `price_desc`, `year_desc`, `mileage_asc` |
| `limit`, `cursor` | | pagination; `limit` ≤ 50 |

**Effective price** (so price filters are testable): `buy_now` if present, else `current_bid`, else `estimated_value` — or declare a different single rule at onboarding; the conformance suite (§7) tests against the declared rule. Filters are evaluated at query time; live bids that later rise past a customer's cap are expected and handled conversationally (all prices are presented as "live bid — can change").

**Response:**

```json
{
  "total_count": 2409,
  "next_cursor": "abc123",
  "items": [ { /* Vehicle object — see §3 */ } ]
}
```

**Hard requirements:**
- Numeric bounds are **exact filters** against the effective price — a $15,000 budget must not return $16,000 cars.
- `total_count` must be accurate (the agent quotes it: "I found 2,409 matching cars").
- Empty result is a normal `200` with `total_count: 0` — not an error.

### 1.2 `GET /v1/vehicles/{lot_id}` — lot detail *(required)*

Full record for one lot: everything in the Vehicle object plus the **complete photo set**, current live bid, buy-now price, auction date/time, seller notes. Called when a customer says "tell me more about that one."

**Gone lots** return `404` with a distinguishing code so the agent can respond honestly and usefully:

```json
{ "error": { "code": "LOT_SOLD", "message": "…", "sold_at": "2026-07-14T18:00:00Z" } }
```

Codes: `LOT_SOLD` ("that one sold on the 14th — want me to find similar cars?"), `LOT_REMOVED`, `NOT_FOUND`. Search-index lag is tolerated: a lot may briefly appear in search results yet 404 here — **detail is the source of truth** and the agent trusts it.

### 1.3 `GET /v1/vehicles/semantic-search` — natural-language search *(recommended, optional)*

For fuzzy intents that structured facets can't express: *"a reliable family SUV with light damage, something cheap to fix."*

```
GET /v1/vehicles/semantic-search?q=reliable+family+suv+light+damage&price_max=15000&limit=10
```

- Typically backed by a vector index (pgvector, Elastic kNN, Vertex AI Vector Search) over title + description + condition notes.
- **Design rule we insist on:** vector similarity handles the *fuzzy* part only; any numeric/structured parameter present (`price_max`, `year_min`…) must still be applied as a **hard filter**. Cosine similarity does not understand "under $15,000" — a semantically great $18,000 car is still a wrong answer.
- Response shape identical to §1.1 plus a `relevance` score per item. If you don't offer this, the agent degrades gracefully to structured search — it's an enhancement, not a dependency.

### 1.4 `GET /v1/vehicles/{lot_id}/similar` *(optional)*

"Show me similar cars" — same class/price band, or embedding neighbors. Same response shape as search.

### 1.5 `GET /v1/fees/schedule` *(recommended)*

Your buyer-fee schedule, so landed-cost quotes use **your real numbers** instead of market approximations. Static JSON is fine; we cache and refresh daily.

```json
{
  "currency": "USD",
  "updated_at": "2026-07-01",
  "bid_fee_brackets": [
    { "bid_min": 0,    "bid_max": 4999.99,  "fee": 400 },
    { "bid_min": 5000, "bid_max": 9999.99,  "fee_percent": 8.5, "fee_min": 500 }
  ],
  "fixed_fees": [
    { "name": "gate_fee", "amount": 95 },
    { "name": "internet_bid_fee", "amount": 130 }
  ]
}
```

**Customs/destination formulas** (the other half of a landed-cost quote) are supplied by *you or your local brokerage partner* at onboarding via our configuration workbook (per destination port: duty/excise formulas, currency, clearance fees). We implement, you sign off on worked examples, and changes go through a config-change request. All quotes are labeled estimates until a human broker confirms.

### 1.6 Media (photos) — read this one carefully

Photos are load-bearing for this product: they render in the chat, on the website, on lead cards, and (server-side) feed the agent's visual damage analysis. Requirements:

- **Stable HTTPS URLs** per photo (thumbnail + full resolution), included in Vehicle objects.
- **No bot-walls / hotlink protection** on media for our backend — a Cloudflare challenge on an image URL silently breaks chat photos and blocks the agent's multimodal photo analysis. (We have been burned by exactly this.) To make allowlisting practical, **we publish**: a stable egress IP range, a distinctive `User-Agent`, and (if you prefer) a token header of your choosing on every media request.
- **CORS header** (`Access-Control-Allow-Origin`) on media if browser-side features (one-click "AI, inspect this car's photos") should work; otherwise we must mirror thumbnails, which needs license terms (§2.5).
- Signed URLs are acceptable if validity ≥ 24 h **and** fresh URLs are obtainable on demand via `GET /v1/vehicles/{lot_id}` (§1.2) — the detail response always carries currently-valid URLs.

### 1.7 Non-functional requirements (Mode A — what we need from you)

| Concern | Requirement |
|---|---|
| Auth | API key per tenant or OAuth2 client-credentials; no cookies/CAPTCHA on API paths |
| Latency | search p95 < 1000 ms, detail p95 < 500 ms — tool time sits inside conversational latency, and voice users notice everything |
| Rate limit | ≥ 20 rps sustained per tenant, burst 2×; `429` with `Retry-After` |
| Availability | ≥ 99.5%; maintenance windows announced ≥ 48 h ahead |
| Errors | Consistent JSON error body `{ "error": { "code", "message" } }`; never HTML error pages |
| Versioning | Versioned paths (`/v1/`); ≥ 6 months deprecation notice |
| Sandbox | Test environment + static test dataset + test API key, available during onboarding |

### 1.8 What we commit to you (both modes)

| Concern | Our commitment |
|---|---|
| Agent platform availability | ≥ 99.5% monthly |
| Lead delivery | **No silent loss** — see §4.1 retry/queue policy; worst case a lead arrives delayed, never dropped |
| Traffic identification | Published stable egress IPs + distinctive `User-Agent` for allowlisting |
| Support | Named technical contact, status page, incident acknowledgement ≤ 4 business hours |
| Mode B freshness | We monitor sync lag and reconciliation drift, and alert **both** parties on breach |
| Change management | ≥ 30 days notice before changes to payloads we send you (leads, webhooks) |

### 1.9 Facet dictionary *(required)*

Free-text customer language must map to your legal filter values ("front end damage" → `front_end`). Provide either:

- `GET /v1/meta/facets` — returns every filterable field with its legal values and display labels, **or**
- a static field dictionary at onboarding (same content).

The conformance suite (§7) drives its filter tests from this dictionary; without it neither the agent nor the tests can speak your enumeration.

---

## 2. Mode B — Partner-provided data (we ingest and host)

You ship us the data; we run the database, search index, optional vector index, and media handling. Our ingestion normalizes into the same internal Vehicle API, so the agent is identical. **Leads still flow per §4** — nothing in this section replaces the lead contract.

### 2.1 Initial bulk load

- **Format:** JSON Lines (preferred), CSV, or Parquet. One record per lot using the field list in §3.
- **Transport:** cloud bucket you write / we read (GCS or S3), SFTP drop, or a paginated bulk API.
- **Documentation:** a field dictionary — every enumeration's possible values (damage types, title types, status codes), units (miles vs km), and which fields can be null. (Same artifact as §1.9.)

### 2.2 Ongoing sync — pick one (ordered by preference)

1. **Event webhooks** → our ingestion endpoint (`lot.created`, `lot.updated`, `lot.price_changed`, `lot.sold`, `lot.removed`). Near-real-time; payload = full updated record (preferred) or delta.
2. **Delta feed:** an endpoint or file drop answering "everything changed since cursor/timestamp X", polled every 5–15 minutes. Must include **tombstones** (sold/removed lots), not just upserts.
3. **Scheduled full snapshot** (e.g., daily) — acceptable for slow-moving catalogs, but live-auction prices go stale; we mark prices "indicative" in this mode.

**Webhook mechanics (option 1):**

- Signature: `X-Signature: hex(HMAC-SHA256(shared_secret, raw_body))` + `X-Timestamp` header; we reject > 5 min clock skew (replay protection). Secret exchanged at onboarding, rotatable.
- Delivery: success = any `2xx` within 10 s. On failure, retry with exponential backoff (1 min → 1 h) for up to 24 h, then dead-letter on your side **and notify us** — dropped events are found by nightly reconciliation, but we'd rather hear sooner.
- Ordering: events may arrive out of order; we resolve by `updated_at` — a stale `lot.updated` arriving after `lot.sold` is ignored. Every payload must carry `updated_at`.
- Backpressure: if we return `429`, honor `Retry-After`.

**Freshness targets:** bid/price/status ≤ 15 min for active auctions; static attributes ≤ 24 h. A customer told a car is available when it sold an hour ago is the primary failure mode this section exists to prevent.

### 2.3 Data-quality requirements

- `lot_id` stable and unique forever (never recycled).
- Explicit nulls over silently missing fields; consistent units; documented enumerations.
- Records that fail validation are quarantined and reported back — we run nightly **reconciliation** (count + checksum comparison against a summary endpoint or manifest you expose) and alert both parties on drift (§1.8).

### 2.4 What we run on our side (so you know where data goes)

Validate → normalize → upsert into Postgres + search index (structured facets) + optional embedding index (semantic queries) → serve to the agent via our internal Vehicle API. Monitoring, alerting, and access logs included; your data is stored in a tenant-isolated dataset, encrypted at rest, in a region agreed per contract (the same residency terms cover lead PII — §6).

### 2.5 Images & licensing (Mode B)

- Ideal: your CDN URLs, hotlink-allowed (we store URLs only). Signed URLs inside feeds must obey the same ≥ 24 h validity as §1.6, with refresh available via the delta feed or a lookup endpoint — otherwise photo links in our copy silently expire.
- Alternative: we mirror photos to our storage — requires **explicit license terms** for storage, display, and (if the "AI photo inspection" feature is enabled) automated analysis.
- Contract must state retention/deletion policy for sold/removed lots and on termination.

---

## 3. Canonical Vehicle object

The minimum ("req") and recommended ("rec") fields — this is both the Mode A response schema and the Mode B feed schema:

```json
{
  "lot_id": "0-45130589",            // req — stable unique id
  "vin": "1NXBR12E31Z423366",        // rec
  "year": 2024,                       // req
  "make": "Toyota",                   // req
  "model": "Corolla",                 // req
  "trim": "LE",                       // rec
  "body_style": "sedan",              // rec
  "color": "red",                     // rec — customers ask constantly
  "damage_primary": "front_end",      // req
  "damage_secondary": "minor_dents",  // rec
  "title": { "type": "salvage", "state": "GA" },   // req
  "odometer": { "value": 54839, "unit": "mi", "status": "actual" },  // req
  "runs_drives": true,                // rec
  "has_keys": true,                   // rec
  "engine": "1.8L I4",                // rec
  "fuel": "gasoline",                 // rec
  "transmission": "automatic",        // rec
  "drive": "fwd",                     // rec
  "location": { "yard": "Raleigh", "state": "NC", "country": "US" }, // req
  "sale": { "datetime": "2026-07-20T14:00:00Z", "type": "auction" }, // rec
  "pricing": {
    "current_bid": 4175,              // req (at least one price signal)
    "estimated_value": 9200,          // rec
    "buy_now": null                   // rec
  },
  "photos": [
    { "thumb": "https://…-1s.jpg", "full": "https://…-1.jpg" }       // req ≥ 1
  ],
  "listing_url": "https://…",         // req — customers are sent here for live bid
  "updated_at": "2026-07-15T11:58:03Z" // req — also drives sync ordering (§2.2)
}
```

Missing "rec" fields degrade specific features gracefully (no `color` → the agent honestly says the listing doesn't state it), but each one you provide removes an "I don't know" from the conversation.

---

## 4. Leads & CRM (both modes)

The one write path in the system. A lead is captured when a customer confirms purchase intent and provides contact details. Delivery options, ranked by integration effort on your side:

1. **Your CRM endpoint** (§4.1) — leads appear directly in your existing workflow. Best experience.
2. **Standard CRM connector** — we deliver into HubSpot / Salesforce / Bitrix24 / Pipedrive via your OAuth app or API token; you give us a pipeline/stage mapping.
3. **Our hosted broker portal** — we host the lead dashboard, your brokers log in; optional daily CSV/email export. Zero integration, weakest reporting.

### 4.1 `POST /v1/leads` — lead intake contract (option 1)

```json
{
  "idempotency_key": "conv-8f2c…-1",
  "tenant": "caucasus-auto-import",
  "full_name": "Giorgi Beridze",
  "phone": "+995555123456",
  "language": "ka",
  "intent_type": "specific_lot",
  "lot_id": "0-45130589",
  "vehicle_description": "2024 Toyota Corolla LE",
  "budget_usd": 15000,
  "criteria": null,
  "conversation_id": "dfMessenger-…",
  "consent": {
    "contact_by_phone": true,
    "text_version": "consent-v2-2026-05",
    "timestamp": "2026-07-15T12:00:00Z"
  }
}
```

- `intent_type` ∈ `specific_lot` (then `lot_id` + `vehicle_description` are set) | `general_criteria` (then `criteria` is set).
- `criteria` schema: the structured search the customer described, plus their words:
  ```json
  { "make": "Toyota", "model": "Corolla", "year_min": 2021, "price_max": 20000,
    "damage": ["minor"], "free_text": "hybrid preferred, dark colors" }
  ```

**Response:** `{ "lead_id": "…", "reference": "LD-483920" }`

- The `reference` is read back to the customer **verbatim** — keep it short and human-speakable (it is also spoken aloud in voice conversations).
- **Idempotency semantics:** same `idempotency_key` replayed → `200` with the **same** `lead_id`/`reference` (not a new lead, not an error). Keys must be honored ≥ 24 h. Same key with a *different* payload → `409`.
- **Auth:** you issue us a per-tenant API key or OAuth2 client credentials for this endpoint (mirror of §1.7's requirement in the other direction).
- **Our retry/queue policy (the no-silent-loss guarantee):** on timeout/`5xx` we retry with exponential backoff (~5 attempts / 10 min); if the endpoint is still down, the lead is queued and redelivered for up to 24 h, and both sides are alerted after 30 min of failed delivery. The customer has already received their reference — the lead must eventually land.

### 4.2 Lead status webhook *(optional, recommended)*

If the broker portal or reporting should reflect live status, you push updates to us:

```json
POST {our_url}   // registered at onboarding; signed like §2.2 (HMAC-SHA256 + timestamp)
{ "lead_id": "…", "reference": "LD-483920", "status": "contacted",
  "changed_at": "2026-07-15T12:30:00Z" }
```

`status` ∈ `received` | `contacted` | `qualified` | `bidding` | `won` | `lost`.

### 4.3 Lead data handling

Leads carry name, phone, language, the exact lot (or criteria), budget, and consent (with text version for audit) — **no payment data, no government IDs, ever**. Lead records are stored as CRM business records (unredacted, that's their purpose) in the same contractual region as §2.4; conversation *transcripts* are separate and PII-redacted (automated DLP) before storage.

---

## 5. Multi-tenant / white-label configuration

Per deployment we configure: brand name and greeting, destination port & customs formulas for landed-cost quotes (§1.5 — supplied by you, signed off on worked examples), broker service fee, callback SLA ("a broker calls within 15 minutes"), supported languages, lead destination (§4), and enabled features (photo inspection, repair estimates, semantic search). One partner can run multiple brands off one integration.

---

## 6. Security & compliance summary

- Read-only on inventory; write-only on leads; the agent cannot bid, pay, or modify partner data.
- Secrets in a managed vault; per-tenant API keys; our egress IPs published for allowlisting (§1.8).
- PII minimization (name + phone only); transcripts DLP-redacted; lead records handled per §4.3; **deletion requests** via the named technical contact or a dedicated endpoint, fulfilled within 30 days with confirmation.
- Data residency: inventory (Mode B) and lead PII stored in the contractually agreed region.
- Guardrails on the agent: no prompt/tool disclosure, no financial/legal advice, injection-resistant, human-broker handoff for all transactions.
- Audit trail: every tool call and lead submission is logged with conversation id.

---

## 7. Onboarding checklist

**Mode A:** sandbox credentials + facet dictionary (§1.9) → we run a conformance suite against your endpoints (filter exactness against the declared effective-price rule, facet coverage, pagination, latency, error shapes incl. `LOT_SOLD`, media accessibility/CORS) → fee schedule + customs workbook loaded and signed off → lead endpoint round-trip incl. idempotency-replay and 409 tests → status webhook (if used) signature test → pilot tenant live.

**Mode B:** schema-mapping workshop (your field dictionary ↔ §3) → sample export validated → sync method chosen and tested (webhook signatures, ordering, tombstones / delta cursor / snapshot) → initial bulk load + reconciliation pass → freshness monitoring live → lead path per §4 tested → pilot tenant live.

Typical onboarding: **1–2 weeks (Mode A)**, **2–3 weeks (Mode B)**, assuming an existing API/export to start from.

---

*Questions during evaluation: your assigned technical contact (named at kickoff) — or open an issue against this document.*
