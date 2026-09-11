/* ═══════════ SAFE STORAGE (never throws) ═══════════ */
const store={
  get(k){try{return localStorage.getItem(k)}catch(e){return this._m[k]??null}},
  set(k,v){try{localStorage.setItem(k,v)}catch(e){this._m[k]=String(v)}},
  _m:{}
};

/* ═══════════ AUTH ═══════════ */
const AUTH_PROTECTION_ENABLED=true;
const AUTHORIZED_DOMAIN='freef1.netlify.app';
const PREVIEW_HOST=location.hostname==='localhost'||location.hostname==='127.0.0.1'||location.hostname.endsWith('.e2b.app');
const AUTH_API_URL=PREVIEW_HOST?`${location.origin}/api/auth/verify`:'https://f1free.onrender.com/api/auth/verify';

/* Lightweight browser-copy deterrence. This cannot provide real source-code
   security because browsers must receive the page to render it. */
(function installCopyProtection(){
  const editableSelector='input,textarea,select,[contenteditable="true"]';
  const isEditable=target=>target instanceof Element&&Boolean(target.closest(editableSelector));
  const blockSelection=event=>{if(!isEditable(event.target))event.preventDefault()};
  document.addEventListener('contextmenu',event=>{if(!isEditable(event.target))event.preventDefault()});
  document.addEventListener('selectstart',blockSelection);
  document.addEventListener('dragstart',blockSelection);
  document.addEventListener('copy',event=>{if(!isEditable(event.target))event.preventDefault()});
  document.addEventListener('cut',event=>{if(!isEditable(event.target))event.preventDefault()});
  document.addEventListener('keydown',event=>{
    const key=(event.key||'').toLowerCase();
    const modifier=event.ctrlKey||event.metaKey;
    const blocked=key==='f12'||
      (modifier&&['u','s','p'].includes(key))||
      (modifier&&event.shiftKey&&['i','j','c','k'].includes(key));
    if(blocked&&!isEditable(event.target)){event.preventDefault();event.stopPropagation()}
  });
})();
function checkAuth(){
  if(!AUTH_PROTECTION_ENABLED)return;
  const host=location.hostname.toLowerCase();
  if(host===AUTHORIZED_DOMAIN||PREVIEW_HOST)return;
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
// Keep all season-aware API requests tied to the same schedule year.
const SITE_SEASON=2026;
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
 {label:"DAZN",suffix:"/dazn-es"},{label:"Sky Sports F1",suffix:"/sky-sport-f1-de"},
 // Fixed-URL source: wikisport.info serves its own player when framed (the page
 // redirects top-level visits, so it only renders inside an iframe). We embed
 // their entry page, not the inner /strm/NN.php player number: the wrapper
 // self-updates when the provider rotates player pages, and it carries their
 // Stream 1/2/3 links as an in-player fallback. Touch users can scroll inside
 // the frame if the provider's layout is taller than the stage.
 {label:"WikiSport",url:"https://wikisport.info/strm/f1.php"}
];

const $=id=>document.getElementById(id);
const eventSelect=$("eventSelect"),sessionSelect=$("sessionSelect"),linksEl=$("links"),
 playerEl=$("player"),loaderEl=$("loader"),noStreamEl=$("noStream"),badgeEl=$("badge"),
 nsActionsEl=$("nsActions"),noStreamTitleEl=$("noStreamTitle"),noStreamTextEl=$("noStreamText"),
 clockEl=$("clock"),countdownEl=$("countdown"),newsFeedEl=$("newsFeed"),newsStatusEl=$("newsStatus");

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
let activeView='home';// which view (home/news/info/discord) is on screen — see VIEWS / ROUTER

/* ── selectors ── */
function populate(){
  eventSelect.innerHTML="";
  schedule.forEach(ev=>{
    const o=document.createElement("option");o.value=ev.slug;
    const done=ev.sessions.every(isSessionEnded);
    o.disabled=done;
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

/* ── accessible custom dropdowns ──
   Keep the real select as the source of truth, but render the opened menu
   ourselves so it follows the APEX visual system on every browser. */
let customSelectSequence=0;
function enhanceSelect(select){
  if(!select||select.dataset.customEnhanced==='true')return;
  select.dataset.customEnhanced='true';
  const shell=document.createElement('div');shell.className='select-shell';
  select.parentNode.insertBefore(shell,select);shell.appendChild(select);
  const menuId=`custom-select-menu-${++customSelectSequence}`;
  const trigger=document.createElement('button');
  trigger.type='button';trigger.className='select-trigger';trigger.setAttribute('aria-haspopup','listbox');
  trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls',menuId);
  const label=select.closest('.sel')?.querySelector(`label[for="${select.id}"]`);
  if(label){if(!label.id)label.id=`${select.id}-label`;trigger.setAttribute('aria-labelledby',label.id)}
  trigger.innerHTML='<span class="select-value"></span><span class="select-chevron" aria-hidden="true"></span>';
  const menu=document.createElement('div');menu.className='select-menu';menu.id=menuId;menu.setAttribute('role','listbox');menu.hidden=true;
  shell.insertBefore(trigger,select);shell.appendChild(menu);
  select.classList.add('native-select-source');select.tabIndex=-1;select.setAttribute('aria-hidden','true');
  let optionButtons=[];
  const getAvailableIndex=(start,direction)=>{
    let index=start;
    while(index>=0&&index<optionButtons.length){
      const option=optionButtons[index];
      if(!option.disabled&&!option.hidden)return index;
      index+=direction;
    }
    return -1;
  };
  const close=focusTrigger=>{
    menu.hidden=true;trigger.setAttribute('aria-expanded','false');
    if(focusTrigger)trigger.focus();
  };
  const sync=()=>{
    const selected=select.options[select.selectedIndex];
    const value=trigger.querySelector('.select-value');
    if(value)value.textContent=selected?.textContent||'Select an option';
    trigger.disabled=select.disabled||!select.options.length;
    menu.replaceChildren();optionButtons=[];
    [...select.options].forEach((option,index)=>{
      const button=document.createElement('button');button.type='button';button.className='select-option';
      button.textContent=option.textContent;button.dataset.value=option.value;button.dataset.index=String(index);
      button.setAttribute('role','option');button.setAttribute('aria-selected',String(index===select.selectedIndex));
      button.disabled=Boolean(option.disabled);button.hidden=Boolean(option.hidden);
      if(option.disabled)button.classList.add('is-disabled');
      button.addEventListener('click',()=>{
        if(option.disabled||option.hidden)return;
        select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));
        sync();close(false);trigger.focus();
      });
      menu.appendChild(button);optionButtons.push(button);
    });
  };
  const open=direction=>{
    if(trigger.disabled)return;
    sync();menu.hidden=false;menu.classList.remove('above');
    const menuRect=menu.getBoundingClientRect(),shellRect=shell.getBoundingClientRect();
    if(menuRect.bottom>innerHeight-12&&shellRect.top>menuRect.height+12)menu.classList.add('above');
    trigger.setAttribute('aria-expanded','true');
    const selectedIndex=select.selectedIndex>=0?select.selectedIndex:0;
    const step=direction||0;
    const target=step?getAvailableIndex(selectedIndex+step,step):getAvailableIndex(selectedIndex,1);
    (optionButtons[target>=0?target:selectedIndex]||optionButtons[0])?.focus();
  };
  trigger.addEventListener('click',()=>{
    if(menu.hidden)open(0);else close(false);
  });
  trigger.addEventListener('keydown',event=>{
    if(['ArrowDown','ArrowUp','Enter',' '].includes(event.key)){
      event.preventDefault();
      if(menu.hidden)open(event.key==='ArrowUp'?-1:1);else close(false);
    }
  });
  menu.addEventListener('keydown',event=>{
    const current=optionButtons.indexOf(document.activeElement);
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close(true);return;}
    if(event.key==='Tab'){close(true);return;}
    if(event.key==='Enter'||event.key===' '){event.preventDefault();document.activeElement?.click();return;}
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){
      event.preventDefault();
      const next=getAvailableIndex(current+(event.key==='ArrowDown'?1:-1),event.key==='ArrowDown'?1:-1);
      if(next>=0)optionButtons[next].focus();
    }
    if(event.key==='Home'||event.key==='End'){
      event.preventDefault();
      const next=getAvailableIndex(event.key==='Home'?0:optionButtons.length-1,event.key==='Home'?1:-1);
      if(next>=0)optionButtons[next].focus();
    }
  });
  select.addEventListener('change',sync);
  new MutationObserver(sync).observe(select,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','hidden','selected']});
  select._syncCustom=sync;
  sync();
}
function setupCustomSelects(){
  document.querySelectorAll('.sel > select').forEach(enhanceSelect);
  document.addEventListener('click',event=>{
    document.querySelectorAll('.select-shell').forEach(shell=>{
      if(!shell.contains(event.target)){
        const trigger=shell.querySelector('.select-trigger'),menu=shell.querySelector('.select-menu');
        if(trigger&&menu&&!menu.hidden){menu.hidden=true;trigger.setAttribute('aria-expanded','false');}
      }
    });
  });
}
function updateHeader(){
  const parts=currentEvent.name.split(" ");
  const last=parts.slice(-2).join(" ");const first=parts.slice(0,-2).join(" ")||parts[0];
  $("heroTitle").textContent=first;
  $("heroTitle2").textContent=last;
  if(activeView==='home')document.title=currentEvent.name+" — APEX F1";
  $("heroSession").textContent=currentSession.name+" · "+SITE_SEASON;
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
    b.onclick=()=>{currentSource=i;renderButtons();updateHeader();load();trackEvent('source',s.label)};
    linksEl.appendChild(b);
  });
}
const buildUrl=i=>sources[i].url||`https://embedindia.st/embed/f1/${SITE_SEASON}/${currentEvent.slug}/${currentSession.slug}${sources[i].suffix||""}`;

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
/* Recovery actions shown in the "feed blocked" state (see showStreamBlocked). */
nsActionsEl.addEventListener("click",e=>{
  if(e.target.id==="nsRetryBtn")load();
  else if(e.target.id==="nsNewTabBtn")window.open(buildUrl(currentSource),"_blank","noopener");
});

