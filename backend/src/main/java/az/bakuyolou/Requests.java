package az.bakuyolou;
import jakarta.validation.constraints.*;

public final class Requests {
    public record Report(@NotNull @Positive Integer bus_id,@NotNull @Min(0) @Max(3) Integer level,@NotNull @Size(min=8,max=80) String client_id) {}
    public record Join(@NotNull @Positive Integer bus_id,@NotNull @Size(min=8,max=80) String client_id) {}
    public record Stop(@NotBlank @Size(max=200) String session_id) {}
    public record Event(@NotNull @Size(min=3,max=160) String title,@NotNull @Pattern(regexp="[A-Z0-9]{1,4}") String route,
        @NotNull @Pattern(regexp="event|accident|road") String type,@NotNull @Min(0) @Max(120) Integer delay,
        @NotNull @Min(0) @Max(500) Integer demand,@NotNull @Size(min=3,max=300) String passenger) {}
    public record Telemetry(@NotNull @Min(0) @Max(30) Integer seated,@NotNull @Min(0) @Max(50) Integer standing,
        @NotNull @Min(0) @Max(500) Integer waiting,@NotNull @DecimalMin("39") @DecimalMax("42") Double lat,
        @NotNull @DecimalMin("48") @DecimalMax("51") Double lng) {}
    public record Action(@NotNull @Positive Integer bus_id,@NotNull @Pattern(regexp="review|reserve|monitor") String action) {}
}
