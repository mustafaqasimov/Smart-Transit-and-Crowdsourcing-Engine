# QA nəticələri — 31 oktyabr 2026

- Docker multi-stage build: keçdi.
- PostgreSQL 16 və FastAPI konteynerləri: healthy.
- Unit testlər: 5/5 keçdi.
- PostgreSQL REST inteqrasiya testləri: 6/6 keçdi.
- Chromium brauzer testləri: 2/2 keçdi (desktop STOP/report/operator təsdiqi və 390px mobil marşrut axtarışı).
- Frontend production build: keçdi.
- Bir upstream Starlette/AnyIO deprecation warning var; testlərə mane olmur.

Brauzer testlərini təkrarlamaq:
```bash
cd frontend
npm ci
# Sistem Chromium varsa:
CHROMIUM_PATH=/usr/bin/chromium npm test
# Yoxdursa: npx playwright install chromium; npm test
```
Browser testləri yerli demo instansiyasına bir report və STOP sorğusu əlavə edir. Backend integration testləri ayrıca transit_test bazasını istifadə edir.

Xarici xəritə plitələri bu mühitdə yüklənmədiyi üçün vizual xəritə fonu təsdiqlənməyib. Markerlər və xəritə idarəetmələri render olunur. Şəbəkə qaralamasına tile və font domenləri əlavə edilib, aktivləşdirilməsi istifadəçinin environment settings save/publish addımıdır.
YOLO adapteri, real GPS, fiziki STOP, real trafik provayderi, yük testi və real dünya proqnoz dəqiqliyi yoxlanılmayıb. Test keçməsi bu inteqrasiyaların mövcudluğu demək deyil.
