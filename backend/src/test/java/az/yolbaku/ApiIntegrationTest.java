package az.yolbaku;
import com.fasterxml.jackson.databind.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties={"OPERATOR_KEY=integration-only-key"}) @AutoConfigureMockMvc @Transactional
@EnabledIfEnvironmentVariable(named="DATABASE_URL",matches=".*transit_test$")
class ApiIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    String key="integration-only-key";
    JsonNode json(String body)throws Exception{return mapper.readTree(body);}
    int bus()throws Exception{return json(mvc.perform(get("/api/dashboard")).andReturn().getResponse().getContentAsString()).get("buses").get(0).get("id").asInt();}
    int eta()throws Exception{return json(mvc.perform(get("/api/dashboard")).andReturn().getResponse().getContentAsString()).get("buses").get(0).get("analysis").get("eta").asInt();}
    @Test void healthAndSeed()throws Exception{mvc.perform(get("/api/health")).andExpect(status().isOk()).andExpect(jsonPath("$.database").value("postgresql"));mvc.perform(get("/api/dashboard")).andExpect(jsonPath("$.buses.length()").value(3));}
    @Test void authorization()throws Exception{mvc.perform(get("/api/operator")).andExpect(status().isForbidden());mvc.perform(get("/api/operator").header("X-Operator-Key",key)).andExpect(status().isOk());}
    @Test void reportValidationAndLimit()throws Exception{
        String p="{\"bus_id\":"+bus()+",\"client_id\":\"test-device-report\",\"level\":3}";
        mvc.perform(post("/api/reports").contentType("application/json").content(p)).andExpect(status().isCreated());
        mvc.perform(post("/api/reports").contentType("application/json").content(p)).andExpect(status().isTooManyRequests());
        mvc.perform(post("/api/reports").contentType("application/json").content(p.replace("\"level\":3","\"level\":9"))).andExpect(status().isUnprocessableEntity());
        mvc.perform(post("/api/reports").contentType("application/json").content("{}")).andExpect(status().isUnprocessableEntity());
    }
    @Test void stopJoinDedupAck()throws Exception{
        mvc.perform(post("/api/stop").contentType("application/json").content("{\"session_id\":\"bad\"}")).andExpect(status().isForbidden());
        var session=json(mvc.perform(post("/api/join").contentType("application/json").content("{\"bus_id\":"+bus()+",\"client_id\":\"test-stop-device\"}")).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        String token=session.get("token").asText(),p="{\"session_id\":\""+token+"\"}";
        var stop=json(mvc.perform(post("/api/stop").contentType("application/json").content(p)).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        mvc.perform(post("/api/stop").contentType("application/json").content(p)).andExpect(jsonPath("$.id").value(stop.get("id").asInt()));
        mvc.perform(post("/api/stops/"+stop.get("id")+"/ack")).andExpect(status().isForbidden());
        mvc.perform(post("/api/stops/"+stop.get("id")+"/ack").header("X-Operator-Key",key)).andExpect(status().isOk());
        mvc.perform(get("/api/stop-status").param("session_id",token)).andExpect(jsonPath("$[0].status").value("driver_panel_acknowledged"));
        mvc.perform(get("/api/operator").header("X-Operator-Key",key)).andExpect(jsonPath("$.stops[0].session_id").doesNotExist());
    }
    @Test void eventLifecycle()throws Exception{
        int before=eta();String p="{\"title\":\"Test accident\",\"route\":\"125\",\"type\":\"accident\",\"delay\":7,\"demand\":20,\"passenger\":\"Alternativ yolu seçin\"}";
        mvc.perform(post("/api/events").contentType("application/json").content(p)).andExpect(status().isForbidden());
        var e=json(mvc.perform(post("/api/events").header("X-Operator-Key",key).contentType("application/json").content(p)).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        assertEquals(before+7,eta());mvc.perform(post("/api/events/"+e.get("id")+"/close").header("X-Operator-Key",key)).andExpect(status().isOk());assertEquals(before,eta());
    }
    @Test void telemetryAndAction()throws Exception{
        mvc.perform(post("/api/telemetry/"+bus()).header("X-Operator-Key",key).contentType("application/json").content("{\"seated\":12,\"standing\":5,\"waiting\":10,\"lat\":40.38,\"lng\":49.85}")).andExpect(status().isOk());
        mvc.perform(get("/api/dashboard")).andExpect(jsonPath("$.buses[0].analysis.seat_percent").value(40));
        mvc.perform(post("/api/actions").header("X-Operator-Key",key).contentType("application/json").content("{\"bus_id\":"+bus()+",\"action\":\"reserve\"}")).andExpect(status().isCreated());
        mvc.perform(get("/api/operator").header("X-Operator-Key",key)).andExpect(jsonPath("$.actions.length()").value(1));
    }
    @Test void docsAndMissingBus()throws Exception{mvc.perform(get("/v3/api-docs")).andExpect(status().isOk());mvc.perform(post("/api/join").contentType("application/json").content("{\"bus_id\":99999,\"client_id\":\"test-no-bus\"}")).andExpect(status().isNotFound());}
}