function showNoStream(opts){
  const blocked=!!(opts&&opts.blocked);
  loaderEl.classList.add("hidden");noStreamEl.classList.add("visible");
  nsActionsEl.hidden=!blocked;
  setStreamOnScreen(false);
  playerEl.querySelector("iframe")?.remove();playerEl.querySelector("video")?.remove();
  if(blocked){
    stopNS();
    noStreamTitleEl.textContent=(opts&&opts.title)||"Feed blocked on this device";
    noStreamTextEl.textContent=(opts&&opts.text)||BLOCKED_COPY;
  }else startNS()}
function hideNoStream(){noStreamEl.classList.remove("visible");nsActionsEl.hidden=true;stopNS()}

/* While a stream element is on screen the player is lifted above the page overlays (see .has-stream in app.css). */
function setStreamOnScreen(on){document.body.classList.toggle('has-stream',on)}

let playerLoadToken=0;
/* iOS-class device: only used for user-facing guidance and analytics context. */
const IS_IOS=/ipad|iphone|ipod/i.test(navigator.userAgent)||(/macintosh/i.test(navigator.userAgent)&&navigator.maxTouchPoints>1);
/* How long an embed attempt may take to commit a document before we treat it
   as network-blocked and fall over to the next feed source. */
const NAV_TIMEOUT_MS=9000;
const BLOCKED_COPY=IS_IOS
 ?"The stream host never loaded on this network. On iPhone this is usually caused by a content blocker, Private Relay, Lockdown Mode or DNS filtering. Disable them for this site, or open the feed in its own tab."
 :"The stream host never responded on this network — the feed was blocked before it could start. Check ad-blockers, VPN or DNS filtering, or open the feed in its own tab.";

function setLoaderText(text){const el=$("loaderText");if(el)el.textContent=text}

/* An iframe whose navigation never committed paints as a blank WHITE about:blank
   tile (the classic "white stream" on iOS, where network-level blocks — content
   blockers, Private Relay, filtered DNS — silently leave the frame uncommitted).
   Only reveal a frame once its document committed: before commit the
   same-origin about:blank location is readable, after a cross-origin commit
   the read throws. */
function iframeCommitted(f){
  if(!f||!f.isConnected)return false;
  try{const href=f.contentWindow?f.contentWindow.location.href:"";return href!==""&&href!=="about:blank"}
  catch(_){return true}// cross-origin read throws only after a real commit
}
function makeStreamIframe(url){
  const f=document.createElement("iframe");
  f.src=url;
  f.allow="autoplay; fullscreen; encrypted-media; picture-in-picture";
  f.allowFullscreen=true;f.referrerPolicy="no-referrer";
  f.title="Live stream";
  return f;
}
function showStreamBlocked(){trackEvent('stream_blocked');showNoStream({blocked:true,text:BLOCKED_COPY})}

/* Try each feed source in turn (user's pick first) until one commits a document. */
function attemptSource(token,order,idx,startedAt){
  if(token!==playerLoadToken)return;
  if(idx>=order.length){showStreamBlocked();return}
  setLoaderText(idx===0?"Establishing feed…":"Feed unreachable — switching source…");
  const f=makeStreamIframe(buildUrl(order[idx]));
  let settled=false;
  const reveal=()=>{settled=true;trackEvent('stream_ready',Math.round(performance.now()-startedAt));
    f.classList.add('loaded');setTimeout(()=>{if(token===playerLoadToken)loaderEl.classList.add('hidden')},180)};
  f.onload=()=>{if(token!==playerLoadToken||settled)return;if(!iframeCommitted(f))return;reveal()};
  setTimeout(()=>{/* navigation watchdog: nothing committed => there is no picture to show */
    if(token!==playerLoadToken||!f.isConnected||settled)return;
    if(iframeCommitted(f)){reveal();return}
    trackEvent('stream_timeout');
    f.remove();
    attemptSource(token,order,idx+1,startedAt);
  },NAV_TIMEOUT_MS);
  playerEl.appendChild(f);setStreamOnScreen(true);
}

function load(){
  const token=++playerLoadToken;
  loaderEl.classList.remove("hidden");hideNoStream();
  setLoaderText("Establishing feed…");
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
      f.onerror=()=>{if(token===playerLoadToken)showStreamBlocked()};
    }else{
      f.src=streamOverride.url;f.allow="autoplay; fullscreen; encrypted-media; picture-in-picture";
      f.allowFullscreen=true;f.referrerPolicy="no-referrer";f.title="Live stream";
      f.style.cssText='position:absolute;inset:0;width:100%;height:100%;border:0;opacity:0;transition:opacity .7s ease';
      f.onload=()=>{if(token!==playerLoadToken||f.style.opacity==='1')return;if(!iframeCommitted(f))return;
        f.style.opacity='1';setTimeout(()=>{if(token===playerLoadToken)loaderEl.classList.add('hidden')},180)};
      setTimeout(()=>{if(token!==playerLoadToken||!f.isConnected||f.style.opacity==='1')return;
        if(iframeCommitted(f)){f.style.opacity='1';loaderEl.classList.add('hidden');return}
        trackEvent('stream_timeout');f.remove();showStreamBlocked();
      },NAV_TIMEOUT_MS);
    }
    playerEl.appendChild(f);setStreamOnScreen(true);
    return;
  }
  if(!isStreamAvailable(currentSession)){showNoStream();trackEvent('nostream');return}
  const order=[currentSource];
  for(let i=0;i<sources.length;i++)if(i!==currentSource)order.push(i);
  attemptSource(token,order,0,performance.now());
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
  const API=PREVIEW_HOST?location.origin:'https://f1free.onrender.com',INTERVAL=18000;
  let timer=0,inFlight=false,visitorToken='',visitorTokenExpiresAt=0;
  const updateCount=data=>{if(data&&Number.isFinite(data.active))el.textContent=String(data.active)};
  const refreshVisitorToken=async()=>{
    const response=await fetchWithTimeout(`${API}/api/visitors/token`,{cache:'no-store',credentials:'omit',headers:{'X-User-Id':uid}});
    if(!response.ok)throw new Error(`Token request failed: ${response.status}`);
    const data=await response.json();
    visitorToken=data.token||'';
    visitorTokenExpiresAt=Number(data.expiresAt)||0;
  };
  const beat=async()=>{
    clearTimeout(timer);
    if(document.hidden||inFlight){timer=setTimeout(beat,INTERVAL);return}
    inFlight=true;
    try{
      if(!visitorToken||visitorTokenExpiresAt-Date.now()<60000)await refreshVisitorToken();
      // Page travels as a query parameter (not a custom header) so the request stays preflight-free
      // and works against older backends that don't know about it yet.
      const r=await fetchWithTimeout(`${API}/api/visitors/heartbeat?page=${encodeURIComponent(location.pathname)}`,{cache:'no-store',credentials:'omit',keepalive:true,
        headers:{'X-Visitor-Token':visitorToken,'X-User-Id':uid}});
      if(r.status===403){visitorToken='';visitorTokenExpiresAt=0}
      else if(r.ok)updateCount(await r.json());
    }catch(_){}finally{inFlight=false;timer=setTimeout(beat,INTERVAL)}
  };
  /* Anonymous usage counters for the admin dashboard (feed picked, page opened, fullscreen,
     player ready/slow, livery). Same signed token as the heartbeat, fire-and-forget, never blocks UI. */
  const queue=[];let draining=false;
  const drain=async()=>{
    if(draining)return;draining=true;
    try{
      while(queue.length){
        if(!visitorToken||visitorTokenExpiresAt-Date.now()<60000)await refreshVisitorToken();
        const ev=queue.shift();
        const r=await fetchWithTimeout(`${API}/api/visitors/event`,{method:'POST',cache:'no-store',credentials:'omit',keepalive:true,
          headers:{'Content-Type':'application/json','X-Visitor-Token':visitorToken,'X-User-Id':uid},body:JSON.stringify(ev)});
        if(r.status===403){visitorToken='';visitorTokenExpiresAt=0;queue.unshift(ev);break}
        if(r.status===429){queue.length=0;break}
      }
    }catch(_){queue.length=0}finally{draining=false}
  };
  trackEvent=(type,value)=>{if(queue.length<12){queue.push(value===undefined?{type}:{type,value});setTimeout(drain,0)}};
  earlyEvents.splice(0).forEach(([type,value])=>trackEvent(type,value));// anything fired before init (e.g. the first load())
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)beat()},{passive:true});
  beat();
}
const earlyEvents=[];let trackEvent=(type,value)=>{if(earlyEvents.length<12)earlyEvents.push([type,value])};
document.addEventListener('fullscreenchange',()=>{if(document.fullscreenElement&&playerEl.contains(document.fullscreenElement))trackEvent('fullscreen')});
document.addEventListener('webkitfullscreenchange',()=>{if(document.webkitFullscreenElement&&playerEl.contains(document.webkitFullscreenElement))trackEvent('fullscreen')});

/* ═══════════ LIVE SITE STATE + STREAM OVERRIDE (SSE) ═══════════ */
const PUBLIC_API=PREVIEW_HOST?location.origin:'https://f1free.onrender.com';
const newsDateFormat=new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric'});
let newsPollInFlight=false;

