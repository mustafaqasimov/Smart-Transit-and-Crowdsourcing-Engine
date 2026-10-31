package az.bakuyolou;
import org.slf4j.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.bind.*;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.server.ResponseStatusException;
import static az.bakuyolou.Store.map;

/** Every API error is {"detail": "..."} in Azerbaijani. */
@RestControllerAdvice
public class Errors {
    private static final Logger log=LoggerFactory.getLogger(Errors.class);
    @ExceptionHandler(org.springframework.web.multipart.MaxUploadSizeExceededException.class)
    public ResponseEntity<?> uploadTooLarge(Exception e) { return ResponseEntity.status(413).body(map("detail","Fayl çox böyükdür: şəkil maksimum 8 MB, video maksimum 50 MB")); }
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<?> status(ResponseStatusException e) { return ResponseEntity.status(e.getStatusCode()).body(map("detail",e.getReason())); }
    @ExceptionHandler({MethodArgumentNotValidException.class,HttpMessageNotReadableException.class,MissingServletRequestParameterException.class,
        MethodArgumentTypeMismatchException.class,MissingRequestHeaderException.class,org.springframework.web.multipart.support.MissingServletRequestPartException.class})
    public ResponseEntity<?> invalid(Exception e) { return ResponseEntity.unprocessableEntity().body(map("detail","Məlumatları yoxlayın")); }
    @ExceptionHandler(Exception.class)
    public ResponseEntity<?> other(Exception e) {
        if(e instanceof ErrorResponse r) return ResponseEntity.status(r.getStatusCode()).body(map("detail",r.getStatusCode().value()==404?"Tapılmadı":"Sorğu qəbul edilmədi"));
        log.error("Unhandled API error",e);
        return ResponseEntity.internalServerError().body(map("detail","Server xətası. Bir az sonra yenidən sınayın."));
    }
}
