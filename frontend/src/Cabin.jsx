import React from 'react';
import {Armchair,Users} from 'lucide-react';
export default function Cabin({bus}) {
  return <div className="cabin-section"><div className="section-title"><div><span className="eyebrow">AVTOBUSUN RƏQƏMSAL ƏKİZİ</span><h3>Salonda nə baş verir?</h3></div><span className="tag">2D demo</span></div>
    <div className="cabin-layout"><div className="bus-cabin" role="img" aria-label={`${bus.seated} dolu oturacaq, ${bus.standing} ayaqüstə sərnişin. Sintetik salon planı.`}>
      <div className="windshield"><span/> <b>↑ Hərəkət istiqaməti</b></div><div className="driver">SÜRÜCÜ</div>
      <div className="seats">{Array.from({length:30},(_,i)=><span key={i} className={'seat '+(i<bus.seated?'occupied':'')}><Armchair size={16}/></span>)}</div>
      <div className="aisle">{Array.from({length:bus.standing},(_,i)=><i key={i} style={{left:`${20+(i%3)*28}%`,top:`${5+Math.floor(i/3)*5}%`}}/>)}</div>
      <span className="door front">GİRİŞ</span><span className="door rear">ÇIXIŞ</span>
    </div><div className="cabin-data"><div className="big-percent">{bus.occupancy}<span>%</span></div><p>Ümumi doluluq</p><div className="cabin-stat"><Armchair/><div><b>{bus.seated} / {bus.seats}</b><small>Oturacaq doludur</small></div></div><div className="cabin-stat"><Users/><div><b>{bus.standing} / {bus.standing_capacity}</b><small>Ayaqüstə sərnişin</small></div></div><div className="seat-legend"><i/> Dolu <i className="empty"/> Boş</div><p className="fine">Yerləşmə sintetikdir. YOLO nəticələri ayrıca göstərilir; kamera koordinatları oturacaq mövqeyi deyil.</p></div></div>
  </div>;
}
