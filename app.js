/* ═══════════ SAFE STORAGE (never throws) ═══════════ */
const store={
  get(k){try{return localStorage.getItem(k)}catch(e){return this._m[k]??null}},
  set(k,v){try{localStorage.setItem(k,v)}catch(e){this._m[k]=String(v)}},
  _m:{}
};

/* ═══════════ AUTH ═══════════ */
const AUTH_PROTECTION_ENABLED=true;
const AUTHORIZED_DOMAIN='freef1.netlify.app';
const AUTH_API_URL='https://f1free.onrender.com/api/auth/verify';

/* Content protection — follows AUTH_PROTECTION_ENABLED */
(function(){
  if(!AUTH_PROTECTION_ENABLED)return;
  const stop=e=>{e.preventDefault();return false};
  document.addEventListener('contextmenu',stop);
  document.addEventListener('dragstart',stop);
  document.addEventListener('selectstart',e=>{
    if(e.target.closest('input,textarea,select'))return;
    e.preventDefault();return false;
  });
  document.addEventListener('copy',stop);
  document.addEventListener('cut',stop);
  document.addEventListener('keydown',e=>{
    const k=(e.key||'').toLowerCase();
    if(k==='f12')return stop(e);
    if(e.ctrlKey&&e.shiftKey&&['i','j','c'].includes(k))return stop(e);
    if(e.ctrlKey&&['u','s'].includes(k))return stop(e);
  });
})();

function checkAuth(){
  if(!AUTH_PROTECTION_ENABLED)return;
  const host=location.hostname.toLowerCase();
  if(host===AUTHORIZED_DOMAIN||host==='localhost'||host==='127.0.0.1')return;
  fetch(AUTH_API_URL,{cache:'no-store'}).then(r=>r.json()).then(d=>{
    if(d.authorized)return;showUnauthorized(d.error||'Unauthorized access detected');
  }).catch(()=>showUnauthorized('Unable to verify authorization.'));
}
function showUnauthorized(reason){
  const overlay=$('authOverlay');
  $('authErrorCode').textContent='Error: '+reason;
  overlay.classList.add('open');
  $('authRetryBtn').onclick=()=>{overlay.classList.remove('open');setTimeout(checkAuth,500)};
}
setTimeout(checkAuth,100);

