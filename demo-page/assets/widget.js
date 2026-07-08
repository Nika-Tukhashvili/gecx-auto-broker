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

  function collectStrings(o, depth, acc) {
    if (depth > 8 || o == null) return acc;
    if (typeof o === 'string') { if (o.trim()) acc.push(o); return acc; }
    if (typeof o === 'number') return acc;
    if (Array.isArray(o)) { for (const v of o) collectStrings(v, depth + 1, acc); return acc; }
    if (typeof o === 'object') { for (const k in o) { try { collectStrings(o[k], depth + 1, acc); } catch (e) {} } }
    return acc;
  }

  function onUser(e) {
    try {
      const strs = collectStrings(e && e.detail, 0, []);
      // the user's typed query is usually the longest human-ish string
      const cand = strs.filter(s => s.length < 200 && /[a-zA-Z]/.test(s) && !s.includes('{') && !s.startsWith('http'))
                       .sort((a, b) => b.length - a.length)[0];
      if (cand) { recentUser.push(cand.trim()); if (recentUser.length > 15) recentUser.shift(); }
    } catch (err) {}
  }

  function onResponse(e) {
    try {
      const text = collectStrings(e && e.detail, 0, []).join('\n');
      const ref = (text.match(/LD-[A-Za-z0-9]+/) || [])[0];
      if (!ref) return;
      let arr = [];
      try { arr = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (x) {}
      if (arr.some(l => l.ref === ref)) return;
      const veh = (text.match(/for (?:the|your)\s+((?:19|20)\d{2}\s+[A-Za-z][\w .\-]+?)[.\n,]/) || [])[1];
      const phone = [...recentUser].reverse().find(m => (m.replace(/\D/g, '').length >= 7));
      const name = [...recentUser].reverse().find(m =>
        /^[A-Za-z][A-Za-z .'-]{2,40}$/.test(m.trim()) &&
        !/^(yes|no|ok|okay|show|more|hi|hello|thanks|calculate|find|search|buy)/i.test(m.trim()));
      arr.unshift({
        name: name || 'Chat lead', phone: phone || '—', brand: 'Caucasus Auto Import',
        status: 'new', vehicle: veh || '', criteria: veh ? '' : 'Captured via AI assistant',
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
