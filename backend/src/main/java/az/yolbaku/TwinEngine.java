package az.yolbaku;

import java.util.*;
import static az.yolbaku.Store.map;
import static az.yolbaku.DecisionEngine.n;

/** Deterministic discrete-minute queue model. No trained ML or optimality claim. */
public final class TwinEngine {
    private TwinEngine() {}
    public static Map<String,Object> project(List<Map<String,Object>> fleet,int initial,int perMinute,int horizon,int delay,String policy) {
        var arrivals=new ArrayList<Map<String,Object>>();
        for(var bus:fleet) arrivals.add(map("eta",Math.max(1,n(bus,"eta")+delay-(policy.equals("priority")?3:0)),"free",n(bus,"free")));
        if(policy.equals("reserve")) arrivals.add(map("eta",4,"free",80));
        // Rebalancing recovers 10 effective boarding spaces at the first arrival,
        // but removes the same space from the last arrival: capacity is conserved.
        arrivals.sort(Comparator.comparingInt(a->n(a,"eta")));
        if(policy.equals("rebalance")&&arrivals.size()>1) {
            var first=arrivals.get(0);var last=arrivals.get(arrivals.size()-1);
            int transfer=Math.min(10,Math.min(n(last,"free"),80-n(first,"free")));
            first.put("free",n(first,"free")+transfer);last.put("free",n(last,"free")-transfer);
        }
        int queue=initial, served=0, personMinutes=0;
        var series=new ArrayList<Map<String,Object>>();
        series.add(map("minute",0,"queue",queue,"served",0));
        for(int minute=1;minute<=horizon;minute++) {
            queue+=perMinute;personMinutes+=queue;
            for(var a:arrivals) if(n(a,"eta")==minute) {int board=Math.min(queue,n(a,"free"));queue-=board;served+=board;}
            series.add(map("minute",minute,"queue",queue,"served",served));
        }
        int total=initial+perMinute*horizon;
        return map("unmet",queue,"served",served,"total_demand",total,"average_wait",Math.round(10.0*personMinutes/Math.max(1,total))/10.0,
            "service_percent",Math.round(100.0*served/Math.max(1,total)),"series",series);
    }
}
