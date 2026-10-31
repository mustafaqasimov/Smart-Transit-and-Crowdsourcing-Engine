import React,{useState,useEffect,useMemo} from 'react';
import {Search,ArrowRight,ArrowLeftRight,MapPin,Clock,Bus,Users,Armchair,Navigation,Repeat,MousePointerClick,LogOut} from 'lucide-react';
import TransitMap,{occupancyLevel} from './TransitMap';
import {api,clientId,storage} from './api';

const CROWD=['Boş','Normal','Dolu','Çox dolu'];
export function Occupancy({value}) {return <span className={'occupancy '+occupancyLevel(value)}><i/>{value}% dolu</span>}

function JourneyCard({journey,active,onSelect}) {
  const first=journey.legs[0].first_bus;
  return <button className={'journey-card'+(active?' selected':'')} onClick={onSelect} aria-pressed={active}>
    <div className="journey-top"><div className="journey-legs">{journey.legs.map((l,i)=><React.Fragment key={i}>{i>0&&<ArrowRight size={14}/>}<span className="route-badge small" style={{background:l.route.color}}>{l.route.id}</span></React.Fragment>)}</div>
      <strong>{journey.total_minutes}<small> dəq</small></strong></div>
    <div className="journey-meta">{journey.transfers?<span className="transfer-tag"><Repeat size={13}/>Köçürmə: {journey.transfer.name} · {journey.wait_minutes} dəq</span>:<span className="direct-tag">Birbaşa</span>}
      <span>{journey.legs.reduce((s,l)=>s+l.stop_count,0)} dayanacaq</span></div>
    <div className="journey-foot">{first?<><Clock size={13}/> İlk avtobus {first.eta} dəq · <Occupancy value={first.occupancy}/></>:'Avtobus yoxdur'}</div>
  </button>;
}

