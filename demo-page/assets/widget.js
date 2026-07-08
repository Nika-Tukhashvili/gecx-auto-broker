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
  const t = document.getElementById('toast');
  if (t) { t.textContent = '💬 Question copied — paste it into the chat.'; t.style.display = 'block'; setTimeout(() => t.style.display = 'none', 3200); }
};

// ─────────────────────────────────────────────────────────────────────────
// Chat → Broker Portal bridge (demo).
// The CES agent runs in Google's cloud and cannot reach this browser, so we
// listen to the widget's client-side events: capture what the user typed, and
// when the agent confirms a lead ("reference id LD-…"), write it to the same
// localStorage the Broker Portal (crm.html) reads. Best-effort demo connector;
// production would POST from the agent to a real CRM.
// ─────────────────────────────────────────────────────────────────────────
(function leadBridge() {
  const recentUser = [];   // recent user-typed messages (newest last)

  function deepFindText(obj, depth) {
    if (!obj || depth > 6) return '';
    if (typeof obj === 'string') return obj;
    if (Array.isArray(obj)) { for (const v of obj) { const r = deepFindText(v, depth + 1); if (r) return r; } return ''; }
    if (typeof obj === 'object') {
      if (typeof obj.text === 'string') return obj.text;
      for (const k of Object.keys(obj)) { const r = deepFindText(obj[k], depth + 1); if (r) return r; }
    }
    return '';
  }

  window.addEventListener('chat-messenger-request-sent', (e) => {
    try {
      const body = e.detail && e.detail.data && e.detail.data.requestBody;
      const txt = deepFindText(body, 0);
      if (txt && txt.trim()) recentUser.push(txt.trim());
      if (recentUser.length > 12) recentUser.shift();
    } catch (err) { /* noop */ }
  });

  window.addEventListener('chat-messenger-response-received', (e) => {
    try {
      const msgs = (e.detail && e.detail.data && e.detail.data.messages) || [];
      const text = msgs.map(m => (m && m.text) || '').join('\n');
      const ref = (text.match(/LD-[A-Za-z0-9]+/) || [])[0];
      if (!ref) return;

      let arr = [];
      try { arr = JSON.parse(localStorage.getItem('broker_leads_v1') || '[]'); } catch (x) {}
      if (arr.some(l => l.ref === ref)) return; // already captured

      // vehicle: "...for the 2021 Toyota Corolla SE." / "...for your 2021 Toyota ..."
      const veh = (text.match(/for (?:the|your)\s+((?:19|20)\d{2}\s+[A-Za-z][\w .\-]+?)[.\n,]/) || [])[1];
      // phone: most recent user message with 7+ digits
      const phone = [...recentUser].reverse().find(m => (m.replace(/\D/g, '').length >= 7));
      // name: most recent short alphabetic user message (no digits), 2+ words or a capitalized word
      const name = [...recentUser].reverse().find(m => /^[A-Za-z][A-Za-z .'-]{2,40}$/.test(m.trim()) && !/^(yes|no|ok|show|more|hi|hello|thanks)/i.test(m.trim()));

      arr.unshift({
        name: name || 'Chat lead',
        phone: phone || '—',
        brand: 'Caucasus Auto Import',
        status: 'new',
        vehicle: veh || '',
        criteria: veh ? '' : 'Captured via AI assistant',
        ref, ago: 'just now', source: 'AI assistant',
      });
      localStorage.setItem('broker_leads_v1', JSON.stringify(arr));
    } catch (err) { /* noop */ }
  });
})();
