import React,{useEffect,useMemo} from 'react';
import {MapContainer,TileLayer,Polyline,Marker,Tooltip,Popup,CircleMarker,useMap,useMapEvents} from 'react-leaflet';
import L from 'leaflet';

export const occupancyLevel=value=>value>80?'high':value>55?'medium':'low';

function FitBounds({points,watch}) {
  const map=useMap();
  useEffect(()=>{if(points.length)map.fitBounds(points,{padding:[40,40],maxZoom:15});},[watch,map]);
  return null;
}
/** Buses glide between 4 s updates; the glide is switched off while Leaflet re-positions markers for a zoom. */
function ZoomGuard() {
  const map=useMapEvents({
    zoomstart(){map.getContainer().classList.add('map-zooming')},
    zoomend(){setTimeout(()=>map.getContainer().classList.remove('map-zooming'),120)},
  });
  return null;
}
function BusMarker({bus,route,color,selected,onSelect}) {
  const level=occupancyLevel(bus.occupancy);
  // Memoised so position updates move the same element (and animate) instead of re-creating it.
  const icon=useMemo(()=>L.divIcon({className:'bus-icon',iconSize:[78,36],iconAnchor:[39,18],
    html:`<div class="bus-pin ${level}${selected?' is-selected':''}${bus.reserve?' is-reserve':''}" style="--route:${color}"><span class="bus-emoji" aria-hidden="true">🚌</span><b>${route}</b><i>${bus.occupancy}%</i></div>`}),
    [level,selected,bus.occupancy,bus.reserve,route,color]);
  return <Marker position={[bus.lat,bus.lng]} icon={icon} zIndexOffset={selected?1000:0} eventHandlers={{click:()=>onSelect?.(bus.id)}} keyboard={false}>
    <Tooltip direction="top" offset={[0,-16]}><b>{bus.vehicle}</b> → {bus.headsign}<br/>{bus.eta} dəq · {bus.occupancy}% dolu · {bus.free} boş yer</Tooltip>
  </Marker>;
}
function StopPopup({stop,routes,planner,onStop,onCurrentRoute}) {
  const map=useMap(),done=fn=>()=>{map.closePopup();fn()};
  return <Popup>
    <div className="stop-popup"><b>{stop.name}</b>
      <div className="stop-routes">{routes.map(r=><span key={r.id} style={{background:r.color}}>{r.id}</span>)}</div>
      <div className="stop-actions">
        {planner&&<><button className="pick-from" onClick={done(()=>planner.onPick(stop.id,'from'))}>Buradan</button><button className="pick-to" onClick={done(()=>planner.onPick(stop.id,'to'))}>Buraya</button></>}
        {onCurrentRoute&&onStop&&<button onClick={done(()=>onStop(stop.id))}>Gəlişlər</button>}
      </div>
    </div>
  </Popup>;
}

export default function TransitMap({catalog,fleet,selected,onSelect,onStop,planner,journey}) {
  const route=fleet.route;
  const servedBy=useMemo(()=>{const m={};catalog?.routes.forEach(r=>r.stops.forEach(s=>(m[s.id]??=[]).push(r)));return m},[catalog]);
  const routeStops=new Set(route.stops.map(s=>s.id));
  const focus=journey?journey.legs.flatMap(l=>l.path):route.stops.map(s=>[s.lat,s.lng]);
  const stops=planner&&catalog?catalog.stops:route.stops;
  return <div className="map-frame" data-testid="fleet-map">
    <MapContainer center={[40.395,49.86]} zoom={13} scrollWheelZoom={false} zoomControl={true}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19}/>
      <FitBounds points={focus} watch={journey?journey.id:route.id}/>
      <ZoomGuard/>
      {planner&&catalog?.routes.filter(r=>r.id!==route.id).map(r=><Polyline key={r.id} positions={r.stops.map(s=>[s.lat,s.lng])} pathOptions={{color:r.color,weight:3,opacity:.22}}/>)}
      <Polyline positions={route.stops.map(s=>[s.lat,s.lng])} pathOptions={{color:'#ffffff',weight:9,opacity:.9}}/>
      <Polyline positions={route.stops.map(s=>[s.lat,s.lng])} pathOptions={{color:route.color,weight:5,opacity:journey?.45:.9}}/>
      {journey?.legs.map((l,i)=><React.Fragment key={i}>
        <Polyline positions={l.path} pathOptions={{color:'#ffffff',weight:11,opacity:.95}}/>
        <Polyline positions={l.path} pathOptions={{color:l.route.color,weight:7,opacity:1,dashArray:i?'10 8':null}}/>
      </React.Fragment>)}
      {stops.map(s=>{
        const isFrom=planner?.from===s.id,isTo=planner?.to===s.id,onRoute=routeStops.has(s.id),waiting=s.id===fleet.stop_id;
        const color=isFrom?'#16a37f':isTo?'#e0475b':onRoute?route.color:'#8b93a8';
        return <CircleMarker key={s.id} center={[s.lat,s.lng]} radius={isFrom||isTo?10:waiting?8:onRoute?6:5}
          pathOptions={{color,fillColor:isFrom||isTo?color:'#ffffff',fillOpacity:1,weight:isFrom||isTo?4:3}} className={`stop-marker stop-${s.id}`}>
          <Tooltip direction="top" offset={[0,-6]}>{isFrom?'Haradan: ':isTo?'Haraya: ':''}{s.name}</Tooltip>
          <StopPopup stop={s} routes={servedBy[s.id]||[]} planner={planner} onStop={onStop} onCurrentRoute={onRoute}/>
        </CircleMarker>;
      })}
      {fleet.buses.map(b=><BusMarker key={b.id} bus={b} route={route.id} color={route.color} selected={b.id===selected} onSelect={onSelect}/>)}
    </MapContainer>
    <div className="map-legend"><span className="legend-dot low"/>Boş<span className="legend-dot medium"/>Orta<span className="legend-dot high"/>Dolu<span className="legend-count">{fleet.buses.length} avtobus · sintetik GPS</span></div>
  </div>;
}