function newsFromPayload(payload){
  if(Array.isArray(payload))return payload;
  return Array.isArray(payload?.news)?payload.news:Array.isArray(payload?.items)?payload.items:[];
}
function updateNewsStatus(online){
  if(!newsStatusEl)return;
  newsStatusEl.textContent=online?'NEWS · LIVE':'NEWS · OFFLINE';
  newsStatusEl.classList.toggle('is-live',online);
  newsStatusEl.classList.toggle('is-offline',!online);
}
function formatNewsDate(timestamp){
  const date=new Date(Number(timestamp));
  return Number.isNaN(date.getTime())?'—':newsDateFormat.format(date);
}
function renderNews(items){
  if(!newsFeedEl)return;
  const list=newsFromPayload(items).filter(item=>item&&item.title&&item.body).slice(0,8);
  if(!list.length){
    newsFeedEl.innerHTML='<div class="state">No news updates yet. Check back soon.</div>';
    return;
  }
  const fragment=document.createDocumentFragment();
  list.forEach((item,index)=>{
    const article=document.createElement('article');
    article.className='news-item';
    article.style.animation=`fadeUp .55s var(--ease) ${index*55}ms both`;
    article.innerHTML=`<div class="news-meta"><span class="news-tag">${escapeHtml(item.tag||'Race Control')}</span><time class="news-date" datetime="${escapeHtml(new Date(Number(item.createdAt)||Date.now()).toISOString())}">${escapeHtml(formatNewsDate(item.createdAt))}</time></div>
      <h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.body)}</p>`;
    fragment.appendChild(article);
  });
  newsFeedEl.replaceChildren(fragment);
}
function applyNewsUpdate(payload,online=true){
  renderNews(newsFromPayload(payload));
  updateNewsStatus(online);
}
async function pollNews(force=false){
  if(!newsFeedEl||document.hidden||newsPollInFlight||(!force&&streamSseConnected))return;
  newsPollInFlight=true;
  try{
    const response=await fetchWithTimeout(`${PUBLIC_API}/api/news`,{cache:'no-store',credentials:'omit',headers:{Accept:'application/json'}});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    applyNewsUpdate(await response.json(),true);
  }catch(_){
    updateNewsStatus(false);
    if(!newsFeedEl.querySelector('.news-item'))newsFeedEl.innerHTML='<div class="state">News feed unavailable right now.</div>';
  }finally{newsPollInFlight=false}
}
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
  const SSE_URL=`${PUBLIC_API}/api/events`;
  try{
    const es=new EventSource(SSE_URL);streamEvents=es;
    const onState=e=>{try{applyStreamOverride(JSON.parse(e.data))}catch(_){}};
    es.addEventListener('open',()=>{streamSseConnected=true;streamRetryMs=2000});
    es.addEventListener('stream_override',onState);
    // Kept for compatibility with older backend deployments; duplicate state is ignored above.
    es.addEventListener('stream_update',onState);
    es.addEventListener('maintenance_update',event=>{try{applyMaintenanceMode(JSON.parse(event.data))}catch(_){}});
    es.addEventListener('news_update',event=>{try{applyNewsUpdate(JSON.parse(event.data),true)}catch(_){}});
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
    const response=await fetchWithTimeout(`${PUBLIC_API}/api/site/status`,{cache:'no-store',credentials:'omit'});
    if(response.ok)applyMaintenanceMode((await response.json()).maintenance);
  }catch(_){}finally{sitePollInFlight=false}
}
async function pollStreamStatus(force=false){
  if(document.hidden||streamPollInFlight||(!force&&streamSseConnected))return;
  streamPollInFlight=true;
  try{
    const r=await fetchWithTimeout(`${PUBLIC_API}/api/stream/status`,{cache:'no-store',credentials:'omit'});
    if(r.ok)applyStreamOverride(await r.json());
  }catch(_){}finally{streamPollInFlight=false}
}
function initStreamPolling(){
  clearInterval(streamPollTimer);pollStreamStatus(true);pollSiteStatus(true);pollNews(true);
  streamPollTimer=setInterval(()=>{pollStreamStatus();pollSiteStatus();pollNews()},30000);
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){streamEvents?.close();streamEvents=null;streamSseConnected=false}
    else{pollStreamStatus(true);pollSiteStatus(true);pollNews(true);initStreamOverrideSSE()}
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
  const ev=schedule.find(e=>e.slug===eventSelect.value);if(!ev||ev.sessions.every(isSessionEnded))return;
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
    navEl.classList.toggle('stuck',y>40||activeView!=='home');progressEl.style.transform='scaleX('+(h>0?y/h:0)+')';
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
  document.querySelectorAll('#infoTabs [role="tab"]').forEach(t=>{
    const active=t.dataset.panel===id;
    t.classList.toggle('active',active);
    t.setAttribute('aria-selected',String(active));
  });
}
document.querySelectorAll('#infoTabs [role="tab"]').forEach(t=>t.addEventListener('click',()=>openPanel(t.dataset.panel)));
document.querySelectorAll('[role="tablist"]').forEach(tabList=>tabList.addEventListener('keydown',event=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  const tabs=[...tabList.querySelectorAll('[role="tab"]')];
  const current=tabs.indexOf(document.activeElement);if(current<0)return;
  event.preventDefault();
  const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(current+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
  tabs[next].focus();
}));
document.querySelectorAll('.foot-links button[data-panel]').forEach(b=>b.addEventListener('click',()=>{
  openPanel(b.dataset.panel);
  navigate('info');
}));

/* ═══════════ VIEWS / ROUTER ═══════════
   Home, News, Info and Discord are "views" in one document. Switching views cross-fades
   in place (no reload), header + footer stay put, the URL updates (/news, /info) and
   the browser back button works. Netlify serves index.html for those paths via _redirects,
   so a direct load of /info opens straight onto the Info view. */
const VIEWS={home:'viewHome',news:'viewNews',info:'viewInfo',discord:'viewDiscord'};
const VIEW_TITLES={news:'News — APEX F1',info:'Terms, Privacy & FAQ — APEX F1',discord:'Discord — APEX F1'};
const VIEW_SWAP_MS=reduceMotion?0:260;
let viewSwapTimer=null;
function routeFromPath(path){const seg=(path||'/').replace(/^\/+|\/+$/g,'').toLowerCase();return seg in VIEWS?seg:'home'}
function revealNow(root){root.querySelectorAll('.rv').forEach(el=>el.classList.add('in'))}
function setActiveNav(route){
  document.querySelectorAll('.nav-links a[data-route]').forEach(a=>a.classList.toggle('current',a.dataset.route===route));
  document.body.dataset.view=route;
}
function showView(route,{push=true,scroll=true}={}){
  const next=$(VIEWS[route]),prev=$(VIEWS[activeView]);
  if(!next)return;
  const changed=route!==activeView;
  if(push){
    const url=route==='home'?'/':'/'+route;
    if(location.pathname!==url)history.pushState({view:route},'',url);
  }
  document.title=route==='home'?currentEvent.name+" — APEX F1":VIEW_TITLES[route];
  setActiveNav(route);closeNav();
  if(!changed){if(scroll)scrollTo({top:0,behavior:'smooth'});return}
  activeView=route;clearTimeout(viewSwapTimer);trackEvent('view',route==='home'?'/':'/'+route);
  document.body.classList.add('view-swapping');
  prev.classList.add('is-leaving');prev.classList.remove('is-active');
  viewSwapTimer=setTimeout(()=>{
    prev.hidden=true;prev.classList.remove('is-leaving');
    next.hidden=false;
    if(scroll)scrollTo({top:0,behavior:'instant'});
    // Force a frame so the enter transition actually plays after un-hiding.
    void next.offsetWidth;
    next.classList.add('is-active');
    if(route!=='home')revealNow(next);// sub pages are short: reveal everything immediately
    document.body.classList.remove('view-swapping');
    onScroll();
    if(route==='news')pollNews(true);// refresh the feed the moment the page opens
  },VIEW_SWAP_MS);
}
function navigate(route){showView(route,{push:true,scroll:true})}
/* Intercept in-page route links (nav, footer, back buttons). Plain hrefs remain as a no-JS fallback. */
document.addEventListener('click',event=>{
  const a=event.target.closest('a[data-route]');if(!a)return;
  if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button!==0)return;
  event.preventDefault();navigate(a.dataset.route);
});
/* Anchor links (#watch, #grid, #standings, #top) only make sense on the home view. */
document.addEventListener('click',event=>{
  const a=event.target.closest('a[href^="#"]');if(!a||activeView==='home')return;
  const id=a.getAttribute('href').slice(1);const target=document.getElementById(id);if(!target)return;
  event.preventDefault();
  showView('home',{push:true,scroll:false});
  setTimeout(()=>target.scrollIntoView({behavior:reduceMotion?'instant':'smooth'}),VIEW_SWAP_MS+40);
});
addEventListener('popstate',()=>showView(routeFromPath(location.pathname),{push:false,scroll:true}));
/* Initial route: /news or /info opens directly onto that view (no flash of the home page). */
(function initView(){
  const route=routeFromPath(location.pathname);
  history.replaceState({view:route},'',location.pathname+location.search+location.hash);
  if(route==='home'){setActiveNav('home');return}
  const next=$(VIEWS[route]),home=$(VIEWS.home);
  home.hidden=true;home.classList.remove('is-active');
  next.hidden=false;next.classList.add('is-active');activeView=route;
  revealNow(next);setActiveNav(route);document.title=VIEW_TITLES[route];
})();

/* ═══════════ STANDINGS ═══════════ */
const JOLPI='https://api.jolpi.ca/ergast/f1';
const rowsEl=$("standingsList"),loadEl=$("standingsLoading");
const TEAM_HEX={'McLaren':'#FF8000','Ferrari':'#DC0000','Red Bull':'#1E41FF','Mercedes':'#00D2BE',
 'Williams':'#005AFF','Aston Martin':'#006F62','Alpine F1 Team':'#FF0080','Alpine':'#FF0080',
 'Haas F1 Team':'#B6BABD','Haas':'#B6BABD','Audi':'#E62213','Sauber':'#00E701','RB F1 Team':'#6692FF','Racing Bulls':'#6692FF','Cadillac F1 Team':'#B4A07A','Cadillac':'#B4A07A'};