export default function Passenger({catalog,fleet,bus,select,changeRoute,refresh,notify}) {
  const [from,setFrom]=useState('28may'),[to,setTo]=useState('ag'),[results,setResults]=useState(null),[journey,setJourney]=useState(null),[searching,setSearching]=useState(false);
  const [session,setSession]=useState(()=>storage.get('transitRide','sessionStorage')),[stop,setStop]=useState(null),[busy,setBusy]=useState(false);
  const [mine,setMine]=useState(()=>storage.get('crowdReports','sessionStorage')||{});
  const stops=useMemo(()=>[...catalog.stops].sort((a,b)=>a.name.localeCompare(b.name,'az')),[catalog]);
  const stopName=id=>catalog.stops.find(s=>s.id===id)?.name;
  useEffect(()=>storage.set('transitRide',session,'sessionStorage'),[session]);
  // After a reload, reopen the route and bus of the ride in progress.
  useEffect(()=>{if(session?.route){changeRoute(session.route,session.stop,session.dir);select(session.bus_id)}},[]);
  useEffect(()=>{if(!session)return;let active=true;const poll=async()=>{try{const s=await api('/stop-status',undefined,'GET',{'X-Ride-Token':session.token});if(active)setStop(s[0]?.status||null);}catch{/* keep last status */}};poll();const timer=setInterval(poll,4000);return()=>{active=false;clearInterval(timer)}},[session]);
  async function search(f=from,t=to){
    if(!f||!t||f===t)return;
    setSearching(true);
    try{const r=await api(`/journeys?from=${encodeURIComponent(f)}&to=${encodeURIComponent(t)}`);setResults(r.journeys);if(r.journeys.length)choose(r.journeys[0]);else setJourney(null)}
    catch(e){notify(e.message)}finally{setSearching(false)}
  }
  function choose(j){setJourney(j);const l=j.legs[0];changeRoute(l.route.id,l.from.id,l.dir)}
  function pick(id,kind){
    const f=kind==='from'?id:from,t=kind==='to'?id:to;
    setFrom(f);setTo(t);
    if(f===t){notify('Başlanğıc və son dayanacaq fərqli olmalıdır');return}
    search(f,t);
  }
  async function action(fn){setBusy(true);try{await fn()}catch(e){notify(e.message)}finally{setBusy(false)}}
  async function report(level){await action(async()=>{
    const before=bus.occupancy;await api('/reports',{bus_id:bus.id,level,client_id:clientId});
    const next={...mine,[bus.id]:level};setMine(next);storage.set('crowdReports',next,'sessionStorage');
    const d=await refresh();const after=d?.buses.find(b=>b.id===bus.id)?.occupancy;
    notify(`Bildirişiniz qeydə alındı: ${CROWD[level]}. Doluluq ${before}% → ${after??before}%`);
  })}
  const currentStop=fleet.route.stops.find(s=>s.id===fleet.stop_id);
  const first=fleet.route.stops[0],last=fleet.route.stops.at(-1);
  const next=fleet.buses[fleet.buses.findIndex(b=>b.id===bus.id)+1];
  const shownJourney=journey&&journey.legs[0].route.id===fleet.route.id?journey:null;
  const onThisBus=session?.bus_id===bus.id;
  return <>
    <section className="passenger-hero"><div><span className="eyebrow">BAKI, YOLA HAZIRSAN?</span><h1>Hər gedişin<br/><em>daha rahat olsun.</em></h1><p>Gələn avtobusu gör. Boş yeri bil. Yolunu seç.</p></div><div className="hero-ticket"><Bus size={28}/><span>SƏNİN ŞƏHƏRİN</span><b>Bakı</b><div className="ticket-line"/><small>{catalog.routes.length} xətt · {catalog.stops.length} dayanacaq</small></div></section>

    <section className="panel planner" id="plan" data-section>
      <div className="section-title"><div><span className="eyebrow">GEDİŞ PLANLA</span><h2>Haradan haraya?</h2></div><span className="map-hint"><MousePointerClick size={15}/>Xəritədə dayanacağa toxunub da seçə bilərsən</span></div>
      <form className="journey-form" onSubmit={e=>{e.preventDefault();search()}}>
        <label><span><span className="origin-dot"/> Haradan</span><select aria-label="Haradan" value={from} onChange={e=>setFrom(e.target.value)}>{stops.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label>
        <button type="button" className="swap-button" aria-label="İstiqaməti dəyiş" onClick={()=>{setFrom(to);setTo(from)}}><ArrowLeftRight size={17}/></button>
        <label><span><MapPin size={15}/> Haraya</span><select aria-label="Haraya" value={to} onChange={e=>setTo(e.target.value)}>{stops.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label>
        <button className="primary" disabled={searching||from===to}><Search size={18}/>{searching?'Axtarılır…':'Gediş tap'}</button>
      </form>
      {results!==null&&<div className="journey-results" aria-live="polite">{results.length?results.map(j=><JourneyCard key={j.id} journey={j} active={journey?.id===j.id} onSelect={()=>choose(j)}/>)
        :<div className="notice">{stopName(from)} → {stopName(to)} üçün bir köçürmə ilə gediş tapılmadı. Yaxın başqa dayanacaq seçin.</div>}</div>}
    </section>

    {fleet.events?.length>0&&<div className="route-alerts">{fleet.events.map(e=><div key={e.id}><span className="pulse"/><p><b>{e.title}</b><small>{e.passenger} · +{e.delay} dəq · Demo hadisə</small></p></div>)}</div>}

    <div className="passenger-grid"><section className="panel map-panel" id="map" data-section><div className="section-title"><h3><Navigation size={18}/> Canlı xəritə</h3><span className="live-label"><span className="pulse"/> Hər 4 saniyə</span></div>
      <TransitMap catalog={catalog} fleet={fleet} selected={bus.id} onSelect={select} journey={shownJourney} onStop={id=>changeRoute(fleet.route.id,id,fleet.dir)} planner={{from,to,onPick:pick}}/>
      <div className="map-foot"><span><MapPin size={14}/>{currentStop.name}</span><small>Marşrut sxematikdir · GPS və doluluq sintetikdir</small></div></section>
      <section className="panel arrivals" id="arrivals" data-section><div className="section-title"><h3>Gələn avtobuslar</h3><span className="tag">{fleet.buses.length} reys</span></div>
        <div className="arrival-controls"><select aria-label="Gözlədiyim dayanacaq" value={fleet.stop_id} onChange={e=>changeRoute(fleet.route.id,e.target.value,fleet.dir)}>{fleet.route.stops.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <div className="direction-toggle" role="group" aria-label="İstiqamət">{[['f',last],['b',first]].map(([d,s])=><button key={d} className={fleet.dir===d?'selected':''} aria-pressed={fleet.dir===d} onClick={()=>changeRoute(fleet.route.id,fleet.stop_id,d)}>→ {s.name}</button>)}</div></div>
        <div className="arrival-list">{fleet.buses.map((b,i)=><button key={b.id} className={'arrival-card '+(bus.id===b.id?'selected':'')} onClick={()=>select(b.id)} aria-label={`${b.vehicle} avtobusunu seç`}><div className="arrival-bus"><span className="arrival-emoji" aria-hidden="true">🚌</span><div><b>{b.vehicle}{b.reserve&&<em className="reserve-tag">rezerv</em>}</b><small>{i===0?'İlk gələn':`${i+1}-ci gəliş`} · növbəti: {b.next_stop}</small></div><strong>{b.eta}<small>dəq</small></strong></div><div className="arrival-meta"><Occupancy value={b.occupancy}/><span>{b.free} boş yer{b.crowd?` · ${b.crowd.reports} bildiriş`:''}</span></div><div className={'capacity-track '+occupancyLevel(b.occupancy)}><i style={{width:Math.min(100,b.occupancy)+'%'}}/></div></button>)}</div></section></div>

    <section className="panel ride-detail" id="ride" data-section><div className="section-title"><div><span className="eyebrow">SEÇİLMİŞ AVTOBUS · {bus.vehicle}</span><h2><span className="route-badge" style={{background:fleet.route.color}}>{fleet.route.id}</span>{fleet.route.name}</h2></div><Occupancy value={bus.occupancy}/></div>
      <div className="ride-metrics"><div><Clock/><strong>{bus.eta}<small> dəq</small></strong><span>{currentStop.name} dayanacağına</span></div><div><Armchair/><strong>{bus.seats-bus.seated}</strong><span>Boş oturacaq</span></div><div><Bus/><strong>{next?`${next.eta} dəq`:'—'}</strong><span>{next?`Sonrakı avtobus · ${next.occupancy}% dolu`:'Bu dövrdə sonrakı reys yoxdur'}</span></div></div>
      <div className="ride-actions"><div><b>{onThisBus?'Bu reysdəsən':session?`Hazırda ${session.vehicle||'başqa avtobus'} reysindəsən`:'Bu avtobusla gedirsən?'}</b><p>{onThisBus?'Növbəti dayanacaqda düşmək üçün STOP göndər.':'Reysə qoşul, dayanacaq sorğusu göndər.'}</p></div>
        <div className="ride-buttons">{onThisBus?<button className="primary stop" disabled={busy||!!stop} onClick={()=>action(async()=>{const r=await api('/stop',{session_id:session.token});setStop(r.status);notify(r.message)})}>{stop==='driver_panel_acknowledged'?'Sürücü təsdiqlədi':stop?'STOP serverə çatdı':'STOP · Növbəti dayanacaq'}</button>
          :<button className="primary" disabled={busy} onClick={()=>action(async()=>{const r=await api('/join',{bus_id:bus.id,client_id:clientId});setSession({token:r.token,bus_id:r.bus_id,vehicle:r.vehicle,route:fleet.route.id,stop:fleet.stop_id,dir:fleet.dir});setStop(null);notify(`${r.vehicle} reysinə qoşuldunuz.`)})}>{session?'Bu avtobusa keç':'Reysə qoşul'} <ArrowRight size={17}/></button>}
          {session&&<button className="soft" onClick={()=>{setSession(null);setStop(null)}}><LogOut size={15}/> Reysdən çıx</button>}</div></div>
      <div className="crowd-report"><div className="crowd-head"><span><Users size={17}/> İndi bu avtobus necədir?</span><small>{bus.crowd?<>Sərnişinlərə görə <b>{bus.crowd.label}</b> · {bus.crowd.reports} bildiriş · sayğac {bus.sensor_occupancy}%</>:`Hələ bildiriş yoxdur · sayğac ${bus.sensor_occupancy}%`}</small></div>
        <div className="crowd-buttons">{CROWD.map((label,level)=><button className={'crowd-button level-'+level+(mine[bus.id]===level?' chosen':'')} aria-pressed={mine[bus.id]===level} disabled={busy} key={label} onClick={()=>report(level)}>{label}</button>)}</div></div>
      <p className="fine">Sənin seçimin 10 dəqiqə ərzində doluluğa təsir edir; yenidən seçsən, əvvəlki bildirişin əvəzlənir. STOP bu demoda server və operator paneli arasında işləyir.</p></section>

    <section id="lines" data-section><div className="section-title"><div><span className="eyebrow">BÜTÜN XƏTLƏR</span><h2>{catalog.routes.length} demo xətt</h2></div></div>
      <div className="route-tabs">{catalog.routes.map(r=><button key={r.id} className={fleet.route.id===r.id?'selected':''} onClick={()=>{changeRoute(r.id,r.stops[0].id);setJourney(null);document.getElementById('map')?.scrollIntoView({behavior:'smooth',block:'start'})}}><span style={{background:r.color}}>{r.id}</span><div><b>{r.name}</b><small>{r.stops.length} dayanacaq · {r.buses} avtobus · {r.minutes} dəq</small></div><ArrowRight size={17}/></button>)}</div></section>
  </>;
}
