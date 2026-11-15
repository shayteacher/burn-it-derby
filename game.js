/* Burn It Derby: game logic. Needs topics.js loaded first. */
/* Horse icon: Material Design Icons "horse-human", Apache License 2.0 (github.com/Templarian/MaterialDesign) */
const HORSE = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M10 3.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5S12.33 5 11.5 5S10 4.33 10 3.5M22 8v3.5l-1.03.35A2.5 2.5 0 0 1 18.5 14h-.08c-.14.68-.47 1.29-.92 1.78V22H15v-5h-.25c-.21 0-.42-.03-.62-.06l-4.44-.74l-1.12 2.01l.75 3.79H6.78L6 18.25c-.03-.3 0-.6.16-.86l1.02-1.81a3.27 3.27 0 0 1-1.68-2.77c-.04.15-.06.37-.03.69c.03.44.14 1.09.07 1.81c-.04.72-.37 1.46-.79 1.95c-.43.49-.9.83-1.4 1.09l-.7-.7c.19-.47.38-.89.42-1.28c.06-.37-.01-.67-.12-.94l-.53-1.13c-.21-.51-.47-1.25-.42-2.12c.03-.85.5-1.96 1.39-2.57c.9-.61 1.87-.7 2.66-.53c.5.1 1.01.34 1.45.68c.37-.17.8-.26 1.25-.26H9V8.11c0-1 .68-1.92 1.66-2.08A2 2 0 0 1 13 8v1.5h1.5V9c0-2.21 1.79-4 4-4H22l-.89 1.34c.54.36.89.97.89 1.66m-2 3.2l-1.04-1.66c-.13-.21-.46-.12-.46.13V13c.83 0 1.5-.67 1.5-1.5z"/></svg>';


const COLORS = ['#ff4d5a','#4d8dff','#3fd17a','#ffc43d','#b46cff','#ff8a3d'];
const DIE = {
  d6:{sides:6,  color:'#ffffff', label:'d6'},
  d10:{sides:10,color:'#f2b632', label:'d10'},
  d4:{sides:4,  color:'#5aa9ff', label:'d4'},
  d8:{sides:8,  color:'#2fae66', label:'d8'}
};
const STORE = 'burnItDerby.v1';

function fresh(){
  return {
    round:1, finish:50, pitGap:15, cap:6, nextId:1, placeCount:0, count:6, topicIdx:0,
    topics:TOPICS.slice(),
    topic:'The greatest invention is ___ because ___.',
    groups:COLORS.map((c,i)=>({name:'Group '+(i+1), pos:0, tray:[], place:0})),
    log:[]
  };
}
let S = fresh();
try{ const saved = JSON.parse(localStorage.getItem(STORE)); if(saved && saved.groups) S = Object.assign(fresh(), saved); }catch(e){}
S.topics = TOPICS.slice(); if(S.topicIdx>=S.topics.length) S.topicIdx=0;
let undoStack = [];
let selected = 0, rolling = false, sfxOn = true;

function G(){ return S.groups.slice(0, S.count); }
function save(){ try{ localStorage.setItem(STORE, JSON.stringify(S)); }catch(e){} }
function snap(){ undoStack.push(JSON.stringify(S)); if(undoStack.length>60) undoStack.shift(); }
function uid(){ return S.nextId++; }

/* ---------- build lanes ---------- */
const lanesEl = document.getElementById('lanes');
function buildLanes(){
  lanesEl.innerHTML = '';
  G().forEach((g,i)=>{
    const lane = document.createElement('div');
    lane.className = 'lane'; lane.style.setProperty('--lc', COLORS[i]); lane.dataset.i = i;
    lane.innerHTML = `
      <div class="ctrl">
        <div class="gname" contenteditable="true" spellcheck="false"></div>
        <div class="adds">
          <button class="add big" data-t="d6" style="--dc:#fff" title="Answer die">+d6</button>
          <button class="add" data-t="d10" style="--dc:#f2b632" title="New item + new reason">d10</button>
          <button class="add" data-t="d4" style="--dc:#5aa9ff" title="Echo die">d4</button>
          <button class="add d8" data-t="d8" style="--dc:#2fae66" title="Pit stop die">d8</button>
        </div>
      </div>
      <div class="tray"><span class="empty">NO DICE YET</span><div class="sum"></div></div>
      <div class="track">
        <div class="ticks"></div>
        <div class="pos">0</div>
        <div class="finish"></div>
        <div class="badge pit">PIT STOP</div>
        <div class="horse">${HORSE}<div class="num">${i+1}</div></div>
        <div class="badge place"></div>
      </div>`;
    const nm = lane.querySelector('.gname');
    nm.textContent = g.name;
    nm.addEventListener('input',()=>{ S.groups[i].name = nm.textContent.trim() || ('Group '+(i+1)); save(); renderPick(); });
    nm.addEventListener('keydown',e=>{ if(e.key==='Enter'){e.preventDefault(); nm.blur();} });
    lane.querySelectorAll('.add').forEach(b=>b.addEventListener('click',()=>addDie(i,b.dataset.t)));
    lanesEl.appendChild(lane);
  });
  renderTicks();
}
function renderTicks(){
  const seg = Math.max(1, Math.round(S.finish/5));
  document.querySelectorAll('.track').forEach(t=>{
    t.style.setProperty('--seg', seg);
    const tk = t.querySelector('.ticks'); tk.innerHTML='';
    for(let s=5; s<S.finish; s+=5){
      const d=document.createElement('div'); d.className='tick'; d.textContent=s;
      d.style.left = `calc((100% - 82px) * ${s/S.finish} + 34px)`; tk.appendChild(d);
    }
  });
}

