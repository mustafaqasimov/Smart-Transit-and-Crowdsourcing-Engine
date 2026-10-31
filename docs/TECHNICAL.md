# Texniki izah və AI istifadəsi

## Problem və həll
Sərnişin gəliş və tutum qeyri-müəyyənliyini görür; operator crowdsourcing və telemetriyanı birləşdirib xidmət tədbirini qeyd edir. UI iki rol üçün fərqli qərar məlumatı verir. mygov tipli təmiz portal görünüşündən ilham alınıb; mygov kodu, loqosu və rəsmi kimliyi istifadə edilməyib.

## Arxitektura
React/Leaflet → eyni origin Spring Boot REST → Spring JDBC → PostgreSQL.
Docker multi-stage build UI-nı statik fayla çevirir; Spring Boot həm UI, həm API təqdim edir. Database Docker volume-da qalır. API JSON obyektlərini növ indeksli records cədvəlində saxlayır: bus, report, session, stop, event, action. Bu vaxt məhdudiyyətli prototip seçimidir; böyük miqyas üçün normallaşdırılmış cədvəllər/migrasiyalar lazımdır.

5 saniyəlik polling istifadə edilir. WebSocket tətbiq edilməyib. Hadisələr operator tərəfindən bağlananadək aktivdir. Sıxlıq bildirişləri 10 dəqiqədən sonra hesablamadan çıxır. Fiziki sensor sayları ayrı, birləşdirilmiş crowdsourcing göstəricisi ayrı saxlanır.

ETA = (cari baza vaxtı + əvvəlki avtobusun keçid vaxtı)/2 + aktiv hadisələrin gecikməsi. Yol hadisələrinin gecikmələri toplanır; korrelyasiyalı hadisələrin ikiqat təsiri gələcək modeldə həll edilməlidir.
Qarşılanmayan tələb = max(0, gözləyən + hadisə tələbi − cari boş tutum − növbəti avtobusun boş tutumu). Növbəti avtobus >8 dəq uzaqdadırsa və qarşılanmayan tələb >10-dursa rezervin qiymətləndirilməsi tövsiyə edilir. Bu heuristikadır; yaxın vaxtlı tələb üçün tam simulyasiya deyil.

## Hazır modullar və referanslar
- Spring Boot: https://github.com/spring-projects/spring-boot — Java 21 REST, validation və embedded server.
- springdoc-openapi: https://github.com/springdoc/springdoc-openapi — Swagger/OpenAPI.
- Spring JDBC — parametrli SQL və PostgreSQL persistence.
- React: https://github.com/facebook/react — UI komponentləri.
- Leaflet / React Leaflet: https://github.com/Leaflet/Leaflet və https://github.com/PaulLeCam/react-leaflet — xəritə.
- Lucide: https://github.com/lucide-icons/lucide — ikonlar.
- Ultralytics: https://github.com/ultralytics/ultralytics — optional YOLO/ByteTrack; onun lisenziya şərtləri ayrıca tətbiq olunur.
- SahYatri: https://github.com/AmanVerma1067/SahYatri, baxılan commit 9e2e69f55f325bb2f2938d6c0eadf8fad9875c2d — kamera→API→panel arxitektura referansı. Kod birbaşa köçürülməyib; baxılan detection faylında `_name_` səhvi var.

## AI bəyannaməsi
OpenAI Codex ideyanın texniki hissələrə bölünməsi, backend/frontend kodunun hazırlanması, Docker konfiqurasiyası, testlər və sənədləşmə üçün istifadə edilib. AI çıxışları build və avtomatlaşdırılmış testlərlə yoxlanılır. Məhsulun qərar modeli qayda əsaslıdır, təlim keçmiş AI modeli kimi təqdim edilmir. Optional YOLO adapteri əsas test nəticələrinə daxil deyil. Real dünya dəqiqlik göstəriciləri ölçülməyib.

## Təqdim ediləcək materiallar
Mənbə kodu, README işəsalma təlimatı, bu arxitektura/AI bəyannaməsi və QA nəticələri birlikdə təqdim edilə bilər. E-poçt göndərilməyib; bu sənəd təşkilatçılara göndərmək üçün materialdır.

## Java migration
Python backend Java 21/Spring Boot-a keçirilib. Eyni records cədvəli və JSON məlumatları saxlanılır, mövcud database silinmir. REST payload adları və status kodları UI ilə uyğundur. Bean Validation 422 xətaları, operator açarı 403 cavabı verir. JUnit/MockMvc testləri real PostgreSQL bazasında tranzaksiya rollback ilə işləyir. Sıxlıq limitləri və STOP idempotency bir Java instansiyası daxilində sinxronlaşdırılır; çox instansiyalı production üçün DB constraint/distributed limit lazımdır.