/* ═══════════ SCHEDULE ═══════════ */
const schedule=[
 {round:1,slug:"australia",name:"Australian Grand Prix",circuit:"Albert Park Grand Prix Circuit",locality:"Melbourne",country:"Australia",sprint:false,sessions:[{slug:"fp1",name:"Practice 1",start:"2026-03-06T01:30:00Z"},{slug:"fp2",name:"Practice 2",start:"2026-03-06T05:00:00Z"},{slug:"fp3",name:"Practice 3",start:"2026-03-07T01:30:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-03-07T05:00:00Z"},{slug:"race",name:"Race",start:"2026-03-08T04:00:00Z"}]},
 {round:2,slug:"china",name:"Chinese Grand Prix",circuit:"Shanghai International Circuit",locality:"Shanghai",country:"China",sprint:true,sessions:[{slug:"fp1",name:"Practice 1",start:"2026-03-13T03:30:00Z"},{slug:"sprint-qualifying",name:"Sprint Qualifying",start:"2026-03-13T07:30:00Z"},{slug:"sprint",name:"Sprint",start:"2026-03-14T03:00:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-03-14T07:00:00Z"},{slug:"race",name:"Race",start:"2026-03-15T07:00:00Z"}]},
 {round:3,slug:"japan",name:"Japanese Grand Prix",circuit:"Suzuka Circuit",locality:"Suzuka",country:"Japan",sprint:false,sessions:[{slug:"fp1",name:"Practice 1",start:"2026-03-27T02:30:00Z"},{slug:"fp2",name:"Practice 2",start:"2026-03-27T06:00:00Z"},{slug:"fp3",name:"Practice 3",start:"2026-03-28T02:30:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-03-28T06:00:00Z"},{slug:"race",name:"Race",start:"2026-03-29T05:00:00Z"}]},
 {round:4,slug:"miami",name:"Miami Grand Prix",circuit:"Miami International Autodrome",locality:"Miami",country:"USA",sprint:true,sessions:[{slug:"fp1",name:"Practice 1",start:"2026-05-01T16:00:00Z"},{slug:"sprint-qualifying",name:"Sprint Qualifying",start:"2026-05-01T20:30:00Z"},{slug:"sprint",name:"Sprint",start:"2026-05-02T16:00:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-05-02T20:00:00Z"},{slug:"race",name:"Race",start:"2026-05-03T20:00:00Z"}]},
 {round:5,slug:"canada",name:"Canadian Grand Prix",circuit:"Circuit Gilles Villeneuve",locality:"Montreal",country:"Canada",sprint:true,sessions:[{slug:"fp1",name:"Practice 1",start:"2026-05-22T16:30:00Z"},{slug:"sprint-qualifying",name:"Sprint Qualifying",start:"2026-05-22T20:30:00Z"},{slug:"sprint",name:"Sprint",start:"2026-05-23T16:00:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-05-23T20:00:00Z"},{slug:"race",name:"Race",start:"2026-05-24T20:00:00Z"}]},
 {round:6,slug:"monaco",name:"Monaco Grand Prix",circuit:"Circuit de Monaco",locality:"Monte Carlo",country:"Monaco",sprint:false,sessions:[{slug:"fp1",name:"Practice 1",start:"2026-06-05T11:30:00Z"},{slug:"fp2",name:"Practice 2",start:"2026-06-05T15:00:00Z"},{slug:"fp3",name:"Practice 3",start:"2026-06-06T10:30:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-06-06T14:00:00Z"},{slug:"race",name:"Race",start:"2026-06-07T13:00:00Z"}]},
 {round:7,slug:"barcelona",name:"Barcelona Grand Prix",circuit:"Circuit de Barcelona-Catalunya",locality:"Barcelona",country:"Spain",sprint:false,sessions:[{slug:"fp1",name:"Practice 1",start:"2026-06-12T11:30:00Z"},{slug:"fp2",name:"Practice 2",start:"2026-06-12T15:00:00Z"},{slug:"fp3",name:"Practice 3",start:"2026-06-13T10:30:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-06-13T14:00:00Z"},{slug:"race",name:"Race",start:"2026-06-14T13:00:00Z"}]},
 {round:8,slug:"austria",name:"Austrian Grand Prix",circuit:"Red Bull Ring",locality:"Spielberg",country:"Austria",sprint:false,sessions:[{slug:"fp1",name:"Practice 1",start:"2026-06-26T11:30:00Z"},{slug:"fp2",name:"Practice 2",start:"2026-06-26T15:00:00Z"},{slug:"fp3",name:"Practice 3",start:"2026-06-27T10:30:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-06-27T14:00:00Z"},{slug:"race",name:"Race",start:"2026-06-28T13:00:00Z"}]},
 {round:9,slug:"britain",name:"British Grand Prix",circuit:"Silverstone Circuit",locality:"Silverstone",country:"UK",sprint:true,sessions:[{slug:"fp1",name:"Practice 1",start:"2026-07-03T11:30:00Z"},{slug:"sprint-qualifying",name:"Sprint Qualifying",start:"2026-07-03T15:30:00Z"},{slug:"sprint",name:"Sprint",start:"2026-07-04T11:00:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-07-04T15:00:00Z"},{slug:"race",name:"Race",start:"2026-07-05T14:00:00Z"}]},
 {round:10,slug:"belgium",name:"Belgian Grand Prix",circuit:"Circuit de Spa-Francorchamps",locality:"Spa",country:"Belgium",sprint:false,sessions:[{slug:"fp1",name:"Practice 1",start:"2026-07-17T11:30:00Z"},{slug:"fp2",name:"Practice 2",start:"2026-07-17T15:00:00Z"},{slug:"fp3",name:"Practice 3",start:"2026-07-18T10:30:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-07-18T14:00:00Z"},{slug:"race",name:"Race",start:"2026-07-19T13:00:00Z"}]},
 {round:11,slug:"hungary",name:"Hungarian Grand Prix",circuit:"Hungaroring",locality:"Budapest",country:"Hungary",sprint:false,sessions:[{slug:"fp1",name:"Practice 1",start:"2026-07-24T11:30:00Z"},{slug:"fp2",name:"Practice 2",start:"2026-07-24T15:00:00Z"},{slug:"fp3",name:"Practice 3",start:"2026-07-25T10:30:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-07-25T14:00:00Z"},{slug:"race",name:"Race",start:"2026-07-26T13:00:00Z"}]},
 {round:12,slug:"netherlands",name:"Dutch Grand Prix",circuit:"Circuit Park Zandvoort",locality:"Zandvoort",country:"Netherlands",sprint:true,sessions:[{slug:"fp1",name:"Practice 1",start:"2026-08-21T10:30:00Z"},{slug:"sprint-qualifying",name:"Sprint Qualifying",start:"2026-08-21T14:30:00Z"},{slug:"sprint",name:"Sprint",start:"2026-08-22T10:00:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-08-22T14:00:00Z"},{slug:"race",name:"Race",start:"2026-08-23T13:00:00Z"}]},
 {round:13,slug:"italy",name:"Italian Grand Prix",circuit:"Autodromo Nazionale di Monza",locality:"Monza",country:"Italy",sprint:false,sessions:[{slug:"fp1",name:"Practice 1",start:"2026-09-04T10:30:00Z"},{slug:"fp2",name:"Practice 2",start:"2026-09-04T14:00:00Z"},{slug:"fp3",name:"Practice 3",start:"2026-09-05T10:30:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-09-05T14:00:00Z"},{slug:"race",name:"Race",start:"2026-09-06T13:00:00Z"}]},
 {round:14,slug:"spain",name:"Spanish Grand Prix",circuit:"Madring",locality:"Madrid",country:"Spain",sprint:false,sessions:[{slug:"fp1",name:"Practice 1",start:"2026-09-11T11:30:00Z"},{slug:"fp2",name:"Practice 2",start:"2026-09-11T15:00:00Z"},{slug:"fp3",name:"Practice 3",start:"2026-09-12T10:30:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-09-12T14:00:00Z"},{slug:"race",name:"Race",start:"2026-09-13T13:00:00Z"}]},
 {round:15,slug:"azerbaijan",name:"Azerbaijan Grand Prix",circuit:"Baku City Circuit",locality:"Baku",country:"Azerbaijan",sprint:false,sessions:[{slug:"fp1",name:"Practice 1",start:"2026-09-24T08:30:00Z"},{slug:"fp2",name:"Practice 2",start:"2026-09-24T12:00:00Z"},{slug:"fp3",name:"Practice 3",start:"2026-09-25T08:30:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-09-25T12:00:00Z"},{slug:"race",name:"Race",start:"2026-09-26T11:00:00Z"}]},
 {round:16,slug:"singapore",name:"Singapore Grand Prix",circuit:"Marina Bay Street Circuit",locality:"Marina Bay",country:"Singapore",sprint:true,sessions:[{slug:"fp1",name:"Practice 1",start:"2026-10-09T08:30:00Z"},{slug:"sprint-qualifying",name:"Sprint Qualifying",start:"2026-10-09T12:30:00Z"},{slug:"sprint",name:"Sprint",start:"2026-10-10T09:00:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-10-10T13:00:00Z"},{slug:"race",name:"Race",start:"2026-10-11T12:00:00Z"}]},
 {round:17,slug:"usa",name:"United States Grand Prix",circuit:"Circuit of the Americas",locality:"Austin",country:"USA",sprint:false,sessions:[{slug:"fp1",name:"Practice 1",start:"2026-10-23T17:30:00Z"},{slug:"fp2",name:"Practice 2",start:"2026-10-23T21:00:00Z"},{slug:"fp3",name:"Practice 3",start:"2026-10-24T17:30:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-10-24T21:00:00Z"},{slug:"race",name:"Race",start:"2026-10-25T20:00:00Z"}]},
 {round:18,slug:"mexico",name:"Mexico City Grand Prix",circuit:"Autódromo Hermanos Rodríguez",locality:"Mexico City",country:"Mexico",sprint:false,sessions:[{slug:"fp1",name:"Practice 1",start:"2026-10-30T18:30:00Z"},{slug:"fp2",name:"Practice 2",start:"2026-10-30T22:00:00Z"},{slug:"fp3",name:"Practice 3",start:"2026-10-31T17:30:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-10-31T21:00:00Z"},{slug:"race",name:"Race",start:"2026-11-01T20:00:00Z"}]},
 {round:19,slug:"brazil",name:"Brazilian Grand Prix",circuit:"Autódromo José Carlos Pace",locality:"São Paulo",country:"Brazil",sprint:false,sessions:[{slug:"fp1",name:"Practice 1",start:"2026-11-06T15:30:00Z"},{slug:"fp2",name:"Practice 2",start:"2026-11-06T19:00:00Z"},{slug:"fp3",name:"Practice 3",start:"2026-11-07T14:30:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-11-07T18:00:00Z"},{slug:"race",name:"Race",start:"2026-11-08T17:00:00Z"}]},
 {round:20,slug:"lasvegas",name:"Las Vegas Grand Prix",circuit:"Las Vegas Strip Street Circuit",locality:"Las Vegas",country:"USA",sprint:false,sessions:[{slug:"fp1",name:"Practice 1",start:"2026-11-20T00:30:00Z"},{slug:"fp2",name:"Practice 2",start:"2026-11-20T04:00:00Z"},{slug:"fp3",name:"Practice 3",start:"2026-11-21T00:30:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-11-21T04:00:00Z"},{slug:"race",name:"Race",start:"2026-11-22T04:00:00Z"}]},
 {round:21,slug:"qatar",name:"Qatar Grand Prix",circuit:"Losail International Circuit",locality:"Lusail",country:"Qatar",sprint:false,sessions:[{slug:"fp1",name:"Practice 1",start:"2026-11-27T13:30:00Z"},{slug:"fp2",name:"Practice 2",start:"2026-11-27T17:00:00Z"},{slug:"fp3",name:"Practice 3",start:"2026-11-28T14:30:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-11-28T18:00:00Z"},{slug:"race",name:"Race",start:"2026-11-29T16:00:00Z"}]},
 {round:22,slug:"abudhabi",name:"Abu Dhabi Grand Prix",circuit:"Yas Marina Circuit",locality:"Abu Dhabi",country:"UAE",sprint:false,sessions:[{slug:"fp1",name:"Practice 1",start:"2026-12-04T09:30:00Z"},{slug:"fp2",name:"Practice 2",start:"2026-12-04T13:00:00Z"},{slug:"fp3",name:"Practice 3",start:"2026-12-05T10:30:00Z"},{slug:"qualifying",name:"Qualifying",start:"2026-12-05T14:00:00Z"},{slug:"race",name:"Race",start:"2026-12-06T13:00:00Z"}]}
];
// Parse session timestamps once instead of constructing hundreds of Date objects every minute.
schedule.forEach(event=>event.sessions.forEach(session=>{session.ts=Date.parse(session.start)}));
const sources=[
 {label:"F1TV",suffix:""},{label:"F1TV Alt",suffix:"/f1tv"},
 {label:"DAZN",suffix:"/dazn-es"},{label:"Sky Sports F1",suffix:"/sky-sport-f1-de"}
];

