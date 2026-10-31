package az.bakuyolou;

import java.time.Instant;
import org.springframework.boot.*;
import org.springframework.stereotype.Component;
import org.springframework.core.annotation.Order;
import org.springframework.transaction.annotation.Transactional;
import static az.bakuyolou.Store.map;

/** Idempotent: adds missing route states and BK-route-N demo buses without touching existing records. */
@Component @Order(1)
public class DemoFleetSeed implements ApplicationRunner {
    private static final int[] SEATED={29,24,16,30,21,12}, STANDING={38,14,3,44,22,6};
    private final Store store;
    private final RouteCatalog catalog;
    public DemoFleetSeed(Store store,RouteCatalog catalog){this.store=store;this.catalog=catalog;}
    @Override @Transactional public void run(ApplicationArguments args) {
        for(var r:catalog.all()) {
            if(store.list("route_state").stream().noneMatch(s->s.get("route").equals(r.id())))
                store.add("route_state",map("route",r.id(),"version",0));
            var existing=store.list("bus").stream().filter(b->b.get("route").equals(r.id())).toList();
            for(int i=0;i<existing.size();i++) if(!existing.get(i).containsKey("vehicle")) {
                var bus=existing.get(i);bus.putAll(map("vehicle","BK-"+r.id()+"-"+(i+1),"phase",i/(double)r.buses()));store.update("bus",bus);
            }
            for(int i=0;i<r.buses();i++) {
                String vehicle="BK-"+r.id()+"-"+(i+1);
                if(store.list("bus").stream().anyMatch(b->vehicle.equals(b.get("vehicle")))) continue;
                // Different routes get a different mix of busy and quiet buses.
                int k=(i+r.id().hashCode()&0x7fffffff)%SEATED.length;
                var stop=r.stops().get(i%r.stops().size());
                store.add("bus",map("route",r.id(),"name",r.name(),"vehicle",vehicle,"phase",i/(double)r.buses(),
                    "lat",stop.lat(),"lng",stop.lng(),"seats",30,"standing_capacity",50,
                    "seated",r.id().matches("125|18|65")?SEATED[i]:SEATED[k],"standing",r.id().matches("125|18|65")?STANDING[i]:STANDING[k],
                    "base_eta",4+i*5,"previous_travel",6,"following_eta",12,"following_free",18,
                    "waiting",45,"updated_at",Instant.now().toString(),"source","Sintetik telemetriya"));
            }
        }
    }
}
