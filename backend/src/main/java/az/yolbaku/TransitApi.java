package az.yolbaku;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;
import static az.yolbaku.Store.map;

@RestController @RequestMapping("/api")
public class TransitApi {
    public record Scenario(@NotNull @Pattern(regexp="[A-Z0-9]{1,4}") String route,@NotBlank @Size(max=40) String stop_id,@Pattern(regexp="f|b") String dir,
        @NotNull @Min(5) @Max(60) Integer horizon,@NotNull @DecimalMin("0.5") @DecimalMax("3.0") Double demand_multiplier,
        @NotNull @Min(0) @Max(30) Integer delay) {}
    public record Apply(@NotNull @Pattern(regexp="reserve|priority|rebalance") String policy) {}
    private final RouteCatalog catalog;private final FleetService fleet;private final TwinService twin;private final DemoAccess access;
    public TransitApi(RouteCatalog catalog,FleetService fleet,TwinService twin,DemoAccess access){this.catalog=catalog;this.fleet=fleet;this.twin=twin;this.access=access;}
    @GetMapping("/routes") public Object routes(){return map("routes",catalog.all(),"stops",catalog.stops(),"mode","simulation");}
    @GetMapping("/fleet") public Object fleet(@RequestParam(defaultValue="125") String route,@RequestParam(required=false) String stop,@RequestParam(defaultValue="f") String dir){return fleet.network(route,stop,dir);}
    @GetMapping("/journeys") public Object journeys(@RequestParam String from,@RequestParam String to){return fleet.journeys(from,to);}
    @PostMapping("/twin/preview") public Object preview(@Valid @RequestBody Scenario p,HttpServletRequest request){access.operator(request);return twin.preview(p);}
    @PostMapping("/twin/{id}/apply") public Object apply(@PathVariable int id,@Valid @RequestBody Apply p,HttpServletRequest request){access.operator(request);return twin.apply(id,p.policy());}
}
