# Supabase 흉내: 클라이언트가 보내는 요청 모양과 응답 처리 확인용
import os
HERE=os.path.dirname(os.path.abspath(__file__));ROOT=os.path.dirname(HERE)
THREE=os.path.join(HERE,'vendor','three.min.js');SHOT=os.path.join(ROOT,'build','shots');os.makedirs(SHOT,exist_ok=True)
WRAP=os.path.join(ROOT,'build','wrap.html')
from playwright.sync_api import sync_playwright
import json,re,secrets,urllib.parse as up
DB={'acc':{},'ses':{},'laps':{},'scores':{},'prof':{},'plays':{},'layouts':{'suzuka':{'objs':[],'auto':{'trees':True}}}}
LOG=[]
def key(n): return 'n_'+n.lower().encode().hex()
def rpc(fn,a):
    LOG.append(fn)
    who=DB['ses'].get(a.get('p_token'))
    if fn=='sm_signup':
        k=key(a['p_nick'])
        if k in DB['acc']: return {'ok':False,'err':'taken'}
        DB['acc'][k]={'nick':a['p_nick'],'pw':a['p_pw'],'email':None};t=secrets.token_hex(8);DB['ses'][t]=k;return {'ok':True,'key':k,'nick':a['p_nick'],'token':t}
    if fn=='sm_login':
        k=key(a['p_nick']);x=DB['acc'].get(k)
        if not x: return {'ok':False,'err':'none'}
        if x['pw']!=a['p_pw']: return {'ok':False,'err':'bad'}
        t=secrets.token_hex(8);DB['ses'][t]=k;return {'ok':True,'key':k,'nick':x['nick'],'token':t}
    if fn=='sm_me':
        if not who: return {'ok':False,'err':'session'}
        x=DB['acc'][who];return {'ok':True,'key':who,'nick':x['nick'],'created':1,'emailMask':x.get('mask'),'hasEmail':x['email'] is not None}
    if fn=='sm_add_play': DB['plays'][a['p_gid']]=DB['plays'].get(a['p_gid'],0)+1;return None
    if not who and fn!='sm_recover': return {'ok':False,'err':'session'}
    if fn=='sm_submit_lap':
        cur=DB['laps'].get((a['p_tid'],who))
        if cur and cur['ms']<=a['p_ms']: return {'ok':True,'saved':False}
        DB['laps'][(a['p_tid'],who)]={'key':who,'nick':DB['acc'][who]['nick'],'ms':a['p_ms'],'data':a['p_data']};return {'ok':True,'saved':True}
    if fn=='sm_submit_score':
        cur=DB['scores'].get((a['p_gid'],who))
        if cur and cur['score']>=a['p_score']: return {'ok':True,'saved':False}
        DB['scores'][(a['p_gid'],who)]={'key':who,'nick':DB['acc'][who]['nick'],'score':a['p_score'],'data':a['p_data']};return {'ok':True,'saved':True}
    if fn=='sm_set_profile':
        if a['p_img'] is None: DB['prof'].pop(who,None)
        else: DB['prof'][who]={'img':a['p_img'],'ratio':a['p_ratio'],'nick':DB['acc'][who]['nick']}
        return {'ok':True}
    if fn=='sm_set_email':
        DB['acc'][who].update(email=a['p_email'].lower(),mask=a['p_mask'],code=a['p_code']);return {'ok':True}
    if fn=='sm_change_pw':
        x=DB['acc'][who]
        if a['p_email'] is not None:
            if x['email']!=a['p_email'].strip().lower(): return {'ok':False,'err':'email'}
        elif x['pw']!=a['p_old']: return {'ok':False,'err':'bad'}
        x['pw']=a['p_new'];return {'ok':True}
    if fn=='sm_rename':
        x=DB['acc'][who]
        if x['pw']!=a['p_pw']: return {'ok':False,'err':'bad'}
        nk=key(a['p_nick']);DB['acc'][nk]=dict(x,nick=a['p_nick']);del DB['acc'][who]
        for t,k in list(DB['ses'].items()):
            if k==who: DB['ses'][t]=nk
        for tb in ('laps','scores'):
            for kk,v in list(DB[tb].items()):
                if kk[1]==who: del DB[tb][kk]; v.update(key=nk,nick=a['p_nick']); DB[tb][(kk[0],nk)]=v
        return {'ok':True,'key':nk,'nick':a['p_nick']}
    if fn=='sm_recover':
        k=key(a['p_nick']);x=DB['acc'].get(k)
        if not x or x['email']!=a['p_email'] or x.get('code')!=a['p_code']: return {'ok':False,'err':'code'}
        x['pw']=a['p_new'];t=secrets.token_hex(8);DB['ses'][t]=k;return {'ok':True,'key':k,'nick':x['nick'],'token':t}
    if fn=='sm_logout': DB['ses'].pop(a['p_token'],None);return None
