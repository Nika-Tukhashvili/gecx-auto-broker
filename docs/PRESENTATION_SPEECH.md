# GECX AI Auto Broker — Presentation Speech (~10 minutes)

*Spoken talk track with live-demo cues. Plain text = say it. `[DO: …]` = do it on screen. Rough timing in brackets. ~1,350 words ≈ 9–10 minutes at a calm pace — trim the bracketed "optional" lines if running long.*

---

## Before the meeting — 5-minute checklist

- Open the demo site and **hard-refresh** it; open the **Broker Portal** in a second tab and sign in.
- In the chat, click **Start new chat** so you're on the latest version.
- Have **one photo of a damaged car saved on the desktop** for the photo-inspection moment.
- Use a **fresh test phone number** you haven't used before for the lead step.
- Demo in **text chat** (type, don't dictate). If asked about voice, use the Q&A answer below.
- Keep 2–3 **screenshots of a full conversation** as backup in case of network problems.

---

## 1. Opening — the problem *(0:00 – 0:45)*

Good morning, everyone. Before I show you any technology, let me describe a customer.

He's in Madrid — or Tbilisi, or Dubai, it's the same story. He knows that cars at US auctions like Copart sell for a fraction of the local price, even after shipping. He's seen his neighbor do it. But when he tries himself, he hits a wall: listings in a foreign language, auction fees he doesn't understand, shipping, customs, repair costs — and no idea what the car will *really* cost until it's too late.

So he calls a broker. And the broker's team spends hours every day answering the same three questions on the phone: *what do you have, what will it really cost me, and is this car in good shape?*

That is the gap we built for.

## 2. What we built *(0:45 – 1:45)*

We built an **AI auto broker** — a conversational assistant that lives on the importer's website and does the qualification work of a junior broker, around the clock, in the customer's language.

It searches real auction inventory — in this demo, over fifty-eight thousand real cars from Copart and IAAI. It shows photos and live auction links. It calculates the full to-the-door price — auction fees, towing, ocean freight, customs — for the customer's destination country. It estimates repair costs, and it can even look at a photo of the damage and price what it sees. And when the customer says "I want this one," it hands a fully prepared lead to a human broker.

One design decision I want to highlight up front, because it's what makes this trustworthy: **the AI never places bids and never touches money.** It informs, qualifies, and prepares. A certified human broker closes every deal. The AI makes the funnel wider and cheaper — the human stays where judgment and money are.

## 3. Live demo *(1:45 – 6:30)*

Let me show you. This is a working product, live on the web right now — not slides.

**[DO: show the website, open the chat]**

This is our demo brand. In a real deployment this is *your* brand — your name, your colors, your language.

**[DO: type — "I want a Toyota Corolla, 2021 or newer, under $20,000. Some damage is okay."]**

I talk to it the way a customer actually talks. No forms, no filters, no dropdowns. Behind the scenes, it turns my sentence into a precise search over the auction inventory.

**[Results appear]**

Notice three things. First — these are real cars, with real damage descriptions, mileage, titles, locations. Second — the budget is respected exactly: I said twenty thousand, so nothing above twenty thousand. Third — under every car: photos, and a link straight to the live auction page. One click and the customer is looking at the actual lot.

**[DO: type — "tell me more about the second one"]**

I didn't repeat the car's number — it remembers context, like a person would. "The second one," "that red one," "the one from Georgia" — all of that works.

**[DO: type — "what will be the total cost delivered?"]**

This is the killer question in this business, the one customers really care about — and here's the answer, itemized: winning bid, auction fees, inland towing, ocean freight, service fee, customs. Every line visible, nothing hidden.

The customs math you see is configured per destination. For our demo corridor it's engine-size and age based excise. For a Spanish importer it would be EU duty plus VAT, calculated to Valencia or Algeciras. That's configuration — not new development.

And note the honesty: it's labeled an estimate, and a certified broker confirms the final quote. The AI never over-promises.

**[DO: type — "what will the repairs cost?"]**

From the listing's damage description it gives an honest range. But now the part I like best.

**[DO: upload the damage photo — "what about this damage?"]**

I just gave it a photo, and it's genuinely *looking* at the car: which panels are hit, how severe it is, whether airbags deployed, whether the damage looks structural — and it prices each item. And it prices by make: a Porsche panel is not priced like a Corolla panel. This is the moment customers usually don't believe until they see it.

**[DO: type — "OK, I want to buy it" → give name → give the fresh phone number]**

The moment of truth. It asks for a name and phone, confirms, and creates the lead with a reference number the customer can write down.

**[DO: switch to the Broker Portal tab, refresh]**

And here is the other side of the business: the broker's portal. The lead is already here — the exact car, its photo, the auction link, the customer's phone, the reference. Your broker calls back in minutes and starts the conversation at "let's do the paperwork" instead of "so what are you looking for?"

That's the whole loop: anonymous visitor to qualified, car-specific lead — no human time spent.

## 4. How it's built, in one minute *(6:30 – 7:45)*

For the technical people in the room, briefly.

It runs on **Google Cloud** — Google's enterprise agent platform with the Gemini model family; that's also what reads the damage photos. The assistant works through a set of strictly typed tools: search, car details, cost calculation, repair estimation, lead capture. Every fact about a car — price, mileage, damage — comes **directly from inventory data**, and every lead lands with an exact reference.

Trust is engineered in: if the data doesn't state something — say, the color — it says so and points to the photos rather than speculating. It collects only a name and a phone number; transcripts are automatically redacted. It politely refuses everything outside its job — including bidding, payments, and financial advice.

## 5. We can build this for you *(7:45 – 9:15)*

Now the part that matters for this room: what you just saw is a **platform, not a one-off**.

Brand, greeting, languages, destination port, customs formulas, fee structure, broker callback promise — all of that is **configuration, not code**. The same engine that quotes excise for Georgia quotes EU duty plus VAT for Spain.

Connecting your inventory takes one of two shapes, whichever fits your policies: **you keep your data** and give us API access — or **you send us a data feed** and we host and sync it. Leads flow directly into **your CRM** — or you use the hosted broker portal you just saw. We have a full technical integration guide ready for your engineers; onboarding a pilot is measured in **weeks, not months**.

*(Optional, if the audience is broader than automotive:)* And one more thought — the pattern underneath is universal: search a large inventory, explain true costs, assess condition, qualify the customer, and hand a ready deal to a human expert. Cars today; the same engine fits real estate, equipment, any considered purchase with a specialist in the loop.

## 6. Close *(9:15 – 10:00)*

To sum up: customers get instant, honest answers in their own language at any hour. Brokers stop repeating themselves and receive prepared, car-specific leads. And the business gets a wider funnel at near-zero marginal cost per conversation.

The demo is live on the public internet — I'll share the link, and I genuinely encourage you to try to confuse it over coffee.

We'd love to configure a pilot on your brand and your inventory. Thank you — and I'm happy to take questions.

---

## Q&A cheat sheet *(not part of the 10 minutes)*

**"What if it quotes a wrong price?"** — Every figure is labeled an estimate and built from data, not guessed; a certified broker confirms the final quote before any bid. The AI widens the funnel; the human owns the commitment.

**"Which languages?"** — Language is configuration. The demo ships two; adding your market's language is part of onboarding, not development.

**"Our inventory data is sensitive."** — Then it never leaves you: in one integration mode we call your APIs and store nothing. The other mode — you ship us a feed — exists for partners who prefer not to run public APIs.

**"How long to launch a pilot?"** — Weeks, not months. The fastest path: your API credentials or a data export, your fee schedule and customs rules, your branding — we configure and test together.

**"What does it cost?"** — Depends on integration mode and volume; the honest answer is a scoping conversation. The demo itself runs on standard Google Cloud infrastructure with predictable per-conversation costs.

**"Can it talk — voice?"** — It holds voice conversations today, and full voice-driven search is on the production roadmap. For pilots we lead with chat, which is where customers convert best anyway.

**"Can it bid for the customer?"** — Deliberately no. Bidding and payments stay with certified humans — that's a trust and compliance feature, not a limitation.

**"What if the customer doesn't pick a car?"** — It still captures the lead with their criteria — "black Toyota hybrid, up to eighteen thousand" — so the broker can hunt for them. No conversation is wasted.

**"What about scale — we have millions of vehicles?"** — The demo carries fifty-eight thousand cars; the production architecture queries a live database and scales to millions, with prices always current.

**"Where does customer data go?"** — Google Cloud, in a region agreed by contract. Only a name and phone are collected; transcripts are automatically redacted; nothing is sold or shared.
