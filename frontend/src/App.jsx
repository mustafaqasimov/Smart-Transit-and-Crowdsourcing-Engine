import React,{useState,useEffect,useCallback} from 'react';
import {Bus,ArrowUpRight,Navigation,Layers,LogOut,ShieldCheck,ChevronRight,X,Activity,Map as MapIcon,Route,Camera,AlertTriangle,Download,Smartphone,Flame} from 'lucide-react';
import Passenger from './Passenger';
import Operator from './Operator';
import {api} from './api';

const SECTIONS={
  passenger:[{id:'plan',label:'Gediş planla',icon:Navigation},{id:'map',label:'Canlı xəritə',icon:MapIcon},{id:'arrivals',label:'Gələn avtobuslar',icon:Bus},{id:'ride',label:'Mənim reysim',icon:Activity},{id:'lines',label:'Bütün xətlər',icon:Route}],
  operator:[{id:'twin',label:'Rəqəmsal əkiz',icon:Layers},{id:'fleet',label:'Avtobus parkı',icon:Bus},{id:'density',label:'Sıxlıq xəritəsi',icon:Flame},{id:'vision',label:'Salon və YOLO',icon:Camera},{id:'operations',label:'Əməliyyatlar',icon:Activity},{id:'events',label:'Yol hadisələri',icon:AlertTriangle}],
};

/** The nav item follows the section crossing the upper third of the viewport. */
function useActiveSection(ids,ready) {
  const [active,setActive]=useState(ids[0]);
  useEffect(()=>{
    let frame=0;
    const update=()=>{
      frame=0;let current=ids[0];
      for(const id of ids){const el=document.getElementById(id);if(el&&el.getBoundingClientRect().top<=innerHeight*.33)current=id;}
      if(innerHeight+scrollY>=document.documentElement.scrollHeight-4){const last=[...ids].reverse().find(id=>document.getElementById(id));if(last)current=last;}
      setActive(current);
    };
    const schedule=()=>{if(!frame)frame=requestAnimationFrame(update)};
    update();addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule);
    return()=>{removeEventListener('scroll',schedule);removeEventListener('resize',schedule);cancelAnimationFrame(frame)};
  },[ids.join(),ready]);
  return [active,setActive];
}
function useInstallPrompt() {
  const [prompt,setPrompt]=useState(null),[installed,setInstalled]=useState(()=>matchMedia('(display-mode: standalone)').matches);
  useEffect(()=>{
    const offer=e=>{e.preventDefault();setPrompt(e)},done=()=>{setInstalled(true);setPrompt(null)};
    addEventListener('beforeinstallprompt',offer);addEventListener('appinstalled',done);
    return()=>{removeEventListener('beforeinstallprompt',offer);removeEventListener('appinstalled',done)};
  },[]);
  return {installed,canInstall:!!prompt&&!installed,install:async()=>{prompt.prompt();await prompt.userChoice.catch(()=>{});setPrompt(null)}};
}

