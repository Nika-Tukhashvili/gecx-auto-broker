// Helper for inventory "Ask AI" buttons. The chat widget itself is embedded
// via the static CES snippet in each page's <head>/<body> (see index.html).
window.askAiAboutLot = function (lot) {
  const text = `I'm interested in lot ${lot.lotId || lot.vin}: ${lot.year} ${lot.make} ${lot.model}` +
    (lot.damage ? ` (${lot.damage} damage)` : '') +
    (lot.estimatedBid ? `, ~$${Number(lot.estimatedBid).toLocaleString()} estimated bid` : '') +
    '. How much would it cost delivered to Georgia?';
  try {
    const cm = document.querySelector('chat-messenger');
    if (cm && typeof cm.open === 'function') cm.open();
  } catch (e) { /* noop */ }
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

  // Recursively walk light + shadow DOM, find the DEEPEST element containing
  // each lot id, and append the media strip right after its content.
  function scan(root, seenRoots) {
    if (!root || seenRoots.has(root)) return;
    seenRoots.add(root);
    const els = root.querySelectorAll ? root.querySelectorAll('*') : [];
    for (const el of els) {
      if (el.shadowRoot) scan(el.shadowRoot, seenRoots);
      if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'TEXTAREA') continue;
      const text = el.textContent || '';
      if (text.length > 4000) continue;         // skip huge containers
      const raws = [...text.matchAll(LOT_RE)].map(m => m[1])
        .concat([...text.matchAll(LOT_BARE_RE)].map(m => m[1]));
      const pairs = {};                          // resolved id -> raw string as it appears in text
      for (const raw of raws) { const id = resolve(raw); if (id && !(id in pairs)) pairs[id] = raw; }
      for (const id of Object.keys(pairs)) {
        // deepest node: no child element also contains this lot (as written in the text)
        const raw = pairs[id];
        let deepest = true;
        for (const c of el.children) {
          if ((c.textContent || '').includes(raw)) { deepest = false; break; }
        }
        if (!deepest) continue;
        // one strip per lot id per element (an element may mention several lots)
        if (el.querySelector && el.querySelector('.lot-media-strip[data-lot="' + id + '"]')) continue;
        const strip = buildStrip(id);
        if (strip) { strip.dataset.lot = id; el.appendChild(strip); }
      }
    }
  }

  let scanTimer = null;
  function scheduleScan() {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(() => {
      const cm = document.querySelector('chat-messenger');
      if (!cm) return;
      const txt = (cm.shadowRoot && cm.shadowRoot.textContent) || '';
      const hasLot = /\b\d-\d{6,9}\b/.test(txt) || /Lot\s*#?\s*\d{7,9}\b/i.test(txt);
      if (!hasLot) return;
      loadMap().then(() => scan(cm.shadowRoot || cm, new Set()));
    }, 600);
  }

  // Observe once the widget exists; re-scan (debounced) on every chat mutation.
  let obsTries = 0;
  const obsIv = setInterval(() => {
    const cm = document.querySelector('chat-messenger');
    if (cm && cm.shadowRoot) {
      new MutationObserver(scheduleScan).observe(cm.shadowRoot, { childList: true, subtree: true, characterData: true });
      clearInterval(obsIv);
      scheduleScan();
    }
    if (++obsTries > 60) clearInterval(obsIv);
  }, 500);
  // Also nudge on the widget's own response events (covers shadow re-renders).
  window.addEventListener('chat-messenger-response-received', scheduleScan);
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

  // Track the current car from any text (user paste or agent reply). Later text wins.
  // Agent replies carry no URLs (voice would read them aloud) — just lot numbers —
  // so image/link are derived from the lot id via the shared lot_media map.
  function trackCar(text) {
    if (!text) return;
    const img = text.match(/https?:\/\/images\.bid\.cars\/[^\s"'()<>]+?\.(?:jpe?g|png|webp)/i);
    if (img) car.image = img[0].replace(/[).,]+$/, '');
    const link = text.match(/https?:\/\/bid\.cars\/en\/lot\/[^\s"'()<>]+/i);
    if (link) car.link = link[0].replace(/[).,]+$/, '');
    // lot id: from the auction link path, else a bare "1-77215095" / "0-45043310"
    const fromLink = car.link && car.link.match(/\/lot\/([^\/\s]+)/);
    const bare = text.match(/\b(\d-\d{6,9})\b/);
    if (fromLink) car.lot = fromLink[1];
    else if (bare) car.lot = bare[1];
    if (car.lot && window.lotMediaUrls) {
      if (window.__lotMedia) window.__lotMedia.load();
      const u = window.lotMediaUrls(car.lot);
      if (u) {
        if (!img) car.image = u.images[0];
        if (!link) car.link = u.link;
        if (!car.vehicle) {
          // tag is "YEAR-Make-Model[-Trim…][-VIN]"; drop a trailing VIN-ish token
          const parts = u.tag.split('-').filter(p => !/^[A-HJ-NPR-Z0-9]{11,}$/i.test(p));
          car.vehicle = parts.join(' ');
        }
      }
    }
    // vehicle "YEAR Make Model" (e.g. from the "I'm interested in lot …: 2026 Toyota Corolla" paste
    // or the agent's "**2026 Toyota Corolla LE**" heading)
    const veh = text.match(/\b((?:19|20)\d{2}\s+[A-Z][A-Za-z.\-]+(?:\s+[A-Za-z0-9.\-]+){1,3})/);
    if (veh) car.vehicle = veh[1].replace(/[*_]/g, '').trim();
  }

  function onUser(e) {
    try {
      const all = collectStrings(e && e.detail, 0, []);
      all.forEach(trackCar);
      const cand = all.filter(isHuman).sort((a, b) => b.length - a.length)[0];
      if (cand) { recentUser.push(cand.trim()); if (recentUser.length > 15) recentUser.shift(); }
    } catch (err) {}
  }

  function onResponse(e) {
    try {
      const strs = collectStrings(e && e.detail, 0, []);
      strs.forEach(trackCar);
      const text = strs.join('\n');
      const ref = (text.match(/LD-[A-Za-z0-9]+/) || [])[0];
      if (!ref) return;
      let arr = [];
      try { arr = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (x) {}
      if (arr.some(l => l.ref === ref)) return;
      const veh = (text.match(/for (?:the|your)\s+((?:19|20)\d{2}\s+[A-Za-z][\w .\-]+?)[.\n,]/) || [])[1] || car.vehicle;
      // phone: first clean phone-like digit run across recent user messages
      let phone = null;
      for (const m of [...recentUser].reverse()) {
        const hit = m.match(/\+?\d[\d\s().\-]{5,}\d/);
        if (hit && hit[0].replace(/\D/g, '').length >= 7) { phone = hit[0].trim(); break; }
      }
      // name: a recent message that, with digits/punct stripped, reads like a person's name
      let name = null;
      for (const m of [...recentUser].reverse()) {
        const stripped = m.replace(/[\d+().\-]/g, '').replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
        const words = stripped.split(' ').filter(Boolean);
        if (words.length >= 1 && words.length <= 3 && /^[A-Za-z][A-Za-z '\-]{1,}$/.test(stripped) &&
            !/^(yes|no|ok|okay|show|more|hi|hello|thanks|calculate|find|search|buy|under|toyota|porsche|corolla|hybrid|black|white|red)/i.test(stripped)) {
          name = stripped; break;
        }
      }
      arr.unshift({
        name: name || 'Chat lead', phone: phone || '—', brand: 'Caucasus Auto Import',
        status: 'new', vehicle: veh || '', criteria: veh ? '' : 'Captured via AI assistant',
        lot: car.lot || '', image: car.image || '', link: car.link || '',
        ref, ago: 'just now', source: 'AI assistant',
      });
      localStorage.setItem(KEY, JSON.stringify(arr));
      bridgeToast('✅ Lead ' + ref + ' saved to the Broker Portal');
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
