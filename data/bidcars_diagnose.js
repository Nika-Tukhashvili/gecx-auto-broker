/* DIAGNOSTIC — paste into the bid.cars console. Shows the real response shape
 * and downloads it as bidcars_raw.txt so the parser can be fixed. */
(async () => {
  const URL_ = '/app/search/request?search-type=filters&status=All&type=Automobile&make=All&model=All&year-from=1900&year-to=2027&auction-type=All&page=1';
  const r = await fetch(URL_, { headers: { 'x-requested-with': 'XMLHttpRequest', accept: '*/*' }, credentials: 'include' });
  const t = await r.text();
  console.log('STATUS:', r.status, '| content-type:', r.headers.get('content-type'), '| length:', t.length);
  console.log('--- first 4000 chars ---\n' + t.slice(0, 4000));
  console.log('--- signal counts ---');
  console.log('images.bid.cars :', (t.match(/images\.bid\.cars/g) || []).length);
  console.log('pluto.bid.car   :', (t.match(/pluto\.bid\.car/g) || []).length);
  console.log('data-src        :', (t.match(/data-src/g) || []).length);
  console.log('.jpg            :', (t.match(/\.jpg/g) || []).length);
  console.log('looks like JSON :', t.trim().startsWith('{') || t.trim().startsWith('['));
  const b = new Blob([t], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = window.URL.createObjectURL(b); a.download = 'bidcars_raw.txt';
  document.body.appendChild(a); a.click(); a.remove();
  console.log('⬇️ Downloaded bidcars_raw.txt — send me this file.');
})();