function hexFor(n){for(const k in TEAM_HEX)if((n||'').includes(k))return TEAM_HEX[k];return 'var(--team)'}
function escapeHtml(value){return String(value??'').replace(/[&<>\"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[char]))}
const apiPromises=new Map();
const API_TIMEOUT_MS=10000;
const API_STALE_FALLBACK_MS=24*60*60*1000;
function fetchWithTimeout(url,options={},timeoutMs=API_TIMEOUT_MS){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),timeoutMs);
  return fetch(url,{...options,signal:controller.signal}).finally(()=>clearTimeout(timeout));
}
function apiCacheKey(url){return `freef1_api_cache_${url}`}
function readApiFallback(url){
  const key=apiCacheKey(url);
  try{
    const cached=JSON.parse(store.get(key)||'null');
    if(!cached||Date.now()-Number(cached.savedAt)>API_STALE_FALLBACK_MS){
      if(cached){try{localStorage.removeItem(key)}catch(_){}}
      return null;
    }
    return cached.data||null;
  }catch(_){return null}
}
const API_CACHE_MAX=40,API_CACHE_INDEX='freef1_api_cache_index';
function saveApiResponse(url,data){
  try{
    const key=apiCacheKey(url);
    try{store.set(key,JSON.stringify({savedAt:Date.now(),data}))}catch(_){return}
    let idx=null;
    try{idx=JSON.parse(store.get(API_CACHE_INDEX)||'null')}catch(_){idx=null}
    if(!Array.isArray(idx)){
      idx=[];
      try{
        for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.indexOf('freef1_api_cache_')===0)idx.push(k)}
      }catch(_){}
    }
    idx=idx.filter(k=>k!==key);idx.push(key);
    while(idx.length>API_CACHE_MAX){const old=idx.shift();try{localStorage.removeItem(old)}catch(_){}}
    try{store.set(API_CACHE_INDEX,JSON.stringify(idx))}catch(_){}
  }catch(_){}
}
function fetchJson(url){
  if(apiPromises.has(url))return apiPromises.get(url);
  const request=fetchWithTimeout(url,{headers:{Accept:'application/json'}})
    .then(response=>{if(!response.ok)throw new Error(`HTTP ${response.status}`);return response.json()})
    .then(data=>{saveApiResponse(url,data);return data})
    .catch(error=>{apiPromises.delete(url);const fallback=readApiFallback(url);if(fallback)return fallback;throw error});
  apiPromises.set(url,request);return request;
}
let driverStandingsPromise=null;
function getDriverStandings(){
  if(!driverStandingsPromise)driverStandingsPromise=fetchJson(`${JOLPI}/${SITE_SEASON}/driverstandings/?limit=40`)
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
    : fetchJson(`${JOLPI}/${SITE_SEASON}/constructorstandings/`);
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
  driverEntries=list.slice();
  const renderFollowing=getFollowing();
  const fragment=document.createDocumentFragment();let rendered=0;
  list.forEach((it,i)=>{
    const d=it.Driver||{},team=it.Constructors?.[0]?.name||'',src=photoFor(d.driverId);if(!src)return;
    const a=document.createElement('article');a.className='dcard'+(it.position==='1'?' lead':'');
    a.style.setProperty('--c',hexFor(team));a.style.animationDelay=(i*32)+'ms';
    const label=`View ${d.givenName||''} ${d.familyName||''} profile`.replace(/\s+/g,' ').trim();
    a.setAttribute('role','button');a.tabIndex=0;a.setAttribute('aria-label',label);a.title=label;
    a.dataset.driverId=d.driverId;
    a.innerHTML=`<div class="dshade"></div><div class="dfall">${escapeHtml((d.givenName?.[0]||'')+(d.familyName?.[0]||''))}</div>
      <img src="${src}" alt="${escapeHtml(`${d.givenName||''} ${d.familyName||''}`)}" width="440" height="587" loading="lazy" decoding="async" fetchpriority="low" referrerpolicy="no-referrer">
      <div class="dpos">P${escapeHtml(it.position)}</div><div class="dnum">${escapeHtml(d.permanentNumber||'')}</div>
      <div class="dhint">View profile</div>
      <div class="fbadge"${renderFollowing.includes(d.driverId)?'':' hidden'}>★ Following</div>
      <div class="dbody"><div class="dname"><small>${escapeHtml(d.givenName||'')}</small>${escapeHtml(d.familyName||'')}</div>
      <div class="dteam"><i></i>${escapeHtml(team)}</div><div class="dpts">${escapeHtml(it.points)} PTS · ${escapeHtml(it.wins)} WIN${it.wins==='1'?'':'S'}</div></div>`;
    a.querySelector('img').addEventListener('error',()=>a.classList.add('noimg'),{once:true});
    const open=()=>openDriverProfile(d.driverId);
    a.addEventListener('click',open);
    a.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open()}});
    fragment.appendChild(a);rendered++;
  });
  if(rendered)el.replaceChildren(fragment);else el.innerHTML='<div class="state">Grid unavailable right now.</div>';
}
function loadDriverGrid(){
  getDriverStandings().then(renderDriverGrid)
    .catch(()=>{$("driverGrid").innerHTML='<div class="state">Grid unavailable right now.</div>'});
}
/* ═══════════ DRIVER PROFILE (click a card → modal) ═══════════ */
const dOverlay=$("driverOverlay"),dSheet=$("driverSheet"),dProfile=$("driverProfile");
let driverEntries=[],driverProfileToken=0;
const FOLLOW_KEY='freef1_following';
/* Follows are private: stored only in this browser, never sent anywhere. */
function getFollowing(){
  try{
    const list=JSON.parse(store.get(FOLLOW_KEY)||'[]');
    return Array.isArray(list)?list.filter(x=>typeof x==='string'):[];
  }catch(_){return[]}
}
function syncFollowBadges(){
  const following=getFollowing();
  document.querySelectorAll('.dcard[data-driver-id]').forEach(card=>{
    const badge=card.querySelector('.fbadge');
    if(badge)badge.hidden=!following.includes(card.dataset.driverId);
  });
}
const driverCareerCache=new Map();
/* Ergast constructor name → livery entry (team logo + theme). */
const TEAM_ALIAS={'rb f1 team':'racingbulls','racing bulls':'racingbulls','red bull':'redbull',
 'red bull racing':'redbull','alpine f1 team':'alpine','haas f1 team':'haas',
 'cadillac f1 team':'cadillac','aston martin':'astonmartin','sauber':'audi'};
function teamEntryForConstructor(name){
  const n=String(name||'').trim().toLowerCase();
  if(TEAM_ALIAS[n])return teams.find(t=>t.id===TEAM_ALIAS[n])||teams[0];
  return teams.find(t=>t.id!=='default'&&(n.includes(t.name.toLowerCase())||t.name.toLowerCase().includes(n)))||teams[0];
}
function fmtPts(n){return String(Math.round(Number(n||0)*10)/10)}
function ageFrom(dob){
  if(!dob)return null;
  const b=new Date(dob+'T00:00:00Z');if(isNaN(b))return null;
  const now=new Date();let age=now.getUTCFullYear()-b.getUTCFullYear();
  const m=now.getUTCMonth()-b.getUTCMonth();
  if(m<0||(m===0&&now.getUTCDate()<b.getUTCDate()))age--;
  return age;
}
function fmtDob(dob){
  if(!dob)return '—';
  const d=new Date(dob+'T00:00:00Z');if(isNaN(d))return '—';
  return d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
}
/* Career telemetry, optimised for speed:
   1. Results are paged (Jolpi caps at 100 rows): page one reveals the total,
      remaining pages load in parallel beside the poles + seasons calls.
   2. Titles: champion check per winning season only — a champion always has
      at least one win, so rookies skip this entirely. Checks run through a
      small pool, and every career fetch retries with backoff on rate-limiting.
   All calls flow through fetchJson → deduped + cached 24h. Success is
   memoised per driver (reopening is instant); failure retries on reopen. */