def handle(route):
    req=route.request;u=up.urlparse(req.url);path=u.path.replace('/rest/v1/','')
    assert req.headers.get('apikey','').startswith('sb_publishable_'),'apikey'
    if path.startswith('rpc/'):
        r=rpc(path[4:],json.loads(req.post_data or '{}'));return route.fulfill(status=200,body='' if r is None else json.dumps(r),content_type='application/json')
    q=up.parse_qs(u.query);eq=lambda f:(q.get(f,[''])[0].split('.',1)[1] if f in q else None)
    if path=='laps' or path=='scores':
        rows=[v for v in DB[path].values() if (v.get('key')==eq('key') or eq('key') is None)]
        rows=[v for (t,k),v in DB[path].items() if t==(eq('tid') or eq('gid')) and (eq('key') is None or k==eq('key'))]
        if 'ms' in q: lim=int(q['ms'][0].split('.')[1]);rows=[r for r in rows if r['ms']<lim]
        if 'score' in q: lim=int(q['score'][0].split('.')[1]);rows=[r for r in rows if r['score']>lim]
        rows.sort(key=lambda r:r.get('ms',-r.get('score',0)))
        if req.method=='HEAD': return route.fulfill(status=200,headers={'content-range':f'0-0/{len(rows)}'},body='')
        return route.fulfill(status=200,body=json.dumps(rows),content_type='application/json')
    if path=='profiles':
        p=DB['prof'].get(eq('key'));return route.fulfill(status=200,body=json.dumps([p] if p else []),content_type='application/json')
    if path=='plays': return route.fulfill(status=200,body=json.dumps([{'gid':g,'n':n} for g,n in DB['plays'].items()]),content_type='application/json')
    if path=='layouts':
        d=DB['layouts'].get(eq('tid'));return route.fulfill(status=200,body=json.dumps([{'data':d}] if d else []),content_type='application/json')
    route.fulfill(status=404,body='[]')
with sync_playwright() as p:
    b=p.chromium.launch();pg=b.new_page(viewport={'width':1280,'height':800});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.route('**/three.min.js',lambda r:r.fulfill(path=THREE,content_type='text/javascript'))
    pg.route('https://fonts.googleapis.com/**',lambda r:r.fulfill(body='',content_type='text/css'))
    pg.route('https://thzlynfaydadrrptmasg.supabase.co/**',handle)
    pg.goto('http://localhost:8765/');pg.wait_for_timeout(800)
    print('mode',pg.evaluate('Store.mode'))
    pg.fill('#inNick','민수');pg.fill('#inPw','1234');pg.click('[data-act=signup]');pg.wait_for_timeout(300)
    print('user',pg.evaluate('USER&&[USER.nick,!!USER.token]'),pg.inner_text('#loginCard .store-note'))
    # 기록 저장 경로 직접 호출
    print(pg.evaluate("""(async()=>{await Store.setBest('suzuka',USER.key,{nick:USER.nick,ms:95000,sec:[1,2,3],car:'SMR-1',at:1});
      await Store.setScore('blocks',USER.key,{nick:USER.nick,score:5000,level:2});
      const t=await Store.top('suzuka');const me=await Store.getBest('suzuka',USER.key);const r=await Store.rankOf('suzuka',96000);
      const s=await Store.topScore('blocks');const rs=await Store.rankScore('blocks',100);await Store.addPlay('blocks');const pl=await Store.plays();const L=await Store.getLayout('suzuka');
      return JSON.stringify({t,me,r,s,rs,pl,L:!!L})})()"""))
    # 프로필
    pg.click('[data-act=profile]');pg.wait_for_timeout(400)
    pg.fill('#pfEmail','m@x.com');pg.click('#pfSend');code=pg.text_content('.pf-alt .code');pg.fill('#pfCodeIn',code);pg.click('#pfCodeOk');pg.wait_for_timeout(400)
    print('email state',pg.inner_text('.pf-sec .pf-state'))
    pg.click('#pwWay [data-w=mail]');pg.fill('#pfPwMail','M@x.com');pg.fill('#pfNew','5555');pg.fill('#pfNew2','5555');pg.click('#pfPwGo');pg.wait_for_timeout(300);print('pw',pg.inner_text('#pfPwMsg'))
    pg.fill('#pfNick','민수킹');pg.fill('#pfNickPw','5555');pg.click('#pfNickGo');pg.wait_for_timeout(600);print('rename',pg.evaluate('USER.nick'),pg.evaluate("Store.top('suzuka').then(t=>t.map(x=>x.nick+':'+x.ms))"))
    pg.keyboard.press('Escape');pg.click('[data-act=logout]');pg.wait_for_timeout(200)
    pg.click('[data-act=forgot]');pg.fill('#fgNick','민수킹');pg.fill('#fgMail','m@x.com');pg.fill('#fgCode',code);pg.fill('#fgNew','7777');pg.fill('#fgNew2','7777');pg.click('#fgGo');pg.wait_for_timeout(400)
    print('recover',pg.evaluate('USER&&USER.nick'))
    # 세션 만료 → 저장 시 안내
    pg.evaluate("USER.token='expired';LS.set('smr_session',USER)");pg.reload();pg.wait_for_timeout(800);print('expired session cleared',pg.evaluate('USER'))
    # 틀린 비번
    pg.fill('#inNick','민수킹');pg.fill('#inPw','0000');pg.click('#btnLogin');pg.wait_for_timeout(300);print('bad',pg.inner_text('#loginMsg'))
    # 블록 랭킹 화면
    pg.fill('#inPw','7777');pg.click('#btnLogin');pg.wait_for_timeout(300);pg.click('[data-act=open-blocks]');pg.wait_for_timeout(600);print('bk rank',pg.inner_text('#bkRank')[:80].replace('\n',' '))
    print('rpcs',sorted(set(LOG)));print('errs',errs);b.close()
