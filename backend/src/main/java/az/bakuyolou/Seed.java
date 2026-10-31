package az.bakuyolou;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import static az.bakuyolou.Store.map;

@Component
@org.springframework.core.annotation.Order(0)
public class Seed implements ApplicationRunner {
    private final Store store;
    public Seed(Store store) { this.store=store; }
    @Override @Transactional
    public void run(ApplicationArguments args) {
        store.initialize();
        if(!store.list("bus").isEmpty()) return;
        String[] routes={"125","18","65"},names={"28 May → Ağ Şəhər","İçərişəhər → Nərimanov","Elmlər → Gənclik"};
        double[] lat={40.379,40.387,40.397},lng={49.848,49.857,49.831};
        int[] seated={29,20,30},standing={25,8,35};
        for(int i=0;i<3;i++) store.add("bus",map("route",routes[i],"name",names[i],"lat",lat[i],"lng",lng[i],"seats",30,"standing_capacity",50,
            "seated",seated[i],"standing",standing[i],"base_eta",4+i*3,"previous_travel",6+i*2,"following_eta",12,"following_free",8,
            "waiting",35+i*10,"updated_at",Instant.now().toString(),"source","Demo telemetriya"));
        store.add("event",map("title","Konsert çıxışı — tələb artımı","route","125","type","event","delay",3,"demand",45,"verified",true,"active",true,"created_at",Instant.now().toString(),"source","Demo ssenari","passenger","Əlavə vaxt ayırın; dayanacaqlarda sıxlıq gözlənilir."));
        store.add("event",map("title","Yol işi — hərəkət məhdudiyyəti","route","65","type","road","delay",6,"demand",0,"verified",true,"active",true,"created_at",Instant.now().toString(),"source","Demo ssenari","passenger","Daha tez çıxmağı və alternativ marşrutu nəzərdən keçirin."));
    }
}