const $=id=>document.getElementById(id);
const eventSelect=$("eventSelect"),sessionSelect=$("sessionSelect"),linksEl=$("links"),
 playerEl=$("player"),loaderEl=$("loader"),noStreamEl=$("noStream"),badgeEl=$("badge"),
 clockEl=$("clock"),countdownEl=$("countdown");

function hoursSince(s){return (Date.now()-s.ts)/3600000}
function isStreamAvailable(s){const d=hoursSince(s);return d>=-1&&d<=3}
function isSessionEnded(s){return hoursSince(s)>4}
function getCurrentLiveSession(){
  for(const ev of schedule)for(const s of ev.sessions){const d=hoursSince(s);
    if(d>=-1&&d<=3)return{event:ev,session:s}}
  return null;
}
/* Pick the weekend that is live, else the next one, else the last of season */
function pickDefault(){
  const live=getCurrentLiveSession();
  if(live)return{event:live.event,session:live.session};
  for(const ev of schedule){
    const s=ev.sessions.find(x=>!isSessionEnded(x));
    if(s)return{event:ev,session:s};
  }
  const last=schedule.at(-1);
  return{event:last,session:last.sessions.at(-1)};
}
const _def=pickDefault();
let currentEvent=_def.event;
let currentSession=_def.session;
let currentSource=0;

/* ── selectors ── */
function populate(){
  eventSelect.innerHTML="";
  schedule.forEach(ev=>{
    const o=document.createElement("option");o.value=ev.slug;
    const done=ev.sessions.every(isSessionEnded);
    o.textContent=`R${ev.round} · ${ev.name}`+(done?" (finished)":"");
    if(ev.slug===currentEvent.slug)o.selected=true;eventSelect.appendChild(o);
  });
  updateSessions();updateCurrentStreamButton();
}
function updateSessions(){
  sessionSelect.innerHTML="";
  currentEvent.sessions.forEach(s=>{
    const o=document.createElement("option");o.value=s.slug;o.textContent=s.name;
    if(s.slug===currentSession.slug)o.selected=true;
    if(isSessionEnded(s)){o.disabled=true;o.textContent=s.name+" (ended)"}
    sessionSelect.appendChild(o);
  });
}
function updateHeader(){
  const parts=currentEvent.name.split(" ");
  const last=parts.slice(-2).join(" ");const first=parts.slice(0,-2).join(" ")||parts[0];
  $("heroTitle").textContent=first;
  $("heroTitle2").textContent=last;
  document.title=currentEvent.name+" — APEX F1";
  $("heroSession").textContent=currentSession.name+" · 2026";
  const done=currentEvent.sessions.every(isSessionEnded);
  $("heroRound").textContent=`Round ${currentEvent.round} · ${currentEvent.locality}, ${currentEvent.country}`
    +(currentEvent.sprint?" · Sprint Weekend":"")+(done?" · Completed":"");
  $("stageLabel").textContent="apex://live/"+currentEvent.slug+"/"+currentSession.slug+(sources[currentSource].suffix||"");
  $("sourceLabel").textContent="SOURCE · "+sources[currentSource].label.toUpperCase();
  badgeEl.style.display=isStreamAvailable(currentSession)?"inline-flex":"none";
}
function renderButtons(){
  linksEl.innerHTML="";
  sources.forEach((s,i)=>{
    const b=document.createElement("button");b.className="chip"+(i===currentSource?" active":"");
    b.textContent=s.label;
    b.onclick=()=>{currentSource=i;renderButtons();updateHeader();load()};
    linksEl.appendChild(b);
  });
}
const buildUrl=i=>`https://embedindia.st/embed/f1/2026/${currentEvent.slug}/${currentSession.slug}${sources[i].suffix}`;

/* ── no-stream rotator ── */
let nsTimer=null,nsPaused=false,nsRunning=false;
function stopNS(){if(nsTimer){clearTimeout(nsTimer);nsTimer=null}nsRunning=false}
function startNS(){
  stopNS();nsPaused=false;nsRunning=true;
  const t=$("noStreamTitle"),x=$("noStreamText");
  const msgs=[
   {t:"Hang tight",x:"We're working on getting this stream up for you. Check back soon!"},
   {t:"Formation lap",x:"Our crew is setting up the feed. A few more moments and you'll be good to go."},
   {t:"In the garage",x:"Getting everything ready for the best viewing experience possible."},
   {t:"Almost there",x:"Just a little more patience and you'll be watching the race in no time."},
   {t:"Stay tuned",x:"The stream will be up shortly. We appreciate your patience!"}];
  let i=0;
  (function next(){
    if(!nsRunning)return;
    if(nsPaused){nsTimer=setTimeout(next,500);return}
    [t,x].forEach(e=>{e.style.opacity="0";e.style.transform="translateY(8px)"});
    nsTimer=setTimeout(()=>{
      if(!nsRunning)return;
      i=(i+1)%msgs.length;t.textContent=msgs[i].t;x.textContent=msgs[i].x;
      [t,x].forEach(e=>{e.style.opacity="1";e.style.transform="none"});
      nsTimer=setTimeout(next,5000);
    },1100);
  })();
}
noStreamEl.addEventListener("mouseenter",()=>nsPaused=true);
noStreamEl.addEventListener("mouseleave",()=>nsPaused=false);
document.addEventListener("visibilitychange",()=>nsPaused=document.hidden);

function showNoStream(){loaderEl.classList.add("hidden");noStreamEl.classList.add("visible");
  playerEl.querySelector("iframe")?.remove();startNS()}
function hideNoStream(){noStreamEl.classList.remove("visible");stopNS()}

