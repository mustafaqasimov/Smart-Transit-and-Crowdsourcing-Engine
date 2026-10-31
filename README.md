# YolBaku — Smart Transit & Crowdsourcing Engine

Azərbaycan dilində işlək sərnişin və operator demo tətbiqi. React + Leaflet UI, FastAPI REST API, PostgreSQL 16, Docker Compose.

## Başlat

```bash
cp .env.example .env
# .env-də POSTGRES_PASSWORD və OPERATOR_KEY üçün təsadüfi dəyərlər yazın.
# PostgreSQL parolunda URL-safe simvollar istifadə edin.
docker compose up -d --build
```

UI: port **8000**. REST sənədləri: **/docs**. Sağlamlıq: **/api/health**.
Operator mərkəzində `.env` faylındakı `OPERATOR_KEY` daxil edilir. Açar brauzer yaddaşında saxlanılmır. Mövcud cloud instansiyasında `.env` artıq yaradılıb; onu əvəz etməyin.

Cloud proxy ilə build:
```bash
docker build --secret id=proxy_ca,src="$CODEX_PROXY_CERT" --secret id=system_ca,src=/etc/ssl/certs/ca-certificates.crt -t smart-transit-and-crowdsourcing-engine-app .
docker compose up -d --no-build
```

## İşləyən imkanlar

- 3 nümunə marşrut, sxematik xəritə, ETA, oturacaq və ayaqüstə doluluğu.
- Sıxlıq bildirişi: 60 saniyə limit, 10 dəqiqəlik aktual pəncərə, çəkili birləşdirmə.
- Demo reysə qoşulma, idempotent STOP sorğusu, operator/sürücü paneli təsdiqi.
- Hadisə yaratma/bağlama, sərnişin xəbərdarlığı, ETA və tələb hesablamasına təsir.
- Telemetriya yeniləmə, əvvəlki avtobusun keçid vaxtı və sonrakı avtobusun tutumu əsasında qərar dəstəyi.
- Qərar jurnalı və sadə rezerv tutum ssenarisi; bütün yazılar PostgreSQL-də saxlanılır.
- Operator yazma əməliyyatları açarla qorunur. API girişləri Pydantic ilə yoxlanılır.

## QA

```bash
./scripts/test.sh
cd frontend && npm ci && npm run build
```
Unit və REST inteqrasiya testləri ayrıca `transit_test` PostgreSQL bazasında işləyir. STOP, giriş nəzarəti, hadisənin ETA-ya təsiri, telemetriya, limitlər və qərarın saxlanılması yoxlanılır.

## Demo təqdimat axını

1. 125 marşrutunun ETA və oturacaq/ayaqüstə doluluğuna baxın.
2. “Dolu” bildirişi göndərin; ümumi göstərici və bildiriş sayı dəyişir.
3. Reysə qoşulun, STOP göndərin; server təsdiqini görün.
4. Operator mərkəzinə keçin, açarı daxil edin və STOP-u təsdiqləyin.
5. Qəza yaradın: gecikmə 7 dəqiqə, əlavə tələb 20. Sərnişin bildirişi və ETA yenilənsin.
6. Tövsiyənin səbəbini oxuyun, rezerv tələbini jurnala yazın.
7. Hadisəni bağlayın; ETA-nın əvvəlki səviyyəyə qayıtmasını göstərin.

## Dürüst məhdudiyyətlər

Bu prototip **demo məlumatı** istifadə edir; Bakı operatorlarının GPS/GTFS, yol hadisələri və fiziki STOP sisteminə qoşulmayıb. Xəritədə xətt real marşrut deyil. Avtobus mövqeləri telemetriya göndərilənədək dəyişmir. Sorğu ilə özünü avtobusda elan etmək fiziki yoxlama deyil. Rate limit cihaz ID-si ilədir, istehsal anti-spam sistemi deyil. STOP bir demo sessiya üçün bir sorğudur; dayanacaq dövrü/QR verifikasiyası gələcək işdir.

Qərar mühərriki öyrədilmiş ML və ya optimal dispetçer sistemi deyil. Kamera demo UI-nı idarə etmir. `vision/count.py` ayrıca, **əsas QA-da yoxlanılmamış** YOLO/ByteTrack adapteridir; real video və model çəkiləri tələb edir. Görünən adam sayı ümumi sərnişin və ya oturacaq doluluğu sayılmır. Kamera kalibrasiyası və etalon video olmadan dəqiqlik iddiası yoxdur.

İstehsal üçün istifadəçi/rol autentifikasiyası, audit, migrasiyalar, real reys/dayanacaq modeli, telemetriya tarixçəsi, etibarlılıq kalibrasiyası və resurs məhdudiyyətli optimallaşdırma əlavə edilməlidir. İnternet olmadıqda xəritə plitələri və xarici şrift yüklənməyə bilər; əsas UI/API işləyir.

QA nəticələri: [docs/QA.md](docs/QA.md).

Arxitektura və AI istifadəsi: [docs/TECHNICAL.md](docs/TECHNICAL.md).
