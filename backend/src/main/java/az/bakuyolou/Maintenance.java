package az.bakuyolou;

import java.time.*;
import org.slf4j.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Keeps the demo record store small: expired reserve buses and old transient records are removed. */
@Component
public class Maintenance {
    private static final Logger log=LoggerFactory.getLogger(Maintenance.class);
    private final Store store;
    public Maintenance(Store store){this.store=store;}
    @Scheduled(initialDelay=60_000,fixedDelay=300_000)
    public void purge() {
        var now=Instant.now();var day=now.minus(Duration.ofDays(1));
        int removed=store.purge("bus","expires_at",now)+store.purge("scenario","created_at",day)+store.purge("report","created_at",day)
            +store.purge("session","created_at",day)+store.purge("stop","created_at",day)+store.purge("vision","created_at",now.minus(Duration.ofDays(7)))+store.purge("alert","created_at",day);
        if(removed>0) log.info("Removed {} expired demo records",removed);
    }
}
