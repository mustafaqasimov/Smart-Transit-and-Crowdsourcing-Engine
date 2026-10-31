package az.yolbaku;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;

@Repository
public class Store {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    public Store(JdbcTemplate jdbc, ObjectMapper mapper) { this.jdbc=jdbc; this.mapper=mapper; }
    public static Map<String,Object> map(Object... values) {
        var result=new LinkedHashMap<String,Object>();
        for(int i=0;i<values.length;i+=2) result.put((String)values[i],values[i+1]);
        return result;
    }
    public void initialize() {
        jdbc.execute("CREATE TABLE IF NOT EXISTS records (id SERIAL PRIMARY KEY, kind VARCHAR NOT NULL, data JSON NOT NULL)");
        jdbc.execute("CREATE INDEX IF NOT EXISTS ix_records_kind ON records(kind)");
    }
    public void health() { jdbc.queryForObject("SELECT 1",Integer.class); }
    private Map<String,Object> decode(String json, int id) {
        try { Map<String,Object> r=mapper.readValue(json,new TypeReference<>(){}); r.put("id",id); return r; }
        catch(Exception e) { throw new IllegalStateException("Invalid stored record",e); }
    }
    private String encode(Map<String,Object> data) {
        try { var copy=new LinkedHashMap<>(data); copy.remove("id"); return mapper.writeValueAsString(copy); }
        catch(Exception e) { throw new IllegalStateException("Cannot serialize record",e); }
    }
    public List<Map<String,Object>> list(String kind) {
        return jdbc.query("SELECT id,data FROM records WHERE kind=? ORDER BY id",(rs,n)->decode(rs.getString("data"),rs.getInt("id")),kind);
    }
    public Map<String,Object> get(int id,String kind) {
        return list(kind).stream().filter(r->((Number)r.get("id")).intValue()==id).findFirst()
            .orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Tapılmadı"));
    }
    public Map<String,Object> add(String kind,Map<String,Object> data) {
        Integer id=jdbc.queryForObject("INSERT INTO records(kind,data) VALUES (?,CAST(? AS JSON)) RETURNING id",Integer.class,kind,encode(data));
        return get(id,kind);
    }
    public void update(String kind,Map<String,Object> data) {
        jdbc.update("UPDATE records SET data=CAST(? AS JSON) WHERE id=? AND kind=?",encode(data),data.get("id"),kind);
    }
}
