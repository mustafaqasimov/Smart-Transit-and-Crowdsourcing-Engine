package az.yolbaku;
import org.junit.jupiter.api.Test;
import java.util.*;
import static az.yolbaku.Store.map;
import static org.junit.jupiter.api.Assertions.*;
class DecisionEngineTest {
    Map<String,Object> bus(){ return map("id",1,"route","125","seated",30,"standing",40,"seats",30,"standing_capacity",50,"waiting",65,"following_free",5,"following_eta",15,"base_eta",4,"previous_travel",6); }
    @Test void capacityAndReserve(){var a=DecisionEngine.assess(bus(),List.of(),List.of());assertEquals(100,a.get("seat_percent"));assertEquals(80,a.get("standing_percent"));assertEquals(50,a.get("unmet"));assertTrue(a.get("recommendation").toString().startsWith("Rezerv"));}
    @Test void eventsChangeEta(){var a=DecisionEngine.assess(bus(),List.of(map("route","125","delay",8,"demand",20)),List.of());assertEquals(13,a.get("eta"));assertEquals(85,a.get("demand"));}
    @Test void otherRouteIgnored(){assertEquals(DecisionEngine.assess(bus(),List.of(),List.of()),DecisionEngine.assess(bus(),List.of(map("route","18","delay",99,"demand",99)),List.of()));}
    @Test void followingCapacity(){var b=bus();b.put("following_free",80);assertEquals(0,DecisionEngine.assess(b,List.of(),List.of()).get("unmet"));}
    @Test void crowdInfluenceBounded(){int base=(int)DecisionEngine.assess(bus(),List.of(),List.of()).get("occupancy");int value=(int)DecisionEngine.assess(bus(),List.of(),List.of(map("bus_id",1,"level",0))).get("occupancy");assertTrue(base-value>0&&base-value<=20);}
    @Test void pythonRoundingCompatibility(){assertEquals(8,DecisionEngine.round(7.5));assertEquals(8,DecisionEngine.round(8.5));}
}
