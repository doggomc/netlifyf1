import type { FeatureContext } from '../app';
import { $ } from '../services/dom';
export function init(ctx: FeatureContext) {
const { sources, isStreamAvailable, buildUrl, BACKEND_API, mapPool, showToast } = ctx;
/* ═══════════════ DIAGNOSTICS — Copy Diagnostics button in footer ═══════════════ */
function diagParseUA(ua){
  ua = String(ua||'');
  let browser='Unknown', bver='-', os='Unknown', over='-', device='Desktop';
  if(/Edg\//.test(ua)){ browser='Edge'; const m=ua.match(/Edg\/([\d.]+)/); bver=m?m[1]:'-'; }
  else if(/OPR\/|Opera/.test(ua)){ browser='Opera'; const m=ua.match(/(?:OPR|Opera)\/([\d.]+)/); bver=m?m[1]:'-'; }
  else if(/Chrome\//.test(ua) && !/Chromium|Edg/.test(ua)){ browser='Chrome'; const m=ua.match(/Chrome\/([\d.]+)/); bver=m?m[1]:'-'; }
  else if(/Firefox\//.test(ua)){ browser='Firefox'; const m=ua.match(/Firefox\/([\d.]+)/); bver=m?m[1]:'-'; }
  else if(/Safari\//.test(ua) && !/Chrome/.test(ua)){ browser='Safari'; const m=ua.match(/Version\/([\d.]+)/); bver=m?m[1]:'-'; }
  else if(/Brave/.test(ua)){ browser='Brave'; bver='-'; }
  if(/Windows NT ([\d.]+)/.test(ua)){ os='Windows'; const m=ua.match(/Windows NT ([\d.]+)/); over=m?m[1]:'-'; const map={'10.0':'10/11','6.3':'8.1','6.2':'8','6.1':'7'}; over=map[over]||over; }
  else if(/Mac OS X ([\d_]+)/.test(ua)){ os='macOS'; const m=ua.match(/Mac OS X ([\d_]+)/); over=m?m[1].replace(/_/g,'.'):'-'; }
  else if(/Android ([\d.]+)/.test(ua)){ os='Android'; const m=ua.match(/Android ([\d.]+)/); over=m?m[1]:'-'; }
  else if(/iPhone|iPad|iPod/.test(ua)){ os='iOS'; const m=ua.match(/OS ([\d_]+)/); over=m?m[1].replace(/_/g,'.'):'-'; }
  else if(/Linux/.test(ua)) os='Linux';
  else if(/CrOS/.test(ua)) os='Chrome OS';
  if(/Mobile|iPhone|Android.*Mobile/.test(ua)) device='Mobile';
  else if(/Tablet|iPad/.test(ua)) device='Tablet';
  else device='Desktop';
  return {browser, bver, os, over, device, ua};
}
async function diagPing(url, label){
  const t0 = performance.now();
  const cleanUrl = String(url||'');
  if(!cleanUrl) return {label, url: cleanUrl, ok:false, status:'-', ms:0, error:'no url'};
  // Try HEAD first (405 on some hosts like strmfree — we treat that as alive and retry GET)
  try{
    const ctrl = new AbortController();
    const to = window.setTimeout(()=>ctrl.abort(), 5000);
    const r = await fetch(cleanUrl, { method:'HEAD', mode:'cors', credentials:'omit', cache:'no-store', redirect:'follow', signal: ctrl.signal, headers:{'Accept':'*/*'} });
    clearTimeout(to);
    const ms = Math.round(performance.now()-t0);
    // HEAD 405 on strmfree is expected — actually alive
    if(r.status===405) return {label, url: cleanUrl, ok:true, status:'405', ms, error:''};
    return {label, url: cleanUrl, ok: r.ok, status: String(r.status), ms, error: r.ok?'':'HTTP '+r.status};
  }catch(e){
    const msg = String(e && e.message || e);
    // CORS block shows as TypeError Failed to fetch — stream may still be alive via iframe
    if(/Failed to fetch|Load failed|NetworkError|CORS|aborted/i.test(msg)){
      // Retry GET no-cors to see if network at least reachable (opaque)
      try{
        const ctrl2 = new AbortController();
        const to2 = window.setTimeout(()=>ctrl2.abort(), 4000);
        const r2 = await fetch(cleanUrl, { method:'GET', mode:'no-cors', cache:'no-store', redirect:'follow', signal: ctrl2.signal });
        clearTimeout(to2);
        const ms2 = Math.round(performance.now()-t0);
        // opaque = 0 but no network error = reachable, likely 200 behind CORS
        if(r2.type==='opaque') return {label, url: cleanUrl, ok:true, status:'opaque', ms: ms2, error:''};
        return {label, url: cleanUrl, ok:false, status:'0', ms: ms2, error: msg};
      }catch(e2){
        const ms2 = Math.round(performance.now()-t0);
        const short = /Failed to fetch|Load failed|NetworkError/i.test(msg) && /Failed to fetch|Load failed|NetworkError/i.test(String(e2.message||e2)) ? 'fetch blocked' : (msg + ' | ' + String(e2.message||e2)).slice(0,40);
        return {label, url: cleanUrl, ok:false, status:'-', ms: ms2, error: short};
      }
    }
    const ms = Math.round(performance.now()-t0);
    return {label, url: cleanUrl, ok:false, status:'-', ms, error: msg};
  }
}
function diagIframePing(url, label){
  return new Promise((resolve)=>{
    const t0 = performance.now();
    const cleanUrl = String(url||'');
    if(!cleanUrl) return resolve({label, url: cleanUrl, ok:false, status:'-', ms:0, error:'no url'});
    // Use hidden iframe to test if device can actually load the embed (fetch is CORS-blocked, iframe is not)
    let done=false;
    let to=null;
    const finish=(ok,status,err)=>{
      if(done) return;
      done=true;
      clearTimeout(to);
      try{ iframe.remove(); }catch(_){}
      const ms=Math.round(performance.now()-t0);
      resolve({label, url: cleanUrl, ok, status, ms, error: err||''});
    };
    const iframe=document.createElement('iframe');
    // Match live player attributes so adblock sees same as real embed
    iframe.referrerPolicy='no-referrer';
    iframe.setAttribute('allow','autoplay *; encrypted-media *; fullscreen *; picture-in-picture *');
    // No sandbox — matches live cockpit (sandbox breaks streams)
    iframe.style.cssText='position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;border:0;';
    // onload = host reachable (even if player shows spinner, iframe HTML loaded)
    iframe.onload=()=>finish(true,'iframe ok','');
    iframe.onerror=()=>finish(false,'iframe blocked','');
    // Timeout = blocked on device (DNS / adblock / network)
    to=window.setTimeout(()=>finish(false,'timeout',''), 6000);
    try{
      iframe.src=cleanUrl;
      document.body.appendChild(iframe);
    }catch(e){
      finish(false,'-', String(e).slice(0,60));
    }
  });
}
function diagBool(v){ return v ? 'yes' : 'no'; }
async function buildDiagnosticsReport(){
  const now = new Date();
  const du = diagParseUA(navigator.userAgent||'');
  const conn = navigator.connection || {};
  const tz = (()=>{ try{ return Intl.DateTimeFormat().resolvedOptions().timeZone||'-'; }catch(_){ return '-'; }})();
  const lang = navigator.language || '-';
  const scr = window.screen || {};
  // site state — guard for early load
  let curEv='-', curSess='-', curSrc='-', curUrl='-', active='-';
  let avail='-', disabled='-', build='-';
  let iframeInfo='-';
  let hasStream = document.body.classList.contains('has-stream');
  try{ curEv = (typeof ctx.currentEvent!=='undefined' && ctx.currentEvent) ? (ctx.currentEvent.name + ' R' + ctx.currentEvent.round + ' ('+ctx.currentEvent.slug+')') : '-'; }catch(_){}
  try{ curSess = (typeof ctx.currentSession!=='undefined' && ctx.currentSession) ? (ctx.currentSession.name + ' ('+ctx.currentSession.slug+')') : '-'; }catch(_){}
  try{ const s=(typeof sources!=='undefined' && typeof ctx.currentSource!=='undefined') ? sources[ctx.currentSource] : null; curSrc = s ? (s.label + ' ['+s.id+']') : '-'; curUrl = '(hidden)'; }catch(_){}
  try{ active = (typeof ctx.activeView!=='undefined'?ctx.activeView:'-'); }catch(_){}
  try{ avail = (typeof isStreamAvailable==='function' && typeof ctx.currentSession!=='undefined') ? String(isStreamAvailable(ctx.currentSession)) : '-'; }catch(_){}
  try{ disabled = (typeof ctx.disabledSources!=='undefined' ? [...ctx.disabledSources].join(', ')||'(none)' : '-'); }catch(_){}
  try{ const el = document.querySelector<HTMLElement>('#player iframe'); if(el){ iframeInfo = 'sandbox=' + (el.getAttribute('sandbox')||'(none)') + ' | allow='+(el.getAttribute('allow')||'-').slice(0,80) + ' | loaded='+el.classList.contains('loaded') + ' | hasIframe=yes'; } else iframeInfo='(no iframe in DOM)'; }catch(_){}
  // storage / permissions
  let lsOk='-', wakeOk='-';
  try{ localStorage.setItem('__diag','1'); localStorage.removeItem('__diag'); lsOk='yes'; }catch(_){ lsOk='no ('+String(_).slice(0,60)+')'; }
  try{ wakeOk = ('wakeLock' in navigator) ? 'yes' : 'no'; }catch(_){ wakeOk='no'; }
  // ping site APIs + streams internally, but NEVER expose stream URLs in the report (hidden)
  const pingTargets = [];
  // add stream URLs internally (hidden from report)
  try{
    if(typeof sources!=='undefined') sources.forEach(s=>{
      let u='-'; try{ u = (typeof buildUrl==='function' ? buildUrl(sources.indexOf(s)) : ''); }catch(_){ u=''; }
      if(u && u.startsWith('http')) pingTargets.push({label: 'Stream '+s.label+' ['+s.id+']', url: u, hideUrl:true});
    });
  }catch(_){}
  pingTargets.push({label:'Race Control config (optional)', url: `${BACKEND_API}/api/site/config`, hideUrl:false});
  let pingResults='(no targets)';
  let out = [];
  try{
    // use mapPool if exists
    const poolFn = (typeof mapPool==='function' ? (items,fn)=>mapPool(items,fn,4) : (items,fn)=>Promise.all(items.map(fn)));
    const outRaw = await poolFn(pingTargets, t=> t.label.startsWith('Stream ') ? diagIframePing(t.url, t.label) : diagPing(t.url, t.label));
    out = outRaw.map((r,i)=>({...r, hideUrl: !!pingTargets[i].hideUrl}));
    pingResults = out.map(r=>{
      const flag = r.ok ? 'OK' : 'FAIL';
      const isStream = r.label.startsWith('Stream ');
      const urlPart = (r.hideUrl || isStream) ? '' : ` | ${r.url}`;
      // keep error inline, short — kept compact for a single Discord message
      const err = r.error ? ` — ${String(r.error).slice(0,70)}` : '';
      return `[${flag}] ${r.status} ${r.ms}ms | ${r.label}${urlPart}${err}`;
    }).join('\n');
  }catch(_){ pingResults='ping failed: '+String(_).slice(0,300); }

  // Discord-ready, ordered, compact (<1900 chars so it fits one Discord message)
  const gen = now.toISOString().slice(0,19).replace('T',' ') + ' UTC';
  const hostLine = `${location.host}${location.pathname}`;
  const uaShort = (du.ua||'').slice(0,120) + ((du.ua||'').length>120?'…':'');
  // Build ordered sections
  const sys = `${du.browser} ${du.bver} • ${du.os} ${du.over} • ${du.device} • ${innerWidth}x${innerHeight} DPR${devicePixelRatio} • TZ ${tz} • ${lang}`;
  const site = `${curEv} • ${curSess} • ${curSrc} • has-stream ${diagBool(hasStream)}`;
  // pingResults is already built as lines like "  [OK] 200 120ms | Stream WeStream [westream]" — convert to Discord ANSI
  const pingLines = String(pingResults||'').split('\n').filter(Boolean).map(l=>{
    // l is "  [OK] 200 120ms | Stream WeStream [westream]" or API line
    const isOk = l.includes('[OK]');
    const isFail = l.includes('[FAIL]');
    if(!isOk && !isFail) return l;
    // Use ansi colors inside code block: green for OK, red for FAIL, gray for meta
    const color = isOk ? '\u001b[0;32m' : '\u001b[0;31m';
    const reset = '\u001b[0m';
    // strip the leading "  [OK] " and keep rest
    const rest = l.replace(/^\s*\[(?:OK|FAIL)\]\s*/, '');
    const icon = isOk ? '✔' : '✘';
    return `${color}${icon} ${rest}${reset}`;
  }).join('\n');
  // Main report — outside code block for header, inside ansi for network
  const report = [
    `**FreeF1 Diagnostics** • ${gen} • ${hostLine}`,
    `> **System** • ${sys}`,
    `> **Site** • ${site}`,
    `> UA: \`${uaShort}\``,
    `> Iframe: \`${String(iframeInfo).slice(0,110)}\` • Disabled: \`${String(disabled).slice(0,80)||'(none)'}\``,
    '',
    '```ansi',
    pingLines || '\u001b[0;90mno pings\u001b[0m',
    '```',
    `*Send only to certified FreeF1 Discord devs. Generated ${gen} • ${location.href}*`
  ].join('\n');
  // Fallback if >1900 chars — keep ALL streams but strip error details to fit
  if(report.length > 1900){
    const compactPings = out.map(r=>{
      const flag = r.ok ? 'OK' : 'FAIL';
      return `[${flag}] ${r.status} | ${r.label}`;
    }).join('\n');
    const compact = [
      `**FreeF1 Diagnostics** • ${gen} • ${hostLine}`,
      `> **System** • ${sys.slice(0,90)}`,
      `> **Site** • ${site.slice(0,90)}`,
      '```ansi',
      String(compactPings).split('\n').map(l=>{
        const isOk = l.includes('[OK]');
        const color = isOk ? '\u001b[0;32m' : '\u001b[0;31m';
        return `${color}${isOk?'✔':'✘'} ${l.replace(/^\s*\[(?:OK|FAIL)\]\s*/,'')}\u001b[0m`;
      }).join('\n'),
      '```',
      `*Compact — full in console (F12). ${location.href}*`
    ].join('\n');
    if(compact.length < 1900) return compact;
    // last resort: truncate but warn
    return compact.slice(0,1880)+'\n```';
  }
  return report;
}
function showDiagCaution(){
  const o=$('diagCautionOverlay');
  if(!o) return;
  o.hidden=false;
  // force reflow for transition if CSS uses .open
  void o.offsetWidth;
  o.classList.add('open');
  document.body.style.overflow='hidden';
  // focus dismiss for a11y
  window.setTimeout(()=>$('diagCautionDismiss')?.focus(), 0);
}
function hideDiagCaution(){
  const o=$('diagCautionOverlay');
  if(!o) return;
  o.hidden=true;
  o.classList.remove('open');
  document.body.style.overflow='';
}
async function handleCopyDiagnostics(){
  const btn = $('copyDiagnosticsBtn');
  const orig = btn ? btn.textContent : '';
  if(btn){ btn.disabled=true; btn.textContent='Collecting…'; }
  try{
    showToast('Collecting diagnostics — checking feeds & APIs…', 'info');
    const report = await buildDiagnosticsReport();
    let copied=false;
    try{ await navigator.clipboard.writeText(report); copied=true; }catch(_){
      const ta=document.createElement('textarea');
      ta.value=report; ta.style.cssText='position:fixed;top:-1000px;left:-1000px;opacity:0';
      document.body.appendChild(ta); ta.focus(); ta.select();
      try{ copied=document.execCommand('copy'); }catch(_){}
      ta.remove();
    }
    if(copied) showToast('Diagnostics copied — paste to @doggo', 'success');
    else { showToast('Copy failed — report printed to console', 'error'); console.log(report); }
    console.log('%c'+report, 'font:11px/1.4 monospace; white-space:pre;');
    // show caution after copy
    showDiagCaution();
  }catch(e){
    showToast('Diagnostics failed: '+String(e).slice(0,80), 'error');
    console.error(e);
  }finally{
    if(btn){ btn.textContent=orig; btn.disabled=false; }
  }
}
$('copyDiagnosticsBtn')?.addEventListener('click', handleCopyDiagnostics);
$('diagCautionClose')?.addEventListener('click', hideDiagCaution);
$('diagCautionDismiss')?.addEventListener('click', hideDiagCaution);
$('diagCautionOverlay')?.addEventListener('click', (e)=>{ if(e.target && (e.target as HTMLElement).id==='diagCautionOverlay') hideDiagCaution(); });
document.addEventListener('keydown', (e)=>{ if(e.key==='Escape'){ const o=$('diagCautionOverlay'); if(o && !o.hidden) hideDiagCaution(); }});
$('diagCautionDiscord')?.addEventListener('click', ()=>{ hideDiagCaution(); });


return {};
}
