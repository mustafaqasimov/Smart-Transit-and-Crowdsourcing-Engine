import {test,expect} from '@playwright/test';

const tilesLoaded=page=>page.waitForFunction(()=>Array.from(document.querySelectorAll('img.leaflet-tile')).every(i=>i.complete),{},{timeout:10000}).catch(()=>{});
const noOverflow=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
/** Opens a stop popup on the map; dispatched so a bus pin passing over the stop cannot swallow the click. */
async function pickStop(page,id,button){
  const stop=page.locator(`path.stop-${id}`),box=await stop.boundingBox();
  await stop.dispatchEvent('click',{clientX:box.x+box.width/2,clientY:box.y+box.height/2});
  await page.locator('.leaflet-popup').getByRole('button',{name:button,exact:true}).click();
  await expect(page.locator('.leaflet-popup')).toHaveCount(0);
}

test('mobile passenger: login, planner by select and by map, crowd report changes data, STOP',async({page},testInfo)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:390,height:844});await page.goto('/');
  await expect(page.getByRole('button',{name:/Sərnişin kimi daxil ol/})).toBeVisible();
  await page.screenshot({path:testInfo.outputPath('login-mobile.png'),fullPage:true});
  await page.getByRole('button',{name:/Sərnişin kimi daxil ol/}).click();
  await expect(page.getByRole('heading',{name:'Hər gedişin daha rahat olsun.'})).toBeVisible();
  await page.reload();await expect(page.getByRole('heading',{name:'Hər gedişin daha rahat olsun.'})).toBeVisible();

  await page.getByLabel('Haradan',{exact:true}).selectOption('28may');await page.getByLabel('Haraya',{exact:true}).selectOption('ag');
  await page.getByRole('button',{name:'Gediş tap',exact:true}).click();
  await expect(page.locator('.journey-card').first()).toBeVisible();
  await expect(page.locator('.journey-card.selected')).toHaveCount(1);
  const pins=await page.locator('.bus-pin').count();expect(pins).toBeGreaterThanOrEqual(3);
  await expect(page.locator('.arrival-card')).toHaveCount(pins);
  await expect(page.locator('.bus-emoji').first()).toHaveText('🚌');

  // Choosing on the map: Avtovağzal → Həzi Aslanov has no direct line, so a transfer is offered.
  await pickStop(page,'avtovagzal','Buradan');
  await pickStop(page,'aslanov','Buraya');
  await expect(page.getByLabel('Haradan',{exact:true})).toHaveValue('avtovagzal');
  await expect(page.getByLabel('Haraya',{exact:true})).toHaveValue('aslanov');
  await expect(page.locator('.journey-card .transfer-tag').first()).toContainText('Köçürmə');

  const occupancy=async()=>Number((await page.locator('.ride-detail .section-title .occupancy').innerText()).match(/\d+/)[0]);
  await page.getByRole('button',{name:'Boş',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Bildirişiniz qeydə alındı: Boş');
  await expect(page.getByRole('button',{name:'Boş',exact:true})).toHaveAttribute('aria-pressed','true');
  const empty=await occupancy();
  await page.getByLabel('Bildirişi bağla').click();
  await page.getByRole('button',{name:'Çox dolu',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Çox dolu');
  await expect.poll(occupancy).toBeGreaterThan(empty);
  await expect(page.locator('.crowd-head')).toContainText('1 bildiriş');
  await page.getByLabel('Bildirişi bağla').click();

  await page.getByRole('button',{name:/Reysə qoşul/}).click();
  await page.getByRole('button',{name:'STOP · Növbəti dayanacaq',exact:true}).click();
  await expect(page.getByRole('button',{name:'STOP serverə çatdı'})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button',{name:'STOP serverə çatdı'})).toBeVisible();

  await page.evaluate(()=>window.scrollTo(0,0));await tilesLoaded(page);
  await page.screenshot({path:testInfo.outputPath('passenger-mobile.png'),fullPage:true});
  expect(await noOverflow(page)).toBeTruthy();
  expect(errors).toEqual([]);
});

test('desktop passenger: sidebar follows scrolling and nav jumps to sections',async({page},testInfo)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1440,height:900});await page.goto('/');
  await page.getByRole('button',{name:/Sərnişin kimi daxil ol/}).click();
  const current=page.locator('.sidebar [aria-current="location"]');
  await expect(current).toHaveText('Gediş planla');
  await page.locator('.sidebar').getByRole('button',{name:'Mənim reysim'}).click();
  await expect(current).toHaveText('Mənim reysim');
  await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
  await expect(current).toHaveText('Bütün xətlər');
  await page.evaluate(()=>window.scrollTo(0,0));
  await expect(current).toHaveText('Gediş planla');
  await expect(page.locator('.live-card')).toContainText('avtobus');
  await expect(page.locator('.route-tabs button')).toHaveCount(10);
  await tilesLoaded(page);
  await page.screenshot({path:testInfo.outputPath('passenger-desktop.png'),fullPage:true});
  expect(errors).toEqual([]);
});