async function fetchCareerJson(url,attempts=4){
  let wait=800;
  for(let i=0;i<attempts;i++){
    try{
      return await fetchJson(url);
    }catch(err){
      if(i===attempts-1)throw err;
      await new Promise(r=>setTimeout(r,wait));
      wait=Math.min(wait*2,6000);
    }
  }
}
function mapPool(items,fn,size=4){
  const out=new Array(items.length);let next=0;
  const workers=new Array(Math.min(size,items.length)).fill(0).map(async()=>{
    while(next<items.length){const k=next++;out[k]=await fn(items[k])}
  });
  return Promise.all(workers).then(()=>out);
}
async function fetchAllResults(driverId){
  const first=await fetchCareerJson(`${JOLPI}/drivers/${driverId}/results/?limit=100&offset=0`).catch(()=>null);
  const rows=first?.MRData?.RaceTable?.Races||[];
  const total=Number(first?.MRData?.total||rows.length);
  if(!rows.length)return null;
  if(total<=rows.length)return rows;
  const offsets=[];
  for(let off=rows.length;off<total;off+=100)offsets.push(off);
  const pages=await mapPool(offsets,off=>
    fetchCareerJson(`${JOLPI}/drivers/${driverId}/results/?limit=100&offset=${off}`).catch(()=>null),3);
  for(const page of pages){
    const batch=page?.MRData?.RaceTable?.Races||[];
    if(!batch.length)return null;
    rows.push(...batch);
  }
  return rows;
}
function getDriverCareer(driverId){
  if(driverCareerCache.has(driverId))return driverCareerCache.get(driverId);
  const job=(async()=>{
    try{
      const [raceRows,poles,seasons]=await Promise.all([
        fetchAllResults(driverId),
        fetchCareerJson(`${JOLPI}/drivers/${driverId}/qualifying/1/?limit=1`).catch(()=>null),
        fetchCareerJson(`${JOLPI}/drivers/${driverId}/seasons/?limit=100`).catch(()=>null)
      ]);
      const races=raceRows||[];
      if(!races.length||!poles)return null;
      let wins=0,podiums=0,points=0,seasonPodiums=0;
      const winSeasons=new Set(),allSeasons=new Set();
      races.forEach(r=>{
        allSeasons.add(r.season);
        const res=r.Results?.[0];if(!res)return;
        points+=parseFloat(res.points)||0;
        const pos=res.position;
        if(pos==='1'){wins++;podiums++;winSeasons.add(r.season)}
        else if(pos==='2'||pos==='3')podiums++;
        if(String(r.season)===String(SITE_SEASON)&&(pos==='1'||pos==='2'||pos==='3'))seasonPodiums++;
      });
      const seasonRows=seasons?.MRData?.SeasonTable?.Seasons||[];
      const years=seasonRows.length?seasonRows.map(s=>s.season):[...allSeasons].sort();
      const span=years.length>1?`${years[0]}–${years[years.length-1]}`:(years[0]||String(SITE_SEASON));
      /* The current season only counts toward titles once its final race is done. */
      const lastRaceStart=schedule[schedule.length-1]?.sessions?.find(s=>s.slug==='race')?.start;
      const seasonComplete=lastRaceStart?Date.now()>new Date(lastRaceStart).getTime()+2*36e5:false;
      const titleSeasons=[...winSeasons].filter(y=>String(y)!==String(SITE_SEASON)||seasonComplete);
      let titles=0;
      if(titleSeasons.length){
        const checkTitle=async y=>{
          try{
            const d=await fetchCareerJson(`${JOLPI}/${y}/driverstandings/1/?limit=1`);
            const champ=d?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings?.[0]?.Driver?.driverId;
            return champ?champ===driverId:null;
          }catch(_){return null}
        };
        const checks=await mapPool(titleSeasons,checkTitle,2);
        if(checks.includes(null))return null;
        titles=checks.filter(Boolean).length;
      }
      return {
        races:races.length,wins,podiums,seasonPodiums,
        points:fmtPts(points),
        poles:Number(poles?.MRData?.total||0),
        seasons:years.length||allSeasons.size,span,titles
      };
    }catch(_){return null}
  })();
  driverCareerCache.set(driverId,job);
  job.then(career=>{if(!career)driverCareerCache.delete(driverId)});
  return job;
}
function openDriverProfile(driverId){
  const entry=driverEntries.find(e=>e.Driver?.driverId===driverId);
  if(!entry||!dOverlay||!dProfile)return;
  const token=++driverProfileToken;
  const d=entry.Driver||{},team=entry.Constructors?.[0]?.name||'';
  const color=hexFor(team),tEntry=teamEntryForConstructor(team);
  const photo=photoFor(d.driverId);
  const code=d.code||((d.givenName?.[0]||'')+(d.familyName?.slice(0,2)||'')).toUpperCase()||'—';
  const num=d.permanentNumber||'';
  const age=ageFrom(d.dateOfBirth);
  const mate=driverEntries.find(e=>e!==entry&&(e.Constructors?.[0]?.name||'')===team)?.Driver;
  const mateName=mate?`${mate.givenName||''} ${mate.familyName||''}`.trim():'—';
  dSheet.style.setProperty('--dc',color);
  const following=getFollowing().includes(d.driverId);
  dProfile.innerHTML=`
    <div class="dp-card">
      <div class="dp-shade"></div>
      <div class="dp-info">
        <div class="dp-eyebrow">Driver Profile · ${SITE_SEASON} Season</div>
        <div class="dp-name"><small>${escapeHtml(d.givenName||'')}</small>${escapeHtml(d.familyName||'')}</div>
        <div class="dp-team">${tEntry.logo?`<img src="${TEAM_LOGO(tEntry.logo,96)}" alt="" width="30" height="30" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">`:''}<span>${escapeHtml(team||'—')}</span></div>
        <div class="dp-pills">
          <span class="dp-pos">P${escapeHtml(entry.position)}</span>
          ${num?`<span class="dp-pill">#${escapeHtml(num)}</span>`:''}
          <span class="dp-pill">${escapeHtml(code)}</span>
        </div>
      </div>
      <div class="dp-photo">
        ${photo?`<img src="${photo}" alt="${escapeHtml(`${d.givenName||''} ${d.familyName||''}`)}" loading="eager" decoding="async" referrerpolicy="no-referrer" onerror="this.closest('.dp-photo').classList.add('noimg')">`:''}
        <div class="dp-fall">${escapeHtml((d.givenName?.[0]||'')+(d.familyName?.[0]||''))}</div>
      </div>
    </div>
    <div class="dp-sec">${SITE_SEASON} Season</div>
    <div class="dp-tiles">
      <div class="dp-tile"><b>P${escapeHtml(entry.position)}</b><span>Standing</span></div>
      <div class="dp-tile"><b>${escapeHtml(entry.points)}</b><span>Points</span></div>
      <div class="dp-tile"><b>${escapeHtml(entry.wins)}</b><span>Wins</span></div>
      <div class="dp-tile"><b id="dpSeasonPod">···</b><span>Podiums</span></div>
    </div>
    <div class="dp-sec">Career</div>
    <div id="dpCareer">
      <div class="dp-tiles skel"><div class="dp-tile"></div><div class="dp-tile"></div><div class="dp-tile"></div><div class="dp-tile"></div><div class="dp-tile"></div><div class="dp-tile"></div></div>
      <div class="dp-note">Loading career telemetry…</div>
    </div>
    <div class="dp-sec">Biography</div>
    <div class="dp-bio">
      <div class="dp-fact"><small>Nationality</small><b>${escapeHtml(d.nationality||'—')}</b></div>
      <div class="dp-fact"><small>Born</small><b>${escapeHtml(fmtDob(d.dateOfBirth))}${age!==null?` · Age ${age}`:''}</b></div>
      <div class="dp-fact"><small>Driver Code</small><b>${escapeHtml(code)}</b></div>
      <div class="dp-fact"><small>Race Number</small><b>${escapeHtml(num||'—')}</b></div>
      <div class="dp-fact"><small>Team</small><b>${escapeHtml(team||'—')}</b></div>
      <div class="dp-fact"><small>Teammate</small><b>${escapeHtml(mateName)}</b></div>
    </div>
    <div class="dp-actions">
      <button class="btn sm${following?' on':''}" id="dpFollow" type="button" aria-pressed="${following}">${following?'✓ Following':'+ Follow'}</button>
      ${tEntry.id!=='default'?`<button class="btn sm primary" id="dpLivery" type="button">Apply ${escapeHtml(tEntry.name)} Livery</button>`:''}
      ${d.url?`<a class="btn sm" href="${escapeHtml(d.url)}" target="_blank" rel="noopener">Biography ↗</a>`:''}
    </div>`;
  $("dpFollow")?.addEventListener('click',event=>{
    const btn=event.currentTarget;
    const on=btn.getAttribute('aria-pressed')!=='true';
    const list=getFollowing().filter(x=>x!==d.driverId);
    if(on)list.push(d.driverId);
    store.set(FOLLOW_KEY,JSON.stringify(list));
    btn.classList.toggle('on',on);
    btn.setAttribute('aria-pressed',String(on));
    btn.textContent=on?'✓ Following':'+ Follow';
    syncFollowBadges();
  });
  $("dpLivery")?.addEventListener('click',()=>{
    applyTeamTheme(tEntry.id);store.set('freef1_team',tEntry.id);trackEvent('team',tEntry.id);
    closeModal(dOverlay);
  });
  openModal(dOverlay);
  getDriverCareer(d.driverId).then(career=>{
    if(token!==driverProfileToken)return;
    renderDriverCareer(career);
  });
}
function renderDriverCareer(career){
  const box=$("dpCareer");if(!box)return;
  const pod=$("dpSeasonPod");if(pod)pod.textContent=career?career.seasonPodiums:'–';
  if(!career){box.innerHTML='<div class="state">Career telemetry unavailable right now.</div>';return}
  box.innerHTML=`
    <div class="dp-tiles">
      <div class="dp-tile"><b>${career.races}</b><span>Races</span></div>
      <div class="dp-tile"><b>${career.wins}</b><span>Wins</span></div>
      <div class="dp-tile"><b>${career.podiums}</b><span>Podiums</span></div>
      <div class="dp-tile"><b>${career.poles}</b><span>Poles</span></div>
      <div class="dp-tile"><b>${escapeHtml(career.points)}</b><span>Points</span></div>
      <div class="dp-tile hl"><b>${career.titles}</b><span>Title${career.titles===1?'':'s'}</span></div>
    </div>
    <div class="dp-note">F1 ${escapeHtml(career.span)} · ${career.seasons} season${career.seasons===1?'':'s'} · Career data via Ergast</div>`;
}
$("driverClose").addEventListener('click',()=>closeModal(dOverlay));

document.querySelectorAll('#standings [role="tab"]').forEach(t=>t.addEventListener('click',()=>{
  document.querySelectorAll('#standings [role="tab"]').forEach(x=>{
    const active=x===t;
    x.classList.toggle('active',active);
    x.setAttribute('aria-selected',String(active));
  });
  loadStandings(t.dataset.type);
}));

/* ═══════════ SESSION RESULTS ═══════════ */
let seasonRaces=[];
const sOverlay=$("sessionsOverlay"),sRace=$("sessionRaceSelect"),sType=$("sessionTypeSelect"),
 sLoad=$("sessionsResultsLoading"),sRes=$("sessionsResults");
function lockScroll(on){document.body.style.overflow=on?'hidden':''}
let lastModalFocus=null;
function openModal(modal){
  lastModalFocus=document.activeElement;
  modal.classList.add('open');lockScroll(true);
  requestAnimationFrame(()=>modal.querySelector('button:not(:disabled),select:not([tabindex="-1"])')?.focus());
}
function closeModal(modal){
  modal.classList.remove('open');
  if(!document.querySelector('.modal.open')){
    lockScroll(false);
    if(lastModalFocus&&typeof lastModalFocus.focus==='function')lastModalFocus.focus();
    lastModalFocus=null;
  }
}
function trapModalFocus(event){
  if(event.key!=='Tab')return;
  const modal=document.querySelector('.modal.open');if(!modal)return;
  const focusable=[...modal.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not([tabindex="-1"]),[href],[tabindex]:not([tabindex="-1"]),textarea:not(:disabled)')]
    .filter(element=>!element.hidden&&element.offsetParent!==null);
  if(!focusable.length)return;
  const first=focusable[0],last=focusable[focusable.length-1];
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
}
function isDateEnded(d){return d&&(new Date()-new Date(d+'T23:59:59Z'))>0}

async function loadSeasonRaces(){
  try{
    if(!seasonRaces.length){const data=await fetchJson(`https://api.jolpi.ca/ergast/f1/${SITE_SEASON}.json?limit=30`);seasonRaces=data?.MRData?.RaceTable?.Races||[]}
    sRace.innerHTML='';
    const valid=seasonRaces.filter(race=>isDateEnded(race.date));
    const list=(valid.length?valid:seasonRaces).slice().sort((a,b)=>Number(b.round)-Number(a.round));
    const fragment=document.createDocumentFragment();
    list.forEach(race=>{const option=document.createElement('option');option.value=race.round;option.textContent=`R${race.round} · ${race.raceName}`;fragment.appendChild(option)});
    sRace.appendChild(fragment);if(list.length)sRace.value=list[0].round;
    if(!seasonRaces.length)sRace.innerHTML='<option>No races found</option>';
    updateSessionTypeOptions();loadSessionResults();
  }catch(_){sRace.innerHTML='<option>Failed to load</option>'}
}
function updateSessionTypeOptions(){
  const rc=seasonRaces.find(r=>r.round===sRace.value);
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
    const data=await fetchJson(`https://api.jolpi.ca/ergast/f1/${SITE_SEASON}/${round}/${ep}/`);
    sLoad.style.display='none';
    const race=data?.MRData?.RaceTable?.Races?.[0];
    const results=type==='qualifying'?race?.QualifyingResults:type==='sprint'?race?.SprintResults:race?.Results;
    if(!results?.length){sRes.innerHTML='<div class="state">No results published for this session yet.</div>';return}
    const fragment=document.createDocumentFragment();
    results.forEach((result,index)=>{
      const element=document.createElement('div');element.className='rrow';element.style.animation=`rowIn .5s var(--ease) ${index*24}ms both`;
      element.style.setProperty('--race-team',hexFor(result.Constructor?.name||''));
      const time=type==='qualifying'?([result.Q3,result.Q2,result.Q1].filter(Boolean)[0]||'—'):(result.Time?.time||result.status||'—');
      element.innerHTML=`<div class="pos">${escapeHtml(result.position)}</div><div class="who"><b>${escapeHtml(`${result.Driver?.givenName||''} ${result.Driver?.familyName||''}`)}</b><small>${escapeHtml(result.Constructor?.name||'')}</small></div><div class="rtime">${escapeHtml(time)}</div>`;
      fragment.appendChild(element);
    });
    sRes.replaceChildren(fragment);
  }catch(e){sLoad.style.display='none';sRes.innerHTML='<div class="state">Failed to load results.</div>'}
}
$("sessionsBtn").addEventListener('click',()=>{openModal(sOverlay);loadSeasonRaces()});
$("sessionsClose").addEventListener('click',()=>closeModal(sOverlay));
sRace.addEventListener('change',()=>{updateSessionTypeOptions();loadSessionResults()});
sType.addEventListener('change',loadSessionResults);
$("championshipBtn").addEventListener('click',()=>document.getElementById('standings').scrollIntoView({behavior:'smooth'}));

