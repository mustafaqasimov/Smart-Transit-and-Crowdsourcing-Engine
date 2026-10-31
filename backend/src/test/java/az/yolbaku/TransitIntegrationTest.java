package az.yolbaku;
import com.fasterxml.jackson.databind.*;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties={"DEMO_ACCESS_ENABLED=true","OPERATOR_KEY=integration-only-key"})
@AutoConfigureMockMvc @Transactional
@EnabledIfEnvironmentVariable(named="DATABASE_URL",matches=".*transit_test$")
class TransitIntegrationTest {
    @Autowired MockMvc mvc;@Autowired ObjectMapper mapper;
    String scenario="{\"route\":\"125\",\"stop_id\":\"28may\",\"horizon\":20,\"demand_multiplier\":1.5,\"delay\":3}";
    JsonNode json(org.springframework.test.web.servlet.ResultActions r)throws Exception{return mapper.readTree(r.andReturn().getResponse().getContentAsString());}
    Cookie login(String role)throws Exception{
        var r=mvc.perform(post("/api/access").contentType("application/json").content("{\"role\":\""+role+"\"}")).andExpect(status().isOk()).andReturn().getResponse();
        String header=r.getHeader("Set-Cookie");assertTrue(header.contains("HttpOnly"));assertTrue(header.contains("SameSite=Strict"));return new Cookie("transit_demo",header.split(";",2)[0].split("=",2)[1]);
    }
    int preview(Cookie c)throws Exception{return json(mvc.perform(post("/api/twin/preview").cookie(c).contentType("application/json").content(scenario)).andExpect(status().isOk())).get("id").asInt();}
    void apply(Cookie c,int id,String policy,int status)throws Exception{mvc.perform(post("/api/twin/"+id+"/apply").cookie(c).contentType("application/json").content("{\"policy\":\""+policy+"\"}")).andExpect(status().is(status));}
    @Test void roleAccessAndLogout()throws Exception{
        mvc.perform(get("/api/access")).andExpect(jsonPath("$.role").value("guest"));
        mvc.perform(post("/api/twin/preview").cookie(login("passenger")).contentType("application/json").content(scenario)).andExpect(status().isForbidden());
        Cookie op=login("operator");mvc.perform(get("/api/operator").cookie(op)).andExpect(status().isOk());
        mvc.perform(delete("/api/access").cookie(op)).andExpect(status().isOk());mvc.perform(get("/api/operator").cookie(op)).andExpect(status().isForbidden());
    }
    @Test void operatorKeyWorksForTwinWithoutDemoCookie()throws Exception{
        mvc.perform(post("/api/twin/preview").header("X-Operator-Key","integration-only-key").contentType("application/json").content(scenario)).andExpect(status().isOk());
        mvc.perform(post("/api/twin/preview").header("X-Operator-Key","wrong").contentType("application/json").content(scenario)).andExpect(status().isForbidden());
    }
    @Test void guestCannotJoinOrReport()throws Exception{
        int bus=json(mvc.perform(get("/api/fleet"))).get("buses").get(0).get("id").asInt();
        mvc.perform(post("/api/reports").contentType("application/json").content("{\"bus_id\":"+bus+",\"client_id\":\"guest-device\",\"level\":2}")).andExpect(status().isForbidden());
        mvc.perform(post("/api/join").contentType("application/json").content("{\"bus_id\":"+bus+",\"client_id\":\"guest-device\"}")).andExpect(status().isForbidden());
    }
    @Test void fleetAndJourneysInBothDirectionsAndWithTransfer()throws Exception{
        var r=json(mvc.perform(get("/api/fleet").param("route","125").param("stop","28may")).andExpect(status().isOk()));
        assertEquals(4,r.get("buses").size());int eta=0;for(var b:r.get("buses")){assertTrue(b.get("eta").asInt()>=eta);eta=b.get("eta").asInt();assertTrue(b.get("occupancy").asInt()<=100);}
        var forward=json(mvc.perform(get("/api/journeys").param("from","28may").param("to","ag"))).get("journeys");
        assertTrue(forward.findValuesAsText("id").contains("125"));
        var back=json(mvc.perform(get("/api/journeys").param("from","ag").param("to","28may"))).get("journeys");
        assertTrue(back.size()>0);assertEquals("b",back.get(0).get("legs").get(0).get("dir").asText());
        var transfer=json(mvc.perform(get("/api/journeys").param("from","avtovagzal").param("to","aslanov"))).get("journeys");
        assertTrue(transfer.size()>0);assertEquals(1,transfer.get(0).get("transfers").asInt());assertEquals(2,transfer.get(0).get("legs").size());
        var j=transfer.get(0);assertEquals(j.get("first_eta").asInt()+j.get("trip_minutes").asInt()+j.get("wait_minutes").asInt(),j.get("total_minutes").asInt());
        mvc.perform(get("/api/journeys").param("from","nowhere").param("to","ag")).andExpect(status().isUnprocessableEntity());
        mvc.perform(get("/api/journeys").param("from","ag").param("to","ag")).andExpect(status().isUnprocessableEntity());
        mvc.perform(get("/api/fleet").param("route","125").param("stop","elmler")).andExpect(status().isUnprocessableEntity());
    }
    @Test void crowdReportsChangeDisplayedOccupancy()throws Exception{
        var cookie=login("passenger");
        JsonNode busy=null;for(var b:json(mvc.perform(get("/api/fleet").param("route","125"))).get("buses")) if(busy==null||b.get("occupancy").asInt()>busy.get("occupancy").asInt()) busy=b;
        int id=busy.get("id").asInt(), before=busy.get("occupancy").asInt();
        mvc.perform(post("/api/reports").cookie(cookie).contentType("application/json").content("{\"bus_id\":"+id+",\"client_id\":\"crowd-test\",\"level\":0}")).andExpect(status().isCreated());
        int empty=occupancy(id);assertTrue(empty<before,"Boş report lowers occupancy");
        mvc.perform(post("/api/reports").cookie(cookie).contentType("application/json").content("{\"bus_id\":"+id+",\"client_id\":\"crowd-test\",\"level\":3}")).andExpect(status().isOk());
        assertTrue(occupancy(id)>empty,"Çox dolu report raises occupancy");
        for(var b:json(mvc.perform(get("/api/fleet").param("route","125"))).get("buses")) if(b.get("id").asInt()==id) assertEquals(1,b.get("crowd").get("reports").asInt());
    }
    int occupancy(int id)throws Exception{
        for(var b:json(mvc.perform(get("/api/fleet").param("route","125"))).get("buses")) if(b.get("id").asInt()==id) return b.get("occupancy").asInt();
        throw new AssertionError("bus missing");
    }
    @Test void previewIsReadOnlyAndApplyIdempotent()throws Exception{
        var cookie=login("operator");int id=preview(cookie);
        mvc.perform(get("/api/fleet")).andExpect(jsonPath("$.buses.length()").value(4));
        for(int i=0;i<2;i++)mvc.perform(post("/api/twin/"+id+"/apply").cookie(cookie).contentType("application/json").content("{\"policy\":\"reserve\"}")).andExpect(status().isOk()).andExpect(jsonPath("$.applied").value(true));
        var buses=json(mvc.perform(get("/api/fleet"))).get("buses");assertEquals(5,buses.size());
        assertTrue(buses.findValuesAsText("vehicle").contains("RS-"+id));
        apply(cookie,id,"priority",409);
    }
    @Test void priorityIsBoundedAndExpires()throws Exception{
        var c=login("operator");
        for(int i=0;i<3;i++) apply(c,preview(c),"priority",200);
        var state=json(mvc.perform(get("/api/fleet").param("route","125"))).get("state");
        assertTrue(state.get("priority_active").asBoolean());assertTrue(state.get("priority_minutes_left").asInt()<=15);
        assertFalse(state.has("priority"));
    }
    @Test void rejectsStaleScenariosAndInvalidPolicy()throws Exception{
        var c=login("operator");int a=preview(c),b=preview(c);
        apply(c,a,"priority",200);apply(c,b,"reserve",409);apply(c,b,"anything",422);
        mvc.perform(post("/api/twin/preview").cookie(c).contentType("application/json").content(scenario.replace("1.5","9.0"))).andExpect(status().isUnprocessableEntity());
    }
    @Test void changingEventsInvalidatesPreview()throws Exception{
        var c=login("operator");int id=preview(c);
        mvc.perform(post("/api/events").cookie(c).contentType("application/json").content("{\"title\":\"New demo event\",\"route\":\"125\",\"type\":\"event\",\"delay\":2,\"demand\":5,\"passenger\":\"Test warning\"}")).andExpect(status().isCreated());
        apply(c,id,"reserve",409);
        mvc.perform(get("/api/events")).andExpect(jsonPath("$.events[?(@.title=='New demo event')]").exists());
    }
}
