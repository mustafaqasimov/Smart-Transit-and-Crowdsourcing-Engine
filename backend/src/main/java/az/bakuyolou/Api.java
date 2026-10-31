package az.bakuyolou;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.time.*;
import java.security.*;
import java.util.*;
import static az.bakuyolou.Store.map;
import static az.bakuyolou.DemoAccess.equal;

@RestController @RequestMapping("/api")
public class Api {
    static final int REPORTS_PER_MINUTE=12;
    private final Store store;
    private final ObjectMapper mapper;
    private final DemoAccess access;
    private final RouteCatalog catalog;
    private final AlertService alerts;
    private final HttpServletRequest request;
    private final SecureRandom random=new SecureRandom();
    public Api(Store store,ObjectMapper mapper,DemoAccess access,RouteCatalog catalog,AlertService alerts,HttpServletRequest request) { this.store=store;this.mapper=mapper;this.access=access;this.catalog=catalog;this.alerts=alerts;this.request=request; }
    private static boolean recent(Map<String,Object> row,String field,long seconds) {
        return row.get(field)!=null&&Instant.parse(row.get(field).toString()).isAfter(Instant.now().minusSeconds(seconds));
    }
    private Map<String,Object> data(Object request) { return mapper.convertValue(request,new TypeReference<>(){}); }
    private Map<String,Object> create(Object request) {
        var d=data(request); d.put("created_at",Instant.now().toString());return d;
    }
    @GetMapping("/health") public Object health() { store.health();return map("status","ok","database","postgresql","mode","demo"); }
    /** Legacy rule-model analytics. Live ETA and occupancy come from /api/fleet. */
    @GetMapping("/dashboard") public Object dashboard() {
        var events=store.list("event").stream().filter(e->Boolean.TRUE.equals(e.get("active"))).toList();
        var reports=store.list("report").stream().filter(r->recent(r,"created_at",600)).toList();
        var buses=store.list("bus");buses.forEach(b->b.put("analysis",DecisionEngine.assess(b,events,reports)));
        return map("buses",buses,"events",events,"mode","demo","updated_at",Instant.now().toString());
    }
    @GetMapping("/events") public Object events() {
        return map("events",store.list("event").stream().filter(e->Boolean.TRUE.equals(e.get("active"))).toList());
    }
    /** One live crowd report per person and bus: a new choice replaces the previous one instead of stacking. */
    @PostMapping("/reports")
    public synchronized ResponseEntity<Object> report(@Valid @RequestBody Requests.Report p) {
        access.user(request);
        var bus=store.get(p.bus_id(),"bus");
        var response=saveReport(p);
        // A "very full" report raises a reserve recommendation right away instead of at the next scan.
        alerts.check(bus.get("route").toString());
        return response;
    }
    private ResponseEntity<Object> saveReport(Requests.Report p) {
        String reporter=access.identity(request,p.client_id());
        var mine=store.list("report").stream().filter(r->reporter.equals(r.get("reporter"))).toList();
        if(mine.stream().filter(r->recent(r,"updated_at",60)).count()>=REPORTS_PER_MINUTE)
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"Çox sayda bildiriş. Bir dəqiqə sonra yenidən bildirin");
        var existing=mine.stream().filter(r->r.get("bus_id").equals(p.bus_id())&&recent(r,"created_at",600)).findFirst();
        var now=Instant.now().toString();
        if(existing.isPresent()) {
            var r=existing.get();r.putAll(map("level",p.level(),"created_at",now,"updated_at",now));store.update("report",r);
            r.remove("reporter");r.put("updated",true);return ResponseEntity.ok(r);
        }
        var d=map("bus_id",p.bus_id(),"level",p.level(),"reporter",reporter,"verified",false,"created_at",now,"updated_at",now);
        var saved=store.add("report",d);saved.remove("reporter");saved.put("updated",false);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }
    @PostMapping("/join") @ResponseStatus(HttpStatus.CREATED)
    public Object join(@Valid @RequestBody Requests.Join p) {
        access.user(request);
        var bus=store.get(p.bus_id(),"bus");var d=create(p);byte[] bytes=new byte[24];random.nextBytes(bytes);
        d.put("token",Base64.getUrlEncoder().withoutPadding().encodeToString(bytes));d.put("vehicle",bus.get("vehicle"));d.put("verification","demo-self-declared");return store.add("session",d);
    }
    @PostMapping("/stop") @ResponseStatus(HttpStatus.CREATED)
    public synchronized Object stop(@Valid @RequestBody Requests.Stop p) {
        var session=store.list("session").stream().filter(r->equal(r.get("token").toString(),p.session_id())).findFirst()
            .orElseThrow(()->new ResponseStatusException(HttpStatus.FORBIDDEN,"Əvvəl reysə qoşulun"));
        if(!recent(session,"created_at",7200)) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Reys sessiyası bitib");
        var existing=store.list("stop").stream().filter(r->r.get("session_id").equals(p.session_id())).findFirst();
        if(existing.isPresent()) return existing.get();
        return store.add("stop",map("session_id",p.session_id(),"bus_id",session.get("bus_id"),"vehicle",session.get("vehicle"),"status","server_received","created_at",Instant.now().toString(),"message","Serverə çatdı. Avtobus təsdiqinədək fiziki STOP düyməsindən istifadə edin."));
    }
    @GetMapping("/operator") public Object ops() {
        access.operator(request);var stops=store.list("stop");stops.forEach(r->r.remove("session_id"));return map("stops",stops,"actions",store.list("action"));
    }
    @PostMapping("/stops/{id}/ack") public Object ack(@PathVariable int id) {
        access.operator(request);var r=store.get(id,"stop");r.put("status","driver_panel_acknowledged");store.update("stop",r);return map("status","driver_panel_acknowledged");
    }
    /** The ride token travels in a header so it does not end up in access logs or browser history. */
    @GetMapping("/stop-status") public Object stopStatus(@RequestHeader("X-Ride-Token") String token) {
        return store.list("stop").stream().filter(r->equal(r.get("session_id").toString(),token)).map(r->map("status",r.get("status"),"id",r.get("id"))).toList();
    }
    @PostMapping("/events") @ResponseStatus(HttpStatus.CREATED)
    public Object event(@Valid @RequestBody Requests.Event p) {
        access.operator(request);catalog.get(p.route());var d=create(p);d.putAll(map("verified",true,"active",true,"source","Operator"));return store.add("event",d);
    }
    @PostMapping("/events/{id}/close") public Object close(@PathVariable int id) {
        access.operator(request);var r=store.get(id,"event");r.put("active",false);store.update("event",r);return map("closed",true);
    }
    /** Counts are shown as reported for 10 minutes; the GPS fix overrides the simulated position for 2 minutes. */
    @PostMapping("/telemetry/{id}") public Object telemetry(@PathVariable int id,@Valid @RequestBody Requests.Telemetry p) {
        access.operator(request);var r=store.get(id,"bus");var now=Instant.now().toString();
        r.putAll(map("seated",p.seated(),"standing",p.standing(),"waiting",p.waiting(),"gps_lat",p.lat(),"gps_lng",p.lng(),"gps_at",now,"telemetry_at",now,"updated_at",now));
        store.update("bus",r);return map("updated",true);
    }
    @PostMapping("/actions") @ResponseStatus(HttpStatus.CREATED)
    public Object action(@Valid @RequestBody Requests.Action p) {
        access.operator(request);store.get(p.bus_id(),"bus");var d=create(p);d.put("status","Operator qərarı qeyd edildi; real dispetçer inteqrasiyası yoxdur");return store.add("action",d);
    }
}
