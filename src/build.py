# 쌤몰래 빌드
#   python3 src/build.py          → 저장소 루트에 Vercel용 사이트(index.html, app.css, a0~a5.js) 생성
#   python3 src/build.py --single → build/ssaem.html 한 파일짜리(Claude 아티팩트용)도 생성
# 필요: esbuild (npx esbuild 또는 ESBUILD 환경변수). 없으면 압축 없이 만듦.
import subprocess,os,re,sys,shutil
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC=os.path.join(ROOT,'src')
# 순서 중요: 한 스크립트로 이어 붙여 실행됨 (뒤 파일의 const를 앞 파일 최상위 코드에서 쓰면 안 됨)
FILES=['physics.js','tracks.js','main1.js','store_sb.js','main2.js','main3.js','main6.js','main4.js',
       'blocks.js','g2048.js','react.js','extra.js','main5.js']
FONTS='https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Noto+Sans+KR:wght@400;500;700&family=Saira+Condensed:wght@600;700;800&display=swap'
THREE='https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'
rd=lambda f:open(os.path.join(SRC,f),encoding='utf-8').read()
js=''.join(rd(f)+'\n' for f in FILES); css=rd('style.css'); body=rd('body.html')

def esbuild(code,loader):
    exe=os.environ.get('ESBUILD') or shutil.which('esbuild') or ('/opt/npm-tools/node_modules/esbuild/bin/esbuild' if os.path.exists('/opt/npm-tools/node_modules/esbuild/bin/esbuild') else None)
    cmd=[exe] if exe else (['npx','--yes','esbuild@0.24.0'] if shutil.which('npx') else None)
    if not cmd: print('esbuild 없음: 압축 없이 진행'); return code
    try: return subprocess.run(cmd+['--minify','--loader='+loader,'--target=es2020','--charset=utf8'],input=code,capture_output=True,text=True,check=True).stdout
    except Exception as e: print('압축 실패, 원본 사용:',e); return code

# 1) 문법 검사
tmp=os.path.join(ROOT,'build','all.js');os.makedirs(os.path.dirname(tmp),exist_ok=True);open(tmp,'w',encoding='utf-8').write(js)
if shutil.which('node'):
    r=subprocess.run(['node','--check',tmp],capture_output=True,text=True)
    if r.returncode: print(r.stderr);sys.exit('JS 문법 오류')

# 2) Vercel 사이트 (JS를 6조각으로 나눠 로더가 이어 붙여 실행)
mj=esbuild(js,'js'); mc=esbuild(css,'css'); mb=re.sub(r'>\s*\n\s*<','><',body)
N=6;L=len(mj)
for f in os.listdir(ROOT):
    if re.match(r'a\d+\.js$',f): os.remove(os.path.join(ROOT,f))
for i in range(N): open(os.path.join(ROOT,f'a{i}.js'),'w',encoding='utf-8').write(mj[i*L//N:(i+1)*L//N])
open(os.path.join(ROOT,'app.css'),'w',encoding='utf-8').write(mc)
loader="(async()=>{try{const t=await Promise.all(["+",".join(f"'a{i}.js'" for i in range(N))+"].map(u=>fetch(u,{cache:'no-cache'}).then(r=>{if(!r.ok)throw 0;return r.text()})));const s=document.createElement('script');s.textContent=t.join('');document.body.appendChild(s);}catch(e){document.body.insertAdjacentHTML('beforeend','<p style=\"color:#fff;padding:20px\">불러오지 못했어요. 새로고침해 주세요.</p>');}})();"
html=f'''<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>쌤몰래 - 쉬는 시간 게임</title>
<meta name="description" content="쌤몰래: 쉬는 시간에 한 판. 서킷 타임어택 레이싱, 블록 낙하, 2048, F1 출발 반응 테스트를 PC·아이패드·휴대폰에서 즐겨요.">
<meta property="og:title" content="쌤몰래"><meta property="og:description" content="쉬는 시간에 한 판 하는 게임 사이트">
<meta name="theme-color" content="#0a0c0f">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{FONTS}">
<link rel="stylesheet" href="app.css"><style>html,body{{margin:0;padding:0}}</style></head><body>
{mb}
<script src="{THREE}"></script>
<script>{loader}</script>
</body></html>
'''
open(os.path.join(ROOT,'index.html'),'w',encoding='utf-8').write(html)
print('사이트 생성 완료 → index.html, app.css, a0~a5.js')

# 3) 한 파일짜리 (Claude 아티팩트용: 아티팩트가 <html><head> 뼈대를 붙여 줌)
if '--single' in sys.argv:
    out=f'<title>쌤몰래</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n<link rel="stylesheet" href="{FONTS}">\n<style>\n{css}</style>\n{body}<script src="{THREE}"></script>\n<script>\n{js}</script>\n'
    open(os.path.join(ROOT,'build','ssaem.html'),'w',encoding='utf-8').write(out); print('한 파일 생성 → build/ssaem.html')