/* ═══════════ RACE TIMES ═══════════ */
const raceTimesOverlay=$("raceTimesOverlay"),raceTimesList=$("raceTimesList"),raceTimesSeason=$("raceTimesSeason"),raceTimesTimezone=$("raceTimesTimezone");
let raceTimesFilter='all';
const localTimeZone=Intl.DateTimeFormat().resolvedOptions().timeZone||'local timezone';
const localTimeZoneLabel=(()=>{
  const parts=new Intl.DateTimeFormat('en-US',{timeZoneName:'short'}).formatToParts(new Date());
  return parts.find(part=>part.type==='timeZoneName')?.value||localTimeZone;
})();
const raceDateFormat=new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric'});
const raceClockFormat=new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',hour12:false,timeZoneName:'short'});
function raceStatus(event,now=Date.now()){
  const race=event.sessions.find(session=>session.slug==='race')||event.sessions.at(-1);
  const starts=event.sessions.map(session=>session.ts).filter(Number.isFinite);
  const first=Math.min(...starts),last=Math.max(...starts);
  if(race&&now>race.ts+4*60*60*1000)return'finished';
  if(now>=first-60*60*1000&&now<=last+4*60*60*1000)return'current';
  return'upcoming';
}
function formatRaceDateTime(timestamp){
  const date=new Date(Number(timestamp));
  if(Number.isNaN(date.getTime()))return'—';
  return `${raceDateFormat.format(date)} · ${raceClockFormat.format(date)}`;
}
function renderRaceTimes(filter=raceTimesFilter){
  if(!raceTimesList)return;
  raceTimesFilter=filter;
  if(raceTimesSeason)raceTimesSeason.textContent=`SEASON ${SITE_SEASON} · LOCAL`;
  if(raceTimesTimezone)raceTimesTimezone.textContent=`Times shown in your local timezone · ${localTimeZone} (${localTimeZoneLabel})`;
  const items=schedule.map(event=>({event,status:raceStatus(event),race:event.sessions.find(session=>session.slug==='race')||event.sessions.at(-1)}))
    .filter(item=>filter==='all'||item.status===filter);
  if(!items.length){raceTimesList.innerHTML='<div class="state">No races match this filter.</div>';return}
  raceTimesList.innerHTML=items.map(({event,status,race})=>`<article class="race-time-item ${status}">
    <div class="race-time-top"><div class="race-time-title">R${escapeHtml(event.round)} · ${escapeHtml(event.name)}<small>${escapeHtml(event.locality)}, ${escapeHtml(event.country)}</small></div>
      <span class="race-time-status ${status}">${status}</span></div>
    <div class="race-time-race"><span>Race · ${escapeHtml(formatRaceDateTime(race?.ts))}</span></div>
    <div class="race-time-sessions">${event.sessions.map(session=>`<div class="race-time-session"><b>${escapeHtml(session.name)}</b><time datetime="${escapeHtml(new Date(session.ts).toISOString())}">${escapeHtml(formatRaceDateTime(session.ts))}</time></div>`).join('')}</div>
  </article>`).join('');
}
$("raceTimesBtn").addEventListener('click',()=>{openModal(raceTimesOverlay);renderRaceTimes('all')});
$("raceTimesClose").addEventListener('click',()=>closeModal(raceTimesOverlay));
document.querySelectorAll('#raceTimesTabs [role="tab"]').forEach(tab=>tab.addEventListener('click',()=>{
  document.querySelectorAll('#raceTimesTabs [role="tab"]').forEach(item=>{
    const active=item===tab;item.classList.toggle('active',active);item.setAttribute('aria-selected',String(active));
  });
  renderRaceTimes(tab.dataset.raceFilter);
}));

/* ═══════════ RADIO & RACE CONTROL (OpenF1, free tier) ═══════════
   Browser → api.openf1.org directly (CORS *, no key). Free tier = sessions that
   ended ≥30 min ago; a session in progress unlocks once OpenF1 publishes it.
   Budget: OpenF1 allows 3 req/s · 30 req/min PER IP (shared by everyone behind a
   carrier NAT), so requests are cached, spaced out and never fired in bursts.
   Panel state (open/closed + last picked session) is remembered per browser. */
/* OpenF1 is reached through our own backend proxy: the free tier answers live
   windows with a CORS-less 401 that browsers report as an opaque
   "Failed to fetch", and the per-IP rate limit is shared by every visitor.
   The proxy caches, coalesces and serves last-known-good snapshots instead. */
const OPENF1_API=PREVIEW_HOST?`${location.origin}/api/openf1`:'https://f1free.onrender.com/api/openf1';
const RADIO_RC_STORE_KEY='freef1_radio_rc';
const radioRcEl=$("radioRc"),radioRcBtn=$("radioRcBtn"),radioRcEventSel=$("radioRcEvent"),radioRcSessionSel=$("radioRcSession"),
  radioRcStatusEl=$("radioRcStatus"),radioRcRadioList=$("radioRcRadioList"),radioRcRcList=$("radioRcRcList"),radioRcAudio=$("radioRcAudio"),
  radioRcPlayerEl=$("radioRcPlayer");
const radioRc={meetings:[],sessions:[],drivers:new Map(),sessionKey:null,radio:[],rc:[],playing:null,loadToken:0,refreshTimer:0,retryTimer:0,switchTimer:0,open:false,cache:new Map(),lastRequestAt:0,chain:Promise.resolve()};
const radioRcTimeFmt=new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
function radioRcPrefs(){try{return JSON.parse(store.get(RADIO_RC_STORE_KEY)||'{}')||{}}catch(e){return{}}}
function radioRcSavePrefs(patch){store.set(RADIO_RC_STORE_KEY,JSON.stringify({...radioRcPrefs(),...patch}))}
/* Cached, serialised fetch: ≥400 ms between request starts, results reused for `ttlMs`. */
function openf1(path,params,ttlMs){
  const url=`${OPENF1_API}/${path}?${new URLSearchParams(params)}`;
  const hit=radioRc.cache.get(url);
  if(hit&&(hit.promise||Date.now()-hit.at<ttlMs))return hit.promise||Promise.resolve(hit.data);
  const run=async()=>{
    const wait=radioRc.lastRequestAt+400-Date.now();if(wait>0)await new Promise(r=>setTimeout(r,wait));
    radioRc.lastRequestAt=Date.now();
    let r;
    try{r=await fetch(url,{cache:'no-store'})}
    catch(_){const e=new Error('Cannot reach our data server — check your connection');e.code='net';throw e}
    if(r.status===503||r.status===429){
      let code=r.status===429?'rate':'upstream';
      try{const d=await r.json();if(d&&d.code)code=d.code}catch(_){}
      const e=new Error(code==='live'
        ?'Live data is locked on OpenF1’s free tier until the session ends — try again after the flag'
        :code==='rate'?'OpenF1 is busy (shared rate limit)':'OpenF1 is unreachable right now');
      e.code=code==='rate'?'rate':code==='live'?'live':'up';throw e
    }
    if(!r.ok){const e=new Error(`Data server error ${r.status}`);e.code='up';throw e}
    return r.json();
  };
  const promise=radioRc.chain.then(run,run).then(data=>{radioRc.cache.set(url,{data,at:Date.now()});return data}).catch(err=>{radioRc.cache.delete(url);throw err});
  radioRc.chain=promise.catch(()=>{});
  radioRc.cache.set(url,{promise,at:Date.now()});
  return promise;
}
function radioRcSetStatus(text,cls){radioRcStatusEl.textContent=text;radioRcStatusEl.className=`radio-rc-status mono${cls?' '+cls:''}`}
function radioRcIsLiveWindow(s){if(!s)return false;const start=Date.parse(s.date_start),end=Date.parse(s.date_end);const now=Date.now();return now>=start-30*60e3&&now<=end+30*60e3}
/* Match an OpenF1 meeting to the site's own schedule (same weekend) so labels read
   "R16 · Italian Grand Prix" exactly like the rest of the site. */
