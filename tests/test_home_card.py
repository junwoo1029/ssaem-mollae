import os
HERE=os.path.dirname(os.path.abspath(__file__));ROOT=os.path.dirname(HERE)
THREE=os.path.join(HERE,'vendor','three.min.js');SHOT=os.path.join(ROOT,'build','shots');os.makedirs(SHOT,exist_ok=True)
WRAP=os.path.join(ROOT,'build','wrap.html')
from playwright.sync_api import sync_playwright
open(WRAP,'w').write('<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>'+open(os.path.join(ROOT,'build','ssaem.html')).read()+'</body></html>')
with sync_playwright() as p:
    b=p.chromium.launch()
    for name,opt in [('d',{'viewport':{'width':1280,'height':720}}),('ph',p.devices['iPhone 13']),('pad',p.devices['iPad Pro 11'])]:
        pg=b.new_context(**opt).new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.route('**/three.min.js',lambda r:r.fulfill(path=THREE,content_type='text/javascript'))
        pg.route('https://fonts.googleapis.com/**',lambda r:r.fulfill(body='',content_type='text/css'))
        pg.goto('file://'+WRAP);pg.wait_for_timeout(600);pg.screenshot(path=f'{SHOT}/rc_{name}.png')
        pg.click('#recCard');pg.wait_for_timeout(800);print(name,errs,pg.evaluate("['#home','#blocks','#g48','#react','#tracks'].filter(s=>!$(s).hidden)"))
    b.close()
