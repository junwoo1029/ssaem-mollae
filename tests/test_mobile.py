import os
HERE=os.path.dirname(os.path.abspath(__file__));ROOT=os.path.dirname(HERE)
THREE=os.path.join(HERE,'vendor','three.min.js');SHOT=os.path.join(ROOT,'build','shots');os.makedirs(SHOT,exist_ok=True)
WRAP=os.path.join(ROOT,'build','wrap.html')
from playwright.sync_api import sync_playwright
O=SHOT+'/'
open(WRAP,'w').write('<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>'+open(os.path.join(ROOT,'build','ssaem.html')).read()+'</body></html>')
with sync_playwright() as p:
    b=p.chromium.launch()
    for name,dev in [('ph','iPhone 13'),('pad','iPad Pro 11')]:
        ctx=b.new_context(**p.devices[dev]);pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.route('**/three.min.js',lambda r:r.fulfill(path=THREE,content_type='text/javascript'))
        pg.route('https://fonts.googleapis.com/**',lambda r:r.fulfill(body='',content_type='text/css'))
        pg.goto('file://'+WRAP);pg.wait_for_timeout(600)
        pg.screenshot(path=O+name+'_home.png')
        pg.tap('[data-act=open-react]');pg.wait_for_timeout(300);print(name,pg.inner_text('#rxSmall'))
        pg.tap('#react [data-act=settings]');pg.wait_for_timeout(200);pg.screenshot(path=O+name+'_set.png')
        print(name,'errs',errs)
    b.close()