function radioRcMeetingLabel(meeting){
  const t=Date.parse(meeting.date_start);
  const ev=schedule.find(e=>e.sessions.some(s=>Math.abs(Date.parse(s.start)-t)<3*86400e3));
  return ev?`R${ev.round} · ${ev.name}`:`${meeting.location} · ${meeting.country_name}`;
}
/* ── session list (1 request, cached 10 min) ── */
async function radioRcLoadSessions(){
  radioRcSetStatus('Loading sessions…');
  const sessions=await openf1('sessions',{year:SITE_SEASON},10*60e3);
  const now=Date.now();
  radioRc.sessions=sessions.filter(s=>Date.parse(s.date_start)-30*60e3<=now&&!/^Day \d/.test(s.session_name)).sort((a,b)=>Date.parse(a.date_start)-Date.parse(b.date_start));
  const meetings=new Map();
  for(const s of radioRc.sessions)if(!meetings.has(s.meeting_key))meetings.set(s.meeting_key,{meeting_key:s.meeting_key,location:s.location,country_name:s.country_name,date_start:s.date_start});
  radioRc.meetings=[...meetings.values()];
  if(!radioRc.meetings.length)throw new Error('No sessions published yet this season');
  const prefs=radioRcPrefs();
  const live=radioRc.sessions.find(radioRcIsLiveWindow);
  const latest=radioRc.sessions.at(-1);
  // Default = the session happening now (or just finished), else the most recent one.
  // A remembered pick only wins while it is still the latest weekend — a new race
  // weekend takes over automatically.
  let target=live||latest;
  if(!live&&prefs.sessionKey){const remembered=radioRc.sessions.find(s=>s.session_key===prefs.sessionKey);if(remembered&&remembered.meeting_key===latest.meeting_key)target=remembered}
  radioRcEventSel.replaceChildren(...radioRc.meetings.map(m=>{const o=document.createElement('option');o.value=m.meeting_key;o.textContent=radioRcMeetingLabel(m);return o}));
  radioRcEventSel.value=String(target.meeting_key);
  radioRcFillSessions(target.session_key);
}
function radioRcFillSessions(preferKey){
  const mk=Number(radioRcEventSel.value);
  const list=radioRc.sessions.filter(s=>s.meeting_key===mk);
  radioRcSessionSel.replaceChildren(...list.map(s=>{const o=document.createElement('option');o.value=s.session_key;o.textContent=s.session_name;return o}));
  const pick=list.find(s=>s.session_key===preferKey)||list.at(-1);
  radioRcSessionSel.value=String(pick.session_key);
  radioRcEventSel._syncCustom?.();radioRcSessionSel._syncCustom?.();
  radioRcQueueSelect(pick.session_key);
}
/* Debounced so flicking through the dropdown doesn't fire a request per step. */
function radioRcQueueSelect(sessionKey){clearTimeout(radioRc.switchTimer);radioRc.switchTimer=setTimeout(()=>radioRcSelectSession(sessionKey),250)}
/* ── session data (3 requests, cached) ── */
async function radioRcSelectSession(sessionKey,{retry=false}={}){
  const session=radioRc.sessions.find(s=>s.session_key===sessionKey);if(!session)return;
  const token=++radioRc.loadToken;
  clearTimeout(radioRc.refreshTimer);clearTimeout(radioRc.retryTimer);
  radioRc.sessionKey=sessionKey;
  radioRcSavePrefs({sessionKey,meetingKey:session.meeting_key});
  radioRcStopAudio();
  radioRcRadioList.innerHTML='<li class="radio-rc-empty">Loading team radio…</li>';
  radioRcRcList.innerHTML='<li class="radio-rc-empty">Loading race control…</li>';
  $("radioRcRadioCount").textContent='';$("radioRcRcCount").textContent='';
  const live=radioRcIsLiveWindow(session);
  const ttl=live?45e3:6*3600e3;// live window: refresh while open; finished sessions never change
  const label=`${session.country_name} · ${session.session_name}`;
  radioRcSetStatus(live?`${label} · in progress`:label,live?'live':'');
  let nextRefresh=0;
  try{
    const drivers=await openf1('drivers',{session_key:sessionKey},6*3600e3);
    const radio=await openf1('team_radio',{session_key:sessionKey},ttl);
    const rc=await openf1('race_control',{session_key:sessionKey},ttl);
    if(token!==radioRc.loadToken)return;
    radioRc.drivers=new Map(drivers.map(d=>[d.driver_number,d]));
    radioRc.radio=radio.map(r=>({...r,ts:Date.parse(r.date)})).filter(r=>r.recording_url).sort((a,b)=>b.ts-a.ts);
    radioRc.rc=rc.map(r=>({...r,ts:Date.parse(r.date)})).sort((a,b)=>b.ts-a.ts);
    radioRcRenderRadio();radioRcRenderRc();
    if(live&&!radio.length&&!rc.length){radioRcSetStatus('In progress · free data unlocks ~30 min after the session','warn');radioRcRadioList.innerHTML='<li class="radio-rc-empty">Radio for this session appears about 30 minutes after it ends.<br>Pick an earlier session above to browse in the meantime.</li>';radioRcRcList.innerHTML='<li class="radio-rc-empty">Race control messages unlock at the same time.</li>';nextRefresh=3*60e3}
    else if(live)nextRefresh=45e3;
  }catch(err){
    if(token!==radioRc.loadToken)return;
    if(err.code==='live'){
      radioRcSetStatus('In progress · free data unlocks ~30 min after the session','warn');
      radioRcRadioList.innerHTML='<li class="radio-rc-empty">Radio for this session appears about 30 minutes after it ends.<br>Pick an earlier session above to browse in the meantime.</li>';
      radioRcRcList.innerHTML='<li class="radio-rc-empty">Race control messages unlock at the same time.</li>';
      nextRefresh=3*60e3;
    }else if(err.code==='rate'&&!retry){
      radioRcSetStatus('OpenF1 is busy · retrying in 20 s','warn');
      radioRcRadioList.innerHTML='<li class="radio-rc-empty">OpenF1 is busy right now — retrying automatically…</li>';
      radioRcRcList.innerHTML='<li class="radio-rc-empty"></li>';
      radioRc.retryTimer=setTimeout(()=>{if(radioRc.open&&radioRc.sessionKey===sessionKey)radioRcSelectSession(sessionKey,{retry:true})},20e3);
    }else{
      const msg=escapeHtml(err.message||'OpenF1 unavailable');
      radioRcRadioList.innerHTML=`<li class="radio-rc-empty err">${msg}</li>`;
      radioRcRcList.innerHTML=`<li class="radio-rc-empty err">${msg}</li>`;
      radioRcSetStatus(err.code==='live'?'OpenF1 free tier locked while a session is live':err.code==='rate'?'OpenF1 is busy · retrying':'OpenF1 unavailable','warn');
    }
  }
  if(nextRefresh&&radioRc.open)radioRc.refreshTimer=setTimeout(()=>{if(!document.hidden&&radioRc.open&&radioRc.sessionKey===sessionKey)radioRcSelectSession(sessionKey)},nextRefresh);
}
function radioRcDriver(n){const d=radioRc.drivers.get(n);const hex=/^[0-9a-f]{6}$/i.test(d?.team_colour||'')?`#${d.team_colour}`:'#555';return{code:d?.name_acronym||`#${n}`,name:d?.full_name||d?.broadcast_name||`Car ${n}`,team:d?.team_name||'',colour:hex}}
function radioRcRenderRadio(){
  $("radioRcRadioCount").textContent=radioRc.radio.length?`${radioRc.radio.length} clips`:'';
  if(!radioRc.radio.length){radioRcRadioList.innerHTML='<li class="radio-rc-empty">No team radio published for this session</li>';return}
  radioRcRadioList.innerHTML=radioRc.radio.map((r,i)=>{const d=radioRcDriver(r.driver_number);
    return `<li><button type="button" class="radio-rc-clip${radioRc.playing===r.recording_url?' playing':''}" data-idx="${i}" aria-label="Play radio from ${escapeHtml(d.name)} at ${escapeHtml(radioRcTimeFmt.format(r.ts))}">
      <span class="radio-rc-code" style="background:${d.colour}">${escapeHtml(d.code)}</span>
      <span class="radio-rc-who"><b>${escapeHtml(d.name)}</b><span>${escapeHtml(d.team)}</span></span>
      <span class="radio-rc-when">${escapeHtml(radioRcTimeFmt.format(r.ts))}</span>
      <span class="radio-rc-play" aria-hidden="true"></span></button></li>`}).join('');
}
function radioRcTag(r){
  const m=r.message||'';
  if(r.category==='SafetyCar')return /VSC|VIRTUAL/.test(m)?'VSC':'SC';
  if(/^RED FLAG/.test(m)||/ABORTED/.test(m))return 'RED';
  if(r.flag)return r.flag.replace(/\s+/g,'');
  if(r.category==='Drs')return 'DRS';
  if(r.category==='SessionStatus')return 'SESSION';
  return 'FIA';
}
function radioRcRenderRc(){
  $("radioRcRcCount").textContent=radioRc.rc.length?`${radioRc.rc.length} messages`:'';
  if(!radioRc.rc.length){radioRcRcList.innerHTML='<li class="radio-rc-empty">No race control messages published for this session</li>';return}
  radioRcRcList.innerHTML=radioRc.rc.map(r=>{const tag=radioRcTag(r);
    return `<li class="radio-rc-msg"><time datetime="${escapeHtml(new Date(r.ts).toISOString())}">${escapeHtml(radioRcTimeFmt.format(r.ts).slice(0,5))}</time><span class="radio-rc-tag ${escapeHtml(tag)}">${escapeHtml(tag)}</span><span>${escapeHtml(r.message||'')}${r.lap_number?`<i class="lap">L${escapeHtml(r.lap_number)}</i>`:''}</span></li>`}).join('');
}
/* ── audio (click-to-play; clips load straight from F1's CDN in the viewer's browser) ── */
function radioRcStopAudio(){radioRcAudio.pause();radioRcAudio.removeAttribute('src');radioRcAudio.load();radioRc.playing=null;radioRcPlayerEl.hidden=true;radioRcPlayerEl.classList.remove('paused');radioRcRadioList.querySelectorAll('.playing').forEach(el=>el.classList.remove('playing'))}
function radioRcPlay(clip){
  const d=radioRcDriver(clip.driver_number);
  if(radioRc.playing===clip.recording_url){if(radioRcAudio.paused){radioRcAudio.play().catch(()=>{});radioRcPlayerEl.classList.remove('paused')}else{radioRcAudio.pause();radioRcPlayerEl.classList.add('paused')}return}
  radioRc.playing=clip.recording_url;
  radioRcPlayerEl.hidden=false;radioRcPlayerEl.classList.remove('paused');
  $("radioRcPlayerCode").textContent=d.code;$("radioRcPlayerCode").style.background=d.colour;
  $("radioRcPlayerName").textContent=`${d.name} · ${d.team}`;$("radioRcPlayerTime").textContent=`${radioRcTimeFmt.format(clip.ts)} · loading…`;
  radioRcRadioList.querySelectorAll('.radio-rc-clip').forEach(el=>el.classList.toggle('playing',radioRc.radio[Number(el.dataset.idx)]?.recording_url===clip.recording_url));
  radioRcAudio.src=clip.recording_url;
  radioRcAudio.play().catch(()=>{});
}
radioRcAudio.addEventListener('loadedmetadata',()=>{if(radioRc.playing){const clip=radioRc.radio.find(r=>r.recording_url===radioRc.playing);if(clip)$("radioRcPlayerTime").textContent=`${radioRcTimeFmt.format(clip.ts)} · ${Math.round(radioRcAudio.duration||0)} s`}});
radioRcAudio.addEventListener('ended',()=>{radioRcPlayerEl.classList.add('paused');radioRcRadioList.querySelectorAll('.playing').forEach(el=>el.classList.remove('playing'))});
radioRcAudio.addEventListener('error',()=>{
  if(!radioRc.playing)return;
  const btn=[...radioRcRadioList.querySelectorAll('.radio-rc-clip')].find(el=>radioRc.radio[Number(el.dataset.idx)]?.recording_url===radioRc.playing);
  if(btn){btn.classList.remove('playing');btn.classList.add('failed')}
  $("radioRcPlayerTime").textContent='Could not load this clip from F1\u2019s audio server';
  radioRcPlayerEl.classList.add('paused');
  showToast('This radio clip could not be loaded from F1\u2019s audio server.','warning');
  radioRc.playing=null;
});
radioRcRadioList.addEventListener('click',event=>{const btn=event.target.closest('.radio-rc-clip');if(!btn)return;const clip=radioRc.radio[Number(btn.dataset.idx)];if(clip)radioRcPlay(clip)});
/* ── open / close (remembered per browser) ── */
function radioRcSetOpen(open,{animate=true,save=true}={}){
  radioRc.open=open;
  radioRcBtn.setAttribute('aria-expanded',String(open));radioRcBtn.classList.toggle('active',open);
  if(save)radioRcSavePrefs({open});
  if(open){
    radioRcEl.classList.toggle('no-anim',!animate);
    radioRcEl.hidden=false;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{radioRcEl.classList.add('open');setTimeout(()=>{if(radioRc.open)radioRcEl.classList.add('settled')},animate?600:0)}));
    if(!radioRc.meetings.length)radioRcLoadSessions().catch(err=>{radioRcSetStatus(err.code==='rate'?'OpenF1 is busy · try again in a minute':err.code==='live'?'OpenF1 free tier locked while a session is live':(err.message||'OpenF1 unavailable'),'warn');radioRcRadioList.innerHTML=`<li class="radio-rc-empty err">${escapeHtml(err.message||'OpenF1 unavailable')}</li>`;radioRcRcList.innerHTML='<li class="radio-rc-empty"></li>'});
    else if(radioRcIsLiveWindow(radioRc.sessions.find(s=>s.session_key===radioRc.sessionKey)))radioRcSelectSession(radioRc.sessionKey);
  }else{
    clearTimeout(radioRc.refreshTimer);clearTimeout(radioRc.retryTimer);
    radioRcEl.classList.remove('open','settled');radioRcStopAudio();
    const finish=()=>{if(!radioRc.open)radioRcEl.hidden=true};
    if(animate)setTimeout(finish,560);else finish();
  }
}
radioRcBtn.addEventListener('click',()=>{radioRcSetOpen(!radioRc.open);if(!radioRc.open)return;setTimeout(()=>radioRcEl.scrollIntoView({behavior:'smooth',block:'nearest'}),80)});
$("radioRcClose").addEventListener('click',()=>{radioRcSetOpen(false);radioRcBtn.focus()});
radioRcEventSel.addEventListener('change',()=>radioRcFillSessions(null));
radioRcSessionSel.addEventListener('change',()=>radioRcQueueSelect(Number(radioRcSessionSel.value)));
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearTimeout(radioRc.refreshTimer)}else if(radioRc.open&&radioRcIsLiveWindow(radioRc.sessions.find(s=>s.session_key===radioRc.sessionKey)))radioRcSelectSession(radioRc.sessionKey)},{passive:true});
// Restore: if the viewer left it open last time, it opens again (no animation, no scroll).
if(radioRcPrefs().open)setTimeout(()=>radioRcSetOpen(true,{animate:false,save:false}),900);

