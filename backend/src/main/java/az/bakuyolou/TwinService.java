package az.bakuyolou;

import java.time.Instant;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import static az.bakuyolou.Store.map;
import static az.bakuyolou.DecisionEngine.n;

@Service
public class TwinService {
    static final int RESERVE_EXTRA=4, RESERVE_MINUTES=60;
    private final Store store;
    private final FleetService fleet;
    private final RouteCatalog catalog;
    public TwinService(Store store,FleetService fleet,RouteCatalog catalog){this.store=store;this.fleet=fleet;this.catalog=catalog;}
    @Transactional public Object preview(TransitApi.Scenario p) {
        var route=catalog.get(p.route()); catalog.stopIndex(route,p.stop_id());
        var state=fleet.state(p.route());state=store.lock(n(state,"id"),"route_state");
        String dir=p.dir()==null?"f":p.dir();
        var buses=fleet.buses(p.route(),p.stop_id(),dir);
        boolean priorityActive=FleetService.priorityActive(state,Instant.now());
        int eventDemand=store.list("event").stream().filter(e->Boolean.TRUE.equals(e.get("active"))&&p.route().equals(e.get("route"))).mapToInt(e->n(e,"demand")).sum();
        int initial=(int)Math.round((35+eventDemand)*p.demand_multiplier());
        int flow=Math.max(1,(int)Math.round(3*p.demand_multiplier()));
        var options=new ArrayList<Map<String,Object>>();
        String[] policies={"reserve","priority","rebalance"},titles={"Rezerv avtobus göndər","Siqnal prioriteti ver","Yükü avtobuslar arasında böl"};
        String[] reasons={"4 dəqiqəyə 80 yerlik əlavə avtobus, 60 dəqiqəlik növbə. Xərc: 1 əlavə maşın və sürücü.",
            priorityActive?"Prioritet artıq aktivdir; tətbiq yalnız müddəti 15 dəqiqəyə uzadır, əlavə qazanc vermir.":"15 dəqiqə ərzində gəlişləri 3 dəqiqə tezləşdirir. Ssenari siqnal prioritetini fərz edir.",
            "İlk avtobusdan sonuncuya maksimum 10 sərnişin keçir. Ümumi tutum dəyişmir."};
        for(int i=0;i<3;i++) {
            String model=policies[i].equals("priority")&&priorityActive?"none":policies[i];
            options.add(map("id",policies[i],"title",titles[i],"reason",reasons[i],"metrics",TwinEngine.project(buses,initial,flow,p.horizon(),p.delay(),model)));
        }
        options.sort(Comparator.comparingDouble(o->((Number)((Map<?,?>)o.get("metrics")).get("average_wait")).doubleValue()));
        return store.add("scenario",map("route",p.route(),"stop_id",p.stop_id(),"dir",dir,"version",state.get("version"),"horizon",p.horizon(),
            "initial_queue",initial,"arrivals_per_minute",flow,"delay",p.delay(),"created_at",Instant.now().toString(),"applied",false,
            "baseline",TwinEngine.project(buses,initial,flow,p.horizon(),p.delay(),"none"),"options",options,
            "model","Diskret dəqiqəlik növbə simulyasiyası v1","assumptions","Bir dayanacaq, sabit sərnişin axını, avtobus başına bir gəliş; enən sərnişin və yol qeyri-müəyyənliyi modelləşdirilmir.",
            "snapshot",buses.stream().map(b->map("id",b.get("id"),"vehicle",b.get("vehicle"),"eta",b.get("eta"),"free",b.get("free"))).toList(),
            "fingerprint",fleet.fingerprint(p.route())));
    }
    private void addReserve(RouteCatalog.Route r,String stop,String dir,String vehicle) {
        if(fleet.buses(r.id(),stop,dir).size()>=r.buses()+RESERVE_EXTRA) throw new ResponseStatusException(HttpStatus.CONFLICT,"Demo rezerv limiti: hər xəttdə "+RESERVE_EXTRA+" əlavə avtobus");
        var now=Instant.now();
        store.add("bus",map("route",r.id(),"name",r.name(),"vehicle",vehicle,"phase",fleet.reservePhase(r.id(),stop,dir),
            "seats",30,"standing_capacity",50,"seated",0,"standing",0,"base_eta",4,"previous_travel",6,"following_eta",12,"following_free",18,"waiting",0,
            "reserve_stop",stop,"reserve_dir",dir,"dispatch_at",now.toString(),"expires_at",now.plusSeconds(RESERVE_MINUTES*60L).toString(),
            "updated_at",now.toString(),"source","Rezerv avtobus (demo)"));
    }
    /** Reserve dispatched straight from a density alert, without a twin scenario. */
    @Transactional public void dispatchReserve(String route,String stop,String dir,int alertId) {
        var r=catalog.get(route);
        var state=store.lock(n(fleet.state(route),"id"),"route_state");
        addReserve(r,stop,dir,"RA-"+alertId);
        state.put("version",n(state,"version")+1);store.update("route_state",state);
        store.add("action",map("route",route,"alert_id",alertId,"action","reserve","created_at",Instant.now().toString(),"status","Sıxlıq xəbərdarlığı ilə rezerv göndərildi"));
    }
    @Transactional public Object apply(int id,String policy) {
        var scenario=store.lock(id,"scenario");
        if(Boolean.TRUE.equals(scenario.get("applied"))) {
            if(!policy.equals(scenario.get("policy"))) throw new ResponseStatusException(HttpStatus.CONFLICT,"Bu ssenaridə artıq başqa həll tətbiq edilib");
            return scenario;
        }
        String route=scenario.get("route").toString(), stop=scenario.get("stop_id").toString();
        String dir=Objects.toString(scenario.get("dir"),"f");
        var state=fleet.state(route);state=store.lock(n(state,"id"),"route_state");
        if(n(state,"version")!=n(scenario,"version")||Instant.parse(scenario.get("created_at").toString()).isBefore(Instant.now().minusSeconds(300)))
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Ssenari köhnəlib. Yenidən hesablayın.");
        if(!fleet.fingerprint(route).equals(scenario.get("fingerprint")))
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Park və ya hadisələr dəyişib. Ssenarini yenidən hesablayın.");
        var r=catalog.get(route);
        if(policy.equals("reserve")) {
            addReserve(r,stop,dir,"RS-"+id);
        } else if(policy.equals("priority")) {
            // A bounded, expiring measure: applying again only extends the window, it never stacks.
            state.put("priority_until",Instant.now().getEpochSecond()+FleetService.PRIORITY_SECONDS);
            state.remove("priority");
        } else if(policy.equals("rebalance")) {
            @SuppressWarnings("unchecked") var snapshot=(List<Map<String,Object>>)scenario.get("snapshot");
            if(snapshot.size()<2||n(snapshot.get(0),"id")==n(snapshot.get(snapshot.size()-1),"id"))
                throw new ResponseStatusException(HttpStatus.CONFLICT,"Yük bölgüsü üçün ən azı iki avtobus lazımdır");
            var first=store.lock(n(snapshot.get(0),"id"),"bus");var last=store.lock(n(snapshot.get(snapshot.size()-1),"id"),"bus");
            int lastCapacity=n(last,"seats")+n(last,"standing_capacity");
            int transfer=Math.max(0,Math.min(10,Math.min(n(first,"seated")+n(first,"standing"),lastCapacity-n(last,"seated")-n(last,"standing"))));
            int removeStanding=Math.min(transfer,n(first,"standing"));first.put("standing",n(first,"standing")-removeStanding);first.put("seated",n(first,"seated")-(transfer-removeStanding));
            int addSeated=Math.min(transfer,n(last,"seats")-n(last,"seated"));last.put("seated",n(last,"seated")+addSeated);last.put("standing",n(last,"standing")+transfer-addSeated);
            store.update("bus",first);store.update("bus",last);
        }
        state.put("version",n(state,"version")+1);store.update("route_state",state);
        scenario.putAll(map("applied",true,"policy",policy,"applied_at",Instant.now().toString()));store.update("scenario",scenario);
        store.add("action",map("route",route,"scenario_id",id,"action",policy,"created_at",Instant.now().toString(),"status","Demo parkına tətbiq edildi"));
        return scenario;
    }
}
