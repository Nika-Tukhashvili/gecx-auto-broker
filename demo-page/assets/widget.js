// Helper for inventory "Ask AI" buttons. The chat widget itself is embedded
// via the static CES snippet in each page's <head>/<body> (see index.html).
window.askAiAboutLot = function (lot) {
  const text = `I'm interested in lot ${lot.lotId || lot.vin}: ${lot.year} ${lot.make} ${lot.model}` +
    (lot.damage ? ` (${lot.damage} damage)` : '') +
    (lot.estimatedBid ? `, ~$${Number(lot.estimatedBid).toLocaleString()} estimated bid` : '') +
    '. How much would it cost delivered to Georgia?';
  try { if (typeof window.__openChat === 'function') window.__openChat(); } catch (e) { /* noop */ }
  if (navigator.clipboard) navigator.clipboard.writeText(text);
  bridgeToast('💬 Question copied — paste it into the chat.');
};

function bridgeToast(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#073763;color:#fff;padding:.8rem 1.3rem;border-radius:10px;z-index:100000;font-size:.9rem;box-shadow:0 8px 24px rgba(0,0,0,.25);font-family:sans-serif';
    document.body.appendChild(t);
  }
  t.textContent = msg; t.style.display = 'block';
  clearTimeout(t._h); t._h = setTimeout(() => { t.style.display = 'none'; }, 4000);
}

// ─────────────────────────────────────────────────────────────────────────
// Chat open/close — OUR control, all screen sizes. The Google widget renders
// its dialog open by default, its titlebar has no close/minimize control, and
// its internal close states proved unreliable. So we own visibility: the whole
// widget layer is hidden until our floating button shows it. Two things this
// must get right:
//   1. Start hidden everywhere (matches the "click the chat bubble" hint), so
//      the chat never covers the page on load.
//   2. The widget locks PAGE SCROLL while it considers itself open (a CSS
//      `body:has(chat-messenger…:not(.messenger-hidden)){overflow:hidden}`
//      rule). Hiding the element with display:none does NOT clear that lock,
//      which froze scrolling on mobile. So when hidden we force scroll back on.
// The SDK's own state is never touched — the conversation is preserved.
// ─────────────────────────────────────────────────────────────────────────
(function chatToggle() {
  const style = document.createElement('style');
  style.textContent =
    // Hide the widget AND release the space it reserves. The SDK adds
    // body{overflow:hidden} and a right-side padding while it thinks the chat
    // is open; display:none alone leaves those in place (frozen scroll + an
    // empty white strip on the right). Adding the SDK's own `messenger-hidden`
    // class makes its `:not(.messenger-hidden)` rules stop matching, releasing
    // both — and these !important overrides are a belt-and-suspenders backup.
    'body.chat-hidden chat-messenger{display:none!important}' +
    'body.chat-hidden{overflow:auto!important;padding-right:0!important}' +
    '#chat-fab{position:fixed;right:20px;bottom:20px;z-index:2147483000;width:56px;height:56px;' +
    'border-radius:50%;border:none;background:#f0076f;color:#fff;font-size:24px;line-height:56px;' +
    'text-align:center;box-shadow:0 6px 20px rgba(0,0,0,.3);cursor:pointer;padding:0}' +
    // Docked look: once open, the same button relocates INSIDE the titlebar
    // (see setOpen) so it renders alongside the SDK's own new-chat/expand
    // icons — a small white circle matching their style, laid out by normal
    // flex flow instead of a measured absolute position.
    '#chat-fab.docked{position:static;width:32px;height:32px;border-radius:50%;' +
    'background:#fff;color:#333;font-size:16px;line-height:32px;box-shadow:none;margin:0 4px 0 0}';
  document.head.appendChild(style);
  document.body.classList.add('chat-hidden');            // start closed on every device

  const fab = document.createElement('button');
  fab.id = 'chat-fab'; fab.type = 'button'; fab.textContent = '💬';
  fab.setAttribute('aria-label', 'Open chat');

  function setOpen(open) {
    document.body.classList.toggle('chat-hidden', !open);
    // The SDK reserves a right-side padding and locks page scroll via its own
    // !important stylesheet rules while the chat is "open". We fake open/closed
    // without touching SDK state, so on CLOSE we must override those — and only
    // an INLINE style beats a stylesheet !important. On OPEN we remove the
    // overrides so the SDK reserves space for the panel as intended.
    if (open) {
      document.body.style.removeProperty('padding-right');
      document.body.style.removeProperty('overflow');
    } else {
      document.body.style.setProperty('padding-right', '0', 'important');
      document.body.style.setProperty('overflow', 'auto', 'important');
    }
    fab.textContent = open ? '✕' : '💬';
    fab.classList.toggle('docked', open);
    fab.setAttribute('aria-label', open ? 'Close chat' : 'Open chat');
    // Reparent into the titlebar-actions slot when open. This matters for the
    // fullscreen "expand" mode (chat-toggle-dialog-button): that mode renders
    // the panel as a native <dialog>, which paints in the browser's top layer
    // ABOVE every normal-DOM element — no z-index can out-rank it, so a
    // fixed-position button floating in document.body would be invisible
    // behind it. Slotting our button as a titlebar-actions child instead
    // means it's part of the SAME projected content, so it's carried into
    // the top layer with everything else — in both slide-in and expanded
    // dialog mode, docked or floating repositions itself for free.
    const container = document.querySelector('chat-messenger-container');
    if (open && container) {
      fab.setAttribute('slot', 'titlebar-actions');
      container.appendChild(fab);
    } else {
      fab.removeAttribute('slot');
      document.body.appendChild(fab);
    }
  }
  setOpen(false);   // enforce the closed layout immediately (clears any reserved space)
  fab.addEventListener('click', () => setOpen(document.body.classList.contains('chat-hidden')));
  document.body.appendChild(fab);

  // "Ask AI" buttons (askAiAboutLot) need the chat visible — expose an opener.
  window.__openChat = () => setOpen(true);
})();

