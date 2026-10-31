import React,{useMemo} from 'react';
import {MapContainer,TileLayer,Polyline,Circle,CircleMarker,Marker,Tooltip} from 'react-leaflet';
import L from 'leaflet';

const LEVEL={high:'#dd3b2a',medium:'#e8a33a',low:'#22a585'};
const alertIcon=L.divIcon({className:'alert-icon',html:'<span>⚠️</span>',iconSize:[30,30],iconAnchor:[15,15]});

/** City centre framing (the airport stop is reachable by panning). Passengers on board per ~400 m GPS cell: radius grows with people, colour follows occupancy. */
export default function DensityMap({catalog,density,alerts}) {
  const bounds=useMemo(()=>catalog.stops.filter(s=>s.lng<49.97).map(s=>[s.lat,s.lng]),[catalog]);
  return <div className="map-frame density-frame" data-testid="density-map">
    <MapContainer bounds={bounds} boundsOptions={{padding:[20,20]}} scrollWheelZoom={false}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19}/>
      {catalog.routes.map(r=><Polyline key={r.id} positions={r.stops.map(s=>[s.lat,s.lng])} pathOptions={{color:r.color,weight:3,opacity:.35}}/>)}
      {density?.cells.map((c,i)=><Circle key={i} center={[c.lat,c.lng]} radius={140+28*Math.sqrt(c.onboard)} className={'density-cell '+c.level}
        pathOptions={{color:LEVEL[c.level],fillColor:LEVEL[c.level],fillOpacity:c.level==='high'?.5:.32,weight:c.level==='high'?2:1}}>
        <Tooltip>{c.onboard} sərnişin · {c.buses} avtobus · {c.occupancy}% dolu</Tooltip></Circle>)}
      {density?.buses.map(b=><CircleMarker key={b.id} center={[b.lat,b.lng]} radius={b.high?6:4} pathOptions={{color:b.high?'#dd3b2a':'#ffffff',weight:2,fillColor:b.color,fillOpacity:1}}>
        <Tooltip>{b.route} · {b.vehicle} · {b.occupancy}%</Tooltip></CircleMarker>)}
      {alerts.map(a=><Marker key={a.id} position={[a.lat,a.lng]} icon={alertIcon}><Tooltip>{a.title}</Tooltip></Marker>)}
    </MapContainer>
    <div className="map-legend"><span className="legend-dot low"/>Az<span className="legend-dot medium"/>Orta<span className="legend-dot high"/>Yüksək (≥{density?.high_threshold??85}%)<span className="legend-count">{density?.buses.length??0} avtobusun GPS-i · 400 m xanalar</span></div>
  </div>;
}