/* ---------- dice ---------- */
function addDie(i,t,src){
  if(rolling) return false;
  const g = S.groups[i];
  if(g.place) return false;
  if(g.tray.length >= S.cap){ flashTray(i); return false; }
  if(!src) snap();
  const d = {id:uid(), t}; g.tray.push(d);
  if(!src){ save(); render(d.id); sfx('add',t); }
  return d.id;
}
function removeDie(i,id){
  if(rolling) return;
  snap();
  const g=S.groups[i]; g.tray = g.tray.filter(d=>d.id!==id);
  S.log.forEach(e=>{ if(e.dieId===id){ e.dieId=null; e.v='burn'; } });
  save(); render();
}
function flashTray(i){
  const t = lanesEl.children[i].querySelector('.tray');
  t.animate([{transform:'translateX(-6px)'},{transform:'translateX(6px)'},{transform:'none'}],{duration:220});
  sfx('buzz');
}
function dieEl(d, popId){
  const el = document.createElement('div');
  el.className = 'die '+d.t + (d.id===popId?' pop':'');
  el.style.setProperty('--dc', DIE[d.t].color);
  el.dataset.id = d.id;
  el.innerHTML = `<div class="shape"></div><span class="lbl">${DIE[d.t].label}</span>`;
  el.title = 'Click to remove';
  return el;
}

/* ---------- render ---------- */
function leaderPos(){ return Math.max(...G().map(g=>g.pos)); }
function render(popId){
  document.getElementById('round').textContent = S.round;
  document.getElementById('finishv').textContent = S.finish;
  document.getElementById('topic').textContent = S.topic;
  let total = 0;
  const lead = leaderPos();
  G().forEach((g,i)=>{
    const lane = lanesEl.children[i];
    total += g.tray.length;
    const tray = lane.querySelector('.tray');
    tray.querySelectorAll('.die').forEach(n=>n.remove());
    tray.querySelector('.empty').style.display = g.tray.length ? 'none':'';
    g.tray.forEach(d=>{
      const el = dieEl(d,popId);
      el.addEventListener('click',()=>removeDie(i,d.id));
      tray.insertBefore(el, tray.querySelector('.sum'));
    });
    tray.classList.toggle('full', g.tray.length>=S.cap);
    lane.querySelector('.horse').style.setProperty('--p', Math.min(1, g.pos/S.finish));
    lane.querySelector('.pos').textContent = g.pos;
    lane.classList.toggle('finished', !!g.place);
    lane.querySelector('.badge.place').textContent = g.place ? ordinal(g.place) : '';
    const pit = !g.place && (lead - g.pos) >= S.pitGap;
    lane.classList.toggle('pit', pit);
    lane.querySelectorAll('.add').forEach(b=>b.disabled = !!g.place || rolling);
  });
  document.getElementById('diceup').textContent = total;
  document.getElementById('gcountv').textContent = S.count+' groups';

  document.getElementById('roll').disabled = rolling || total===0;
  renderBoard();
  renderAnswers();
}
function ordinal(n){ return n+(['th','st','nd','rd'][(n%100-20)%10]||['th','st','nd','rd'][n%100]||'th'); }

/* ---------- group picker + answer log ---------- */
const gpick = document.getElementById('gpick');
function renderPick(){
  gpick.innerHTML='';
  G().forEach((g,i)=>{
    const b=document.createElement('button'); b.type='button';
    b.style.setProperty('--lc',COLORS[i]); b.textContent=i+1; b.title=g.name;
    b.className = i===selected?'sel':'';
    b.addEventListener('click',()=>{ selected=i; renderPick(); document.getElementById('item').focus(); });
    gpick.appendChild(b);
  });
}

const STOP = new Set('a an the it its is are was be to of for and or so very really can you your my me i we they it\'s because cause makes make made get gets things thing some lot lots just more much also when with in on at by people person'.split(' '));
function norm(s){ return s.toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim(); }
function stem(w){ return w.replace(/(ingly|ly|ing|ed|es|s)$/,'').replace(/(.)\1$/,'$1'); }
function tokens(s){ return norm(s).split(' ').filter(w=>w && !STOP.has(w)).map(stem).filter(Boolean); }
function sameItem(a,b){
  const x=norm(a).replace(/^(a|an|the) /,''), y=norm(b).replace(/^(a|an|the) /,'');
  if(!x||!y) return false;
  if(x===y) return true;
  const xs=x.replace(/s$/,''), ys=y.replace(/s$/,'');
  return xs===ys || (xs.length>3 && ys.length>3 && (xs.includes(ys)||ys.includes(xs)));
}
function reasonMatch(r){
  const t = new Set(tokens(r));
  if(!t.size) return null;
  for(const e of S.log){
    if(e.v==='burn' && e.auto) continue;
    const u = new Set(tokens(e.reason)); if(!u.size) continue;
    let inter=0; t.forEach(w=>{ if(u.has(w)) inter++; });
    const jac = inter/(t.size+u.size-inter);
    const contained = inter===Math.min(t.size,u.size) && Math.min(t.size,u.size)>=2;
    if(jac>=0.5 || contained) return e;
  }
  return null;
}

