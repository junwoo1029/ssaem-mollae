import os
HERE=os.path.dirname(os.path.abspath(__file__));ROOT=os.path.dirname(HERE)
THREE=os.path.join(HERE,'vendor','three.min.js');SHOT=os.path.join(ROOT,'build','shots');os.makedirs(SHOT,exist_ok=True)
WRAP=os.path.join(ROOT,'build','wrap.html')
from playwright.sync_api import sync_playwright
import base64,io
O=SHOT+'/'
def setup(pg,errs):
    pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('console',lambda m:errs.append(m.text) if m.type=='error' else None)
    pg.route('**/three.min.js',lambda r:r.fulfill(path=THREE,content_type='text/javascript'))
    pg.route('https://fonts.googleapis.com/**',lambda r:r.fulfill(body='',content_type='text/css'))
with sync_playwright() as p:
    b=p.chromium.launch()
    # ---- 데스크톱
    pg=b.new_page(viewport={'width':1280,'height':800});errs=[];setup(pg,errs)
    pg.goto('file://'+os.path.join(ROOT,'build','ssaem.html'));pg.wait_for_timeout(500)
    print('desktop touch?',pg.evaluate('[isTouchDev,touchOn()]'))
    pg.screenshot(path=O+'home.png')
    pg.fill('#inNick','테스터');pg.fill('#inPw','1234');pg.click('[data-act=signup]');pg.wait_for_timeout(500)
    # 기록 하나 넣기
    pg.evaluate("Store.setScore('blocks',USER.key,{nick:USER.nick,score:5000,level:2,at:1})")
    pg.click('[data-act=profile]');pg.wait_for_timeout(400)
    # 사진 만들기
    pg.evaluate("""()=>{const c=document.createElement('canvas');c.width=800;c.height=500;const x=c.getContext('2d');const g=x.createLinearGradient(0,0,800,500);g.addColorStop(0,'#e33');g.addColorStop(1,'#33e');x.fillStyle=g;x.fillRect(0,0,800,500);x.fillStyle='#fff';x.font='bold 200px sans-serif';x.fillText('A',320,320);window._png=c.toDataURL('image/png');}""")
    data=base64.b64decode(pg.evaluate('_png').split(',')[1])
    pg.set_input_files('#pfFile',files=[{'name':'a.png','mimeType':'image/png','buffer':data}]);pg.wait_for_timeout(500)
    pg.click('#cropRatio [data-r="4/5"]');pg.fill('#cropZoom','180');pg.dispatch_event('#cropZoom','input');pg.wait_for_timeout(200)
    pg.screenshot(path=O+'crop.png')
    pg.click('#cropOk');pg.wait_for_timeout(700)
    print('profile saved',pg.evaluate("Store.getProfile(USER.key).then(p=>p&&[p.ratio,p.img.length])"))
    # 이메일
    pg.fill('#pfEmail','me@example.com');pg.click('#pfSend');pg.wait_for_timeout(200)
    code=pg.text_content('.pf-alt .code');pg.fill('#pfCodeIn',code.lower());pg.click('#pfCodeOk');pg.wait_for_timeout(600)
    print('email',pg.evaluate("Store.getAcc(USER.key).then(a=>[a.emailMask,!!a.recHash])"))
    pg.screenshot(path=O+'profile.png',full_page=True)
    # 닉 변경
    pg.fill('#pfNick','새이름');pg.fill('#pfNickPw','1234');pg.click('#pfNickGo');pg.wait_for_timeout(900)
    print('rename',pg.evaluate("[USER.nick,USER.key]"),pg.evaluate("Store.topScore('blocks').then(r=>r.map(x=>x.nick+':'+x.key))"),pg.evaluate("Store.getProfile(USER.key).then(p=>!!p)"))
    # 이메일로 비번 변경
    pg.click('#pwWay [data-w=mail]');pg.fill('#pfPwMail','ME@example.com');pg.fill('#pfNew','abcd');pg.fill('#pfNew2','abcd');pg.click('#pfPwGo');pg.wait_for_timeout(500)
    print('pw by mail:',pg.inner_text('#pfPwMsg'))
    pg.click('#profBody [data-act=close-profile]');pg.click('[data-act=logout]');pg.wait_for_timeout(200)
    # 비번 찾기
    pg.click('[data-act=forgot]');pg.fill('#fgNick','새이름');pg.fill('#fgMail','me@example.com');pg.fill('#fgCode',code);pg.fill('#fgNew','zzzz');pg.fill('#fgNew2','zzzz');pg.click('#fgGo');pg.wait_for_timeout(600)
    print('forgot ->',pg.evaluate('USER&&USER.nick'))
    pg.screenshot(path=O+'home2.png')
    # 설정: 홈 / 블록
    pg.click('#home [data-act=settings]');pg.wait_for_timeout(200);pg.screenshot(path=O+'set_home.png');pg.click('#settingsOv .btn.primary')
    pg.click('[data-act=open-blocks]');pg.wait_for_timeout(400)
    pg.click('#blocks [data-act=settings]');pg.wait_for_timeout(200);pg.screenshot(path=O+'set_blocks.png')
    pg.click('[data-set=bkGhost] [data-v="0"]');pg.fill('[data-vol=blocks]','30');pg.dispatch_event('[data-vol=blocks]','input')
    print('blocks set',pg.evaluate('[SET.bkGhost,SET.snd.blocks.vol]'),'tabs hidden',pg.evaluate("$('#setTabs').hidden"))
    pg.keyboard.press('Escape');pg.wait_for_timeout(100);print('modal closed',not pg.evaluate('modalOpen()'))
    pg.click('#blocks [data-act=home]');pg.click('[data-act=open-react]');pg.wait_for_timeout(300);pg.click('#react [data-act=settings]');pg.wait_for_timeout(150);pg.screenshot(path=O+'set_react.png')
    pg.keyboard.press('Escape');pg.click('#react [data-act=home]')
    pg.click('#home [data-act=open-racer]');pg.wait_for_timeout(1500);pg.click('#tracks [data-act=settings]');pg.wait_for_timeout(150);print('racer ctx',pg.evaluate('SETCTX'))
    print('errs',errs[:8]);pg.close()
    # ---- 휴대폰
    ctx=b.new_context(**p.devices['iPhone 13']);pg=ctx.new_page();errs=[];setup(pg,errs)
    pg.goto('file://'+os.path.join(ROOT,'build','ssaem.html'));pg.wait_for_timeout(600)
    print('phone touch?',pg.evaluate('[isTouchDev,touchOn()]'))
    pg.screenshot(path=O+'ph_home.png',full_page=True)
    pg.tap('#recCard');pg.wait_for_timeout(1200);print('rec opened',pg.evaluate("['#blocks','#g48','#react','#tracks'].filter(s=>!$(s).hidden)"))
    pg.goto('file://'+os.path.join(ROOT,'build','ssaem.html'));pg.wait_for_timeout(500)
    pg.tap('[data-act=open-g48]');pg.wait_for_timeout(400);print('pad visible',pg.is_visible('#g4Pad'))
    pg.screenshot(path=O+'ph_2048.png')
    pg.tap('#g4Pad [data-dir="3"]');pg.wait_for_timeout(300)
    pg.keyboard.press('ArrowLeft');pg.wait_for_timeout(100);print('after key pad visible',pg.is_visible('#g4Pad'))
    pg.tap('#g4Board');pg.wait_for_timeout(100);print('after tap pad visible',pg.is_visible('#g4Pad'))
    pg.tap('#g48 [data-act=home]');pg.tap('[data-act=open-blocks]');pg.wait_for_timeout(400);print('bk touch',pg.is_visible('#bkTouch'));pg.screenshot(path=O+'ph_blocks.png')
    print('errs',errs[:8])
    b.close()