test('operator: twin preview and apply, fleet table, YOLO image and video',async({page},testInfo)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1440,height:1000});await page.goto('/');
  await page.getByRole('button',{name:/Operator kimi daxil ol/}).click();
  await expect(page.getByRole('heading',{name:'Qərardan əvvəl, nəticəni gör.'})).toBeVisible();
  await page.getByRole('button',{name:'Simulyasiyanı hesabla'}).click();
  await expect(page.getByTestId('scenario')).toBeVisible();
  await expect(page.locator('.solution')).toHaveCount(3);
  await page.getByRole('button',{name:/Siqnal prioriteti ver/}).click();
  await page.evaluate(()=>window.scrollTo(0,0));await tilesLoaded(page);
  await page.screenshot({path:testInfo.outputPath('operator-desktop.png'),fullPage:true});
  await page.getByRole('button',{name:'Demo parkına tətbiq et'}).click();
  await expect(page.getByRole('button',{name:'Tətbiq edildi',exact:true})).toBeDisabled();
  await expect(page.locator('.priority-tag')).toContainText('Prioritet aktiv');
  await expect(page.locator('.fleet-table tbody tr')).toHaveCount(4);

  // GPS density map, and a 'very full' report turning into a reserve recommendation.
  await expect(page.locator('path.density-cell').first()).toBeVisible();
  const busId=(await (await page.request.get('/api/fleet?route=125')).json()).buses[0].id;
  expect((await page.request.post('/api/reports',{data:{bus_id:busId,level:3,client_id:'e2e-operator-device'}})).ok()).toBeTruthy();
  const alert=page.locator('.alert-row',{hasText:'125 xətti'});
  await expect(alert).toBeVisible({timeout:15000});
  await expect(alert).toContainText('Əlavə rezerv avtobus ayrılsın');
  await alert.getByRole('button',{name:'Rezerv ayır'}).click();
  await expect(page.getByRole('status')).toContainText('Rezerv avtobus RA-');
  await expect(page.locator('.fleet-table tbody tr')).toHaveCount(5);
  await page.locator('#density').screenshot({path:testInfo.outputPath('density-alerts.png')});

  await page.getByRole('button',{name:'YOLO nümunəsini işə sal'}).click();
  await expect(page.getByTestId('vision-result')).toContainText('insan',{timeout:90000});
  expect(await page.locator('.detection-image .detection-box').count()).toBeGreaterThan(0);
  const image=await page.request.get('/api/vision/sample');
  await page.getByLabel('Kamera şəkli').setInputFiles({name:'sample.jpg',mimeType:'image/jpeg',buffer:await image.body()});
  await expect(page.getByRole('button',{name:'YOLO nümunəsini işə sal'})).toBeEnabled({timeout:90000});
  await expect(page.getByTestId('vision-result')).toContainText('YOLO26s-pose');
  await expect(page.getByLabel('Duruş',{exact:true})).toContainText('ayaqüstə');

  await page.getByRole('tab',{name:'Video'}).click();
  await page.getByRole('button',{name:'Video nümunəsini işə sal'}).click();
  await expect(page.getByTestId('video-result')).toContainText('fərqli',{timeout:120000});
  await expect(page.getByTestId('vision-video')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>document.querySelector('[data-testid=vision-video]').readyState)).toBeGreaterThan(0);
  expect(await page.locator('.detection-video .detection-box').count()).toBeGreaterThan(0);
  await page.locator('#vision').screenshot({path:testInfo.outputPath('yolo-video.png')});
  const clip=await page.request.get('/api/vision/sample-video');
  expect(clip.headers()['content-type']).toContain('video/webm');
  await page.getByLabel('Kamera videosu').setInputFiles({name:'clip.webm',mimeType:'video/webm',buffer:await clip.body()});
  await expect(page.getByRole('button',{name:'Video nümunəsini işə sal'})).toBeEnabled({timeout:120000});
  await expect(page.getByTestId('video-result')).toContainText('YOLO26s-pose + ByteTrack');
  await expect(page.getByLabel('İzlənən insanlar üzrə duruş')).toContainText('oturur');

  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:testInfo.outputPath('operator-mobile.png'),fullPage:true});
  expect(await noOverflow(page)).toBeTruthy();
  expect(errors).toEqual([]);
});

test('API boundaries, uniform errors and installable app files',async({request})=>{
  const fleet=await (await request.get('/api/fleet')).json();const bus=fleet.buses[0].id;
  expect((await request.post('/api/vision/demo?bus_id='+bus,{data:{}})).status()).toBe(403);
  expect((await request.post('/api/twin/preview',{data:{route:'125',stop_id:'28may',horizon:20,demand_multiplier:1,delay:0}})).status()).toBe(403);
  expect((await request.post('/api/reports',{data:{bus_id:bus,level:2,client_id:'guest-device'}})).status()).toBe(403);
  const missing=await request.get('/api/journeys');expect(missing.status()).toBe(422);expect((await missing.json()).detail).toBeTruthy();
  await request.post('/api/access',{data:{role:'operator'}});
  expect((await request.post('/api/vision/detect?bus_id='+bus,{multipart:{file:{name:'bad.jpg',mimeType:'image/jpeg',buffer:Buffer.from('invalid image')}}})).status()).toBe(422);
  expect((await request.post('/api/vision/video?bus_id='+bus,{multipart:{file:{name:'bad.mp4',mimeType:'video/mp4',buffer:Buffer.from('invalid video')}}})).status()).toBe(422);
  expect((await request.get('/api/vision/health')).status()).toBe(200);
  expect((await request.get('/docs')).status()).toBe(200);
  const manifest=await request.get('/manifest.json');expect(manifest.status()).toBe(200);expect((await manifest.json()).display).toBe('standalone');
  expect((await request.get('/sw.js')).status()).toBe(200);
  expect((await request.get('/icon-512.png')).status()).toBe(200);
  const routes=await (await request.get('/api/routes')).json();expect(routes.routes.length).toBe(10);expect(routes.stops.length).toBeGreaterThan(30);
});