let playerLoadToken=0;
function load(){
  const token=++playerLoadToken;
  loaderEl.classList.remove("hidden");hideNoStream();
  playerEl.querySelector("iframe")?.remove();
  playerEl.querySelector("video")?.remove();
  // If override is active, always try to play it regardless of session state.
  if(streamOverride.active&&streamOverride.url){
    const f=document.createElement(streamOverride.type==='mp4'?'video':'iframe');
    if(streamOverride.type==='mp4'){
      f.controls=true;f.autoplay=true;f.playsInline=true;f.preload='metadata';
      f.style.cssText='position:absolute;inset:0;width:100%;height:100%;border:0';
      const s=document.createElement('source');s.src=streamOverride.url;s.type='video/mp4';f.appendChild(s);
      f.oncanplay=()=>{if(token===playerLoadToken)loaderEl.classList.add('hidden')};
    }else{
      f.src=streamOverride.url;f.allow="autoplay; fullscreen; encrypted-media; picture-in-picture";
      f.allowFullscreen=true;f.referrerPolicy='no-referrer';
      f.style.cssText='position:absolute;inset:0;width:100%;height:100%;border:0;opacity:0;transition:opacity .7s ease';
      f.onload=()=>{if(token!==playerLoadToken)return;f.style.opacity='1';setTimeout(()=>{if(token===playerLoadToken)loaderEl.classList.add('hidden')},180)};
    }
    playerEl.appendChild(f);
    setTimeout(()=>{if(token!==playerLoadToken||!f.isConnected)return;if(!f.style.opacity||f.style.opacity==='0')f.style.opacity='1';loaderEl.classList.add('hidden')},3000);
    return;
  }
  if(!isStreamAvailable(currentSession)){showNoStream();return}
  const f=document.createElement("iframe");
  f.src=buildUrl(currentSource);
  f.allow="autoplay; fullscreen; encrypted-media; picture-in-picture";
  f.allowFullscreen=true;f.referrerPolicy="no-referrer";
  f.onload=()=>{if(token!==playerLoadToken)return;f.classList.add('loaded');setTimeout(()=>{if(token===playerLoadToken)loaderEl.classList.add('hidden')},180)};
  setTimeout(()=>{if(token!==playerLoadToken||!f.isConnected)return;f.classList.add('loaded');loaderEl.classList.add('hidden')},5000);
  playerEl.appendChild(f);
}

/* ── clocks ── */
function getNextSession(){
  const now=Date.now();let next=null,min=Infinity;
  for(const ev of schedule)for(const s of ev.sessions){
    const d=s.ts-now;if(d>0&&d<min){min=d;next={event:ev,session:s}}}
  return next;
}
function updateCountdown(){
  const n=getNextSession();
  if(!n){countdownEl.textContent="No upcoming session";return}
  const diff=n.session.ts-Date.now();
  if(diff<=0){countdownEl.textContent="Lights out!";return}
  const T=Math.floor(diff/1000),d=Math.floor(T/86400),h=Math.floor(T%86400/3600),
    m=Math.floor(T%3600/60),s=T%60,p=v=>String(v).padStart(2,"0");
  countdownEl.textContent=`${n.event.name} ${n.session.name} · ${d>0?d+"d ":""}${p(h)}:${p(m)}:${p(s)}`;
}
const clockFormat=new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
function updateClocks(){if(document.hidden)return;clockEl.textContent=clockFormat.format(Date.now());updateCountdown()}

/* ── visitors ── */
function initVisitorCounter(){
  const el=$("visitorCount");if(!el)return;
  let uid=store.get('freef1_user_id');
  if(!uid){uid='user_'+(crypto.randomUUID?.()||Math.random().toString(36).slice(2)+Date.now().toString(36));store.set('freef1_user_id',uid)}
  const API='https://f1free.onrender.com',SECRET='doggomc',INTERVAL=18000;
  let timer=0,inFlight=false;
  const updateCount=data=>{if(data&&Number.isFinite(data.active))el.textContent=String(data.active)};
  const beat=async()=>{
    clearTimeout(timer);
    if(document.hidden||inFlight){timer=setTimeout(beat,INTERVAL);return}
    inFlight=true;
    try{
      const r=await fetch(`${API}/api/visitors/heartbeat`,{cache:'no-store',credentials:'omit',keepalive:true,
        headers:{'X-Visitor-Secret':SECRET,'X-User-Id':uid}});
      if(r.ok)updateCount(await r.json());
    }catch(_){}finally{inFlight=false;timer=setTimeout(beat,INTERVAL)}
  };
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)beat()},{passive:true});
  beat();
}

/* ═══════════ LIVE SITE STATE + STREAM OVERRIDE (SSE) ═══════════ */
const PUBLIC_API='https://f1free.onrender.com';
function applyMaintenanceMode(state){
  if(state?.active&&location.pathname!=='/maintenance.html')location.replace('/maintenance.html');
}
window.__APEX_SITE_STATUS?.then(data=>applyMaintenanceMode(data?.maintenance));

let streamOverride={active:false,url:null,type:null};
let lastOverrideToastKey='',streamEvents=null,streamSseConnected=false,streamReconnectTimer=0,streamRetryMs=2000;

function updateOverridePill(override) {
  const pill = document.getElementById('overridePill');
  if (!pill) return;
  if (override && override.active) {
    pill.className = 'stage-override-pill active';
    pill.textContent = `● Override · ${(override.type || 'custom').toUpperCase()}`;
  } else {
    const live = getCurrentLiveSession();
    pill.className = 'stage-override-pill inactive';
    pill.textContent = live ? 'Normal Stream' : 'Stream Override · No Current Live Sessions';
  }
}

function applyStreamOverride(override){
  const next=override||{active:false,url:null,type:null};
  const prevActive=streamOverride.active;
  const changed=Boolean(next.active)!==Boolean(streamOverride.active)||(next.url||'')!==(streamOverride.url||'')||(next.type||'')!==(streamOverride.type||'');
  streamOverride=next;updateOverridePill(streamOverride);
  if(!changed)return;
  const toastKey=streamOverride.active?(streamOverride.url||''):'inactive';
  if(toastKey!==lastOverrideToastKey){
    lastOverrideToastKey=toastKey;
    if(streamOverride.active&&streamOverride.url)showToast(`Stream override active — ${streamOverride.type||'custom'} feed`,'warning');
    else if(prevActive)showToast('Stream override deactivated — normal feed restored.','success');
  }
  load();
}

function initStreamOverrideSSE(){
  if(document.hidden||streamEvents)return;
  const SSE_URL='https://f1free.onrender.com/api/events';
  try{
    const es=new EventSource(SSE_URL);streamEvents=es;
    const onState=e=>{try{applyStreamOverride(JSON.parse(e.data))}catch(_){}};
    es.addEventListener('open',()=>{streamSseConnected=true;streamRetryMs=2000});
    es.addEventListener('stream_override',onState);
    // Kept for compatibility with older backend deployments; duplicate state is ignored above.
    es.addEventListener('stream_update',onState);
    es.addEventListener('maintenance_update',event=>{try{applyMaintenanceMode(JSON.parse(event.data))}catch(_){}});
    es.addEventListener('error',()=>{
      streamSseConnected=false;es.close();if(streamEvents===es)streamEvents=null;
      clearTimeout(streamReconnectTimer);
      streamReconnectTimer=setTimeout(initStreamOverrideSSE,streamRetryMs);
      streamRetryMs=Math.min(streamRetryMs*2,30000);
    });
  }catch(_){streamEvents=null;streamReconnectTimer=setTimeout(initStreamOverrideSSE,streamRetryMs)}
}

