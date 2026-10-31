package az.yolbaku;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static az.yolbaku.Store.map;
import static az.yolbaku.DecisionEngine.n;
class TwinEngineTest {
    List<Map<String,Object>> fleet=List.of(map("eta",8,"free",5),map("eta",14,"free",40));
    @Test void reserveServesMoreAndReducesQueueTime(){
        var before=TwinEngine.project(fleet,90,3,20,0,"none");var after=TwinEngine.project(fleet,90,3,20,0,"reserve");
        assertTrue(n(after,"unmet")<n(before,"unmet"));assertTrue(((Number)after.get("average_wait")).doubleValue()<((Number)before.get("average_wait")).doubleValue());
        assertEquals(n(after,"total_demand"),n(after,"served")+n(after,"unmet"));
    }
    @Test void rebalancingConservesCapacity(){
        var before=TwinEngine.project(fleet,200,0,20,0,"none");var after=TwinEngine.project(fleet,200,0,20,0,"rebalance");
        assertEquals(before.get("served"),after.get("served"));assertEquals(before.get("unmet"),after.get("unmet"));
    }
    @Test void horizonExcludesLateBus(){assertEquals(0,n(TwinEngine.project(fleet,100,0,5,0,"none"),"served"));}
    @Test void neverBoardsMoreThanDemand(){var r=TwinEngine.project(fleet,1,0,20,0,"reserve");assertEquals(1,n(r,"served"));assertEquals(0,n(r,"unmet"));}
    @Test void delayCannotImproveBaseline(){var a=TwinEngine.project(fleet,100,2,20,0,"none");var b=TwinEngine.project(fleet,100,2,20,15,"none");assertTrue(n(b,"unmet")>=n(a,"unmet"));}
}
