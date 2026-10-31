package az.bakuyolou;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.NotNull;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import static az.bakuyolou.Store.map;

/** Explicit opt-in demo role selection. Not production identity verification. */
@RestController
@RequestMapping("/api/access")
public class DemoAccess {
    public record Choice(@NotNull @Pattern(regexp="passenger|operator") String role) {}
    private record Session(String role, Instant expires) {}
    static final int MAX_SESSIONS=10000, LOGINS_PER_MINUTE=30;
    private final Map<String,Session> sessions=new ConcurrentHashMap<>();
    private final Map<String,long[]> logins=new ConcurrentHashMap<>();
    private final SecureRandom random=new SecureRandom();
    private final boolean enabled;
    private final String key;
    public DemoAccess(@Value("${DEMO_ACCESS_ENABLED:false}") boolean enabled,@Value("${OPERATOR_KEY:}") String key) { this.enabled=enabled;this.key=key; }
    private String token(HttpServletRequest request) {
        if(!enabled || request.getCookies()==null) return null;
        for(var cookie:request.getCookies()) if(cookie.getName().equals("transit_demo")) {
            var s=sessions.get(cookie.getValue());
            if(s!=null && s.expires().isAfter(Instant.now())) return cookie.getValue();
        }
        return null;
    }
    public String role(HttpServletRequest request) { var t=token(request); return t==null?"guest":sessions.get(t).role(); }
    static boolean equal(String a,String b) { return MessageDigest.isEqual(a.getBytes(StandardCharsets.UTF_8),b.getBytes(StandardCharsets.UTF_8)); }
    /** Operator role cookie, or the server-side OPERATOR_KEY header for integrations when demo access is off. */
    public void operator(HttpServletRequest request) {
        if(role(request).equals("operator")) return;
        String supplied=request.getHeader("X-Operator-Key");
        if(!key.isBlank() && supplied!=null && equal(key,supplied)) return;
        throw new ResponseStatusException(HttpStatus.FORBIDDEN,enabled?"Operator rolunu seçərək daxil olun":"Operator açarı yanlışdır");
    }
    /** With demo access enabled, passenger actions need a chosen role. Without it, a real auth layer is expected in front. */
    public void user(HttpServletRequest request) {
        if(enabled && role(request).equals("guest")) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Əvvəl Sərnişin rolunu seçin");
    }
    /** Stable, non-secret identity for rate limits: the server session if present, otherwise the client id and address. */
    public String identity(HttpServletRequest request,String clientId) {
        var t=token(request);
        String raw=t!=null?"session:"+t:"client:"+clientId+"@"+request.getRemoteAddr();
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8))).substring(0,32); }
        catch(NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
    private void limitLogins(String address) {
        long minute=Instant.now().getEpochSecond()/60;
        if(logins.size()>MAX_SESSIONS) logins.entrySet().removeIf(e->e.getValue()[0]!=minute);
        var w=logins.compute(address,(k,v)->v==null||v[0]!=minute?new long[]{minute,1}:new long[]{minute,v[1]+1});
        if(w[1]>LOGINS_PER_MINUTE) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"Çox sayda giriş cəhdi. Bir dəqiqə sonra yenidən sınayın.");
    }
    @GetMapping public Object current(HttpServletRequest request) {return map("role",role(request),"demo_enabled",enabled);}
    @PostMapping public Object enter(@Valid @RequestBody Choice choice,HttpServletRequest request,HttpServletResponse response) {
        if(!enabled) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Demo girişi deaktivdir");
        limitLogins(request.getRemoteAddr());
        var now=Instant.now();
        sessions.entrySet().removeIf(e->e.getValue().expires().isBefore(now));
        if(sessions.size()>=MAX_SESSIONS) sessions.entrySet().stream().sorted(Comparator.comparing(e->e.getValue().expires()))
            .limit(sessions.size()-MAX_SESSIONS+1L).map(Map.Entry::getKey).toList().forEach(sessions::remove);
        byte[] bytes=new byte[32];random.nextBytes(bytes);
        String token=Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        sessions.put(token,new Session(choice.role(),now.plusSeconds(14400)));
        response.addHeader(HttpHeaders.SET_COOKIE,ResponseCookie.from("transit_demo",token).httpOnly(true).secure(request.isSecure()).sameSite("Strict").path("/api").maxAge(Duration.ofHours(4)).build().toString());
        return map("role",choice.role(),"mode","demo");
    }
    @DeleteMapping public Object leave(HttpServletRequest request,HttpServletResponse response) {
        if(request.getCookies()!=null) for(var c:request.getCookies()) if(c.getName().equals("transit_demo")) sessions.remove(c.getValue());
        response.addHeader(HttpHeaders.SET_COOKIE,ResponseCookie.from("transit_demo","").httpOnly(true).secure(request.isSecure()).sameSite("Strict").path("/api").maxAge(0).build().toString());
        return map("role","guest");
    }
}