const verdictEl = document.getElementById('verdict');
document.getElementById('entry').addEventListener('submit',ev=>{
  ev.preventDefault();
  if(rolling) return;
  const itemIn=document.getElementById('item'), reasonIn=document.getElementById('reason');
  const item=itemIn.value.trim(), reason=reasonIn.value.trim();
  if(!item){ verdictEl.innerHTML='<span class="b">Type the item first.</span>'; itemIn.focus(); return; }
  if(!reason){ verdictEl.innerHTML='<span class="b">No why, no die. Type the reason.</span>'; reasonIn.focus(); return; }
  const g = S.groups[selected];
  if(g.place){ verdictEl.innerHTML=`<span class="b">${esc(g.name)} already finished. Pick another group (or add dice to a rival as their sponsor).</span>`; return; }
  snap();
  const itemNew = !S.log.some(e=>sameItem(e.item,item));
  const clash = reasonMatch(reason);
  let v, msg;
  if(clash){ v='burn'; msg=`<span class="b">BURNED.</span> That reason was already used: "${esc(clash.reason)}". Click it on the board if you disagree.`; }
  else if(itemNew){ v='d10'; msg=`<span class="g">NEW ITEM + NEW REASON. Gold d10</span> to ${esc(g.name)}.`; }
  else { v='d6'; msg=`<span class="w">Old item, new reason. d6</span> to ${esc(g.name)}.`; }
  const entry = {id:uid(), g:selected, item, reason, v, auto:v==='burn', dieId:null};
  if(v!=='burn'){
    const id = addDie(selected, v, 'log');
    if(id===false){ entry.v='burn'; msg=`<span class="b">${esc(g.name)} already has ${S.cap} dice.</span> Logged, but no die.`; }
    else entry.dieId=id;
  }
  S.log.push(entry);
  freshId = entry.dieId; if(view!=='board') setView('board');
  save(); render(entry.dieId);
  verdictEl.innerHTML = msg;
  sfx(entry.v==='burn'?'buzz':(entry.v==='d10'?'gold':'add'));
  itemIn.value=''; reasonIn.value=''; itemIn.focus();
});
function esc(s){ return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

function cycleEntry(id){
  if(rolling) return;
  const e = S.log.find(x=>x.id===id); if(!e) return;
  const g = S.groups[e.g];
  const order=['burn','d6','d10'];
  const next = order[(order.indexOf(e.v)+1)%3];
  const inTray = e.dieId && g.tray.some(d=>d.id===e.dieId);
  if(e.v!=='burn' && !inTray){ verdictEl.innerHTML='<span class="b">That die was already rolled. It can\'t be changed now.</span>'; return; }
  snap();
  if(inTray) g.tray = g.tray.filter(d=>d.id!==e.dieId);
  e.dieId=null; e.auto=false; e.v=next;
  if(next!=='burn'){
    if(g.place || g.tray.length>=S.cap){ e.v='burn'; }
    else { const d={id:uid(),t:next}; g.tray.push(d); e.dieId=d.id; }
  }
  save(); render(e.dieId);
}

const boardEl = document.getElementById('board');
function renderBoard(){
  const groups = [];
  S.log.forEach(e=>{
    let it = groups.find(x=>sameItem(x.name,e.item));
    if(!it){ it={name:e.item, rs:[]}; groups.push(it); }
    it.rs.push(e);
  });
  boardEl.innerHTML = groups.length ? '' : '<span style="color:#8a5a60;font-size:13px">Nothing burned yet.</span>';
  groups.slice().reverse().forEach(it=>{
    const d=document.createElement('div'); d.className='item';
    d.innerHTML = `<b>${esc(it.name)}</b><div class="rs"></div>`;
    const rs=d.querySelector('.rs');
    it.rs.forEach(e=>{
      const r=document.createElement('span');
      r.className='r'+(e.v==='burn'?' burn':'')+(e.v==='d10'?' gold':'');
      r.style.setProperty('--lc',COLORS[e.g]);
      r.innerHTML = `${esc(e.reason)}<span class="v">${e.v==='burn'?'X':e.v}</span>`;
      r.title = S.groups[e.g].name+' | click to change: burned / d6 / d10';
      r.addEventListener('click',()=>cycleEntry(e.id));
      rs.appendChild(r);
    });
    boardEl.appendChild(d);
  });
}

/* ---------- views ---------- */
let view = 'board', freshId = null;
function setView(v){
  view = v;
  document.body.classList.toggle('view-board', v==='board');
  document.getElementById('viewBtn').textContent = v==='board' ? 'Show race' : 'Show answers';
}
document.getElementById('viewBtn').addEventListener('click',()=>{ if(!rolling) setView(view==='board'?'race':'board'); });
function renderAnswers(){
  const gc = document.getElementById('gcards'); gc.innerHTML=''; gc.style.gridTemplateColumns=`repeat(${S.count},1fr)`;
  G().forEach((g,i)=>{
    const c=document.createElement('div'); c.className='gcard'+(g.place?' done':''); c.style.setProperty('--lc',COLORS[i]);
    c.innerHTML=`<div class="top"><span class="nm">${esc(g.name)}</span><span class="ct">${g.place?ordinal(g.place):g.tray.length}</span></div><div class="dice"></div>`;
    const dz=c.querySelector('.dice');
    g.tray.forEach(d=>{ const el=dieEl(d,freshId); el.title=''; el.style.cursor='default'; dz.appendChild(el); });
    gc.appendChild(c);
  });
  const bb=document.getElementById('bigboard');
  const items=[];
  S.log.forEach(e=>{ let it=items.find(x=>sameItem(x.name,e.item)); if(!it){ it={name:e.item,rs:[]}; items.push(it);} it.rs.push(e); });
  const n=S.log.length + items.length;
  bb.style.setProperty('--bs', Math.max(.62, Math.min(1, 1-(n-16)*.012)).toFixed(3));
  bb.innerHTML = items.length ? '' : '<div class="empty">Nothing burned yet. Who is first?</div>';
  const last = S.log[S.log.length-1];
  items.forEach(it=>{
    const d=document.createElement('div'); d.className='bitem'+(last && it.rs.includes(last)?' fresh':'');
    d.innerHTML=`<b>${esc(it.name)}</b><div class="rs"></div>`;
    const rs=d.querySelector('.rs');
    it.rs.forEach(e=>{
      const r=document.createElement('span');
      r.className='r'+(e.v==='burn'?' burn':'')+(e.v==='d10'?' gold':'')+(e===last?' new':'');
      r.style.setProperty('--lc',COLORS[e.g]);
      r.innerHTML=`${esc(e.reason)}<span class="v">${e.v==='burn'?'X':e.v}</span>`;
      r.title=S.groups[e.g].name+' | click to change: burned / d6 / d10';
      r.addEventListener('click',()=>cycleEntry(e.id));
      rs.appendChild(r);
    });
    bb.appendChild(d);
  });
  if(last) { const f=bb.querySelector('.bitem.fresh'); if(f) f.scrollIntoView({block:'nearest'}); }
}

/* ---------- the roll ---------- */
document.getElementById('roll').addEventListener('click', roll);
async function roll(){
  if(rolling) return;
  const total = G().reduce((a,g)=>a+g.tray.length,0);
  if(!total) return;
  audio();
  snap();
  if(view==='board'){ setView('race'); await wait(450); }
  rolling = true; render();
  const STAGGER=420, BASE=900;
  let longest = 0;
  const results = G().map(()=>({sum:0, n:0}));
  const timers = [];
  G().forEach((g,i)=>{
    const tray = lanesEl.children[i].querySelector('.tray');
    const els = [...tray.querySelectorAll('.die')];
    const jitter = Math.random()*140;
    g.tray.forEach((d,k)=>{
      const el = els[k]; const sides = DIE[d.t].sides;
      const val = 1+Math.floor(Math.random()*sides);
      results[i].sum += val; results[i].n++;
      const span = el.querySelector('span'); span.className='';
      el.classList.add('rolling');
      const iv = setInterval(()=>{ span.textContent = 1+Math.floor(Math.random()*sides); }, 60);
      const stopAt = BASE + k*STAGGER + jitter;
      longest = Math.max(longest, stopAt);
      timers.push(setTimeout(()=>{
        clearInterval(iv); span.textContent = val;
        el.classList.remove('rolling'); el.classList.add('landed');
        sfx('click', d.t);
      }, stopAt));
    });
  });
  sfx('rattle', longest);
  await wait(longest + 450);

  G().forEach((g,i)=>{
    if(!results[i].n) return;
    const s = lanesEl.children[i].querySelector('.sum');
    s.textContent = '+'+results[i].sum; s.classList.add('show');
  });
  sfx('ding');
  await wait(900);

  const crossers = [];
  G().forEach((g,i)=>{
    if(!results[i].n) return;
    const before = g.pos;
    g.pos = Math.min(S.finish, g.pos + results[i].sum);
    if(g.pos>=S.finish && !g.place) crossers.push({i, over: before+results[i].sum, n:results[i].n});
    lanesEl.children[i].querySelector('.horse').classList.add('run');
  });
  S.groups.forEach(g=>g.tray=[]);
  render();
  sfx('gallop', 2300);
  await wait(2300);
  document.querySelectorAll('.horse.run').forEach(h=>h.classList.remove('run'));

  crossers.sort((a,b)=> b.over-a.over || b.n-a.n);
  crossers.forEach(c=>{ S.placeCount++; S.groups[c.i].place = S.placeCount; });
  document.querySelectorAll('.sum').forEach(s=>s.classList.remove('show'));
  S.round++;
  rolling = false;
  save(); render();
  if(crossers.length){
    sfx('bell');
    flash(crossers.map(c=>`${S.groups[c.i].name}: ${ordinal(S.groups[c.i].place)}!`).join('   '));
  } else {
    flash('Round '+S.round);
  }
}
function wait(ms){ return new Promise(r=>setTimeout(r,ms)); }
function flash(t){
  const f=document.getElementById('flash'); f.textContent=t; f.classList.add('show');
  clearTimeout(flash.t); flash.t=setTimeout(()=>f.classList.remove('show'),1800);
}

/* ---------- other controls ---------- */
document.getElementById('undo').addEventListener('click',()=>{
  if(rolling || !undoStack.length) return;
  S = JSON.parse(undoStack.pop()); save(); buildLanes(); renderPick(); render();
  verdictEl.textContent='Undone.';
});
document.getElementById('newtopic').addEventListener('click',()=>{
  if(rolling) return;
  snap(); S.log=[]; save(); render();
  verdictEl.textContent='Burn board cleared.';
});
document.getElementById('nextTopic').addEventListener('click',()=>{
  if(rolling || !S.topics.length) return;
  snap();
  if(!Array.isArray(S.used)) S.used=[];
  S.used.push(S.topic);
  let pool = S.topics.filter(t=>!S.used.includes(t));
  if(!pool.length){ S.used=[S.topic]; pool = S.topics.filter(t=>t!==S.topic); }
  if(!pool.length) pool = S.topics.slice();
  S.topic = pool[Math.floor(Math.random()*pool.length)];
  S.topicIdx = S.topics.indexOf(S.topic); S.log=[];
  document.getElementById('topic').textContent = S.topic;
  save(); render(); setView('board');
  verdictEl.textContent='Next topic loaded. Burn board cleared.';
  openTopic();
});
function changeCount(d){
  if(rolling) return;
  const n = Math.max(2, Math.min(6, S.count + d)); if(n===S.count) return;
  snap(); S.count = n; if(selected >= n) selected = n-1;
  save(); buildLanes(); renderPick(); render();
}
document.getElementById('gminus').addEventListener('click',()=>changeCount(-1));
document.getElementById('gplus').addEventListener('click',()=>changeCount(1));
document.querySelector('.topicwrap').addEventListener('click',()=>openTopic());

const modal=document.getElementById('modal');
document.getElementById('settingsBtn').addEventListener('click',()=>{
  document.getElementById('setFinish').value=S.finish;
  document.getElementById('setPit').value=S.pitGap;
  document.getElementById('setCap').value=S.cap;
  const nm=document.getElementById('setNames'); nm.innerHTML='';
  S.groups.forEach((g,i)=>{ const inp=document.createElement('input'); inp.value=g.name; inp.style.borderLeft='8px solid '+COLORS[i]; inp.dataset.i=i; nm.appendChild(inp); });
  modal.classList.add('open');
});
document.getElementById('closeSet').addEventListener('click',()=>{
  snap();
  const f=Math.max(10,Math.min(200,parseInt(document.getElementById('setFinish').value)||S.finish));
  S.pitGap=Math.max(3,parseInt(document.getElementById('setPit').value)||S.pitGap);
  S.cap=Math.max(1,Math.min(10,parseInt(document.getElementById('setCap').value)||S.cap));

  document.querySelectorAll('#setNames input').forEach(inp=>{ S.groups[+inp.dataset.i].name = inp.value.trim()||('Group '+(+inp.dataset.i+1)); });
  if(f!==S.finish){
    S.finish=f;
    const crossers=S.groups.map((g,i)=>({g,i})).filter(x=>!x.g.place && x.g.pos>=f).sort((a,b)=>b.g.pos-a.g.pos);
    crossers.forEach(x=>{ x.g.pos=f; S.placeCount++; x.g.place=S.placeCount; });
  }
  modal.classList.remove('open');
  save(); buildLanes(); renderPick(); render();
});
document.getElementById('resetRace').addEventListener('click',()=>{
  const b=document.getElementById('resetRace');
  if(b.dataset.armed!=='1'){ b.dataset.armed='1'; b.textContent='Tap again to reset'; setTimeout(()=>{b.dataset.armed='';b.textContent='Reset race';},2500); return; }
  snap();
  const keep={finish:S.finish,pitGap:S.pitGap,cap:S.cap,topic:S.topic,names:S.groups.map(g=>g.name),count:S.count,topics:S.topics,topicIdx:S.topicIdx};
  S=fresh(); Object.assign(S,{finish:keep.finish,pitGap:keep.pitGap,cap:keep.cap,topic:keep.topic,count:keep.count,topics:keep.topics,topicIdx:keep.topicIdx});
  S.groups.forEach((g,i)=>g.name=keep.names[i]);
  b.dataset.armed=''; b.textContent='Reset race';
  modal.classList.remove('open'); save(); buildLanes(); renderPick(); render();
});

document.addEventListener('keydown',e=>{
  const typing = /INPUT|TEXTAREA/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
  if(e.altKey && /^[1-6]$/.test(e.key) && +e.key<=S.count){ selected=+e.key-1; renderPick(); e.preventDefault(); return; }
  if(typing) return;
  if(/^[1-6]$/.test(e.key) && +e.key<=S.count){ selected=+e.key-1; renderPick(); document.getElementById('item').focus(); e.preventDefault(); }
});

/* ---------- audio: original calliope waltz + effects ---------- */
let AC=null, master=null, wob=null, drift=null;
function audio(){
  if(AC) { if(AC.state==='suspended') AC.resume(); return AC; }
  try{
    AC = new (window.AudioContext||window.webkitAudioContext)();
    const comp = AC.createDynamicsCompressor(); comp.connect(AC.destination);
    master = AC.createGain(); master.gain.value=.55; master.connect(comp);
    wob = AC.createOscillator(); wob.frequency.value=5.3; const wg=AC.createGain(); wg.gain.value=14; wob.connect(wg); wob.start(); wob.out=wg;
    drift = AC.createOscillator(); drift.frequency.value=.13; const dg=AC.createGain(); dg.gain.value=38; drift.connect(dg); drift.start(); drift.out=dg;
  }catch(e){ AC=null; }
  return AC;
}
const mtof = m => 440*Math.pow(2,(m-69)/12);
function pipe(m, t, dur, vol, weird){
  const f=mtof(m), g=AC.createGain(), lp=AC.createBiquadFilter();
  lp.type='lowpass'; lp.frequency.value=2600; lp.connect(g); g.connect(master);
  g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(vol,t+.02); g.gain.setValueAtTime(vol*.85,t+dur*.7); g.gain.linearRampToValueAtTime(0,t+dur);
  [['sine',1,1],['triangle',2,.28],['square',1,.05]].forEach(([type,mul,a])=>{
    const o=AC.createOscillator(), og=AC.createGain(); o.type=type; o.frequency.value=f*mul; og.gain.value=a;
    if(weird){ wob.out.connect(o.detune); drift.out.connect(o.detune); }
    o.connect(og); og.connect(lp); o.start(t); o.stop(t+dur+.05);
  });
}
/* melody in D minor with chromatic neighbour notes; [midi, eighths] ; 6 eighths per bar */
const MEL = [
  [69,2],[68,1],[69,1],[65,2],  [64,2],[63,1],[64,1],[72,2],
  [71,2],[70,1],[71,1],[67,2],  [69,6],
  [74,2],[73,1],[74,1],[69,2],  [70,2],[69,1],[70,1],[67,2],
  [65,1],[67,1],[69,1],[70,1],[73,2],  [74,4],[0,2],
  [77,2],[76,1],[77,1],[74,2],  [72,2],[71,1],[72,1],[69,2],
  [70,1],[69,1],[67,1],[65,1],[64,2],  [62,1],[64,1],[65,1],[67,1],[68,2],
  [69,2],[61,1],[62,1],[64,2],  [65,2],[64,1],[62,1],[61,2],  [62,6],  [0,6]
];
const CHORDS = [ [50,[62,65,69]],[45,[61,64,67]],[45,[61,64,67]],[50,[62,65,69]],
                 [50,[62,65,69]],[43,[62,67,70]],[45,[61,64,67]],[50,[62,65,69]],
                 [41,[65,69,72]],[45,[64,69,72]],[43,[62,67,70]],[40,[64,67,70]],
                 [45,[61,64,67]],[45,[61,64,67]],[50,[62,65,69]],[45,[61,64,67]] ];
let musicOn=false, nextT=0, melIdx=0, melLeft=0, step=0, schedTimer=null;
const EIGHTH = 60/150/2;
function scheduler(){
  while(nextT < AC.currentTime + .15){
    if(melLeft<=0){
      const [m,len]=MEL[melIdx]; melIdx=(melIdx+1)%MEL.length; melLeft=len;
      if(m) pipe(m, nextT, len*EIGHTH*.95, .16, true);
    }
    melLeft--;
    const bar = Math.floor(step/6)%CHORDS.length, beat = step%6;
    const [root,ch]=CHORDS[bar];
    if(beat===0) pipe(root-12+12, nextT, EIGHTH*1.6, .14, false);
    if(beat===2||beat===4) ch.forEach(n=>pipe(n-12, nextT, EIGHTH*.7, .05, false));
    step++; nextT += EIGHTH;
  }
}
document.getElementById('music').addEventListener('click',e=>{
  if(!audio()) return;
  musicOn=!musicOn; e.target.classList.toggle('on',musicOn); e.target.textContent='Music: '+(musicOn?'on':'off');
  if(musicOn){ nextT=AC.currentTime+.05; melIdx=0; melLeft=0; step=0; schedTimer=setInterval(scheduler,25); }
  else clearInterval(schedTimer);
});
document.getElementById('sfx').addEventListener('click',e=>{
  sfxOn=!sfxOn; e.target.textContent='Sound: '+(sfxOn?'on':'off'); e.target.classList.toggle('on',!sfxOn);
});
let noiseBuf=null;
function noise(t, dur, freq, q, vol){
  if(!noiseBuf){ noiseBuf=AC.createBuffer(1,AC.sampleRate*.5,AC.sampleRate); const d=noiseBuf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1; }
  const s=AC.createBufferSource(); s.buffer=noiseBuf;
  const bp=AC.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=freq; bp.Q.value=q;
  const g=AC.createGain(); g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(.001,t+dur);
  s.connect(bp); bp.connect(g); g.connect(master); s.start(t); s.stop(t+dur+.02);
}
function tone(type,f,t,dur,vol,f2){
  const o=AC.createOscillator(), g=AC.createGain(); o.type=type; o.frequency.setValueAtTime(f,t);
  if(f2) o.frequency.exponentialRampToValueAtTime(f2,t+dur);
  g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(.001,t+dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t+dur+.02);
}
function sfx(kind, arg){
  if(!sfxOn || !audio()) return;
  const t=AC.currentTime;
  if(kind==='add'){ tone('triangle', arg==='d4'?520:arg==='d8'?620:700, t,.12,.25, arg==='d4'?700:900); }
  if(kind==='gold'){ [988,1319,1760].forEach((f,i)=>tone('sine',f,t+i*.07,.35,.22)); }
  if(kind==='buzz'){ tone('sawtooth',140,t,.35,.18,90); }
  if(kind==='rattle'){ for(let x=0; x<arg/1000; x+=.045) noise(t+x, .04, 1800+Math.random()*2500, 4, .25); }
  if(kind==='click'){ noise(t,.06,3000,2,.6); tone('square', arg==='d10'?880:440, t,.05,.08); }
  if(kind==='ding'){ tone('sine',1568,t,.4,.2); }
  if(kind==='gallop'){ const end=arg/1000; for(let x=0; x<end; x+=.36){ [0,.09,.18].forEach((o,k)=>{ noise(t+x+o,.05,600+k*250,3,.5); tone('sine',140+k*20,t+x+o,.06,.18,80); }); } }
  if(kind==='bell'){ [1320,1980,2640].forEach((f,i)=>tone('sine',f,t,1.6-i*.3,.18)); [0,.35].forEach(o=>tone('triangle',784,t+o,.3,.15)); }
}

/* ---------- WHAT!? : ten obnoxious sounds ---------- */
let lastWhat=-1;
const WHAT_LINES=['WHAT!?','HUH!?','LOUDER!','I CAN\'T HEAR YOU!','SAY AGAIN!?','EXCUSE ME!?','ONE MORE TIME!','SPEAK UP!','PARDON!?','EH!?'];
function sweep(type,f1,f2,t,dur,vol,filt){
  const o=AC.createOscillator(), g=AC.createGain(); o.type=type;
  o.frequency.setValueAtTime(f1,t); o.frequency.exponentialRampToValueAtTime(f2,t+dur);
  g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(vol,t+.02); g.gain.setValueAtTime(vol,t+dur*.8); g.gain.linearRampToValueAtTime(0,t+dur);
  let out=o; if(filt){ const f=AC.createBiquadFilter(); f.type='lowpass'; f.frequency.value=filt; o.connect(f); out=f; }
  out.connect(g); g.connect(master); o.start(t); o.stop(t+dur+.05); return o;
}
function vib(o,rate,depth,t,dur){ const l=AC.createOscillator(), lg=AC.createGain(); l.frequency.value=rate; lg.gain.value=depth; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t+dur+.05); }
const WHATS=[
  t=>{ [0,.55].forEach(o=>[466,554,622,698].forEach(f=>sweep('sawtooth',f,f*.98,t+o,.45,.09,1800))); },            /* air horn */
  t=>{ const o=sweep('sine',500,2200,t,.7,.3); vib(o,9,40,t,.7); },                                                  /* slide whistle up */
  t=>{ const o=sweep('sine',2200,350,t,.8,.3); vib(o,9,40,t,.8); },                                                  /* slide whistle down */
  t=>{ const o=sweep('triangle',380,90,t,.7,.4); vib(o,18,60,t,.7); },                                               /* boing */
  t=>{ [311,294,277].forEach((f,i)=>sweep('sawtooth',f,f*.99,t+i*.38,.34,.12,1200)); const o=sweep('sawtooth',262,240,t+1.14,.9,.12,1200); vib(o,6,8,t+1.14,.9); }, /* sad trombone */
  t=>{ sweep('square',72,66,t,1.6,.22,400); sweep('square',108,100,t,1.6,.1,400); },                                /* foghorn */
  t=>{ const o=sweep('square',700,700,t,1.4,.1,2500); vib(o,2.2,320,t,1.4); },                                       /* siren */
  t=>{ [0,.22,.44].forEach(o=>{ sweep('sawtooth',620,240,t+o,.17,.18,1400); }); },                                  /* quack quack quack */
  t=>{ sweep('square',118,118,t,.9,.14,900); sweep('square',125,125,t,.9,.14,900); },                               /* game show buzzer */
  t=>{ [0,.18].forEach(o=>{ noise(t+o,.16,600+o*4000,1.5,.9); sweep('sawtooth',900,120,t+o,.16,.12); }); sweep('sine',180,40,t+.4,.5,.3); } /* record scratch */
];
function what(){
  if(!audio()) return;
  let i; do{ i=Math.floor(Math.random()*WHATS.length); }while(i===lastWhat && WHATS.length>1);
  lastWhat=i;
  WHATS[i](AC.currentTime+.02);
  const f=document.getElementById('flash'); f.classList.add('what');
  flash(WHAT_LINES[Math.floor(Math.random()*WHAT_LINES.length)]);
  setTimeout(()=>f.classList.remove('what'),1900);
  const a=document.getElementById('answers'); a.classList.remove('quake'); void a.offsetWidth; a.classList.add('quake');
}
document.getElementById('what').addEventListener('click',what);
document.addEventListener('keydown',e=>{ if(e.altKey && (e.key==='w'||e.key==='W'||e.code==='KeyW')){ e.preventDefault(); what(); } });

