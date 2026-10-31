# YolBaku — gediş planı və nəqliyyatın rəqəmsal əkizi

Digital Azerbaijan Challenge 2026 üçün Azərbaycan dilində işlək demo. React mobil UI, Java 21 / Spring Boot, PostgreSQL, Python YOLO11n CPU xidməti.

## Başlat

Docker Desktop işləməlidir. İlk dəfə `.env.example` faylını `.env` adı ilə kopyalayın və `POSTGRES_PASSWORD`, `OPERATOR_KEY` üçün təsadüfi dəyərlər yazın. Mövcud `.env` faylını dəyişməyin.

```powershell
docker compose up -d --build
```

- Tətbiq: http://localhost:8000
- API sənədləri: http://localhost:8000/docs
- Sağlamlıq: http://localhost:8000/api/health
- YOLO sağlamlığı: http://localhost:8000/api/vision/health

İlk build internetdən Java/Node/Python paketlərini, CPU PyTorch, YOLO çəkilərini və test şəklini endirir; disk və şəbəkədən asılı olaraq bir neçə dəqiqə çəkə bilər. Sonrakı build-lər keşdən istifadə edir. Windows üçün `.gitattributes` shell skriptlərinin LF sətir sonluqlarını qoruyur.

## Giriş və demo

İlk ekran iki seçim verir: **Sərnişin** və **Operator**. Qeydiyyat və parol yoxdur. Compose `DEMO_ACCESS_ENABLED=true` qurur. Rol serverin yaratdığı 4 saatlıq HttpOnly/SameSite cookie ilə saxlanır; səhifəni yeniləmək rolu saxlayır, tətbiq serverinin restartı sessiyanı bitirir.

Bu rol seçimi şəxsiyyət yoxlaması deyil. İctimai istehsal mühitində demo girişini söndürün və ayrıca həqiqi autentifikasiya tətbiq edin. Bütün operator API-ləri (twin və YOLO daxil) cookie olmadan `X-Operator-Key` başlığı ilə `.env`-dəki `OPERATOR_KEY`-i də qəbul edir; demo girişi söndürüləndə inteqrasiyalar bu yolla işləyir. Bu açar frontend-ə ötürülmür. Demo girişi aktiv olanda sərnişin əməliyyatları (reysə qoşulma, bildiriş) rol seçimi tələb edir; girişə IP üzrə dəqiqədə 30 cəhd limiti qoyulub.

### Sərnişin

1. **Gediş planla**: dayanacaqları siyahıdan seçin və ya xəritədə dayanacağa toxunub **Buradan / Buraya** basın. Hər iki istiqamət və bir köçürməli gedişlər təklif olunur (ümumi vaxt, ilk avtobus, köçürmə gözləməsi).
2. 10 demo xətt, 35 dayanacaq, ilk qurulumda 45 avtobus. Xəritədə avtobuslar 🚌 markerlə, doluluq rəngi ilə göstərilir və 4 saniyədə bir hamar hərəkət edir.
3. Gəlişlər seçilmiş dayanacaq və istiqamət üzrə ETA ilə sıralanır.
4. **Boş / Normal / Dolu / Çox dolu** bildirişi 10 dəqiqə ərzində avtobusun göstərilən doluluğunu dərhal dəyişir. Hər istifadəçinin hər avtobus üçün bir aktiv bildirişi var; yeni seçim əvvəlkini əvəz edir.
5. Reysə qoşulun və STOP göndərin; reys səhifə yenilənəndə də qalır.
6. Sol menyu (mobildə alt menyu) səhifəni sürüşdürdükcə aktiv bölməni göstərir.

### Operator / digital twin

