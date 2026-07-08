/* ============================================================================
 * bid.cars scraper v4 — resilient + resumable. Run in YOUR browser console.
 *
 * Fixes for rate limiting (HTTP 429):
 *   • On 429 it COOLS DOWN (45s → up to 3 min) and retries the SAME page,
 *     instead of skipping — so one run can finish despite the limiter.
 *   • Every car is saved to IndexedDB as it's fetched (survives tab close,
 *     no 5 MB localStorage cap). Completed makes are remembered.
 *   • RE-RUN the same script anytime to RESUME where it left off.
 *
 * HOW TO RUN:
 *   1. Open the bid.cars search results page (logged in).
 *   2. F12 → Console → paste this whole file → Enter. Leave the tab open.
 *   3. If it stalls on repeated 429s, just wait, then paste it again — it resumes.
 *   4. When done (or anytime) it downloads "bidcars_inventory.json".
 *      To export current progress manually at any point: exportBidcars()
 *      To start over from scratch: indexedDB.deleteDatabase('bidcars_scrape')
 * ==========================================================================*/
(async () => {
  const PAGES_PER_MAKE = 50;
  const DELAY_MS = 500;          // between pages (gentler than before)
  const COOLDOWN_START = 45000;  // wait after a 429, then back off
  const COOLDOWN_MAX = 180000;
  const MAX_429_WAITS = 6;       // give up a page after this many cooldowns

  const MAKES = [
    'Toyota','Honda','Ford','Chevrolet','Nissan','Hyundai','Kia','Jeep','Dodge',
    'Subaru','Volkswagen','GMC','BMW','Mercedes-Benz','Audi','Lexus','Mazda',
    'Chrysler','Ram','Cadillac','Buick','Acura','Infiniti','Volvo','Tesla',
    'Land Rover','Porsche','Mitsubishi','Lincoln','Jaguar','Fiat','Mini',
    'Genesis','Maserati','Alfa Romeo','Bentley','Ferrari','Lamborghini',
    'Pontiac','Saturn','Mercury','Hummer','Scion','Suzuki','Rolls-Royce',
    'Aston Martin','McLaren','Rivian','Lucid','Polestar','Saab','Smart',
  ];

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // ── IndexedDB (persistent store) ──
  function openDb() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('bidcars_scrape', 1);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains('cars')) db.createObjectStore('cars', { keyPath: '_k' });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  const putCars = (db, arr) => new Promise((res, rej) => {
    if (!arr.length) return res();
    const tx = db.transaction('cars', 'readwrite'); const s = tx.objectStore('cars');
    arr.forEach(c => c._k && s.put(c)); tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  });
  const countCars = db => new Promise(res => { const q = db.transaction('cars').objectStore('cars').count(); q.onsuccess = () => res(q.result); });
  const getAllCars = db => new Promise(res => { const q = db.transaction('cars').objectStore('cars').getAll(); q.onsuccess = () => res(q.result); });
  const getMeta = (db, k, def) => new Promise(res => { const q = db.transaction('meta').objectStore('meta').get(k); q.onsuccess = () => res(q.result === undefined ? def : q.result); });
  const setMeta = (db, k, v) => new Promise((res, rej) => { const tx = db.transaction('meta', 'readwrite'); tx.objectStore('meta').put(v, k); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });

  // ── parsing ──
  function money(v){ if(typeof v==='number') return v; const n=parseInt(String(v||'').replace(/[^0-9]/g,''),10); return isNaN(n)?0:n; }
  const TWO_WORD=['mercedes-benz','land rover','alfa romeo','aston martin'];
  function parseName(name){
    const [head,...t]=(name||'').split(','); const trim=t.join(',').trim();
    const toks=head.trim().split(/\s+/); const year=/^\d{4}$/.test(toks[0])?toks[0]:'';
    let rest=(year?toks.slice(1):toks).join(' '); let make=rest.split(' ')[0]||'';
    const low=rest.toLowerCase(); for(const m of TWO_WORD) if(low.startsWith(m)){make=rest.slice(0,m.length);break;}
    return {year,make:make.trim(),model:rest.slice(make.length).trim(),trim};
  }
  function toCar(r){
    const key=r.vin||r.lot; if(!key) return null;
    const {year,make,model,trim}=parseName(r.name_long||r.name);
    // Use the most realistic figure: the auction's value estimate or the highest
    // real bid signal — NOT the low starting bid (which is often just $15–$100).
    const bid=Math.max(money(r.final_bid),money(r.prebid_price),Number(r.estimated_max)||0,Number(r.estimated_min)||0)||0;
    return {_k:key,lotId:r.lot,vin:r.vin,year,make,model,trim,
      damage:(r.primary_damage&&r.primary_damage!=='---')?r.primary_damage:'',
      mileage:typeof r.odometer==='number'?r.odometer:null,runsDrives:r.start_code||'',
      hasKeys:(r.specs&&r.specs.key_info==='Present')?'YES':'',engine:(r.specs&&r.specs.engine_rendered)||'',
      titleType:r.sale_document||'',titleState:r.sale_document_state||'',location:r.location||'',
      status:r.search_status||'',estimatedBid:bid,priceLabel:r.final_bid_formatted||r.prebid_price||'',
      buyNow:money(r.buy_now_price)||null,
      image:(r.img&&r.img.img_1)||((r.img_large&&r.img_large.img_1)||''),
      imageLarge:(r.img_large&&r.img_large.img_1)||''};
  }
  function q(make){ return `/app/search/request?search-type=filters&status=All&type=Automobile&make=${encodeURIComponent(make)}&model=All&year-from=1900&year-to=2027&auction-type=All`; }

  async function fetchPage(base,p){
    let cooldown=COOLDOWN_START, waits=0;
    for(let attempt=0; attempt<MAX_429_WAITS+3; attempt++){
      try{
        const res=await fetch(`${base}&page=${p}`,{headers:{'x-requested-with':'XMLHttpRequest',accept:'*/*'},credentials:'include'});
        if(res.status===429){
          if(++waits>MAX_429_WAITS) return null;
          console.warn(`  ⏳ 429 (page ${p}) — cooling down ${Math.round(cooldown/1000)}s [wait ${waits}/${MAX_429_WAITS}]`);
          await sleep(cooldown); cooldown=Math.min(Math.round(cooldown*1.5),COOLDOWN_MAX); continue;
        }
        if(!res.ok) throw new Error('HTTP '+res.status);
        const txt=await res.text(); if(!txt.trim()) throw new Error('empty body');
        return JSON.parse(txt);
      }catch(e){ await sleep(2000); }
    }
    return null;
  }

  // ── export helper (callable anytime as exportBidcars()) ──
  async function doExport(db){
    const cars=(await getAllCars(db)).map(c=>{ const {_k,...rest}=c; return rest; });
    const out={source:'bid.cars per-make scrape (resumable)',count:cars.length,lots:cars};
    const blob=new Blob([JSON.stringify(out)],{type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='bidcars_inventory.json';
    document.body.appendChild(a); a.click(); a.remove();
    console.log(`⬇️ Exported bidcars_inventory.json with ${cars.length} cars.`);
    return cars.length;
  }

  const db=await openDb();
  window.exportBidcars=()=>doExport(db);
  const done=await getMeta(db,'doneMakes',[]);
  console.log(`▶ Resuming. Stored so far: ${await countCars(db)} cars. Makes already done: ${done.length}/${MAKES.length}.`);

  for(const make of MAKES){
    if(done.includes(make)){ console.log(`↷ ${make}: already done, skipping`); continue; }
    const base=q(make); let page=1, hasNext=true, batch=[], added=0, dead=false;
    while(hasNext && page<=PAGES_PER_MAKE){
      const json=await fetchPage(base,page);
      if(!json){ console.warn(`  ✗ ${make} page ${page} unrecoverable — saving progress, will finish on next run`); dead=true; break; }
      hasNext=!!json.next_page_url;
      const rows=json.data||[]; if(!rows.length) break;
      const cars=rows.map(toCar).filter(Boolean);
      batch.push(...cars); added+=cars.length;
      if(batch.length>=200){ await putCars(db,batch); batch=[]; }
      page++; await sleep(DELAY_MS);
    }
    if(batch.length) await putCars(db,batch);
    if(!dead){ done.push(make); await setMeta(db,'doneMakes',done); }
    console.log(`✓ ${make}: +${added} (total stored ${await countCars(db)})`);
    if(dead){ console.warn('⛔ Rate limit persisted. Progress saved. Wait a few minutes and paste the script again to resume.'); await doExport(db); return; }
  }

  console.log(`✅ All makes complete.`);
  await doExport(db);
})();