/* ---------- topic popup + timer ---------- */
const tpop=document.getElementById('tpop'), ttext=document.getElementById('ttext'), tclock=document.getElementById('tclock');
let tTimer=null, tLeft=0;
function openTopic(){
  if(rolling) return;
  ttext.textContent = S.topic; tpop.classList.remove('running'); tpop.classList.add('open');
}
function closeTopic(){ clearInterval(tTimer); tTimer=null; tpop.classList.remove('open','running'); }
ttext.addEventListener('input',()=>{ S.topic=ttext.textContent.trim(); save(); document.getElementById('topic').textContent=S.topic; });
ttext.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); ttext.blur(); } });
function fmt(s){ return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); }
document.querySelectorAll('#tbtns button').forEach(b=>b.addEventListener('click',()=>{
  audio(); ttext.blur();
  tLeft=+b.dataset.s; tclock.textContent=fmt(tLeft); tclock.classList.remove('hurry');
  tpop.classList.add('running');
  clearInterval(tTimer);
  tTimer=setInterval(()=>{
    tLeft--; tclock.textContent=fmt(Math.max(0,tLeft));
    if(tLeft<=10) tclock.classList.add('hurry');
    if(tLeft<=5 && tLeft>0) tick(tLeft);
    if(tLeft<=0) offToRaces();
  },1000);
}));
document.getElementById('tstop').addEventListener('click',offToRaces);
document.getElementById('tclose').addEventListener('click',closeTopic);
document.addEventListener('keydown',e=>{ if(e.key==='Escape' && tpop.classList.contains('open') && !tpop.classList.contains('running')) closeTopic(); });
function tick(n){ if(!audio()) return; const t=AC.currentTime; tone('square', n<=3?1046:784, t,.12,.18); }
function offToRaces(){
  closeTopic(); setView('board');
  const f=document.getElementById('flash'); f.classList.add('races');
  flash('Off to the Races!');
  setTimeout(()=>f.classList.remove('races'),1900);
  fanfare();
  setTimeout(()=>document.getElementById('item').focus(),300);
}
function fanfare(){
  if(!audio()) return;
  const t=AC.currentTime+.03;
  const notes=[[67,0,.14],[72,.15,.14],[76,.3,.14],[79,.45,.3],[76,.8,.14],[79,.95,.7]];
  notes.forEach(([m,o,d])=>{ const f=mtof(m); tone('sawtooth',f,t+o,d+.08,.09); tone('triangle',f*2,t+o,d+.08,.06); });
  [0,.2,.4,.6,.8,1.0,1.2,1.4].forEach((o,k)=>noise(t+o,.05,500+k%3*200,3,.4));
}

