package az.bakuyolou;

import java.util.*;
import org.springframework.stereotype.Component;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Curated Baku landmarks with approximate coordinates; route numbers, stop order and service times are demo data. */
@Component
public class RouteCatalog {
    public record Stop(String id, String name, double lat, double lng) {}
    /** minutes: one-way trip time. Buses run terminus to terminus and back. */
    public record Route(String id, String name, String color, int minutes, int buses, List<Stop> stops) {}
    private final Map<String,Stop> stops = new LinkedHashMap<>();
    private final List<Route> routes;
    private void s(String id,String name,double lat,double lng) { stops.put(id,new Stop(id,name,lat,lng)); }
    private Route r(String id,String name,String color,int minutes,int buses,String... ids) {
        return new Route(id,name,color,minutes,buses,Arrays.stream(ids).map(stops::get).toList());
    }
    public RouteCatalog() {
        s("28may","28 May",40.3797,49.8483); s("sahil","Sahil",40.3723,49.8438); s("iceri","İçərişəhər",40.3662,49.8313);
        s("genclik","Gənclik",40.4005,49.8518); s("nerimanov","Nəriman Nərimanov",40.4028,49.8718); s("nizami","Nizami",40.3793,49.8296);
        s("elmler","Elmlər Akademiyası",40.3755,49.8158); s("koroglupark","Koroğlu parkı",40.3926,49.8437); s("port","Port Baku",40.3775,49.8618);
        s("xetai","Xətai",40.3831,49.8726); s("bulvar","Ağ Şəhər bulvarı",40.3788,49.8856); s("ag","Ağ Şəhər",40.3895,49.8948);
        s("bdu","Bakı Dövlət Universiteti",40.3746,49.8113); s("insaatcilar","İnşaatçılar",40.3913,49.8027); s("20yanvar","20 Yanvar",40.4040,49.8085);
        s("memar","Memar Əcəmi",40.4103,49.8143); s("nesimi","Nəsimi",40.4245,49.8253); s("azadliq","Azadlıq prospekti",40.4256,49.8428);
        s("dernegul","Dərnəgül",40.4253,49.8613); s("avtovagzal","Beynəlxalq Avtovağzal",40.4235,49.7955); s("bakmil","Bakmil",40.4179,49.8790);
        s("ulduz","Ulduz",40.4146,49.8917); s("koroglu","Koroğlu",40.4208,49.9180); s("qarayev","Qara Qarayev",40.4176,49.9339);
        s("neftciler","Neftçilər",40.4103,49.9431); s("dostluq","Xalqlar Dostluğu",40.3974,49.9524); s("ehmedli","Əhmədli",40.3851,49.9541);
        s("aslanov","Həzi Aslanov",40.3725,49.9536); s("heydar","Heydər Əliyev Mərkəzi",40.3958,49.8677); s("fevvare","Fəvvarələr meydanı",40.3700,49.8370);
        s("sehidler","Şəhidlər xiyabanı",40.3608,49.8263); s("bayil","Bayıl",40.3536,49.8318); s("badamdar","Badamdar",40.3446,49.8075);
        s("yasamal","Yasamal",40.3880,49.8180); s("airport","Heydər Əliyev Hava Limanı",40.4675,50.0467);
        routes = List.of(
            r("125","28 May → Ağ Şəhər","#4059e8",24,4,"28may","port","xetai","bulvar","ag"),
            r("18","İçərişəhər → Nərimanov","#059d88",28,4,"iceri","sahil","28may","genclik","nerimanov"),
            r("65","Elmlər → Gənclik","#c47a21",26,4,"elmler","nizami","28may","koroglupark","genclik"),
            r("1","Avtovağzal → Sahil","#d1455b",38,5,"avtovagzal","20yanvar","insaatcilar","bdu","elmler","nizami","fevvare","sahil"),
            r("5","Bayıl → Nərimanov","#7b4fd6",34,5,"bayil","sehidler","fevvare","sahil","28may","heydar","nerimanov"),
            r("13","Badamdar → Həzi Aslanov","#2289b5",42,6,"badamdar","bayil","iceri","sahil","port","xetai","bulvar","aslanov"),
            r("30","Avtovağzal → Ulduz","#5c8a1e",36,5,"avtovagzal","memar","nesimi","azadliq","dernegul","bakmil","ulduz"),
            r("46","Nərimanov → Həzi Aslanov","#b4521a",40,5,"nerimanov","ulduz","koroglu","qarayev","neftciler","dostluq","ehmedli","aslanov"),
            r("88","Yasamal → Əhmədli","#c23c94",32,4,"yasamal","nizami","28may","xetai","ag","ehmedli"),
            r("H1","28 May → Hava Limanı","#1d2f6f",45,3,"28may","genclik","koroglu","airport"));
    }
    public List<Route> all() { return routes; }
    public Route get(String id) { return routes.stream().filter(r->r.id().equals(id)).findFirst()
        .orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Marşrut tapılmadı")); }
    public Stop stop(String id) { var s=stops.get(id);
        if(s==null) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,"Dayanacaq tapılmadı"); return s; }
    public List<Stop> stops() { return routes.stream().flatMap(r->r.stops().stream()).distinct().toList(); }
    public int stopIndex(Route route, String stop) {
        for(int i=0;i<route.stops().size();i++) if(route.stops().get(i).id().equals(stop)) return i;
        throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,"Dayanacaq bu marşruta aid deyil");
    }
}
