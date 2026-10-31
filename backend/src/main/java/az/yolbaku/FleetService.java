package az.yolbaku;

import java.time.Instant;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import static az.yolbaku.Store.map;
import static az.yolbaku.DecisionEngine.n;

/**
 * Synthetic fleet: every bus shuttles terminus to terminus and back on a fixed cycle (2 × one-way minutes).
 * Displayed occupancy blends the bus counter with recent passenger crowd reports.
 */
@Service
public class FleetService {
    /** Crowd report level (Boş, Normal, Dolu, Çox dolu) to occupancy percent. */
    static final int[] CROWD_PERCENT={15,45,80,100};
    static final String[] CROWD_LABEL={"Boş","Normal","Dolu","Çox dolu"};
    static final long PRIORITY_SECONDS=900, REPORT_SECONDS=600, GPS_SECONDS=120, TELEMETRY_SECONDS=600;
    static final int PRIORITY_GAIN=3, TRANSFER_BUFFER=2;
    private final Store store;
    private final RouteCatalog catalog;
    public FleetService(Store store,RouteCatalog catalog) {this.store=store;this.catalog=catalog;}

    /** One consistent read of the mutable demo state, shared by everything computed for a request. */
    public record Snapshot(List<Map<String,Object>> buses,List<Map<String,Object>> events,List<Map<String,Object>> reports,List<Map<String,Object>> states,Instant now) {}
    static boolean before(Object iso,Instant t) { return iso!=null && Instant.parse(iso.toString()).isBefore(t); }
    public Snapshot snapshot() {
        var now=Instant.now();
        return new Snapshot(store.list("bus").stream().filter(b->!before(b.get("expires_at"),now)).toList(),
            store.list("event").stream().filter(e->Boolean.TRUE.equals(e.get("active"))).toList(),
            store.list("report").stream().filter(r->!before(r.get("created_at"),now.minusSeconds(REPORT_SECONDS))).toList(),
            store.list("route_state"),now);
    }
    public Map<String,Object> state(String route) {
        return store.list("route_state").stream().filter(s->route.equals(s.get("route"))).findFirst()
            .orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Marşrut vəziyyəti tapılmadı"));
    }
    static boolean priorityActive(Map<String,Object> state,Instant now) {
        return state.get("priority_until") instanceof Number until && until.longValue()>now.getEpochSecond();
    }
    private Map<String,Object> state(Snapshot s,String route) {
        var st=new LinkedHashMap<>(s.states().stream().filter(x->route.equals(x.get("route"))).findFirst()
            .orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Marşrut vəziyyəti tapılmadı")));
        boolean active=priorityActive(st,s.now());
        st.put("priority_active",active);
        st.put("priority_minutes_left",active?(int)Math.ceil((((Number)st.get("priority_until")).longValue()-s.now().getEpochSecond())/60.0):0);
        st.remove("priority");
        return st;
    }
    public String fingerprint(String route) {
        var buses=store.list("bus").stream().filter(b->route.equals(b.get("route")))
            .map(b->map("id",b.get("id"),"seated",b.get("seated"),"standing",b.get("standing"),"waiting",b.get("waiting"))).toList();
        var events=store.list("event").stream().filter(e->route.equals(e.get("route")))
            .map(e->map("id",e.get("id"),"active",e.get("active"),"delay",e.get("delay"),"demand",e.get("demand"))).toList();
        return buses.toString()+events;
    }

    static int segments(RouteCatalog.Route r) { return 2*(r.stops().size()-1); }
    static int cycleMinutes(RouteCatalog.Route r) { return 2*r.minutes(); }
    /** Position of a stop in the cycle for a direction: "f" = towards the last stop, "b" = back to the first. */
    static double stopPosition(int index,int stops,String dir) {
        int seg=2*(stops-1);
        return dir.equals("b")?((seg-index)%seg)/(double)seg:index/(double)seg;
    }
    static String direction(RouteCatalog.Route r,String dir) { return "b".equals(dir)||"f".equals(dir)?dir:"f"; }
    static String headsign(RouteCatalog.Route r,String dir) { return (dir.equals("b")?r.stops().get(0):r.stops().get(r.stops().size()-1)).name(); }
    public double reservePhase(String route,String stop,String dir) {
        var r=catalog.get(route);
        double target=stopPosition(catalog.stopIndex(r,stop),r.stops().size(),dir);
        double clock=Instant.now().toEpochMilli()/60000.0/cycleMinutes(r);
        return ((target-4.0/cycleMinutes(r)-clock)%1+1)%1;
    }

    private Map<String,Object> crowd(Snapshot s,int bus) {
        var levels=s.reports().stream().filter(r->n(r,"bus_id")==bus).mapToInt(r->n(r,"level")).toArray();
        if(levels.length==0) return null;
        double percent=Arrays.stream(levels).map(l->CROWD_PERCENT[l]).average().orElse(0);
        int label=(int)Math.round(Arrays.stream(levels).average().orElse(0));
        return map("reports",levels.length,"percent",(int)Math.round(percent),"label",CROWD_LABEL[label],"weight",Math.min(.7,.3+.1*levels.length));
    }
    public List<Map<String,Object>> buses(Snapshot s,String routeId,String stopId,String dirParam) {
        var route=catalog.get(routeId);
        String dir=direction(route,dirParam);
        int stops=route.stops().size(), seg=segments(route);
        double target=stopPosition(catalog.stopIndex(route,stopId),stops,dir);
        double clock=s.now().toEpochMilli()/60000.0/cycleMinutes(route);
        int priority=priorityActive(state(s,routeId),s.now())?PRIORITY_GAIN:0;
        int delay=s.events().stream().filter(e->routeId.equals(e.get("route"))).mapToInt(e->n(e,"delay")).sum();
        var result=new ArrayList<Map<String,Object>>();
        for(var stored:s.buses()) if(routeId.equals(stored.get("route"))) {
            var b=new LinkedHashMap<>(stored);
            double phase=((Number)b.getOrDefault("phase",0.0)).doubleValue();
            double progress=((clock+phase)%1+1)%1, pos=progress*seg;
            int k=Math.min(seg-1,(int)pos); double f=pos-k;
            boolean forward=k<stops-1;
            int a=forward?k:stops-1-(k-(stops-1)), next=forward?a+1:a-1;
            var start=route.stops().get(a); var end=route.stops().get(next);
            String busDir=forward?"f":"b";
            double leg=forward?pos/(stops-1):(pos-(stops-1))/(stops-1);
            int eta=Math.max(1,(int)Math.ceil(((target-progress)%1+1)%1*cycleMinutes(route))+delay-priority);
            int seats=n(b,"seats"), standCap=n(b,"standing_capacity"), capacity=seats+standCap;
            int counted=n(b,"seated")+n(b,"standing");
            boolean telemetry=b.get("telemetry_at")!=null&&!before(b.get("telemetry_at"),s.now().minusSeconds(TELEMETRY_SECONDS));
            // Synthetic counters swell mid-route and empty towards the termini; operator telemetry is shown as reported.
            double sensor=Math.min(capacity,telemetry?counted:counted*(.75+.5*Math.sin(Math.PI*leg)));
            double occupancy=100*sensor/capacity;
            var crowd=crowd(s,n(b,"id"));
            if(crowd!=null) { double w=(double)crowd.get("weight"); occupancy=(1-w)*occupancy+w*n(crowd,"percent"); }
            int onboard=(int)Math.round(occupancy*capacity/100), seated=Math.min(seats,onboard);
            double lat=start.lat()+(end.lat()-start.lat())*f, lng=start.lng()+(end.lng()-start.lng())*f;
            String source=telemetry?"Operator telemetriyası":"Sintetik telemetriya";
            if(b.get("gps_at")!=null&&!before(b.get("gps_at"),s.now().minusSeconds(GPS_SECONDS))) {
                lat=((Number)b.get("gps_lat")).doubleValue(); lng=((Number)b.get("gps_lng")).doubleValue(); source="Operator GPS";
            }
            b.putAll(map("lat",lat,"lng",lng,"eta",eta,"dir",busDir,"headsign",headsign(route,busDir),
                "occupancy",(int)Math.round(occupancy),"sensor_occupancy",(int)Math.round(100*sensor/capacity),"crowd",crowd,
                "capacity",capacity,"onboard",onboard,"seated",seated,"standing",Math.min(standCap,onboard-seated),"free",capacity-onboard,
                "next_stop",end.name(),"progress",progress,"reserve",b.containsKey("reserve_stop"),"source",source,"updated_at",s.now().toString()));
            result.add(b);
        }
        result.sort(Comparator.comparingInt(b->n(b,"eta")));
        return result;
    }
    public List<Map<String,Object>> buses(String routeId,String stopId,String dir) { return buses(snapshot(),routeId,stopId,dir); }
    public Object network(String routeId,String stop,String dir) {
        var r=catalog.get(routeId); if(stop==null) stop=r.stops().get(0).id();
        dir=direction(r,dir); var s=snapshot();
        return map("route",r,"stop_id",stop,"dir",dir,"headsign",headsign(r,dir),"buses",buses(s,routeId,stop,dir),"state",state(s,routeId),"mode","simulation",
            "events",s.events().stream().filter(e->routeId.equals(e.get("route"))).toList(),
            "source","Bakı məkanları; nümunə marşrutlar, sintetik GPS və doluluq","updated_at",s.now().toString());
    }

    private Map<String,Object> leg(Snapshot s,RouteCatalog.Route r,int a,int b,Map<String,List<Map<String,Object>>> cache) {
        String dir=a<b?"f":"b";
        var from=r.stops().get(a); var to=r.stops().get(b);
        var buses=cache.computeIfAbsent(r.id()+"|"+from.id()+"|"+dir,k->buses(s,r.id(),from.id(),dir));
        var path=(a<b?r.stops().subList(a,b+1):r.stops().subList(b,a+1).reversed()).stream().map(x->List.of(x.lat(),x.lng())).toList();
        int ride=Math.max(1,(int)Math.round(Math.abs(b-a)*r.minutes()/(r.stops().size()-1.0)));
        var first=buses.isEmpty()?null:buses.get(0);
        return map("route",map("id",r.id(),"name",r.name(),"color",r.color()),"from",map("id",from.id(),"name",from.name()),
            "to",map("id",to.id(),"name",to.name()),"dir",dir,"headsign",headsign(r,dir),"ride_minutes",ride,"stop_count",Math.abs(b-a),"path",path,
            "etas",buses.stream().limit(3).map(x->x.get("eta")).toList(),
            "first_bus",first==null?null:map("id",first.get("id"),"vehicle",first.get("vehicle"),"eta",first.get("eta"),"occupancy",first.get("occupancy"),"free",first.get("free")));
    }
    private static int index(RouteCatalog.Route r,String stop) {
        for(int i=0;i<r.stops().size();i++) if(r.stops().get(i).id().equals(stop)) return i;
        return -1;
    }
    public Object journeys(String from,String to) {
        catalog.stop(from); catalog.stop(to);
        if(from.equals(to)) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,"Başlanğıc və son dayanacaq fərqli olmalıdır");
        var s=snapshot(); var cache=new HashMap<String,List<Map<String,Object>>>();
        var choices=new ArrayList<Map<String,Object>>();
        for(var r:catalog.all()) {
            int a=index(r,from), b=index(r,to);
            if(a<0||b<0) continue;
            var leg=leg(s,r,a,b,cache);
            if(leg.get("first_bus")==null) continue;
            int eta=n((Map<String,Object>)leg.get("first_bus"),"eta"), ride=n(leg,"ride_minutes");
            choices.add(map("id",r.id(),"transfers",0,"legs",List.of(leg),"route",r,"first_eta",eta,"trip_minutes",ride,"wait_minutes",0,"total_minutes",eta+ride,"from",from,"to",to));
        }
        for(var r1:catalog.all()) for(var r2:catalog.all()) {
            if(r1==r2||index(r1,from)<0||index(r2,to)<0||index(r1,to)>=0||index(r2,from)>=0) continue;
            Map<String,Object> best=null;
            for(var x:r1.stops()) {
                int b1=index(r1,x.id()), a2=index(r2,x.id());
                if(a2<0||x.id().equals(from)||x.id().equals(to)) continue;
                var first=leg(s,r1,index(r1,from),b1,cache); var second=leg(s,r2,a2,index(r2,to),cache);
                if(first.get("first_bus")==null||second.get("first_bus")==null) continue;
                int eta=n((Map<String,Object>)first.get("first_bus"),"eta"), arrive=eta+n(first,"ride_minutes");
                int cycle=cycleMinutes(r2);
                // Connecting bus: the first one reaching the transfer stop after we arrive plus a short walk.
                int connect=cache.get(r2.id()+"|"+x.id()+"|"+second.get("dir")).stream().mapToInt(bus->n(bus,"eta"))
                    .map(e->e>=arrive+TRANSFER_BUFFER?e:e+cycle).min().orElse(arrive+cycle);
                int total=connect+n(second,"ride_minutes");
                if(best==null||total<n(best,"total_minutes"))
                    best=map("id",r1.id()+">"+r2.id()+"@"+x.id(),"transfers",1,"legs",List.of(first,second),"route",r1,"first_eta",eta,
                        "trip_minutes",n(first,"ride_minutes")+n(second,"ride_minutes"),"wait_minutes",connect-arrive,"total_minutes",total,
                        "transfer",map("id",x.id(),"name",x.name()),"from",from,"to",to);
            }
            if(best!=null) choices.add(best);
        }
        choices.sort(Comparator.<Map<String,Object>>comparingInt(c->n(c,"total_minutes")).thenComparingInt(c->n(c,"transfers")));
        return map("journeys",choices.stream().limit(6).toList(),"mode","simulation");
    }
}