/* ---------- full screen ---------- */
const fsMsg=document.getElementById('fsmsg');
function fsHelp(){
  const mac=/Mac/i.test(navigator.platform||navigator.userAgent);
  fsMsg.innerHTML = 'This window would not go full screen. Press '+(mac?'<b>Ctrl + Cmd + F</b>':'<b>F11</b>')+' instead. (Downloaded copies go full screen with this button.)';
  fsMsg.style.display='block'; clearTimeout(fsHelp.t); fsHelp.t=setTimeout(()=>fsMsg.style.display='none',6000);
}
function fsLabel(){ document.getElementById('fsBtn').textContent = document.fullscreenElement||document.webkitFullscreenElement ? 'Exit full' : 'Full screen'; }
document.getElementById('fsBtn').addEventListener('click',()=>{
  const d=document, el=d.documentElement;
  try{
    if(d.fullscreenElement||d.webkitFullscreenElement){ (d.exitFullscreen||d.webkitExitFullscreen).call(d); return; }
    const req = el.requestFullscreen||el.webkitRequestFullscreen;
    if(!req || (d.fullscreenEnabled===false && !el.webkitRequestFullscreen)){ fsHelp(); return; }
    const r=req.call(el); if(r && r.catch) r.catch(fsHelp);
  }catch(e){ fsHelp(); }
});
document.addEventListener('fullscreenchange',fsLabel); document.addEventListener('webkitfullscreenchange',fsLabel);

/* ---------- go ---------- */
buildLanes(); renderPick(); setView('board'); render();
window.addEventListener('resize', renderTicks);