function Brand(){return <div className="brand"><span><Bus size={23}/></span>Baku<b>YolOu</b><i>●</i></div>}
function CityArt(){return <svg viewBox="0 0 540 400" className="city-art" aria-hidden="true"><defs><pattern id="grid" width="35" height="35" patternUnits="userSpaceOnUse"><path d="M35 0H0V35" fill="none" stroke="#ffffff12"/></pattern></defs><rect width="540" height="400" fill="url(#grid)"/><path d="M-30 310L120 220L210 275L390 170L590 260" stroke="#ffffff17" strokeWidth="60" fill="none"/><path d="M60 420L190 340L90 280L320 145L520 25" stroke="#ffffff13" strokeWidth="38" fill="none"/><path d="M65 330L190 255L275 305L415 220L385 170" stroke="#a6b7ff" strokeWidth="4" strokeDasharray="8 9" fill="none"/>{[[65,330],[190,255],[275,305],[385,170]].map(([x,y])=><g key={x}><circle cx={x} cy={y} r="13" fill="#263c9b" stroke="#b0b9ff" strokeWidth="4"/><circle cx={x} cy={y} r="4" fill="white"/></g>)}<g transform="translate(215 155)"><rect width="105" height="70" rx="18" fill="white"/><rect x="12" y="13" width="81" height="26" rx="6" fill="#7b91ee"/><circle cx="22" cy="55" r="6" fill="#263c9b"/><circle cx="83" cy="55" r="6" fill="#263c9b"/><text x="52" y="32" textAnchor="middle" fill="white" fontSize="19" fontWeight="700">125</text></g><g transform="translate(330 75)"><rect width="140" height="57" rx="13" fill="#d4f6e9"/><text x="15" y="25" fill="#13765f" fontSize="13" fontWeight="700">NÖVBƏTİ AVTOBUS</text><text x="15" y="45" fill="#134b42" fontSize="17" fontWeight="700">4 dəq · 38% dolu</text></g><text x="45" y="380" fill="#b4bff0" fontSize="12">İLLÜSTRATİV DEMO</text></svg>}
function Login({enter,busy,error}) {
  return <div className="login-page"><section className="login-story"><Brand/><div className="login-heading"><span className="eyebrow">BAKI ÜÇÜN DAHA AĞILLI HƏRƏKƏT</span><h1>Şəhər hərəkətdə.<br/><em>Sən bir addım öndə.</em></h1><p>Rahat gedişlər, məlumatlı qərarlar.<br/>Şəhərin nəqliyyatı bir yerdə.</p></div><CityArt/><div className="login-story-foot"><span>40.4093° N · 49.8671° E</span><span>BAKU, AZERBAIJAN ↗</span></div></section><section className="login-entry"><div className="login-top"><span>Digital Azerbaijan Challenge 2026</span><span>AZ</span></div><div className="entry-content"><span className="welcome-pill">Xoş gəldin 👋</span><h2>Yolun buradan<br/>başlayır.</h2><p>Necə davam etmək istəyirsən?</p><button className="role-card passenger-role" disabled={busy} onClick={()=>enter('passenger')}><span className="role-icon"><Navigation/></span><div><b>Sərnişin kimi daxil ol</b><small>Gedişini seç, avtobusunu izlə.</small></div><ArrowUpRight/></button><button className="role-card" disabled={busy} onClick={()=>enter('operator')}><span className="role-icon"><Layers/></span><div><b>Operator kimi daxil ol</b><small>Simulyasiya et, təsiri ölç, qərar ver.</small></div><ArrowUpRight/></button>{error&&<p className="error" role="alert">{error}</p>}<div className="login-note"><ShieldCheck size={20}/><span>Qeydiyyat və parol tələb olunmur.<br/><b>Bu, açıq demo mühitidir.</b></span></div></div><div className="login-footer">Bir şəhər. Minlərlə yol. Daha rahat sabah.</div></section></div>;
}
function LiveCard({fleet}) {
  if(!fleet)return null;
  const mean=fleet.buses.length?Math.round(fleet.buses.reduce((s,b)=>s+b.occupancy,0)/fleet.buses.length):0;
  const stop=fleet.route.stops.find(s=>s.id===fleet.stop_id);
  return <div className="live-card"><div className="live-card-head"><span className="route-badge small" style={{background:fleet.route.color}}>{fleet.route.id}</span><div><b>{fleet.route.name}</b><small>{stop?.name} · → {fleet.headsign}</small></div></div>
    <div className="live-card-stats"><div><strong>{fleet.buses.length}</strong><small>avtobus</small></div><div><strong>{fleet.buses[0]?.eta??'—'}<em> dəq</em></strong><small>ilk gəliş</small></div><div><strong>{mean}%</strong><small>doluluq</small></div></div>
    <div className="live-card-foot"><span className="pulse"/>Canlı · {new Date(fleet.updated_at).toLocaleTimeString('az',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</div></div>;
}

export default function App(){
  const [role,setRole]=useState('guest'),[catalog,setCatalog]=useState(null),[fleet,setFleet]=useState(null),[route,setRoute]=useState({id:'125',stop:'28may',dir:'f'}),[selected,setSelected]=useState(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[ready,setReady]=useState(false);
  const operator=role==='operator',sections=SECTIONS[operator?'operator':'passenger'];
  const [active,setActive]=useActiveSection(sections.map(s=>s.id),!!fleet);
  const pwa=useInstallPrompt();
  const loadCatalog=useCallback(()=>api('/routes').then(setCatalog).catch(e=>setError(e.message)),[]);
  useEffect(()=>{api('/access').then(r=>setRole(r.role)).catch(e=>setError(e.message)).finally(()=>setReady(true));loadCatalog()},[loadCatalog]);
  const refresh=useCallback(async()=>{
    try{const d=await api(`/fleet?route=${encodeURIComponent(route.id)}&stop=${encodeURIComponent(route.stop)}&dir=${route.dir}`);setFleet(d);setSelected(s=>d.buses.some(b=>b.id===s)?s:d.buses[0]?.id);setError('');return d}
    catch(e){setError(e.message);return null}
  },[route]);
  useEffect(()=>{if(role==='guest')return;refresh();const timer=setInterval(refresh,4000);return()=>clearInterval(timer)},[refresh,role]);
  useEffect(()=>{if(!message)return;const t=setTimeout(()=>setMessage(''),7000);return()=>clearTimeout(t)},[message]);
  async function enter(next){setBusy(true);try{const r=await api('/access',{role:next});setRole(r.role);setError('');scrollTo(0,0)}catch(e){setError(e.message)}finally{setBusy(false)}}
  async function exit(){try{await api('/access',undefined,'DELETE');setRole('guest');setFleet(null);setMessage('')}catch(e){setError(e.message)}}
  const changeRoute=useCallback((id,stop,dir='f')=>{setRoute({id,stop,dir});setSelected(null)},[]);
  function go(id){setActive(id);document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'})}
  if(!ready)return <div className="loading"><Bus/><p>BakuYolOu hazırlanır…</p></div>;
  if(role==='guest')return <Login enter={enter} busy={busy} error={error}/>;
  const bus=fleet?.buses.find(b=>b.id===selected)||fleet?.buses[0];
  const props={catalog,fleet,bus,select:setSelected,changeRoute,refresh,notify:setMessage};
  return <div className={'app '+(operator?'operator-app':'')}>
    <aside className="sidebar"><Brand/><span className="nav-caption">{operator?'OPERATOR MƏRKƏZİ':'SƏNİN GEDİŞİN'}</span>
      <nav aria-label="Bölmələr">{sections.map(({id,label,icon:Icon})=><button key={id} className={'nav-item'+(active===id?' active':'')} aria-current={active===id?'location':undefined} onClick={()=>go(id)}><Icon size={19}/>{label}{active===id&&<span className="nav-marker"/>}</button>)}</nav>
      <LiveCard fleet={fleet}/>
      <div className="sidebar-bottom">
        {pwa.canInstall?<button className="install-button" onClick={pwa.install}><Download size={17}/>Tətbiqi quraşdır</button>
          :!pwa.installed&&<div className="install-tip"><Smartphone size={16}/><span>Tətbiq kimi istifadə üçün brauzer menyusundan <b>“Ana ekrana əlavə et”</b> seçin.</span></div>}
        <div className="demo-note"><span className="pulse"/><b>Demo mühiti</b><p>Şəhər realdır. Telemetriya sintetikdir.</p></div>
        <button className="nav-item" onClick={exit}><LogOut size={18}/> Rolu dəyiş</button><small>DIGITAL AZERBAIJAN · 2026</small></div>
    </aside>
    <div className="app-body"><header className="app-header"><div className="mobile-brand"><Brand/></div><div className="breadcrumb">{operator?'Operator mərkəzi':'Sərnişin'} <ChevronRight size={14}/><b>{sections.find(s=>s.id===active)?.label}</b></div><div className="header-right">{pwa.canInstall&&<button className="install-chip" onClick={pwa.install} aria-label="Tətbiqi quraşdır"><Download size={15}/><span>Quraşdır</span></button>}<span className="demo-pill"><span className="pulse"/> DEMO</span><button className="profile-button" onClick={exit} aria-label="Rolu dəyiş"><span>{operator?'OP':'SƏ'}</span><b>{operator?'Operator':'Sərnişin'}</b><LogOut size={16}/></button></div></header>
      <main id="overview">{error&&<div className="error" role="alert">{error} · Son alınmış məlumat göstərilir. <button onClick={()=>{refresh();if(!catalog)loadCatalog()}}>Yenilə</button></div>}{catalog&&fleet&&bus?(operator?<Operator {...props}/>:<Passenger {...props}/>):<div className="loading"><Bus/><p>Marşrutlar yüklənir…</p><button onClick={()=>{refresh();loadCatalog()}}>Yenilə</button></div>}<footer className="app-footer"><span>BakuYolOu · Daha rahat şəhər üçün.</span><span>Demo marşrutlar · © OpenStreetMap</span></footer></main>
      <nav className="mobile-nav" aria-label="Bölmələr">{sections.slice(0,4).map(({id,label,icon:Icon})=><button key={id} className={active===id?'active':''} onClick={()=>go(id)}><Icon size={20}/>{label.split(' ')[0]}</button>)}<button onClick={exit}><LogOut size={20}/>Çıxış</button></nav></div>
    {message&&<div className="toast" role="status">{message}<button onClick={()=>setMessage('')} aria-label="Bildirişi bağla"><X size={17}/></button></div>}
  </div>;
}