// Low-frequency polling is active only while SSE is unavailable.
let streamPollTimer=0,streamPollInFlight=false,sitePollInFlight=false;
async function pollSiteStatus(force=false){
  if(document.hidden||sitePollInFlight||(!force&&streamSseConnected))return;
  sitePollInFlight=true;
  try{
    const response=await fetch(`${PUBLIC_API}/api/site/status`,{cache:'no-store',credentials:'omit'});
    if(response.ok)applyMaintenanceMode((await response.json()).maintenance);
  }catch(_){}finally{sitePollInFlight=false}
}
async function pollStreamStatus(force=false){
  if(document.hidden||streamPollInFlight||(!force&&streamSseConnected))return;
  streamPollInFlight=true;
  try{
    const r=await fetch('https://f1free.onrender.com/api/stream/status',{cache:'no-store',credentials:'omit'});
    if(r.ok)applyStreamOverride(await r.json());
  }catch(_){}finally{streamPollInFlight=false}
}
function initStreamPolling(){
  clearInterval(streamPollTimer);pollStreamStatus(true);pollSiteStatus(true);
  streamPollTimer=setInterval(()=>{pollStreamStatus();pollSiteStatus()},30000);
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){streamEvents?.close();streamEvents=null;streamSseConnected=false}
    else{pollStreamStatus(true);pollSiteStatus(true);initStreamOverrideSSE()}
  },{passive:true});
}

function showToast(msg, type) {
  let t = document.getElementById('apexToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'apexToast';
    t.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none';
    document.body.appendChild(t);
  }
  const el = document.createElement('div');
  const colors = { warning: '#ffb020', success: '#00d57e', error: '#e10600', info: '#60a5fa' };
  const bg = colors[type] || colors.info;
  el.style.cssText = `background:rgba(14,16,20,.95);border:1px solid ${bg}44;border-left:3px solid ${bg};border-radius:8px;padding:10px 16px;font-family:'JetBrains Mono',monospace;font-size:.7rem;color:#f1f4f8;box-shadow:0 4px 20px rgba(0,0,0,.5);animation:fadeUp .4s ease;pointer-events:auto;max-width:320px`;
  el.textContent = msg;
  t.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, 4000);
}

/* ── current stream button ── */
function updateCurrentStreamButton(){
  const live=getCurrentLiveSession(),btn=$("currentStreamBtn"),lbl=btn.querySelector("span");
  if(live){btn.removeAttribute("aria-disabled");lbl.textContent=`Live now · ${live.session.name}`}
  else{btn.setAttribute("aria-disabled","true");lbl.textContent="No live session"}
  if(!streamOverride.active) updateOverridePill(streamOverride);
}
$("currentStreamBtn").addEventListener("click",()=>{
  const live=getCurrentLiveSession();if(!live)return;
  currentEvent=live.event;currentSession=live.session;currentSource=0;
  updateSessions();updateHeader();renderButtons();load();updateCurrentStreamButton();
  document.getElementById('watch').scrollIntoView({behavior:'smooth'});
});
eventSelect.addEventListener("change",()=>{
  const ev=schedule.find(e=>e.slug===eventSelect.value);if(!ev)return;
  currentEvent=ev;currentSession=ev.sessions.find(s=>!isSessionEnded(s))||ev.sessions[0];
  currentSource=0;updateSessions();updateHeader();renderButtons();load();updateCurrentStreamButton();
});
sessionSelect.addEventListener("change",()=>{
  const s=currentEvent.sessions.find(s=>s.slug===sessionSelect.value);
  if(!s||isSessionEnded(s))return;
  currentSession=s;currentSource=0;updateHeader();renderButtons();load();
});

/* ═══════════ TICKER ═══════════ */
(function(){
  const items=["Live multi-source switching","Zero ads · privacy-first","Championship telemetry",
   "Session results archive","12 team liveries","Built for race weekends","Every practice, quali & race"];
  const html=[...items,...items].map(t=>`<span>${t}</span>`).join("");
  $("tickerTrack").innerHTML=html;
})();

/* ═══════════ MOBILE NAV ═══════════ */
const navEl=$('nav'),navToggle=$('navToggle'),mobileMenu=$('mobileMenu');
function closeNav(){mobileMenu.classList.remove('open');navToggle.setAttribute('aria-expanded','false');navToggle.setAttribute('aria-label','Open navigation')}
navToggle.addEventListener('click',()=>{
  const open=!mobileMenu.classList.contains('open');mobileMenu.classList.toggle('open',open);
  navToggle.setAttribute('aria-expanded',String(open));navToggle.setAttribute('aria-label',open?'Close navigation':'Open navigation');
});
mobileMenu.querySelectorAll('a').forEach(link=>link.addEventListener('click',closeNav));
document.addEventListener('click',event=>{if(!navEl.contains(event.target))closeNav()});
addEventListener('keydown',event=>{if(event.key==='Escape')closeNav()});

/* ═══════════ SCROLL FX ═══════════ */
const revealEls=document.querySelectorAll('.rv');
if('IntersectionObserver'in window){
  const io=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('in');io.unobserve(entry.target)}}),{threshold:.1,rootMargin:'0px 0px -6% 0px'});
  revealEls.forEach(element=>io.observe(element));
}else revealEls.forEach(element=>element.classList.add('in'));

const progressEl=$('progress'),heroLayer=$('heroLayer'),breakLayer=$('breakLayer');
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const liteMotion=reduceMotion||matchMedia('(max-width: 760px)').matches||navigator.connection?.saveData;
let ticking=false;
function onScroll(){
  if(ticking)return;ticking=true;
  requestAnimationFrame(()=>{
    const y=scrollY,h=document.documentElement.scrollHeight-innerHeight;
    navEl.classList.toggle('stuck',y>40);progressEl.style.width=(h>0?(y/h)*100:0)+'%';
    if(!liteMotion&&heroLayer&&y<innerHeight*1.3)heroLayer.style.transform=`translate3d(0,${y*.38}px,0) scale(1.06)`;
    if(!liteMotion&&breakLayer){const rect=breakLayer.parentElement.getBoundingClientRect();if(rect.bottom>0&&rect.top<innerHeight){
      const p=(innerHeight-rect.top)/(innerHeight+rect.height);breakLayer.style.transform=`translate3d(0,${(p-.5)*90}px,0) scale(1.1)`}}
    ticking=false;
  });
}
addEventListener('scroll',onScroll,{passive:true});onScroll();
addEventListener('resize',()=>{if(innerWidth>900)closeNav()},{passive:true});

