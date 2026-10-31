package az.yolbaku;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import java.io.*;
import static az.yolbaku.Store.map;

@RestController @RequestMapping("/api/vision")
public class VisionApi {
    static final long MAX_IMAGE=8L*1024*1024, MAX_VIDEO=50L*1024*1024;
    private static final String IMAGE_ERROR="Şəkil oxunmadı. JPEG/PNG/WebP, maksimum 8 MB istifadə edin.";
    private static final String VIDEO_ERROR="Video oxunmadı. MP4/WebM/MOV, maksimum 50 MB istifadə edin.";
    private final Store store;private final DemoAccess access;private final ObjectMapper mapper;private final String url;
    private final HttpClient client=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    public VisionApi(Store store,DemoAccess access,ObjectMapper mapper,@Value("${VISION_URL:http://vision:8001}") String url){this.store=store;this.access=access;this.mapper=mapper;this.url=url;}
    private byte[] call(String path,byte[] body,String type,String invalid,int timeout) {
        try {
            var builder=HttpRequest.newBuilder(URI.create(url+path)).timeout(Duration.ofSeconds(timeout));
            if(body==null) builder.GET();else builder.header("Content-Type",type).POST(HttpRequest.BodyPublishers.ofByteArray(body));
            var response=client.send(builder.build(),HttpResponse.BodyHandlers.ofByteArray());
            if(response.statusCode()==413||response.statusCode()==422) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,invalid);
            if(response.statusCode()!=200) throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,"YOLO sorğusu tamamlanmadı");
            return response.body();
        } catch(InterruptedException e){Thread.currentThread().interrupt();throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"YOLO sorğusu dayandırıldı");}
        catch(HttpTimeoutException e){throw new ResponseStatusException(HttpStatus.GATEWAY_TIMEOUT,"YOLO analizi çox uzun çəkdi. Daha qısa video sınayın.");}
        catch(IOException e){throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"YOLO xidməti hazır deyil. Bir az sonra yenidən sınayın.");}
    }
    private byte[] multipart(MultipartFile file,boolean video) throws IOException {
        if(file.isEmpty()||file.getSize()>(video?MAX_VIDEO:MAX_IMAGE))
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,video?"Video 1 bayt–50 MB olmalıdır":"Şəkil 1 bayt–8 MB olmalıdır");
        String boundary="Transit"+UUID.randomUUID();var body=new ByteArrayOutputStream();
        body.write(("--"+boundary+"\r\nContent-Disposition: form-data; name=\"file\"; filename=\""+(video?"video.bin":"image.jpg")+"\"\r\nContent-Type: application/octet-stream\r\n\r\n").getBytes(StandardCharsets.UTF_8));
        body.write(file.getBytes());body.write(("\r\n--"+boundary+"--\r\n").getBytes(StandardCharsets.UTF_8));
        return call(video?"/detect-video":"/detect",body.toByteArray(),"multipart/form-data; boundary="+boundary,video?VIDEO_ERROR:IMAGE_ERROR,video?240:90);
    }
    /** Stores detection metadata only; per-frame boxes of a video are returned to the caller but not persisted. */
    private Object save(int bus,byte[] response) {
        try {
            Map<String,Object> data=mapper.readValue(response,new TypeReference<>(){});
            var record=new LinkedHashMap<>(data);
            if(record.get("frames") instanceof List<?> frames) record.put("frames",frames.stream().map(f->map("t",((Map<?,?>)f).get("t"),"people",((Map<?,?>)f).get("people"))).toList());
            record.putAll(map("bus_id",bus,"created_at",Instant.now().toString()));
            var saved=store.add("vision",record);
            data.putAll(map("id",saved.get("id"),"bus_id",bus,"created_at",saved.get("created_at")));
            return data;
        }catch(IOException e){throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,"YOLO cavabı oxunmadı");}
    }
    @GetMapping("/health") public Object health()throws IOException{return mapper.readValue(call("/health",null,null,IMAGE_ERROR,10),Map.class);}
    @GetMapping(value="/sample",produces="image/jpeg") public byte[] sample(){return call("/sample",null,null,IMAGE_ERROR,30);}
    @GetMapping(value="/sample-video",produces="video/webm") public byte[] sampleVideo(){return call("/sample-video",null,null,VIDEO_ERROR,30);}
    @GetMapping("/latest/{bus}") public Object latest(@PathVariable int bus) {
        store.get(bus,"bus");return store.list("vision").stream().filter(v->((Number)v.get("bus_id")).intValue()==bus).reduce((a,b)->b).orElse(map("source","simulation","detections",List.of(),"visible_people",0));
    }
    @PostMapping("/demo") public Object demo(@RequestParam int bus_id,HttpServletRequest request){access.operator(request);store.get(bus_id,"bus");return save(bus_id,call("/demo",new byte[0],"application/json",IMAGE_ERROR,90));}
    @PostMapping("/demo-video") public Object demoVideo(@RequestParam int bus_id,HttpServletRequest request){access.operator(request);store.get(bus_id,"bus");return save(bus_id,call("/demo-video",new byte[0],"application/json",VIDEO_ERROR,240));}
    @PostMapping(value="/detect",consumes="multipart/form-data") public Object detect(@RequestParam int bus_id,@RequestParam("file") MultipartFile file,HttpServletRequest request)throws IOException {
        access.operator(request);store.get(bus_id,"bus");
        return save(bus_id,multipart(file,false));
    }
    @PostMapping(value="/video",consumes="multipart/form-data") public Object video(@RequestParam int bus_id,@RequestParam("file") MultipartFile file,HttpServletRequest request)throws IOException {
        access.operator(request);store.get(bus_id,"bus");
        return save(bus_id,multipart(file,true));
    }
}
