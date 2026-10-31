package az.yolbaku;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.server.ResponseStatusException;
import static az.yolbaku.Store.map;

@RestControllerAdvice
public class Errors {
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<?> status(ResponseStatusException e) { return ResponseEntity.status(e.getStatusCode()).body(map("detail",e.getReason())); }
    @ExceptionHandler({MethodArgumentNotValidException.class,HttpMessageNotReadableException.class})
    public ResponseEntity<?> invalid(Exception e) { return ResponseEntity.unprocessableEntity().body(map("detail","Məlumatları yoxlayın")); }
}