/* Cursor-reactive orbs: fine pointers only, one paint per frame. */
if(!liteMotion&&matchMedia('(pointer:fine)').matches){
  const orbs=[...document.querySelectorAll('.orb')];let pointerFrame=0,lastPointer=null;
  addEventListener('pointermove',event=>{lastPointer=event;if(pointerFrame)return;pointerFrame=requestAnimationFrame(()=>{
    pointerFrame=0;const x=lastPointer.clientX/innerWidth-.5,y=lastPointer.clientY/innerHeight-.5;
    orbs.forEach((orb,index)=>{const amount=(index+1)*14;orb.style.translate=`${-x*amount}px ${-y*amount}px`});
  })},{passive:true});
}

/* ═══════════ ACCORDIONS ═══════════ */
document.querySelectorAll('.acc-q').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const item=btn.parentElement,a=item.querySelector('.acc-a'),was=item.classList.contains('active');
    item.closest('.acc-wrap').querySelectorAll('.acc-item').forEach(i=>{
      i.classList.remove('active');i.querySelector('.acc-a').style.maxHeight=null});
    if(!was){item.classList.add('active');a.style.maxHeight=a.scrollHeight+'px'}
  });
});
/* Panel tabs */
function openPanel(id){
  document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active',p.id===id));
  document.querySelectorAll('#infoTabs .tab').forEach(t=>t.classList.toggle('active',t.dataset.panel===id));
}
document.querySelectorAll('#infoTabs .tab').forEach(t=>t.addEventListener('click',()=>openPanel(t.dataset.panel)));
document.querySelectorAll('.foot-links button[data-panel]').forEach(b=>b.addEventListener('click',()=>{
  openPanel(b.dataset.panel);
  document.getElementById('info').scrollIntoView({behavior:'smooth'});
}));

/* ═══════════ STANDINGS ═══════════ */
const JOLPI='https://api.jolpi.ca/ergast/f1';
const rowsEl=$("standingsList"),loadEl=$("standingsLoading");
const TEAM_HEX={'McLaren':'#FF8000','Ferrari':'#DC0000','Red Bull':'#1E41FF','Mercedes':'#00D2BE',
 'Williams':'#005AFF','Aston Martin':'#006F62','Alpine F1 Team':'#FF0080','Alpine':'#FF0080',
 'Haas F1 Team':'#B6BABD','Haas':'#B6BABD','Audi':'#E62213','Sauber':'#00E701','RB F1 Team':'#6692FF','Racing Bulls':'#6692FF','Cadillac F1 Team':'#B4A07A','Cadillac':'#B4A07A'};