1. Xətti, dayanacağı və istiqaməti seçin; tələb əmsalı, əlavə gecikmə və 5–60 dəqiqəlik pəncərə qurun.
2. **Simulyasiyanı hesabla** cari vəziyyətin surətini saxlayır; parkı dəyişmir.
3. Rezerv avtobus (60 dəqiqə xəttdə qalır), siqnal prioriteti (15 dəqiqəlik, təkrar tətbiq yalnız müddəti uzadır) və yük bölgüsünü müqayisə edin.
4. **Demo parkına tətbiq et** seçilmiş həlli parka və qərar jurnalına yazır. 5 dəqiqədən köhnə və ya dəyişmiş parka aid ssenari rədd edilir.
5. Avtobus parkı cədvəli bütün avtobusları, ETA, doluluq və sərnişin bildirişlərini göstərir.
6. YOLO: **Şəkil** (maks. 8 MB) və ya **Video** (MP4/WebM/MOV, maks. 50 MB, ilk 30 saniyə). Video saniyədə ~3 kadr analiz edilir, ByteTrack eyni insanı kadrlar arasında izləyir; çərçivələr video oynadıqca üzərində göstərilir.
7. Sərnişinin STOP sorğusunu təsdiqləyin, demo yol hadisəsi yaradın və bağlayın.

### Tətbiq kimi quraşdırma (PWA)

YolBaku quraşdırıla bilən veb tətbiqdir. Chrome/Edge-də ünvan sətrindəki quraşdır ikonu və ya menyudakı **Tətbiqi quraşdır** düyməsi, Android-də **Ana ekrana əlavə et**, iOS Safari-də **Paylaş → Ana ekrana əlavə et**. Brauzerlər quraşdırmanı yalnız `localhost` və ya HTTPS üzərindən icazə verir; telefondan LAN IP ilə açıldıqda tətbiq işləyir, amma quraşdırma üçün HTTPS lazımdır.

## Məlumatın mənası

Bakı məkan adları və təxmini koordinatlar istifadə edilir. Marşrut nömrələri, dayanacaq ardıcıllığı, GPS hərəkəti, ETA, doluluq və sərnişin tələbi **demo/sintetikdir**; AYNA və ya 2GIS ilə inteqrasiya yoxdur. 2GIS-in ictimai nəqliyyat API-si kommersiya açarı tələb edir və məlumatın açarsız toplanması istifadə şərtlərinə ziddir; açar əldə edilərsə `FleetService`/`RouteCatalog` bir adapterlə əvəz oluna bilər. Xəritə xətləri dayanacaqlar arası düz xətlərdir.

YOLO real inferens edir, amma standart nümunələr avtobusun xaricində çəkilmiş Ultralytics şəklidir (video nümunə həmin şəkil üzərində süni kamera hərəkətidir). Görünən insan sayı salonun ümumi doluluğu deyil. 2D salonda mövqelər sintetikdir. Yüklənən şəkil və videolar saxlanmır; yalnız aşkarlama metadatası PostgreSQL-ə yazılır. Köhnə müvəqqəti qeydlər (rezerv avtobuslar, ssenarilər, bildirişlər) avtomatik təmizlənir.

## Test

```powershell
.\scripts\verify.ps1
```

Backend testləri ayrıca `transit_test` bazasında tranzaksiyaların rollback-i ilə işləyir. Playwright testləri ayrıca `app-qa` konteynerində, hər dəfə yenidən yaradılan `transit_e2e` bazasına qarşı işləyir; demo bazası dəyişmir. Ekran görüntüləri `artifacts/ui/` qovluğundadır.

Linux backend testləri: `./scripts/test.sh`. Yalnız brauzer testləri:

```powershell
docker compose exec -T db createdb -U transit transit_e2e   # bir dəfə
docker compose -f compose.yaml -f compose.qa.yaml run --rm --build ui-test
```

Məlumat `transit_data` volume-da saxlanır. Bazanı qorumaq üçün `docker compose down` istifadə edin; `down -v` bazanı silir.

Arxitektura və model: [docs/TECHNICAL.md](docs/TECHNICAL.md). Test nəticələri: [docs/QA.md](docs/QA.md). AI bəyannaməsi və təqdimat qeydi: [docs/SUBMISSION.txt](docs/SUBMISSION.txt).
