import React,{useState,useEffect,useRef,useCallback} from 'react';
import {Activity,Bus,Clock,Users,Play,ArrowRight,Check,Camera,Upload,SlidersHorizontal,AlertTriangle,Plus,Film,Image as ImageIcon,Zap} from 'lucide-react';
import TransitMap,{occupancyLevel} from './TransitMap';
import Cabin from './Cabin';
import {api} from './api';

const POLICY={reserve:'Rezerv avtobus',priority:'Siqnal prioriteti',rebalance:'Yük bölgüsü'};

function QueueChart({before,after}) {
  const max=Math.max(1,...before.map(p=>p.queue),...after.map(p=>p.queue));
  const points=series=>series.map((p,i)=>`${35+i/(series.length-1)*620},${170-p.queue/max*135}`).join(' ');
  return <div className="queue-chart"><div className="chart-legend"><span><i/> Müdaxiləsiz</span><span><i/> Seçilmiş həll</span></div><svg viewBox="0 0 680 210" role="img" aria-label="Müdaxilədən əvvəl və sonra dayanacaq növbəsi"><text x="4" y="22">{max}</text><text x="12" y="174">0</text>{[35,80,125,170].map(y=><line key={y} x1="35" x2="655" y1={y} y2={y} stroke="#e6eaf3"/>)}<polyline points={points(before)} fill="none" stroke="#a5adc5" strokeWidth="3" strokeDasharray="6 5"/><polyline points={points(after)} fill="none" stroke="#6155e8" strokeWidth="4"/><text x="35" y="200">İndi</text><text x="570" y="200">{before.length-1} dəqiqə sonra</text></svg></div>
}
function Boxes({detections}) {
  return detections.map((d,i)=><span key={d.track_id??i} className="detection-box" style={{left:d.x*100+'%',top:d.y*100+'%',width:d.width*100+'%',height:d.height*100+'%'}}><b>{d.track_id!=null?`#${d.track_id} · `:''}{Math.round(d.confidence*100)}%</b></span>);
}
/** People per analysed frame; clicking a bar seeks the video. */
function Timeline({frames,time,duration,onSeek}) {
  const max=Math.max(1,...frames.map(f=>f.people)),w=Math.max(1,duration);
  return <svg className="video-timeline" viewBox="0 0 400 70" preserveAspectRatio="none" role="img" aria-label="Kadrlar üzrə görünən insan sayı" onClick={e=>{const r=e.currentTarget.getBoundingClientRect();onSeek((e.clientX-r.left)/r.width*w)}}>
    {frames.map((f,i)=><rect key={i} x={f.t/w*400} y={62-f.people/max*52} width={Math.max(3,400/frames.length-2)} height={f.people/max*52+1} rx="1.5" className={f.t<=time?'played':''}/>)}
    <line x1={time/w*400} x2={time/w*400} y1="0" y2="70" className="playhead"/>
  </svg>;
}
function VideoAnalysis({bus,notify}) {
  const [result,setResult]=useState(null),[src,setSrc]=useState(null),[busy,setBusy]=useState(false),[time,setTime]=useState(0),[playable,setPlayable]=useState(true);
  const video=useRef(null);
  useEffect(()=>()=>{if(src?.startsWith('blob:'))URL.revokeObjectURL(src)},[src]);
  async function run(file){setBusy(true);try{
    let data;
    if(file){const body=new FormData();body.append('file',file);data=await api('/vision/video?bus_id='+bus.id,body);setSrc(URL.createObjectURL(file))}
    else{data=await api('/vision/demo-video?bus_id='+bus.id,{});setSrc('/api/vision/sample-video')}
    setPlayable(true);setTime(0);setResult(data);
    notify(`YOLO videoda ${data.analyzed_frames} kadr analiz etdi: ən çox ${data.max_visible}, izlənən ${data.unique_people} fərqli insan.`);
  }catch(e){notify(e.message)}finally{setBusy(false)}}
  const frame=result?.frames.reduce((hit,f)=>f.t<=time+.05?f:hit,result.frames[0]);
  const seek=t=>{setTime(t);if(video.current)video.current.currentTime=t};
  return <>
    {src&&result?<div className="detection-media"><div className="detection-video">
      <video ref={video} src={src} controls muted playsInline loop onTimeUpdate={e=>setTime(e.currentTarget.currentTime)} onSeeked={e=>setTime(e.currentTarget.currentTime)} onError={()=>setPlayable(false)} data-testid="vision-video"/>
      {playable&&frame&&<Boxes detections={frame.detections}/>}</div>
      {!playable&&<p className="notice">Brauzer bu video formatını oynada bilmir. Analiz nəticəsi aşağıdakı qrafikdədir.</p>}
      <Timeline frames={result.frames} time={time} duration={result.analyzed_seconds} onSeek={seek}/></div>
      :<div className="camera-empty"><Film size={40}/><b>Analiz üçün video seç</b><span>MP4/WebM/MOV · 50 MB · ilk 30 saniyə</span></div>}
    {result&&<div className="vision-result video" data-testid="video-result"><div><strong>{frame?.people??0} insan</strong><small>bu kadrda</small></div><div><strong>{result.max_visible}</strong><small>ən çox</small></div><div><strong>{result.average_visible}</strong><small>orta</small></div><div><strong>{result.unique_people}</strong><small>fərqli (izlənən)</small></div><span>{result.analyzed_frames} kadr · {result.sample_fps} kadr/san · {(result.inference_ms/1000).toFixed(1)} s · {result.model}</span></div>}
    <div className="vision-buttons"><button className="primary" disabled={busy} onClick={()=>run()}><Play size={16}/>{busy?'Video analiz edilir…':'Video nümunəsini işə sal'}</button><label className={'upload-button '+(busy?'disabled':'')}><Upload size={17}/> Video yüklə<input aria-label="Kamera videosu" type="file" accept="video/mp4,video/webm,video/quicktime,video/*" disabled={busy} onChange={e=>{if(e.target.files[0])run(e.target.files[0]);e.target.value=''}}/></label></div>
    <p className="fine">Video saniyədə ~3 kadr seçilərək analiz olunur; ByteTrack eyni insanı kadrlar arasında izləyir (#nömrə). Video serverdə saxlanmır. Nümunə video Ultralytics test şəkli üzərində süni kamera hərəkətidir.</p>
  </>;
}
function ImageAnalysis({bus,notify}) {
  const [result,setResult]=useState(null),[busy,setBusy]=useState(false),[image,setImage]=useState(null);
  useEffect(()=>()=>{if(image?.startsWith('blob:'))URL.revokeObjectURL(image)},[image]);
  async function run(file){setBusy(true);try{let data;if(file){const body=new FormData();body.append('file',file);data=await api('/vision/detect?bus_id='+bus.id,body);setImage(URL.createObjectURL(file));}else{data=await api('/vision/demo?bus_id='+bus.id,{});setImage('/api/vision/sample');}setResult(data);notify(`YOLO ${data.visible_people} görünən insan aşkarladı.`)}catch(e){notify(e.message)}finally{setBusy(false)}}
  return <>
    {image?<div className="detection-image"><img src={image} alt="YOLO tərəfindən analiz edilən kadr"/>{result&&<Boxes detections={result.detections}/>}</div>:<div className="camera-empty"><Camera size={40}/><b>Analiz üçün kadr seç</b><span>JPEG/PNG/WebP · 8 MB · serverdə saxlanmır</span></div>}
    {result&&<div className="vision-result" data-testid="vision-result"><strong>{result.visible_people} insan</strong><span>{result.inference_ms} ms · {result.model}</span></div>}
    <div className="vision-buttons"><button className="primary" disabled={busy} onClick={()=>run()}><Play size={16}/>{busy?'YOLO analiz edir…':'YOLO nümunəsini işə sal'}</button><label className={'upload-button '+(busy?'disabled':'')}><Upload size={17}/> Şəkil yüklə<input aria-label="Kamera şəkli" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={e=>{if(e.target.files[0])run(e.target.files[0]);e.target.value=''}}/></label></div>
    <p className="fine">Nümunə: Ultralytics-in avtobusun xaricindən çəkilmiş test şəkli. Aşkarlanan insanlar salonun ümumi doluluğunu göstərmir.</p>
  </>;
}
function Vision({bus,notify}) {
  const [mode,setMode]=useState('image');
  return <section className="panel vision-panel"><div className="section-title"><div><span className="eyebrow">KOMPÜTER GÖRMƏSİ</span><h3><Camera size={19}/> YOLO müşahidəsi</h3></div><span className="tag">CPU · YOLO11n</span></div>
    <div className="segmented" role="tablist" aria-label="Analiz növü">{[['image',ImageIcon,'Şəkil'],['video',Film,'Video']].map(([id,Icon,label])=><button key={id} role="tab" aria-selected={mode===id} className={mode===id?'selected':''} onClick={()=>setMode(id)}><Icon size={15}/>{label}</button>)}</div>
    {mode==='image'?<ImageAnalysis bus={bus} notify={notify}/>:<VideoAnalysis bus={bus} notify={notify}/>}
  </section>;
}

export default function Operator({catalog,fleet,bus,select,changeRoute,refresh,notify}) {
  const [horizon,setHorizon]=useState(20),[demand,setDemand]=useState(1.5),[delay,setDelay]=useState(3),[scenario,setScenario]=useState(null),[policy,setPolicy]=useState('reserve'),[busy,setBusy]=useState(false),[ops,setOps]=useState(null),[events,setEvents]=useState([]);
  useEffect(()=>{setScenario(null)},[fleet.route.id,fleet.stop_id,fleet.dir,horizon,demand,delay]);
  const loadOps=useCallback(async()=>{try{const [o,e]=await Promise.all([api('/operator'),api('/events')]);setOps(o);setEvents(e.events)}catch(e){notify(e.message)}},[notify]);
  useEffect(()=>{loadOps();const timer=setInterval(loadOps,5000);return()=>clearInterval(timer)},[loadOps]);
  async function action(fn){setBusy(true);try{await fn();await refresh();await loadOps()}catch(e){notify(e.message)}finally{setBusy(false)}}
  async function preview(){await action(async()=>{const s=await api('/twin/preview',{route:fleet.route.id,stop_id:fleet.stop_id,dir:fleet.dir,horizon,demand_multiplier:demand,delay});setScenario(s);setPolicy(s.options[0].id)})}
  const option=scenario?.options.find(o=>o.id===policy);
  const mean=Math.round(fleet.buses.reduce((s,b)=>s+b.occupancy,0)/fleet.buses.length);
  const routeEvents=events.filter(e=>e.route===fleet.route.id);
  return <>
    <div id="twin" data-section>
    <section className="operator-hero"><div><span className="eyebrow">OPERATOR İDARƏETMƏ MƏRKƏZİ</span><h1>Qərardan əvvəl,<br/><em>nəticəni gör.</em></h1><p>Şəhərin rəqəmsal əkizində sına. Təsiri ölç. Həlli tətbiq et.</p></div><div className="twin-orbit"><Activity size={54}/><span>DIGITAL TWIN</span><small>SIMULATION ONLINE</small></div></section>
    <div className="operator-toolbar"><label>Marşrut<select disabled={busy} aria-label="Operator marşrutu" value={fleet.route.id} onChange={e=>{const r=catalog.routes.find(r=>r.id===e.target.value);changeRoute(r.id,r.stops[0].id)}}>{catalog.routes.map(r=><option key={r.id} value={r.id}>{r.id} · {r.name}</option>)}</select></label><label>Dayanacaq<select disabled={busy} aria-label="Operator dayanacağı" value={fleet.stop_id} onChange={e=>changeRoute(fleet.route.id,e.target.value,fleet.dir)}>{fleet.route.stops.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>İstiqamət<select disabled={busy} aria-label="Operator istiqaməti" value={fleet.dir} onChange={e=>changeRoute(fleet.route.id,fleet.stop_id,e.target.value)}><option value="f">→ {fleet.route.stops.at(-1).name}</option><option value="b">→ {fleet.route.stops[0].name}</option></select></label>{fleet.state.priority_active&&<span className="tag priority-tag"><Zap size={13}/>Prioritet aktiv · {fleet.state.priority_minutes_left} dəq</span>}<span className="tag">Demo parkı · v{fleet.state.version}</span></div>
    <div className="kpi-grid">{[[Bus,fleet.buses.length,'Aktiv avtobus'],[Users,mean+'%','Orta doluluq'],[Clock,fleet.buses[0].eta+' dəq','İlk avtobus'],[AlertTriangle,routeEvents.length,'Aktiv hadisə']].map(([Icon,value,label])=><div className="kpi panel" key={label}><Icon/><span>{label}</span><strong>{value}</strong></div>)}</div>
    <div className="twin-grid"><section className="panel twin-controls"><div className="section-title"><div><span className="eyebrow">01 / SSENARİNİ QUR</span><h3><SlidersHorizontal size={18}/> Nə baş versə?</h3></div></div><p className="subtle">Cari parkı baza götür, əlavə yük və gecikməni sına.</p>
      <label className="slider-label">Proqnoz pəncərəsi <b>{horizon} dəq</b><input aria-label="Proqnoz pəncərəsi" disabled={busy} type="range" min="5" max="60" step="5" value={horizon} onChange={e=>setHorizon(+e.target.value)}/></label>
      <label className="slider-label">Sərnişin tələbi <b>×{demand.toFixed(1)}</b><input aria-label="Sərnişin tələbi" disabled={busy} type="range" min="0.5" max="3" step="0.1" value={demand} onChange={e=>setDemand(+e.target.value)}/></label>
      <label className="slider-label">Əlavə gecikmə <b>{delay} dəq</b><input aria-label="Əlavə gecikmə" disabled={busy} type="range" min="0" max="30" value={delay} onChange={e=>setDelay(+e.target.value)}/></label>
      <button className="primary full" disabled={busy} onClick={preview}><Play size={17}/>{busy?'Hesablanır…':'Simulyasiyanı hesabla'}</button><p className="fine">Şəffaf qayda modeli · real əməliyyat proqnozu deyil. Hesablama canlı demo parkını dəyişmir.</p></section>
      <section className="panel map-panel"><div className="section-title"><h3>Marşrutun rəqəmsal əkizi</h3><span className="live-label"><span className="pulse"/> Sintetik GPS</span></div><TransitMap catalog={catalog} fleet={fleet} selected={bus.id} onSelect={select} onStop={id=>changeRoute(fleet.route.id,id,fleet.dir)}/></section></div>
    {scenario&&<section className="panel scenario-panel" data-testid="scenario"><div className="section-title"><div><span className="eyebrow">02 / HƏLLƏRİ MÜQAYİSƏ ET</span><h2>Kiçik müdaxilə. Ölçülən təsir.</h2></div><span className="tag">{scenario.horizon} dəqiqəlik ssenari</span></div><div className="solution-grid">{scenario.options.map((o,i)=><button className={'solution '+(policy===o.id?'selected':'')} key={o.id} onClick={()=>setPolicy(o.id)} disabled={scenario.applied}><span className="solution-label">{i===0?'ƏN AZ GÖZLƏMƏ':'ALTERNATİV '+i}</span><h3>{o.title}</h3><p>{o.reason}</p><div><strong>{o.metrics.average_wait} dəq</strong><span>orta gözləmə</span></div><small>{o.metrics.unmet} nəfər növbədə qalır</small></button>)}</div><div className="comparison"><div><span>Müdaxiləsiz gözləmə</span><strong>{scenario.baseline.average_wait} dəq</strong></div><ArrowRight/><div><span>Həll tətbiq edilərsə</span><strong className="accent">{option.metrics.average_wait} dəq</strong></div><div><span>Qarşılanan tələb</span><strong>{scenario.baseline.service_percent}% → {option.metrics.service_percent}%</strong></div></div><QueueChart before={scenario.baseline.series} after={option.metrics.series}/><div className="apply-row"><p><b>{option.title}</b><br/><small>Tətbiq demo parkını dəyişir və qərar jurnalına yazılır.</small></p><button className="primary" disabled={busy||scenario.applied} onClick={()=>action(async()=>{const s=await api(`/twin/${scenario.id}/apply`,{policy});setScenario(s);notify('Həll demo parkına tətbiq edildi. Xəritə və gəlişlər yeniləndi.')})}>{scenario.applied?<><Check size={18}/>Tətbiq edildi</>:<>Demo parkına tətbiq et<ArrowRight size={17}/></>}</button></div><details><summary>Model və fərziyyələr</summary><p>{scenario.assumptions}</p><p>İlkin növbə: {scenario.initial_queue}. Dəqiqədə gələn sərnişin: {scenario.arrivals_per_minute}. Orta gözləmə bütün tələbin bu pəncərədə keçirdiyi növbə vaxtıdır; həllər resurs xərci nəzərə alınmadan gözləməyə görə sıralanır. Ssenari 5 dəqiqə qüvvədədir. Prioritet 15 dəqiqəlik tədbirdir, rezerv avtobus 60 dəqiqə xəttdə qalır.</p></details></section>}
    </div>

    <section className="panel fleet-panel" id="fleet" data-section><div className="section-title"><div><span className="eyebrow">AVTOBUS PARKI</span><h2>{fleet.route.id} xətti · {fleet.buses.length} avtobus</h2></div><span className="tag">{fleet.route.stops.find(s=>s.id===fleet.stop_id)?.name} dayanacağına ETA</span></div>
      <div className="table-scroll"><table className="fleet-table"><thead><tr><th>Avtobus</th><th>İstiqamət</th><th>Növbəti dayanacaq</th><th>ETA</th><th>Doluluq</th><th>Bildiriş</th><th>Mənbə</th></tr></thead>
        <tbody>{fleet.buses.map(b=><tr key={b.id} className={b.id===bus.id?'selected':''} onClick={()=>select(b.id)}><td><span className="arrival-emoji" aria-hidden="true">🚌</span> <b>{b.vehicle}</b>{b.reserve&&<em className="reserve-tag">rezerv</em>}</td><td>→ {b.headsign}</td><td>{b.next_stop}</td><td><b>{b.eta} dəq</b></td><td><div className="table-occupancy"><div className={'capacity-track '+occupancyLevel(b.occupancy)}><i style={{width:Math.min(100,b.occupancy)+'%'}}/></div>{b.occupancy}%</div></td><td>{b.crowd?`${b.crowd.reports} · ${b.crowd.label}`:'—'}</td><td><small>{b.source}</small></td></tr>)}</tbody></table></div></section>

    <div id="vision" data-section><div className="section-title"><div><span className="eyebrow">AVTOBUS SƏVİYYƏSİNDƏ MÜŞAHİDƏ</span><h2>Hər sərnişin görünəndə.</h2></div><select aria-label="Salon avtobusu" value={bus.id} onChange={e=>select(+e.target.value)}>{fleet.buses.map(b=><option key={b.id} value={b.id}>{b.vehicle} · {b.occupancy}%</option>)}</select></div>
    <div className="vision-grid"><section className="panel"><Cabin bus={bus}/></section><Vision key={bus.id} bus={bus} notify={notify}/></div></div>

    <div className="operations-grid" id="operations" data-section><section className="panel"><div className="section-title"><h3>STOP sorğuları</h3><span className="tag">{ops?.stops.filter(s=>s.status==='server_received').length||0} gözləyir</span></div>{!ops?.stops.length&&<p className="subtle">Sərnişin reysə qoşulub STOP göndərdikdə burada görünəcək.</p>}{ops?.stops.slice(-8).reverse().map(s=><div className="log-row" key={s.id}><div><b>{s.vehicle||`Avtobus #${s.bus_id}`}</b><small>{s.status==='server_received'?'Dayanacaq sorğusu':'Sürücü təsdiqlədi'}</small></div><button className="soft" disabled={busy||s.status!=='server_received'} onClick={()=>action(()=>api(`/stops/${s.id}/ack`,{}))}>{s.status==='server_received'?'Təsdiqlə':'Təsdiqləndi'}</button></div>)}</section><section className="panel"><div className="section-title"><h3>Qərar jurnalı</h3><Activity size={18}/></div>{!ops?.actions.length&&<p className="subtle">Tətbiq edilən həllər burada saxlanacaq.</p>}{ops?.actions.slice(-6).reverse().map(a=><div className="log-row" key={a.id}><div><b>{POLICY[a.action]||a.action}</b><small>{a.route||'Demo'} xətti · {a.status}</small></div><span>{new Date(a.created_at).toLocaleTimeString('az',{hour:'2-digit',minute:'2-digit'})}</span></div>)}</section></div>
    <section className="panel" id="events" data-section><div className="section-title"><h3><AlertTriangle size={18}/> Yol hadisələri</h3><button className="soft" disabled={busy} onClick={()=>action(()=>api('/events',{title:'Demo: dayanacaqda tələb artımı',route:fleet.route.id,type:'event',delay:3,demand:30,passenger:'Demo hadisə: daha çox sərnişin və 3 dəqiqə gecikmə gözlənilir.'}))}><Plus size={16}/> {fleet.route.id} xəttinə hadisə əlavə et</button></div>{!events.length&&<p className="subtle">Aktiv hadisə yoxdur.</p>}{events.map(e=><div className="log-row" key={e.id}><div><b><span className="route-badge tiny" style={{background:catalog.routes.find(r=>r.id===e.route)?.color}}>{e.route}</span> {e.title}</b><small>+{e.delay} dəq · +{e.demand} sərnişin</small></div><button className="soft" disabled={busy} onClick={()=>action(()=>api(`/events/${e.id}/close`,{}))}>Bağla</button></div>)}</section>
  </>;
}