/* ═══════════ TEAM LIVERY ═══════════ */
const teams=[
 {id:'default',name:'Apex Red',color:'#E10600',text:'#fff',abbr:'APX'},
 {id:'mclaren',name:'McLaren',color:'#FF8000',text:'#000',abbr:'MCL',logo:'mclaren'},
 {id:'ferrari',name:'Ferrari',color:'#DC0000',text:'#fff',abbr:'FER',logo:'ferrari'},
 {id:'redbull',name:'Red Bull Racing',color:'#1E41FF',text:'#fff',abbr:'RBR',logo:'redbullracing'},
 {id:'mercedes',name:'Mercedes',color:'#00D2BE',text:'#000',abbr:'MER',logo:'mercedes'},
 {id:'williams',name:'Williams',color:'#005AFF',text:'#fff',abbr:'WIL',logo:'williams'},
 {id:'astonmartin',name:'Aston Martin',color:'#006F62',text:'#fff',abbr:'AMR',logo:'astonmartin'},
 {id:'alpine',name:'Alpine',color:'#FF0080',text:'#fff',abbr:'ALP',logo:'alpine'},
 {id:'haas',name:'Haas',color:'#E6E6E6',text:'#000',abbr:'HAA',logo:'haasf1team'},
 {id:'audi',name:'Audi',color:'#E62213',text:'#fff',abbr:'AUD',logo:'audi'},
 {id:'cadillac',name:'Cadillac',color:'#B4A07A',text:'#000',abbr:'CAD',logo:'cadillac'},
 {id:'racingbulls',name:'Racing Bulls',color:'#6692FF',text:'#000',abbr:'RB',logo:'racingbulls'}
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
/* Team logos: official white marks from the F1 media CDN (same host as the driver imagery,
   already allowed by img-src). Light liveries (Haas) get a dark badge with a coloured ring so
   the white logo stays legible. If a logo fails to load we fall back to the abbreviation. */
const TEAM_LOGO=(slug,w)=>`https://media.formula1.com/image/upload/c_lfill,w_${w}/q_auto/v1740000001/common/f1/2026/${slug}/2026${slug}logowhite.webp`;
const APEX_MARK='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2 17.5L7.5 6.5h5.2l-2 4h4.6l-1.6 3.2H8.9l-1.7 3.8H2z" fill="#fff"/><path d="M14.5 6.5H22l-1.7 3.4h-7.5l1.7-3.4z" fill="#fff" opacity=".72"/></svg>';
function luma(hex){const n=parseInt(hex.slice(1),16);return (.2126*(n>>16)+.7152*(n>>8&255)+.0722*(n&255))/255}
function teamBadge(t){
  const light=luma(t.color)>.7;
  const fill=light?'linear-gradient(140deg,#1c1e24,#0b0c0f)':`linear-gradient(140deg,${t.color},${shade(t.color,-50)})`;
  const ring=light?`box-shadow:inset 0 0 0 1.5px ${t.color},0 8px 20px -8px rgba(0,0,0,.8);`:'';
  if(!t.logo)return `<div class="tbadge mark" style="background:${fill};${ring}color:${t.text}">${APEX_MARK}</div>`;
  const s1=TEAM_LOGO(t.logo,48),s2=TEAM_LOGO(t.logo,96);
  return `<div class="tbadge has-logo" style="background:${fill};${ring}color:${light?'#fff':t.text}">
    <img src="${s1}" srcset="${s1} 1x, ${s2} 2x" width="48" height="48" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">
    <span class="tabbr" aria-hidden="true">${t.abbr}</span></div>`;
}
function renderTeamGrid(){
  tGrid.innerHTML='';
  teams.forEach(t=>{
    const c=document.createElement('div');c.className='tcard';c.dataset.team=t.id;
    c.setAttribute('role','button');c.tabIndex=0;c.setAttribute('aria-label',`Choose ${t.name} livery`);
    c.style.setProperty('--tc',t.color);
    c.innerHTML=`${teamBadge(t)}<div class="tname">${t.name}</div><div class="tick">✓</div>`;
    c.querySelector('.tbadge img')?.addEventListener('error',event=>{const badge=event.target.parentElement;badge.classList.remove('has-logo');event.target.remove()},{once:true});
    const choose=()=>{applyTeamTheme(t.id);store.set('freef1_team',t.id);trackEvent('team',t.id)};
    c.addEventListener('click',choose);
    c.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();choose()}});
    tGrid.appendChild(c);
  });
}
$("teamSelectBtn").addEventListener('click',()=>{
  openModal(tOverlay);renderTeamGrid();
  applyTeamTheme(store.get('freef1_team')||'default');
});
$("teamSelectClose").addEventListener('click',()=>closeModal(tOverlay));
[sOverlay,raceTimesOverlay,tOverlay,dOverlay].forEach(m=>m.addEventListener('click',e=>{
  if(e.target===m)closeModal(m);
}));
addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    const modal=document.querySelector('.modal.open');
    if(modal)closeModal(modal);
    return;
  }
  trapModalFocus(e);
});
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
populate();updateHeader();renderButtons();load();setupCustomSelects();updateClocks();initVisitorCounter();updateOverridePill(streamOverride);
const loadChampionshipData=()=>{loadStandings('drivers');loadDriverGrid()};
if('requestIdleCallback'in window)requestIdleCallback(loadChampionshipData,{timeout:1600});else setTimeout(loadChampionshipData,700);
setInterval(()=>{if(!document.hidden)updateClocks()},1000);
setInterval(()=>{if(!document.hidden)updateCurrentStreamButton()},60000);
setTimeout(initStreamOverrideSSE,500);
setTimeout(initStreamPolling,100);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){updateClocks();updateCurrentStreamButton()}},{passive:true});
