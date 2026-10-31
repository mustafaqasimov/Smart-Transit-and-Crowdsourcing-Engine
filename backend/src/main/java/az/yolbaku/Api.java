package az.yolbaku;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.time.*;
import java.security.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import static az.yolbaku.Store.map;

@RestController @RequestMapping("/api")
public class Api {
    private final Store store;
    private final ObjectMapper mapper;
    private final String key;
    private final SecureRandom random=new SecureRandom();
    public Api(Store store,ObjectMapper mapper,@Value("${OPERATOR_KEY:}") String key) { this.store=store;this.mapper=mapper;this.key=key; }
    private void operator(String supplied) {
        if(key.isBlank()||!equal(key,supplied)) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Operator açarı yanlışdır");
    }
    private static boolean equal(String a,String b) { return MessageDigest.isEqual(a.getBytes(StandardCharsets.UTF_8),b.getBytes(StandardCharsets.UTF_8)); }
    private static boolean recent(Map<String,Object> row,long seconds) {
        return OffsetDateTime.parse(row.get("created_at").toString()).toInstant().isAfter(Instant.now().minusSeconds(seconds));
    }
    private Map<String,Object> data(Object request) { return mapper.convertValue(request,new TypeReference<>(){}); }
    private Map<String,Object> create(String kind,Object request) {
        var d=data(request); d.put("created_at",Instant.now().toString());return d;
    }
    @GetMapping("/health") public Object health() { store.health();return map("status","ok","database","postgresql","mode","demo"); }
    @GetMapping("/dashboard") public Object dashboard() {
        var events=store.list("event").stream().filter(e->Boolean.TRUE.equals(e.get("active"))).toList();
        var reports=store.list("report").stream().filter(r->recent(r,600)).toList();
        var buses=store.list("bus");buses.forEach(b->b.put("analysis",DecisionEngine.assess(b,events,reports)));
        return map("buses",buses,"events",events,"mode","demo","updated_at",Instant.now().toString());
    }
    @PostMapping("/reports") @ResponseStatus(HttpStatus.CREATED)
    public synchronized Object report(@Valid @RequestBody Requests.Report p) {
        store.get(p.bus_id(),"bus");
        if(store.list("report").stream().anyMatch(r->r.get("client_id").equals(p.client_id())&&r.get("bus_id").equals(p.bus_id())&&recent(r,60)))
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"Bir dəqiqə sonra yenidən bildirin");
        var d=create("report",p);d.put("verified",false);return store.add("report",d);
    }
    @PostMapping("/join") @ResponseStatus(HttpStatus.CREATED)
    public Object join(@Valid @RequestBody Requests.Join p) {
        store.get(p.bus_id(),"bus");var d=create("session",p);byte[] bytes=new byte[24];random.nextBytes(bytes);
        d.put("token",Base64.getUrlEncoder().withoutPadding().encodeToString(bytes));d.put("verification","demo-self-declared");return store.add("session",d);
    }
    @PostMapping("/stop") @ResponseStatus(HttpStatus.CREATED)
    public synchronized Object stop(@Valid @RequestBody Requests.Stop p) {
        var session=store.list("session").stream().filter(r->equal(r.get("token").toString(),p.session_id())).findFirst()
            .orElseThrow(()->new ResponseStatusException(HttpStatus.FORBIDDEN,"Əvvəl reysə qoşulun"));
        if(!recent(session,7200)) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Reys sessiyası bitib");
        var existing=store.list("stop").stream().filter(r->r.get("session_id").equals(p.session_id())).findFirst();
        if(existing.isPresent()) return existing.get();
        return store.add("stop",map("session_id",p.session_id(),"bus_id",session.get("bus_id"),"status","server_received","created_at",Instant.now().toString(),"message","Serverə çatdı. Avtobus təsdiqinədək fiziki STOP düyməsindən istifadə edin."));
    }
    @GetMapping("/operator") public Object ops(@RequestHeader(value="X-Operator-Key",defaultValue="") String k) {
        operator(k);var stops=store.list("stop");stops.forEach(r->r.remove("session_id"));return map("stops",stops,"actions",store.list("action"));
    }
    @PostMapping("/stops/{id}/ack") public Object ack(@PathVariable int id,@RequestHeader(value="X-Operator-Key",defaultValue="") String k) {
        operator(k);var r=store.get(id,"stop");r.put("status","driver_panel_acknowledged");store.update("stop",r);return map("status","driver_panel_acknowledged");
    }
    @GetMapping("/stop-status") public Object stopStatus(@RequestParam String session_id) {
        return store.list("stop").stream().filter(r->equal(r.get("session_id").toString(),session_id)).map(r->map("status",r.get("status"),"id",r.get("id"))).toList();
    }
    @PostMapping("/events") @ResponseStatus(HttpStatus.CREATED)
    public Object event(@Valid @RequestBody Requests.Event p,@RequestHeader(value="X-Operator-Key",defaultValue="") String k) {
        operator(k);var d=create("event",p);d.putAll(map("verified",true,"active",true,"source","Operator"));return store.add("event",d);
    }
    @PostMapping("/events/{id}/close") public Object close(@PathVariable int id,@RequestHeader(value="X-Operator-Key",defaultValue="") String k) {
        operator(k);var r=store.get(id,"event");r.put("active",false);store.update("event",r);return map("closed",true);
    }
    @PostMapping("/telemetry/{id}") public Object telemetry(@PathVariable int id,@Valid @RequestBody Requests.Telemetry p,@RequestHeader(value="X-Operator-Key",defaultValue="") String k) {
        operator(k);var r=store.get(id,"bus");r.putAll(data(p));r.put("updated_at",Instant.now().toString());r.put("source","Operator / demo telemetriya");store.update("bus",r);return map("updated",true);
    }
    @PostMapping("/actions") @ResponseStatus(HttpStatus.CREATED)
    public Object action(@Valid @RequestBody Requests.Action p,@RequestHeader(value="X-Operator-Key",defaultValue="") String k) {
        operator(k);store.get(p.bus_id(),"bus");var d=create("action",p);d.put("status","Operator qərarı qeyd edildi; real dispetçer inteqrasiyası yoxdur");return store.add("action",d);
    }
}
