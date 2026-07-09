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
    // vehicle "YEAR Make Model" (e.g. from the "I'm interested in lot …: 2026 Toyota Corolla" paste
    // or the agent's "**2026 Toyota Corolla LE**" heading)
    const veh = text.match(/\b((?:19|20)\d{2}\s+[A-Z][A-Za-z.\-]+(?:\s+[A-Za-z0-9.\-]+){1,3})/);
    if (veh) car.vehicle = veh[1].replace(/[*_]/g, '').trim();
  }
  // If we have a lot + a bid.cars link but no photo, derive the first thumbnail:
  // the link tail IS the image "tag" (year-make-model-vin); we just lack the id hash,
  // so we can only set image when the agent actually included an images.bid.cars URL.

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