// ─────────────────────────────────────────────────────────────────────────
// Session/token guard. The chat SDK stores the session id and its auth token
// as SEPARATE sessionStorage keys; when the 30-min session expires it clears
// the session keys but NOT the token, then mints a new session that reuses
// the stale token → every request 403s with "Session claim does not match
// the session name" and Retry can never recover. This runs BEFORE the
// (deferred) SDK: if the stored token's session claim doesn't match the
// current session (or the session is gone/expired), drop the token so the
// token broker mints a fresh one.
// ─────────────────────────────────────────────────────────────────────────
(function sessionTokenGuard() {
  function tokenSessionClaim(tok) {
    try {
      const payload = JSON.parse(atob(tok.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      const m = JSON.stringify(payload).match(/dfMessenger-[0-9a-fA-F-]+/);
      return m ? m[0] : null;
    } catch (e) { return null; }
  }
  function dropStaleToken() {
    try {
      const SS = window.sessionStorage;
      const tok = SS.getItem('chat-messenger-access-token');
      if (!tok) return false;
      const sid = SS.getItem('chat-messenger-sessionID');
      const exp = SS.getItem('chat-messenger-session-id-expires-at');
      const claim = tokenSessionClaim(tok);
      const sessionGone = !sid || (exp && new Date(exp) < new Date());
      const mismatch = !!(claim && sid && claim !== sid);
      if (sessionGone || mismatch) {
        SS.removeItem('chat-messenger-access-token');
        SS.removeItem('chat-messenger-access-token-expires-at');
        return true;
      }
    } catch (e) {}
    return false;
  }
  window.__dropStaleChatToken = dropStaleToken;   // exposed for testing
  dropStaleToken();
  // Runtime recovery: if the widget errors mid-session with a broken
  // token↔session binding, clear it and reload once so a fresh token is minted.
  let recovered = false;
  window.addEventListener('chat-messenger-error', () => {
    if (dropStaleToken() && !recovered) {
      recovered = true;
      setTimeout(() => window.location.reload(), 400);
    }
  });
})();

// ─────────────────────────────────────────────────────────────────────────
// Chat media enrichment. The agent's replies deliberately contain NO URLs
// (the voice engine reads URLs aloud character-by-character) — only lot
// numbers like "Lot #0-45210399". This module watches the chat's (open)
// shadow DOM and, under any message that mentions a lot number, injects the
// car's photo strip + a "View on bid.cars" button built from our own data
// (lot_media.json: lotId → [imageId, tag]). Visuals without spoken URLs,
// and links that can never be hallucinated.
// ─────────────────────────────────────────────────────────────────────────
(function chatMediaEnrichment() {
  const LOT_RE = /\b(\d-\d{6,9})\b/g;
  // fallback: "Lot #45425532" with the 0-/1- prefix dropped by the model
  const LOT_BARE_RE = /Lot\s*#?\s*(\d{7,9})\b/gi;
  let map = null, loading = null, digitsIdx = null;

  function loadMap() {
    if (!loading) {
      loading = fetch('lot_media.json').then(r => (r.ok ? r.json() : {}))
        .then(m => {
          map = m;
          digitsIdx = {};
          for (const k of Object.keys(m)) {
            const d = k.replace(/^\d-/, '');
            // ambiguous bare digits (same number under 0- and 1-) → never guess
            digitsIdx[d] = (d in digitsIdx) ? null : k;
          }
          return m;
        }).catch(() => { map = {}; digitsIdx = {}; return map; });
    }
    return loading;
  }
  // resolve either a full id ("0-45425532") or bare digits ("45425532") to a map key
  function resolve(id) {
    if (!map) return null;
    if (map[id]) return id;
    const full = digitsIdx && digitsIdx[String(id).replace(/^\d-/, '')];
    return full && map[full] ? full : null;
  }
  window.__lotMedia = { get: id => (map ? map[resolve(id)] : null), resolve, load: loadMap };
  window.lotMediaUrls = function (id) {
    const full = resolve(id);
    const e = full && map[full];
    if (!e) return null;
    const base = 'https://images.bid.cars/' + e[0] + '/' + e[1];
    return {
      images: [1, 2, 3].map(i => base + '-' + i + '.jpg'),
      link: 'https://bid.cars/en/lot/' + full + '/' + e[1],
      tag: e[1],
    };
  };

  function buildStrip(id) {
    const u = window.lotMediaUrls(id);
    if (!u) return null;
    const wrap = document.createElement('div');
    wrap.className = 'lot-media-strip';
    wrap.style.cssText = 'margin:.45rem 0 .6rem;max-width:100%';
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:6px;overflow-x:auto;margin-bottom:.4rem';
    u.images.forEach(src => {
      const img = document.createElement('img');
      img.src = src; img.loading = 'lazy'; img.alt = 'photo';
      img.style.cssText = 'height:88px;border-radius:8px;flex:none;object-fit:cover';
      img.onerror = () => img.remove();
      row.appendChild(img);
    });
    const a = document.createElement('a');
    a.href = u.link; a.target = '_blank'; a.rel = 'noopener';
    a.textContent = '🔗 View all photos & live bid on bid.cars';
    a.style.cssText = 'display:inline-block;font:600 12px sans-serif;color:#073763;border:1.5px solid #073763;border-radius:7px;padding:4px 10px;text-decoration:none';
    wrap.appendChild(row); wrap.appendChild(a);
    return wrap;
  }

  // The chat renders inside NESTED shadow roots (chat-messenger-container is
  // slotted light-DOM whose messages live in its own shadow tree). Neither
  // MutationObserver{subtree} nor textContent pierce shadow boundaries, so we
  // recursively walk elements + their shadowRoots, attach an observer to every
  // shadow root we discover, and enrich the DEEPEST element naming each lot.
  const observedRoots = new WeakSet();
  const observer = new MutationObserver(scheduleScan);

  function walk(node, visit, seen) {
    if (!node || seen.has(node)) return;
    seen.add(node);
    if (node.shadowRoot && !seen.has(node.shadowRoot)) {
      seen.add(node.shadowRoot);
      if (!observedRoots.has(node.shadowRoot)) {
        observedRoots.add(node.shadowRoot);
        observer.observe(node.shadowRoot, { childList: true, subtree: true, characterData: true });
      }
      node.shadowRoot.querySelectorAll('*').forEach(el => walk(el, visit, seen));
    }
    if (node.querySelectorAll) node.querySelectorAll('*').forEach(el => walk(el, visit, seen));
    if (node.nodeType === 1) visit(node);
  }

  function enrichEl(el) {
    if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'TEXTAREA') return;
    if (el.closest && el.closest('.lot-media-strip')) return;
    const text = el.textContent || '';
    if (!text || text.length > 4000) return;    // skip empty / huge containers
    const raws = [...text.matchAll(LOT_RE)].map(m => m[1])
      .concat([...text.matchAll(LOT_BARE_RE)].map(m => m[1]));
    if (!raws.length) return;
    const pairs = {};                            // resolved id -> raw string as written
    for (const raw of raws) { const id = resolve(raw); if (id && !(id in pairs)) pairs[id] = raw; }
    for (const id of Object.keys(pairs)) {
      const raw = pairs[id];
      let deepest = true;                        // no child element also contains it
      for (const c of el.children) {
        if (!c.classList.contains('lot-media-strip') && (c.textContent || '').includes(raw)) { deepest = false; break; }
      }
      if (!deepest) continue;
      if (el.querySelector('.lot-media-strip[data-lot="' + id + '"]')) continue;
      const strip = buildStrip(id);
      if (strip) { strip.dataset.lot = id; el.appendChild(strip); }
    }
  }

  function runScan() {
    const cm = document.querySelector('chat-messenger');
    if (!cm) return;
    // First pass: any lot mentions anywhere in the (deep) chat DOM?
    let found = false;
    walk(cm, el => {
      if (found) return;
      const t = el.textContent || '';
      if (t.length <= 4000 && (/\b\d-\d{6,9}\b/.test(t) || /Lot\s*#?\s*\d{7,9}\b/i.test(t))) found = true;
    }, new Set());
    if (!found) return;
    loadMap().then(() => walk(cm, enrichEl, new Set()));
  }

  let scanTimer = null;
  function scheduleScan() {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(runScan, 500);
  }

  // Kick scans on widget events (messages stream in — retry a few times so the
  // final text is caught), on any observed shadow-root mutation, and at start.
  function burst() { [400, 1500, 3500, 6000].forEach(ms => setTimeout(scheduleScan, ms)); }
  window.addEventListener('chat-messenger-response-received', burst);
  window.addEventListener('chat-messenger-request-sent', burst);
  let obsTries = 0;
  const obsIv = setInterval(() => {
    const cm = document.querySelector('chat-messenger');
    if (cm && cm.shadowRoot) {
      clearInterval(obsIv);
      runScan();                                 // also wires observers to all current roots
    }
    if (++obsTries > 60) clearInterval(obsIv);
  }, 500);
})();

// ─────────────────────────────────────────────────────────────────────────
// Chat → Broker Portal bridge (demo). The CES agent runs in Google's cloud
// and cannot reach this browser, so we listen to the widget's client-side
// events, capture what the user typed, and when the agent confirms a lead
// ("reference ID LD-…") we write it to the same localStorage the Broker Portal
// (crm.html) reads. Best-effort demo connector; production = agent POSTs to CRM.
// ─────────────────────────────────────────────────────────────────────────
(function leadBridge() {
  const KEY = 'broker_leads_v1';
  const recentUser = [];
  // Rolling record of the "current car" seen anywhere in the conversation
  // (user pastes + agent replies), so a captured lead carries its lot/photo/link.
  const car = { lot: null, image: null, link: null, vehicle: null };

  // The chat SESSION survives page reloads (sessionStorage) and restores its
  // history — but restored messages do NOT re-fire widget events, so an
  // in-memory-only car/recentUser is wiped by any mid-conversation reload and
  // the lead then lands in the portal with no car attached. Persist the
  // tracking state next to the chat session and restore it for the SAME
  // session only.
  const STATE_KEY = 'broker_bridge_state_v1';
  function chatSid() { try { return window.sessionStorage.getItem('chat-messenger-sessionID') || ''; } catch (e) { return ''; } }
  function saveState() {
    try { window.sessionStorage.setItem(STATE_KEY, JSON.stringify({ sid: chatSid(), car, recentUser })); } catch (e) {}
  }
  (function restoreState() {
    try {
      const st = JSON.parse(window.sessionStorage.getItem(STATE_KEY) || 'null');
      if (st && st.sid && st.sid === chatSid()) {
        Object.assign(car, st.car || {});
        (st.recentUser || []).slice(-15).forEach(m => recentUser.push(m));
      }
    } catch (e) {}
  })();

  // "Start new chat" (chat-reset-session-button) resets the CES conversation
  // but NOT this page — car/recentUser are plain in-memory state that would
  // otherwise keep answering from the PREVIOUS conversation. That let a stale
  // "my name is X" from an earlier chat outrank the real name typed in a
  // fresh one, since the name-match loop prefers that explicit phrasing.
  // Clear everything the moment the SDK reports a new session starting.
  window.addEventListener('chat-messenger-start-new-session', () => {
    recentUser.length = 0;
    car.lot = car.image = car.link = car.vehicle = null;
    try { window.sessionStorage.removeItem(STATE_KEY); } catch (e) {}
  });

  function collectStrings(o, depth, acc) {
    if (depth > 8 || o == null) return acc;
    if (typeof o === 'string') { if (o.trim()) acc.push(o); return acc; }
    if (typeof o === 'number') return acc;
    if (Array.isArray(o)) { for (const v of o) collectStrings(v, depth + 1, acc); return acc; }
    if (typeof o === 'object') { for (const k in o) { try { collectStrings(o[k], depth + 1, acc); } catch (e) {} } }
    return acc;
  }

  function isHuman(s) {
    // reject internal metadata: resource paths, ids, urls, json blobs
    if (!s || s.length > 120) return false;
    if (/[\/{}]|projects\/|locations\/|sessions\/|dfMessenger|reasoningEngines|https?:|audioEncoding|deployment/i.test(s)) return false;
    return /[a-zA-Z]/.test(s) || /\d{5,}/.test(s);
  }

  // Fill car.image/link/vehicle for the current car.lot from the media map.
  // If the lot can't be resolved, CLEAR image/link — carrying over a previous
  // car's media is exactly the wrong-car-on-the-lead-card bug.
  function applyLotMedia() {
    if (!car.lot || !window.lotMediaUrls) return;
    if (window.__lotMedia) window.__lotMedia.load();
    const u = window.lotMediaUrls(car.lot);
    if (!u) { car.image = null; car.link = null; return; }
    car.image = u.images[0];
    car.link = u.link;
    // tag is "YEAR-Make-Model[-Trim…][-VIN]"; drop a trailing VIN-ish token
    const parts = u.tag.split('-').filter(p => !/^[A-HJ-NPR-Z0-9]{11,}$/i.test(p));
    car.vehicle = parts.join(' ');
  }

  // Track the current car. CRITICAL: a message that mentions SEVERAL lot ids is a
  // search-results LIST — it says nothing about which car the client picked, so it
  // must NOT move the pointer (the old first-match rule pinned the cheapest car and
  // sent the WRONG car/link to the portal). Only single-lot texts (a pasted lot, a
  // detail reply, a lead confirmation) update the current car.
  function trackCar(text) {
    if (!text) return;
    const link = text.match(/https?:\/\/bid\.cars\/en\/lot\/[^\s"'()<>]+/i);
    if (link) {
      car.link = link[0].replace(/[).,]+$/, '');
      const fromLink = car.link.match(/\/lot\/([^\/\s]+)/);
      if (fromLink) { car.lot = fromLink[1]; applyLotMedia(); }
    }
    const ids = [...new Set([...text.matchAll(/\b(\d-\d{6,9})\b/g)].map(m => m[1]))];
    if (ids.length === 1 && ids[0] !== car.lot) {
      car.lot = ids[0];
      applyLotMedia();
    }
    // vehicle "YEAR Make Model" — only from single-car texts, so a results list
    // doesn't overwrite it with the first row's title
    if (ids.length <= 1) {
      const veh = text.match(/\b((?:19|20)\d{2}\s+[A-Z][A-Za-z.\-]+(?:\s+[A-Za-z0-9.\-]+){1,3})/);
      if (veh) car.vehicle = veh[1].replace(/[*_]/g, '').trim();
    }
  }

  function onUser(e) {
    try {
      const all = collectStrings(e && e.detail, 0, []);
      all.forEach(trackCar);
      const cand = all.filter(isHuman).sort((a, b) => b.length - a.length)[0];
      if (cand) { recentUser.push(cand.trim()); if (recentUser.length > 15) recentUser.shift(); }
      saveState();
    } catch (err) {}
  }

  function onResponse(e) {
    try {
      const strs = collectStrings(e && e.detail, 0, []);
      strs.forEach(trackCar);
      saveState();
      const text = strs.join('\n');
      // real create_lead references are exactly LD-<6 digits>; anything else
      // (e.g. a date-shaped "LD-20231008-1") is a hallucinated ref — ignore it
      const ref = (text.match(/\bLD-\d{6}\b(?!-)/) || [])[0];
      if (!ref) return;
      let arr = [];
      try { arr = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (x) {}
      // The confirmation message itself is the most authoritative source for WHICH
      // car the lead is about — the agent restates "… for the <car>, Lot #<id>".
      // If it names lot id(s), the LAST one wins over whatever we tracked earlier.
      const confIds = [...text.matchAll(/\b(\d-\d{6,9})\b/g)].map(m => m[1]);
      if (confIds.length) car.lot = confIds[confIds.length - 1];
      const confVeh = (text.match(/for (?:the|your)\s+((?:19|20)\d{2}\s+[A-Za-z][\w .\-]+?)[.\n,]/) || [])[1];
      // phone: first clean phone-like digit run across recent user messages.
      // Voice turns arrive as SPOKEN WORDS ("five five five one one two two
      // one one"), not digit characters, so the plain digit regex never
      // matches them — fall back to reading consecutive digit-words as a
      // phone number when no literal digits are found.
      const NUM_WORDS = { zero: '0', oh: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9' };
      function spokenDigits(str) {
        const tokens = str.toLowerCase().split(/[^a-z]+/).filter(Boolean);
        let best = '', cur = '';
        for (const t of tokens) {
          if (NUM_WORDS[t] !== undefined) { cur += NUM_WORDS[t]; if (cur.length > best.length) best = cur; }
          else cur = '';
        }
        return best.length >= 7 ? best : null;
      }
      let phone = null;
      for (const m of [...recentUser].reverse()) {
        const hit = m.match(/\+?\d[\d\s().\-]{5,}\d/);
        if (hit && hit[0].replace(/\D/g, '').length >= 7) { phone = hit[0].trim(); break; }
        const spoken = spokenDigits(m);
        if (spoken) { phone = spoken; break; }
      }
      // Duplicate guard: refs derive from the phone's tail, so two DIFFERENT people
      // (or test numbers) can share a ref — "same ref" alone must not drop a lead.
      // Skip only a true repeat: same ref AND same phone digits (or no phone to compare).
      const newDigits = (phone || '').replace(/\D/g, '');
      if (arr.some(l => l.ref === ref && (!newDigits || ((l.phone || '').replace(/\D/g, '') === newDigits)))) return;
      // name: prefer an explicit "my name is X" phrasing; else a short digit-free
      // message that reads like a person's name (phone-bearing messages excluded)
      let name = null;
      for (const m of [...recentUser].reverse()) {
        // Lazy word-by-word capture (1-4 words) that stops at punctuation, end of
        // string, or a connector like "and my phone is" — without a boundary here,
        // "my name is X and my phone is Y" swallowed "and my phone is" into the name.
        const said = m.match(/(?:my name is|name's|i am|i'm|this is)\s+([A-Za-z][A-Za-z'\-]*(?:\s+[A-Za-z][A-Za-z'\-]*){0,3}?)(?=[.,!?]|\s+(?:and|my|phone|number|is|calling|reaching)\b|$)/i);
        if (said) { name = said[1].trim(); break; }
      }
      if (!name) for (const m of [...recentUser].reverse()) {
        if ((m.match(/\d/g) || []).length >= 4) continue;   // phone-ish message, not a name
        const stripped = m.replace(/[\d+().\-]/g, '').replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
        const words = stripped.split(' ').filter(Boolean);
        if (words.length >= 1 && words.length <= 3 && /^[A-Za-z][A-Za-z '\-]{1,}$/.test(stripped) &&
            !/^(yes|no|ok|okay|show|more|hi|hello|thanks|calculate|find|search|buy|under|my|phone|number|toyota|porsche|corolla|hybrid|black|white|red)/i.test(stripped)) {
          name = stripped; break;
        }
      }
      // Write the lead only after the media map is ready, so lot → image/link/vehicle
      // all describe the SAME car (stale car.image from an earlier lot was the source
      // of wrong-car cards in the portal).
      const finish = () => {
        applyLotMedia();
        saveState();
        const veh = confVeh || car.vehicle;
        arr.unshift({
          name: name || 'Chat lead', phone: phone || '—', brand: 'Caucasus Auto Import',
          status: 'new', vehicle: veh || '', criteria: veh ? '' : 'Captured via AI assistant',
          lot: car.lot || '', image: car.image || '', link: car.link || '',
          ref, ago: 'just now', source: 'AI assistant',
        });
        localStorage.setItem(KEY, JSON.stringify(arr));
        bridgeToast('✅ Lead ' + ref + ' saved to the Broker Portal');
      };
      if (window.__lotMedia && car.lot) window.__lotMedia.load().then(finish, finish);
      else finish();
    } catch (err) {}
  }

  // Listen on window and (once present) on the chat-messenger element itself.
  ['chat-messenger-request-sent'].forEach(ev => window.addEventListener(ev, onUser));
  ['chat-messenger-response-received'].forEach(ev => window.addEventListener(ev, onResponse));
  let tries = 0;
  const iv = setInterval(() => {
    const cm = document.querySelector('chat-messenger');
    if (cm) {
      cm.addEventListener('chat-messenger-request-sent', onUser);
      cm.addEventListener('chat-messenger-response-received', onResponse);
      clearInterval(iv);
    }
    if (++tries > 40) clearInterval(iv);
  }, 500);
})();
