package az.yolbaku;

import java.util.*;
import static az.yolbaku.Store.map;

/** Explainable baseline, not a trained model. Keeps Python's half-even rounding. */
public final class DecisionEngine {
    private DecisionEngine() {}
    static int n(Map<String,Object> m,String key) { return ((Number)m.get(key)).intValue(); }
    static int round(double v) { return (int)Math.rint(v); }
    public static Map<String,Object> assess(Map<String,Object> b,List<Map<String,Object>> events,List<Map<String,Object>> reports) {
        var relevantEvents=events.stream().filter(e->e.get("route").equals(b.get("route"))).toList();
        int delay=relevantEvents.stream().mapToInt(e->n(e,"delay")).sum();
        var relevant=reports.stream().filter(r->n(r,"bus_id")==n(b,"id")).toList();
        double sensor=(n(b,"seated")+n(b,"standing"))/(double)(n(b,"seats")+n(b,"standing_capacity"));
        double crowd=relevant.stream().mapToDouble(r->n(r,"level")/3.0).average().orElse(sensor);
        int demand=n(b,"waiting")+relevantEvents.stream().mapToInt(e->n(e,"demand")).sum();
        int free=Math.max(0,n(b,"seats")+n(b,"standing_capacity")-n(b,"seated")-n(b,"standing"));
        int unmet=Math.max(0,demand-free-n(b,"following_free"));
        return map("seat_percent",round(100.0*n(b,"seated")/n(b,"seats")),"standing_percent",round(100.0*n(b,"standing")/n(b,"standing_capacity")),
            "occupancy",round(100*(sensor*.8+crowd*.2)),"eta",round((n(b,"base_eta")+n(b,"previous_travel"))/2.0+delay),
            "delay",delay,"demand",demand,"unmet",unmet,"recommendation",unmet>10&&n(b,"following_eta")>8?"Rezerv avtobus qiymətləndirilsin":"Mövcud xidmət izlənilsin",
            "reason",String.format("Gözlənilən tələb: %d; boş tutum: %d; sonrakı avtobus: %d dəq / %d boş yer. Qarşılanmayan tələb: %d.",demand,free,n(b,"following_eta"),n(b,"following_free"),unmet),
            "confidence","orta","model","İzah edilən qayda modeli","reports",relevant.size());
    }
}