function hexFor(n){for(const k in TEAM_HEX)if((n||'').includes(k))return TEAM_HEX[k];return 'var(--team)'}
function escapeHtml(value){return String(value??'').replace(/[&<>\"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[char]))}
const apiPromises=new Map();
function fetchJson(url){
  if(apiPromises.has(url))return apiPromises.get(url);
  const request=fetch(url,{headers:{Accept:'application/json'}}).then(response=>{if(!response.ok)throw new Error(`HTTP ${response.status}`);return response.json()})
    .catch(error=>{apiPromises.delete(url);throw error});
  apiPromises.set(url,request);return request;
}
let driverStandingsPromise=null;
function getDriverStandings(){
  if(!driverStandingsPromise)driverStandingsPromise=fetchJson(`${JOLPI}/current/driverstandings/?limit=40`)
    .then(data=>data?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings||[])
    .catch(error=>{driverStandingsPromise=null;throw error});
  return driverStandingsPromise;
}

function renderStandings(data,type){
  const L=data?.MRData?.StandingsTable?.StandingsLists?.[0];
  const st=type==='drivers'?L?.DriverStandings:L?.ConstructorStandings;
  if(!st||!st.length){rowsEl.innerHTML='<div class="state">No standings data available.</div>';return}
  const fragment=document.createDocumentFragment();
  st.forEach((it,i)=>{
    const row=document.createElement('div');row.className='row p'+it.position;row.style.animationDelay=(i*24)+'ms';
    const team=type==='drivers'?(it.Constructors?.[0]?.name||''):(it.Constructor?.name||'');
    row.style.setProperty('--c',hexFor(team));
    const name=type==='drivers'?`${it.Driver?.givenName||''} ${it.Driver?.familyName||''}`:(it.Constructor?.name||'');
    const sub=type==='drivers'?`${it.Driver?.permanentNumber?'#'+it.Driver.permanentNumber+' · ':''}${team}`:`${it.wins||0} wins`;
    row.innerHTML=`<div class="pos">${escapeHtml(it.position)}</div><div class="who"><b>${escapeHtml(name)}</b><small>${escapeHtml(sub)}</small></div><div class="pts">${escapeHtml(it.points)}<small>PTS</small></div>`;
    fragment.appendChild(row);
  });
  rowsEl.replaceChildren(fragment);
}
function loadStandings(type){
  loadEl.textContent='Loading standings…';loadEl.style.display='block';rowsEl.style.opacity='.35';
  $("standingsTitle").innerHTML=(type==='drivers'?'Driver':'Constructor')+' <span class="accent">Standings</span>';
  const request=type==='drivers'
    ? getDriverStandings().then(DriverStandings=>({MRData:{StandingsTable:{StandingsLists:[{DriverStandings}]}}}))
    : fetchJson(`${JOLPI}/current/constructorstandings/`);
  request.then(data=>{loadEl.style.display='none';rowsEl.style.opacity='1';renderStandings(data,type)})
    .catch(()=>{loadEl.textContent='Standings unavailable right now.';rowsEl.style.opacity='1'});
}
/* ═══════════ DRIVER GRID (all 22, live order) ═══════════ */
const DRIVER_PHOTO={
  russell:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/mercedes/georus01/2026mercedesgeorus01right.webp',
  antonelli:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/mercedes/andant01/2026mercedesandant01right.webp',
  leclerc:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/ferrari/chalec01/2026ferrarichalec01right.webp',
  hamilton:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/ferrari/lewham01/2026ferrarilewham01right.webp',
  norris:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/mclaren/lannor01/2026mclarenlannor01right.webp',
  piastri:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/mclaren/oscpia01/2026mclarenoscpia01right.webp',
  verstappen:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/redbullracing/maxver01/2026redbullracingmaxver01right.webp',
  hadjar:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/redbullracing/isahad01/2026redbullracingisahad01right.webp',
  lawson:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/racingbulls/lialaw01/2026racingbullslialaw01right.webp',
  lindblad:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/racingbulls/arvlin01/2026racingbullsarvlin01right.webp',
  gasly:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/alpine/piegas01/2026alpinepiegas01right.webp',
  colapinto:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/alpine/fracol01/2026alpinefracol01right.webp',
  ocon:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/haasf1team/estoco01/2026haasf1teamestoco01right.webp',
  bearman:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/haasf1team/olibea01/2026haasf1teamolibea01right.webp',
  hulkenberg:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/audi/nichul01/2026audinichul01right.webp',
  bortoleto:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/audi/gabbor01/2026audigabbor01right.webp',
  sainz:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/williams/carsai01/2026williamscarsai01right.webp',
  albon:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/williams/alealb01/2026williamsalealb01right.webp',
  alonso:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/astonmartin/feralo01/2026astonmartinferalo01right.webp',
  stroll:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/astonmartin/lanstr01/2026astonmartinlanstr01right.webp',
  perez:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/cadillac/serper01/2026cadillacserper01right.webp',
  bottas:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/cadillac/valbot01/2026cadillacvalbot01right.webp'
};
/* API driverId → photo key */
const DRIVER_KEY={max_verstappen:'verstappen',arvid_lindblad:'lindblad',
 carlos_sainz:'sainz',kevin_magnussen:'magnussen'};
const photoFor=id=>DRIVER_PHOTO[DRIVER_KEY[id]||id]||null;
function renderDriverGrid(list){
  const el=$("driverGrid");
  if(!list||!list.length){el.innerHTML='<div class="state">Grid unavailable right now.</div>';return}
  const fragment=document.createDocumentFragment();let rendered=0;
  list.forEach((it,i)=>{
    const d=it.Driver||{},team=it.Constructors?.[0]?.name||'',src=photoFor(d.driverId);if(!src)return;
    const a=document.createElement('article');a.className='dcard'+(it.position==='1'?' lead':'');
    a.style.setProperty('--c',hexFor(team));a.style.animationDelay=(i*32)+'ms';
    a.innerHTML=`<div class="dshade"></div><div class="dfall">${escapeHtml((d.givenName?.[0]||'')+(d.familyName?.[0]||''))}</div>
      <img src="${src}" alt="${escapeHtml(`${d.givenName||''} ${d.familyName||''}`)}" width="440" height="587" loading="lazy" decoding="async" fetchpriority="low" referrerpolicy="no-referrer">
      <div class="dpos">P${escapeHtml(it.position)}</div><div class="dnum">${escapeHtml(d.permanentNumber||'')}</div>
      <div class="dbody"><div class="dname"><small>${escapeHtml(d.givenName||'')}</small>${escapeHtml(d.familyName||'')}</div>
      <div class="dteam"><i></i>${escapeHtml(team)}</div><div class="dpts">${escapeHtml(it.points)} PTS · ${escapeHtml(it.wins)} WIN${it.wins==='1'?'':'S'}</div></div>`;
    a.querySelector('img').addEventListener('error',()=>a.classList.add('noimg'),{once:true});
    fragment.appendChild(a);rendered++;
  });
  if(rendered)el.replaceChildren(fragment);else el.innerHTML='<div class="state">Grid unavailable right now.</div>';
}
function loadDriverGrid(){
  getDriverStandings().then(renderDriverGrid)
    .catch(()=>{$("driverGrid").innerHTML='<div class="state">Grid unavailable right now.</div>'});
}

document.querySelectorAll('#standings .tab').forEach(t=>t.addEventListener('click',()=>{
  document.querySelectorAll('#standings .tab').forEach(x=>x.classList.remove('active'));
  t.classList.add('active');loadStandings(t.dataset.type);
}));

/* ═══════════ SESSION RESULTS ═══════════ */
let races2026=[];
const sOverlay=$("sessionsOverlay"),sRace=$("sessionRaceSelect"),sType=$("sessionTypeSelect"),
 sLoad=$("sessionsResultsLoading"),sRes=$("sessionsResults");
function lockScroll(on){document.body.style.overflow=on?'hidden':''}
function isDateEnded(d){return d&&(new Date()-new Date(d+'T23:59:59Z'))>0}

async function load2026Races(){
  try{
    if(!races2026.length){const data=await fetchJson('https://api.jolpi.ca/ergast/f1/2026.json?limit=30');races2026=data?.MRData?.RaceTable?.Races||[]}
    sRace.innerHTML='';
    const valid=races2026.filter(race=>isDateEnded(race.date));
    const list=(valid.length?valid:races2026).slice().sort((a,b)=>Number(b.round)-Number(a.round));
    const fragment=document.createDocumentFragment();
    list.forEach(race=>{const option=document.createElement('option');option.value=race.round;option.textContent=`R${race.round} · ${race.raceName}`;fragment.appendChild(option)});
    sRace.appendChild(fragment);if(list.length)sRace.value=list[0].round;
    if(!races2026.length)sRace.innerHTML='<option>No races found</option>';
    updateSessionTypeOptions();loadSessionResults();
  }catch(_){sRace.innerHTML='<option>Failed to load</option>'}
}
function updateSessionTypeOptions(){
  const rc=races2026.find(r=>r.round===sRace.value);
  const sp=sType.querySelector('option[value="sprint"]');
  if(rc&&rc.Sprint){sp.disabled=false;sp.hidden=false}
  else{sp.hidden=true;sp.disabled=true;if(sType.value==='sprint')sType.value='results'}
}
async function loadSessionResults(){
  const round=sRace.value,type=sType.value;
  if(!round){sRes.innerHTML='<div class="state">Select a race first.</div>';return}
  sLoad.style.display='block';sRes.innerHTML='';
  try{
    const ep=({results:'results',qualifying:'qualifying',sprint:'sprint'})[type]||'results';
    const data=await fetchJson(`https://api.jolpi.ca/ergast/f1/2026/${round}/${ep}/`);
    sLoad.style.display='none';
    const race=data?.MRData?.RaceTable?.Races?.[0];
    const results=type==='qualifying'?race?.QualifyingResults:type==='sprint'?race?.SprintResults:race?.Results;
    if(!results?.length){sRes.innerHTML='<div class="state">No results published for this session yet.</div>';return}
    const fragment=document.createDocumentFragment();
    results.forEach((result,index)=>{
      const element=document.createElement('div');element.className='rrow';element.style.animation=`rowIn .5s var(--ease) ${index*24}ms both`;
      const time=type==='qualifying'?([result.Q3,result.Q2,result.Q1].filter(Boolean)[0]||'—'):(result.Time?.time||result.status||'—');
      element.innerHTML=`<div class="pos">${escapeHtml(result.position)}</div><div class="who"><b>${escapeHtml(`${result.Driver?.givenName||''} ${result.Driver?.familyName||''}`)}</b><small>${escapeHtml(result.Constructor?.name||'')}</small></div><div class="rtime">${escapeHtml(time)}</div>`;
      fragment.appendChild(element);
    });
    sRes.replaceChildren(fragment);
  }catch(e){sLoad.style.display='none';sRes.innerHTML='<div class="state">Failed to load results.</div>'}
}
$("sessionsBtn").addEventListener('click',()=>{sOverlay.classList.add('open');lockScroll(true);load2026Races()});
$("sessionsClose").addEventListener('click',()=>{sOverlay.classList.remove('open');lockScroll(false)});
sRace.addEventListener('change',()=>{updateSessionTypeOptions();loadSessionResults()});
sType.addEventListener('change',loadSessionResults);
$("championshipBtn").addEventListener('click',()=>document.getElementById('standings').scrollIntoView({behavior:'smooth'}));

/* ═══════════ TEAM LIVERY ═══════════ */
const teams=[
 {id:'default',name:'Apex Red',color:'#E10600',text:'#fff',abbr:'APX'},
 {id:'mclaren',name:'McLaren',color:'#FF8000',text:'#000',abbr:'MCL'},
 {id:'ferrari',name:'Ferrari',color:'#DC0000',text:'#fff',abbr:'FER'},
 {id:'redbull',name:'Red Bull Racing',color:'#1E41FF',text:'#fff',abbr:'RBR'},
 {id:'mercedes',name:'Mercedes',color:'#00D2BE',text:'#000',abbr:'MER'},
 {id:'williams',name:'Williams',color:'#005AFF',text:'#fff',abbr:'WIL'},
 {id:'astonmartin',name:'Aston Martin',color:'#006F62',text:'#fff',abbr:'AMR'},
 {id:'alpine',name:'Alpine',color:'#FF0080',text:'#fff',abbr:'ALP'},
 {id:'haas',name:'Haas',color:'#E6E6E6',text:'#000',abbr:'HAA'},
 {id:'audi',name:'Audi',color:'#E62213',text:'#fff',abbr:'AUD'},
 {id:'cadillac',name:'Cadillac',color:'#B4A07A',text:'#000',abbr:'CAD'},
 {id:'racingbulls',name:'Racing Bulls',color:'#6692FF',text:'#000',abbr:'RB'}
];
const tOverlay=$("teamSelectOverlay"),tGrid=$("teamGrid");
function shade(hex,p){
  const n=parseInt(hex.slice(1),16);
  const r=Math.min(255,Math.max(0,(n>>16)+p)),g=Math.min(255,Math.max(0,(n>>8&255)+p)),b=Math.min(255,Math.max(0,(n&255)+p));
  return '#'+((r<<16)|(g<<8)|b).toString(16).padStart(6,'0');
}
function applyTeamTheme(id){
  const t=teams.find(x=>x.id===id)||teams[0];
  const rs=document.documentElement.style;
  rs.setProperty('--team',t.color);
  rs.setProperty('--team-2',shade(t.color,36));
  rs.setProperty('--red-glow',t.color+'70');
  document.querySelectorAll('.tcard').forEach(c=>c.classList.toggle('on',c.dataset.team===id));
  dispatchEvent(new CustomEvent('apexthemechange',{detail:{color:t.color}}));
}
function renderTeamGrid(){
  tGrid.innerHTML='';
  teams.forEach(t=>{
    const c=document.createElement('div');c.className='tcard';c.dataset.team=t.id;
    c.style.setProperty('--tc',t.color);
    c.innerHTML=`<div class="tbadge" style="background:linear-gradient(140deg,${t.color},${shade(t.color,-50)});color:${t.text}">${t.abbr}</div>
      <div class="tname">${t.name}</div><div class="tick">✓</div>`;
    c.addEventListener('click',()=>{applyTeamTheme(t.id);store.set('freef1_team',t.id)});
    tGrid.appendChild(c);
  });
}
$("teamSelectBtn").addEventListener('click',()=>{
  tOverlay.classList.add('open');lockScroll(true);renderTeamGrid();
  applyTeamTheme(store.get('freef1_team')||'default');
});
$("teamSelectClose").addEventListener('click',()=>{tOverlay.classList.remove('open');lockScroll(false)});
[sOverlay,tOverlay].forEach(m=>m.addEventListener('click',e=>{
  if(e.target===m){m.classList.remove('open');lockScroll(false)}}));
addEventListener('keydown',e=>{if(e.key==='Escape'){
  document.querySelectorAll('.modal.open').forEach(m=>m.classList.remove('open'));lockScroll(false)}});
applyTeamTheme(store.get('freef1_team')||'default');

/* ═══════════ SPEED-LINE CANVAS ═══════════ */
(function(){
  const canvas=$("speedCanvas"),context=canvas?.getContext('2d');if(!context||reduceMotion)return;
  let width=0,height=0,parts=[],rgb=[225,6,0],resizeTimer=0,running=false,lastFrame=0;
  const targetFps=innerWidth<768||navigator.hardwareConcurrency<=4?30:45;
  const frameInterval=1000/targetFps;
  function hex2rgb(hex){hex=hex.replace('#','');if(hex.length===3)hex=[...hex].map(char=>char+char).join('');const value=parseInt(hex,16);return[value>>16,value>>8&255,value&255]}
  function readAccent(color){rgb=hex2rgb(color||getComputedStyle(document.documentElement).getPropertyValue('--team').trim()||'#E10600')}
  function makeSprite(part){
    const sprite=document.createElement('canvas'),spriteContext=sprite.getContext('2d');
    sprite.width=Math.ceil(part.len)+2;sprite.height=Math.max(3,Math.ceil(part.w)+2);
    const gradient=spriteContext.createLinearGradient(0,0,sprite.width,0);
    gradient.addColorStop(0,`rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);gradient.addColorStop(1,`rgba(${rgb[0]},${rgb[1]},${rgb[2]},${part.a})`);
    spriteContext.strokeStyle=gradient;spriteContext.lineWidth=part.w;spriteContext.lineCap='round';spriteContext.beginPath();
    spriteContext.moveTo(1,sprite.height/2);spriteContext.lineTo(sprite.width-1,sprite.height/2);spriteContext.stroke();return sprite;
  }
  function makePart(){const part={x:Math.random()*width,y:Math.random()*height,len:Math.random()*90+20,sp:Math.random()*1.6+.35,a:Math.random()*.28+.05,w:Math.random()*1.3+.25};part.sprite=makeSprite(part);return part}
  function build(){const count=width<768?26:56;parts=Array.from({length:count},makePart)}
  function size(){width=canvas.width=Math.max(1,innerWidth);height=canvas.height=Math.max(1,innerHeight);readAccent();build()}
  function tick(now){
    if(document.hidden){running=false;return}
    running=true;const elapsed=now-lastFrame;if(elapsed<frameInterval){requestAnimationFrame(tick);return}
    const speed=Math.min(2,elapsed/(1000/60));lastFrame=now-elapsed%frameInterval;context.clearRect(0,0,width,height);
    parts.forEach(part=>{part.x+=part.sp*2.4*speed;if(part.x-part.len>width){part.x=-part.len;part.y=Math.random()*height}
      context.drawImage(part.sprite,Math.round(part.x-part.len),Math.round(part.y-part.sprite.height/2))});
    requestAnimationFrame(tick);
  }
  function start(){if(!running&&!document.hidden){running=true;lastFrame=performance.now();requestAnimationFrame(tick)}}
  size();start();
  addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(size,140)},{passive:true});
  addEventListener('visibilitychange',start,{passive:true});
  addEventListener('apexthemechange',event=>{readAccent(event.detail?.color);parts.forEach(part=>{part.sprite=makeSprite(part)})});
})();

/* ═══════════ INIT ═══════════ */
populate();updateHeader();renderButtons();load();updateClocks();initVisitorCounter();updateOverridePill(streamOverride);
const loadChampionshipData=()=>{loadStandings('drivers');loadDriverGrid()};
if('requestIdleCallback'in window)requestIdleCallback(loadChampionshipData,{timeout:1600});else setTimeout(loadChampionshipData,700);
setInterval(updateClocks,1000);
setInterval(()=>{if(!document.hidden)updateCurrentStreamButton()},60000);
setTimeout(initStreamOverrideSSE,500);
setTimeout(initStreamPolling,100);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){updateClocks();updateCurrentStreamButton()}},{passive:true});
