# 쌤몰래 — 작업 안내 (Claude가 이 저장소에서 일할 때 먼저 읽는 파일)

사용자는 한국어로 대화한다. 답도 한국어로. 사용자는 학생이고 코드를 직접 짜지 않으니, 결과(링크·스크린샷)와 쉬운 설명 위주로 보고한다.

## 이 프로젝트는
'쌤몰래'는 쉬는 시간에 하는 웹 게임 모음 사이트다. PC(키보드)·아이패드(터치+하드웨어 키보드)·휴대폰 모두 지원.
- 배포 주소: https://ssaem-mollae.vercel.app
- 자세한 인계 문서: `docs/HANDOFF.md` (서비스 계정, 결정 이력, 남은 일)

## 구조 한눈에
- `src/` 원본 소스. **여기만 고친다.** 빌드 결과물(루트의 index.html, app.css, a0~a5.js)은 직접 고치지 않는다.
- `src/build.py` → 루트에 Vercel용 사이트 생성. `--single`이면 `build/ssaem.html`(한 파일짜리, Claude 아티팩트용)도 생성.
- `supabase/schema.sql` 공유 저장소 전체 스키마·함수. `supabase/seed_layouts.sql` 서킷 배치 데이터.
- `tests/run_all.sh` 빌드 + Playwright 테스트(로컬 모드, 휴대폰/패드, Supabase 흉내 서버).
- `data/layouts/` 서킷 배치 원본 JSON. `tools/physics_sim.js` 차량 물리 단독 시뮬(node).

## 소스 파일 (한 스크립트로 이어 붙여 실행됨, 순서는 build.py의 FILES)
| 파일 | 내용 |
|---|---|
| physics.js | 차량 물리 (240Hz, 타이어·드리프트·ESC·ABS). CAR_SPEC은 아반떼 N 제원 기반 |
| tracks.js | 서킷 5개(스즈카, 영암, 야스마리나, 스파, 모나코) 좌표·섹터·환경 |
| main1.js | 공통 유틸, 설정(SET), 비속어 필터(badNick), Store(저장소: cloud/sb/local), 로그인 카드 |
| store_sb.js | Supabase 연결(SUPA url/key), Store의 sb 모드, 계정 API `Acc` (signup/login/rename/changePw/recover…) |
| main2.js | three.js 렌더러, 텍스처, 차 모델(SMR-1, 코드로 만든 오리지널 디자인) |
| main3.js | 트랙 지오메트리, 지형, 연석, 벽, 터널, 풍경 |
| main6.js | 배치 오브젝트(관중석·관람차 등), 배치 편집기(Claude 아티팩트 소유자만 편집 가능) |
| main4.js | 화면 전환 show(), 게임 목록 GAMES(인기순 10칸), 트랙 선택, 차고 |
| main5.js | 레이스 진행·HUD·섹터·결과·입력·엔진음, 클릭 처리(data-act), 메인 루프, Store.init() 호출 |
| blocks.js | 게임2 블록 낙하(테트리스류): SRS, 7-bag, 홀드, 고스트, 레벨 배경 |
| g2048.js | 게임3 2048 |
| react.js | 게임4 F1 출발 반응 속도 |
| extra.js | 게임별 소리/볼륨, 터치 자동 전환, 설정 모달, 프로필(사진 자르기, 이메일 인증, 닉네임·비번 변경), 홈 추천 카드 |
| body.html / style.css | 화면 마크업 / 스타일 |

## 저장소 모드 (Store.mode)
- `cloud`: Claude 아티팩트 안에서 열렸을 때 (`window.claude.use('db')`).
- `sb`: 그 밖의 http(s) 주소(Vercel). Supabase REST/RPC를 fetch로 직접 호출. 계정·비밀번호는 서버 함수(sm_*)만 다룸, 토큰은 `USER.token`.
- `local`: 둘 다 안 될 때(file:// 등) 이 기기 localStorage.
새 기능에서 저장이 필요하면 Store 메서드를 추가하고 세 모드를 모두 구현한다. Supabase 쪽은 `supabase/schema.sql`에 함수/표를 추가하고 실제 DB에도 적용(마이그레이션)한 뒤 schema.sql을 최신으로 유지한다.

## 새 게임/서킷을 추가할 때 체크리스트
1. 게임 화면: body.html에 `<section class="gscreen" id="...">`, main4.js `show()` 목록과 GAMES에 추가, 클릭 처리(main5.js data-act)에 open/close.
2. 기록: 시간형이면 laps(tid), 점수형이면 scores(gid). **Supabase 함수 `sm_submit_lap`/`sm_submit_score`/`sm_add_play`의 허용 목록에 id 추가** (안 하면 Vercel에서 저장 실패).
3. 설정: extra.js `SET_TABS`, `SET_SECTIONS`에 게임 탭과 소리(sndRow) 추가. 소리는 `gOut(ctx,'게임id')`로 연결하고 `gSnd('게임id')`로 확인.
4. 터치: `touchOn()`으로 터치 버튼 표시 여부 결정, `refreshTouch()`에 연결.
5. 홈 추천 카드 문구: extra.js `REC_WHY`.
6. 랭킹 닉네임 칸은 `nickCell(key,nick)` (프로필 사진 자동 표시).

## 빌드·테스트·배포
```sh
python3 src/build.py --single      # 사이트 + build/ssaem.html
sh tests/run_all.sh                # 전체 테스트 (playwright 필요)
git add -A && git commit -m "..." && git push   # main에 올리기
```
배포: Vercel 프로젝트 `ssaem-mollae`가 GitHub 저장소와 Git 연결돼 있으면 push로 자동 배포. 안 돼 있으면 Vercel 연결 도구로 `create_deployment`(gitSource: github junwoo1029/ssaem-mollae, ref main, sha) 실행. 정적 사이트(빌드 명령 없음, 루트가 출력 폴더).

## 사용자가 정한 것 (바꾸지 말 것)
- 블록 낙하 키: Z/↑ 회전, C 홀드(바꾸기), Space 한 번에 내려찍기, ↓ 천천히 내리기, ←→ 이동. 아이패드 키보드 호환(한글 입력 상태 ㅋ/ㅊ도 인식).
- 레이싱: WASD/화살표, Shift 부스트, Space 잠금 브레이크(미끄러지기), 브레이크+조향 드리프트는 부드럽게 진입·역조향 시 서서히 회복. 엔진음 작게.
- 차는 아반떼 N 사진을 참고했지만 디자인·브랜드는 복제하지 않은 오리지널 'SMR-1 터보' (제원만 참고). 실제 브랜드 로고·이름 넣지 않기.
- 닉네임 비속어 필터 유지(badNick). 비밀번호 4자리 이상.
- 각 게임 랭킹 TOP 20, 내 기록이 20위 밖이면 아래에 따로 표시.
- 홈: 게임 목록 10칸(2열) 인기순, 빈 칸은 '준비 중'. 로고 아래 '오늘의 추천' 카드(4초마다 회전, 누르면 그 게임).
- 비밀번호 변경(로그인 상태)은 '현재 비밀번호' 또는 '인증한 이메일 주소만' 입력으로 가능. 로그아웃 상태 비밀번호 찾기는 이메일+복구 코드 필요.
- 이메일은 실제 발송 서버가 없음: 복구 코드를 만들어 사용자가 mailto로 자기 메일함에 보내 두는 방식.
