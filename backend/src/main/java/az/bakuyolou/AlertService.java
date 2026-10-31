package az.bakuyolou;

import java.time.Instant;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import static az.bakuyolou.Store.map;
import static az.bakuyolou.DecisionEngine.n;

/**
 * Raises a "send a reserve bus" recommendation when a bus is crowded: counter >= 95%,
 * or passengers report it as Dolu / Çox dolu. One open alert per route; a handled route waits 15 minutes.
 */
@Service
public class AlertService {
    static final long REPEAT_SECONDS=900;
    private final Store store;private final FleetService fleet;private final TwinService twin;private final RouteCatalog catalog;
    public AlertService(Store store,FleetService fleet,TwinService twin,RouteCatalog catalog){this.store=store;this.fleet=fleet;this.twin=twin;this.catalog=catalog;}
    @Scheduled(initialDelayString="${ALERT_INITIAL_DELAY_MS:15000}",fixedDelayString="${ALERT_INTERVAL_MS:20000}")
    public void scan() { check(null); }
    public synchronized List<Map<String,Object>> check(String onlyRoute) {
        var s=fleet.snapshot();var now=Instant.now();var created=new ArrayList<Map<String,Object>>();
        var alerts=store.list("alert");
        for(var r:catalog.all()) {
            if(onlyRoute!=null&&!onlyRoute.equals(r.id())) continue;
            boolean busy=alerts.stream().anyMatch(a->r.id().equals(a.get("route"))&&("open".equals(a.get("status"))||!FleetService.before(a.get("created_at"),now.minusSeconds(REPEAT_SECONDS))));
            if(busy) continue;
            var hot=fleet.buses(s,r.id(),r.stops().get(0).id(),"f").stream().filter(FleetService::high).max(Comparator.comparingInt(b->n(b,"occupancy")));
            if(hot.isEmpty()) continue;
            var b=hot.get();var crowd=(Map<?,?>)b.get("crowd");
            String why=crowd!=null&&((Number)crowd.get("percent")).intValue()>=FleetService.ALERT_CROWD
                ?"sərnişinlər \""+crowd.get("label")+"\" bildirib ("+crowd.get("reports")+" bildiriş)":"doluluq "+b.get("occupancy")+"%";
            created.add(store.add("alert",map("route",r.id(),"route_name",r.name(),"color",r.color(),"bus_id",b.get("id"),"vehicle",b.get("vehicle"),
                "occupancy",b.get("occupancy"),"stop_id",b.get("next_stop_id"),"stop_name",b.get("next_stop"),"dir",b.get("dir"),
                "lat",b.get("lat"),"lng",b.get("lng"),"status","open","created_at",now.toString(),
                "title","Yüksək sıxlıq: "+r.id()+" xətti, "+b.get("vehicle"),
                "reason",b.get("vehicle")+": "+why+". Növbəti dayanacaq: "+b.get("next_stop")+".",
                "recommendation","Əlavə rezerv avtobus ayrılsın")));
        }
        return created;
    }
    public Object list() {
        var all=store.list("alert");
        var open=all.stream().filter(a->"open".equals(a.get("status"))).toList();
        var handled=all.stream().filter(a->!"open".equals(a.get("status"))).toList();
        return map("open",open,"recent",handled.subList(Math.max(0,handled.size()-5),handled.size()));
    }
    @Transactional public Object dispatch(int id) {
        var a=store.lock(id,"alert");
        if(!"open".equals(a.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT,"Bu xəbərdarlıq artıq bağlanıb");
        twin.dispatchReserve(a.get("route").toString(),a.get("stop_id").toString(),Objects.toString(a.get("dir"),"f"),id);
        a.putAll(map("status","dispatched","handled_at",Instant.now().toString()));store.update("alert",a);
        return a;
    }
    @Transactional public Object dismiss(int id) {
        var a=store.lock(id,"alert");
        if(!"open".equals(a.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT,"Bu xəbərdarlıq artıq bağlanıb");
        a.putAll(map("status","dismissed","handled_at",Instant.now().toString()));store.update("alert",a);
        return a;
    }
}
