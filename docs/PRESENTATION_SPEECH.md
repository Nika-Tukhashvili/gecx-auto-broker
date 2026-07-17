# GECX AI Auto Broker — Presentation Speech (~10 minutes)

*Spoken talk track with live-demo cues. Plain text = say it. `[DO: …]` = do it on screen. Timing in brackets. Simple English (B2). ~1,300 words ≈ 9–10 minutes at a calm pace. Lines marked "optional" can be cut if you run long.*

---

## Before the meeting — 5-minute checklist

- Open the demo site and **refresh** it. Open the **Broker Portal** in a second tab and sign in.
- In the chat, click **Start new chat** so you are on the latest version.
- Save **one photo of a damaged car on the desktop** for the photo moment.
- Use a **new test phone number** that you have not used before for the lead step.
- Demo in **text chat** (type, don't speak). If someone asks about voice, use the Q&A answer below.
- Keep 2–3 **screenshots of a full conversation** as a backup, in case of internet problems.

---

## 1. Opening — the problem *(0:00 – 0:45)*

Good morning, everyone. Before I show you any technology, let me tell you about a customer.

He lives in Madrid — or Tbilisi, or Dubai. The story is the same everywhere. He knows that cars at US auctions like Copart are much cheaper than at home, even after shipping. His neighbor bought one. But when he tries it himself, he gets stuck. The listings are in a foreign language. The auction fees are confusing. Shipping, customs, repair costs — he doesn't know what the car will really cost until it is too late.

So he calls a broker. And the broker's team spends hours every day answering the same three questions on the phone: *what cars do you have, what will it really cost me, and is this car in good condition?*

That is the problem we built this product for.

## 2. What we built *(0:45 – 1:45)*

We built an **AI auto broker**. It is a chat assistant that lives on the importer's website. It does the work of a junior broker — but 24 hours a day, and in the customer's own language.

It searches real auction inventory — in this demo, more than fifty-eight thousand real cars from Copart and IAAI. It shows photos and links to the auction pages. It calculates the full price to the customer's door — auction fees, transport, ocean shipping, customs. It estimates repair costs. It can even look at a photo of the damage and tell you what the repair will cost. And when the customer says "I want this one," it sends a ready lead to a human broker.

One design decision is very important, and I want to say it clearly: **the AI never places bids and never touches money.** It informs the customer and prepares the deal. A certified human broker closes every deal. The AI brings more customers in — the human stays in control of the money.

## 3. Live demo *(1:45 – 6:30)*

Let me show you. This is a working product, live on the internet right now — not slides.

**[DO: show the website, open the chat]**

This is our demo brand. In a real project, this is *your* brand — your name, your colors, your language.

**[DO: type — "I want a Toyota Corolla, 2021 or newer, under $20,000. Some damage is okay."]**

I write to it like I would talk to a person. No forms, no filters, no menus. Behind the scenes, it turns my sentence into an exact search over the auction inventory.

**[Results appear]**

Please notice three things. First — these are real cars, with real damage descriptions, mileage, titles, and locations. Second — the budget is respected exactly: I said twenty thousand, so nothing costs more than twenty thousand. Third — under every car there are photos and a link to the auction page. One click, and the customer sees the real lot.

**[DO: type — "tell me more about the second one"]**

I did not repeat the car's number. It remembers the conversation, like a person would. "The second one," "that red one" — all of that works.

**[DO: type — "what will be the total cost delivered?"]**

This is the most important question in this business. And here is the answer, line by line: winning bid, auction fees, transport inside the US, ocean shipping, service fee, customs. Every line is visible. Nothing is hidden.

The customs calculation is configured for each destination country. In our demo it uses engine size and age. For a Spanish importer, it would be EU duty plus VAT, calculated to Valencia or Algeciras. That is configuration — not new development.

And please notice the honesty: it says this is an estimate, and a certified broker confirms the final price. The AI never promises too much.

**[DO: type — "what will the repairs cost?"]**

From the damage description, it gives an honest price range. But now — the part I like the best.

**[DO: upload the damage photo — "what about this damage?"]**

I just gave it a photo, and it really *looks* at the car. Which parts are damaged, how bad it is, whether the airbags opened, whether the frame may be damaged — and it gives a price for each item. And it prices by car brand: a Porsche part does not cost the same as a Corolla part. Customers usually don't believe this until they see it.

**[DO: type — "OK, I want to buy it" → give name → give the new phone number]**

Now the final step. It asks for a name and a phone number, confirms them, and creates the lead with a reference number the customer can write down.

**[DO: switch to the Broker Portal tab, refresh]**

And here is the other side of the business — the broker's portal. The lead is already here: the exact car, its photo, the auction link, the customer's phone, the reference number. Your broker calls back in a few minutes, and the conversation starts at "let's do the paperwork" — not at "so, what are you looking for?"

That is the full loop: from an unknown website visitor to a ready lead for one specific car — with zero human time spent.

## 4. How it is built — one minute *(6:30 – 7:45)*

Now, briefly, for the technical people in the room.

It runs on **Google Cloud** — Google's enterprise agent platform, with the Gemini model family. The same model also reads the damage photos. The assistant works through a fixed set of tools: search, car details, cost calculation, repair estimate, lead capture. Every fact about a car — the price, the mileage, the damage — comes **directly from the inventory data**. Every lead has an exact reference number.

Trust is built in. If the data does not say something — for example, the color — the assistant says so and points to the photos. It does not guess. It collects only a name and a phone number, and the conversations are automatically cleaned of personal data. And it politely refuses everything outside its job — including bids, payments, and financial advice.

## 5. We can build this for you *(7:45 – 9:15)*

Now the part that matters most for this room: what you just saw is a **platform, not a one-time project**.

The brand, the greeting, the languages, the destination port, the customs formulas, the fees — all of this is **configuration, not code**. The same engine that calculates customs for Georgia can calculate EU duty plus VAT for Spain.

To connect your inventory, there are two options — you choose what fits your company. Option one: **you keep your data**, and we call your APIs. Option two: **you send us a data feed**, and we host it and keep it in sync. Leads go directly into **your CRM** — or you use the broker portal you just saw. We have a full technical integration guide ready for your engineers. A pilot takes **weeks, not months**.

*(Optional, if the audience is wider than automotive:)* One more thought. The pattern under this product is universal: search a large inventory, explain the real costs, check the condition, prepare the customer, and hand the deal to a human expert. Today it is cars. The same engine works for real estate, machines — any expensive purchase where a specialist closes the deal.

## 6. Close *(9:15 – 10:00)*

To sum up. Customers get instant, honest answers, in their own language, at any hour. Brokers stop repeating themselves and receive ready, car-specific leads. And the business gets more customers at almost zero extra cost per conversation.

The demo is live on the public internet. I will share the link — please try to confuse it during the coffee break. I really mean it.

We would love to configure a pilot with your brand and your inventory. Thank you — and I am happy to take questions.

---

## Business Q&A *(not part of the 10 minutes)*

**"What if it gives a wrong price?"** — Every number is marked as an estimate and comes from data, not from guessing. A certified broker confirms the final price before any bid. The AI brings the customers in; the human makes the commitment.

**"Which languages?"** — Language is configuration. The demo has two; adding your market's language is part of the setup, not new development.

**"Our inventory data is sensitive."** — Then it never leaves you. In one integration option, we call your APIs and store nothing. The other option — sending us a data feed — is for partners who prefer not to run public APIs.

**"How long does a pilot take?"** — Weeks, not months. The fastest path: your API access or a data export, your fee table and customs rules, your branding — and we configure and test it together.

**"What does it cost?"** — It depends on the integration option and the volume. The honest answer is a short scoping call. The running costs are standard Google Cloud costs, predictable per conversation.

**"Can it talk — voice?"** — It can hold a voice conversation today, and full voice search is on the production roadmap. For pilots we start with chat, because that is where customers convert best anyway.

**"Can it bid for the customer?"** — No, and that is by design. Bids and payments stay with certified humans. It is a trust feature, not a missing feature.

**"What if the customer doesn't choose a car?"** — The assistant still saves the lead with the customer's wishes — "black Toyota hybrid, up to eighteen thousand" — so the broker can search for them. No conversation is wasted.

**"We have millions of vehicles — does it scale?"** — The demo carries fifty-eight thousand cars. The production version reads from a live database and scales to millions, with prices always up to date.

**"Where does customer data go?"** — Google Cloud, in a region we agree on in the contract. Only a name and phone number are collected. Conversations are automatically cleaned of personal data. Nothing is sold or shared.

---

## Technical Q&A *(for engineers and CTOs)*

**"What is the technology stack?"** — Google CX Agent Studio (Google's enterprise agent platform) with the Gemini model family. The assistant's tools are typed Python functions: search, car details, cost calculation, repair estimate, lead capture. The demo website is simple HTML and JavaScript.

**"Which model do you use? Can we choose?"** — Gemini, natively multimodal — the same model reads the damage photos. On the managed platform the model is set by Google; in the production setup (our own runtime on Cloud Run), the model can be selected per client.

**"Where does the car data come from? Is it live?"** — In the demo, the inventory is a snapshot of about fifty-eight thousand real auction lots. In production, the agent reads from a live database or from your APIs, with prices refreshed within minutes. The two integration options are described in our integration guide.

**"How do you make sure the answers match the data?"** — The assistant can only present cars that come back from a tool call, and the tools apply exact filters — a $15,000 budget can never return a $16,000 car. Price, mileage, and damage come from the data fields, not from the model's imagination of the text.

**"How does the photo analysis work?"** — The model is multimodal, so it sees the uploaded image directly — no separate vision API. It identifies the damaged areas and the severity. The prices themselves come from a deterministic pricing tool, so the numbers are stable and adjustable. The model does the seeing; the tool does the money.

**"What about prompt injection and security?"** — Text inside listings or user messages is treated as data, never as instructions. There are dedicated guardrails for prompt security and content safety, plus rules that stop the assistant from revealing its configuration. Personal data in transcripts is automatically redacted with Google DLP.

**"What are the API requirements on our side?"** — Three main endpoints: search with exact filters, lot detail, and lead intake with idempotency (a retry must not create a duplicate lead). Plus a list of your damage and title values, and photo URLs that our systems can access. It is all written down in the integration guide, with a test checklist.

**"How does lead delivery work reliably?"** — Lead creation is idempotent and has a retry queue: if your CRM endpoint is down, we retry and hold the lead until it is delivered — a lead is never silently lost. Optionally you can push status updates back to us (contacted, won, lost).

**"What about latency and scale?"** — On the managed platform, one conversation turn takes a few seconds, like any chat assistant. For production scale we recommend our own runtime with a database plus a search index — millions of vehicles, sub-second search, and full control of quotas.

**"Can we run it on-premise?"** — The platform is Google Cloud. What we can do: run it in a dedicated Google Cloud project, in a region you choose, with your data isolated per contract. Full on-premise is not part of this product today.

**"What happens if the AI service is down?"** — The website keeps working — inventory, calculator, and the broker's contact details are all independent of the chat. The chat shows a retry message, and no lead that was already created is lost.

**"How do you test changes?"** — Every change ships as a new version, and the live widget points to a fixed version — so we test first and release consciously. We also keep evaluation scenarios (search, refusals, lead capture) that we run against the agent after changes.
