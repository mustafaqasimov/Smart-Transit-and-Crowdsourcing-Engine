# Yoxlama nəticələri — 31 oktyabr 2026

## Backend

Docker-də Java 21 / Maven, ayrıca PostgreSQL `transit_test` bazası.

**29 test keçdi. 0 failure, 0 error, 0 skipped.**

| Test sinfi | Say | Yoxlanan davranış |
|---|---:|---|
| DecisionEngineTest | 6 | Tutum, rezerv ehtiyacı, hadisə gecikməsi, marşrut sərhədi, crowd siqnalı, yuvarlaqlaşdırma |
| TwinEngineTest | 5 | Rezervin təsiri, yük bölgüsündə tutumun qorunması, gec gəliş, tələb həddi, gecikmə |
| ApiIntegrationTest | 9 | Health/seed (45 avtobus), açar icazəsi, bildirişin əvəzlənməsi və rate limit, STOP (başlıqda token), hadisə dövrü, telemetriya/GPS override, vahid xəta formatı, OpenAPI/404 |
| TransitIntegrationTest | 9 | Rol sessiyası/logout, twin üçün operator açarı, qonaq bildirişinə 403, hər iki istiqamət və köçürməli gediş, bildirişin doluluğu dəyişməsi, idempotent apply, prioritetin yığılmaması, köhnə ssenari və hadisə dəyişikliyi |

DB-yə yazan testlər tranzaksiyalarda rollback edilir. Əsas demo bazası bu testlər üçün istifadə olunmur.

## Brauzer və endpoint axınları

**4 Playwright axın testi keçdi** — Chromium, desktop və mobil 390×844, ayrıca `transit_e2e` bazasında.

1. Mobil: giriş → yenilənmədən sonra rolun qalması → siyahıdan gediş → 🚌 markerlər və gəlişlər → xəritədən dayanacaq seçimi ilə köçürməli gediş → Boş/Çox dolu bildirişinin doluluğu dəyişməsi → reys və STOP → yenilənmədən sonra reysin qalması.
2. Desktop: sol menyunun scroll ilə dəyişməsi və bölmələrə keçid, canlı kart, 10 xətt.
3. Operator: simulyasiya → prioritet tətbiqi və "aktiv" nişanı → park cədvəli → YOLO şəkil (nümunə + yükləmə) → YOLO video (nümunə + yükləmə, çərçivələr, ByteTrack) → mobil layout.
4. API: qonaq mutasiyalarına 403, vahid 422 xətası, etibarsız şəkil/video üçün 422, YOLO health, docs, manifest/service worker/ikon.

UI axınlarında JavaScript səhvləri qeydə alınmadı. Mobil sənədin eni viewport-dan böyük deyil. Ekran görüntüləri ayrıca vizual yoxlanıldı. Bu yoxlama bütün brauzer/cihaz kombinasiyalarını və tam accessibility auditini əvəz etmir.

## YOLO nəticəsi

YOLO26s-pose (cari): `bus.jpg`-də 4 insan — 2 ayaqüstə, 2 bilinmir, 0 oturur (hamısı ayaqüstədir, yanlış “oturur” yoxdur); video nümunəsində 4 fərqli izlənən insan, ~1.5 s. Duruş qaydaları üçün 7 unit test image build-ində keçir.

Əvvəlki ölçü (YOLO11n):

YOLO11n həqiqi CPU inferensi Ultralytics-in `bus.jpg` nümunəsində **4 insan / 4 bounding box** qaytardı. İlk manual çağırış təxminən 3.6 saniyə, isinmiş modelin brauzer nümunəsi təxminən 0.7 saniyə çəkdi; bunlar bu kompüterdə müşahidədir, SLA deyil.

Bu şəkil avtobusun xaricindəndir. Nəticə real salon doluluğunun və ya 2D oturacaq yerləşməsinin doğruluğunu sübut etmir. Video/ByteTrack CLI ayrıca test edilməyib; bu işdə UI-yə bağlı şəkil inferensi test edilib.

## Test zamanı düzəldilən problemlər

- Windows CRLF shell build skriptləri: LF və `.gitattributes` qaydası.
- Spring/Java eyni adlı HttpRequest importu: dəqiq import.
- Docker test host adı `app` brauzerin HTTPS/HSTS davranışına düşürdü: test konteyneri app network namespace-ində `127.0.0.1` istifadə edir.
- Ultralytics-in Pillow patch-i etibarsız şəkil üçün əlavə paket quraşdırmağa cəhd edirdi: orijinal Pillow parseri saxlanır, runtime auto-install söndürülür; 422 düzgün qaytarılır.
- Ssenaridən sonra park/hadisə dəyişikliyi: fingerprint + version + 5 dəqiqəlik limit.
- Siqnal prioriteti hər tətbiqdə +3 yığılırdı (125 xəttində 9-a çatmış, ETA-lar 1 dəqiqəyə düşmüşdü): indi 15 dəqiqəlik, yığılmayan tədbirdir.
- E2E testləri demo bazasını dəyişirdi: ayrıca app-qa + transit_e2e.
- `crypto.randomUUID` HTTP LAN ünvanında yox idi və tətbiq açılmırdı: `getRandomValues` + storage xətalarına dözümlülük.
- CARTO plitələri açar tələb edir: OpenStreetMap plitələrinə qayıdıldı.
- react-leaflet `pathOptions.className` tətbiq etmir: className komponent prop-u kimi verilir.
- Səhifə yenilənəndə aktiv reysin marşrutu itirdi: reys sessiyası marşrut/dayanacaq/istiqamətlə saxlanır.

## Təkrarlama

```powershell
docker compose up -d --build
.\scripts\verify.ps1
```

Brauzer testləri ayrıca `app-qa` konteynerində və hər dəfə yenidən yaradılan `transit_e2e` bazasında işləyir; demo bazası dəyişmir. Backend testləri `transit_test` bazasında rollback ilə işləyir.

Detallı loglar lokal `backend-test.log` və `ui-test.log` fayllarındadır (Git-də ignore edilir). Screenshot-lar `artifacts/ui/` altındadır. Xəritə plitələri və fontlar xarici şəbəkədən asılıdır; tile endirilmə sürəti UI ekran görüntüsündə fərqlənə bilər.
