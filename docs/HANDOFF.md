# 쌤몰래 인계 문서

다른 Claude 계정(또는 다른 사람)이 이어서 관리할 때 필요한 모든 것. 2026-11 기준.

## 1. 지금 돌아가는 것

| 무엇 | 어디 | 누구 계정 |
|---|---|---|
| 사이트 (공개 주소) | https://ssaem-mollae.vercel.app | Vercel 팀 `junwoo` (slug `junwoo8`), 프로젝트 `ssaem-mollae` (id `prj_iOEK0OKccSKa6yELrBQjJAEfqk4K`) |
| 코드 | https://github.com/junwoo1029/ssaem-mollae (공개 저장소, 브랜치 `main`) | GitHub `junwoo1029` |
| 공유 저장소(계정·랭킹·사진) | Supabase 프로젝트 `ssaem-mollae` (ref `thzlynfaydadrrptmasg`, 서울 ap-northeast-2) | Supabase 조직 `junwoo1029` |
| Claude 안의 미리보기 링크 | claude.ai 아티팩트 (옛 계정 소유, 계정이 없어지면 함께 사라짐) | 옛 Claude 계정 |

GitHub·Vercel·Supabase는 Claude 계정과 **별개**라 Claude 계정이 사라져도 그대로 남는다.
단, 이 세 곳에 로그인할 때 쓰는 이메일이 사라질 학교 메일이면, 각 사이트 설정에서 개인 메일로 바꿔 두어야 한다 (아래 4번).

Supabase 접속 정보(브라우저용 공개 키라 코드에 들어 있어도 안전):
- URL: `https://thzlynfaydadrrptmasg.supabase.co`
- publishable key: `src/store_sb.js`의 `SUPA.key`
- 서비스 키(service_role)는 코드·문서에 넣지 않는다.

## 2. 새 Claude 계정에서 이어서 하는 법

1. 새 Claude 계정의 설정 → 커넥터(Connectors)에서 **GitHub, Vercel, Supabase**를 연결한다 (각각 위 표의 계정으로 로그인).
2. 새 대화를 열고 이렇게 말한다:
   > GitHub `junwoo1029/ssaem-mollae` 저장소를 열어서 CLAUDE.md랑 docs/HANDOFF.md 읽고 쌤몰래 작업 이어서 해줘.
3. Claude가 저장소를 열면 `CLAUDE.md`를 읽고 구조·규칙·배포 방법을 알게 된다.
4. Claude 안에서 바로 해 볼 수 있는 미리보기 링크가 필요하면: "build/ssaem.html을 만들어서 아티팩트로 올려줘"라고 하면 된다 (`python3 src/build.py --single`). 새 아티팩트의 랭킹은 비어서 시작한다(Vercel 랭킹과는 별개).

## 3. 서비스별 관리

### Vercel
- 정적 사이트. Framework: Other, Build Command 없음, Output Directory 루트. `.vercelignore`로 src·tests 등은 배포에서 뺌.
- **자동 배포 설정 필요**: Vercel → 프로젝트 `ssaem-mollae` → Settings → Git → Connect Git Repository → `junwoo1029/ssaem-mollae`. 연결하면 `main`에 push할 때마다 자동 배포. (현재는 연결 전이라 배포를 수동으로 실행했음)

### Supabase
- 스키마 전체: `supabase/schema.sql` (빈 프로젝트에 실행하면 그대로 재현). 배치 데이터: `supabase/seed_layouts.sql`.
- 표: accounts(비공개), sessions(비공개), laps, scores, profiles, plays, layouts(공개 읽기). 쓰기는 모두 `sm_*` 함수로만.
- 보안 점검에서 "SECURITY DEFINER 함수를 anon이 실행 가능" 경고가 나오는데, 의도된 설계다(함수 안에서 토큰·비밀번호를 검사함). accounts/sessions의 "정책 없음" 안내도 의도(아무도 직접 접근 못 하게).
- 무료 요금제는 오래 안 쓰면 프로젝트가 일시정지(pause)될 수 있다. 사이트에서 로그인이 안 되면 대시보드에서 Restore.
- 백업: 대시보드 → Database → Backups, 또는 Claude에게 "Supabase 데이터 백업해줘".

### GitHub
- 저장소가 **공개**라 비밀 정보(비밀번호, 서비스 키, 개인 사진 등)는 올리지 않는다.

## 4. 계정 이메일 옮기기 (학교 메일이 사라질 경우)
- GitHub: Settings → Emails → 개인 메일 추가 → Primary로 지정 → 학교 메일 삭제.
- Vercel: Account Settings → Email/Login Connections. GitHub로 로그인했다면 GitHub만 유지되면 됨.
- Supabase: Account → Preferences/Email. GitHub로 로그인했다면 GitHub만 유지되면 됨.
- 새 Claude 계정은 개인 메일로 만든다.

## 5. 지금까지 결정한 것 (요약)
- 게임: ① 서킷 타임어택(실제 서킷 5곳, 사용자 지도 이미지를 따라 그림) ② 블록 낙하 ③ 2048(숫자 커질수록 화려한 타일) ④ F1 출발 반응 속도(100ms 미만은 무효).
- 차: 사용자가 보낸 아반떼 N 사진을 참고하되 브랜드 디자인 복제는 하지 않고 오리지널 'SMR-1 터보'로. 물리는 아반떼 N 제원(1445kg 등).
- 키 배치·홈 화면·비밀번호 규칙 등은 CLAUDE.md "사용자가 정한 것" 참고.
- 이메일 인증: 메일 서버가 없어서 복구 코드를 사용자가 자기 메일로 보내 두는 방식. 진짜 인증 메일을 보내려면 Supabase Auth의 이메일 기능이나 메일 발송 서비스(Resend 등)를 붙여야 함.
- 3D 에셋이 필요하면 Meshy/Tripo 등에서 GLB로 받아 three.js에 넣는 방향으로 이야기함.

## 6. 남은 일 / 아이디어
- Vercel ↔ GitHub 자동 배포 연결 (사용자가 Vercel 화면에서 한 번 클릭).
- Vercel 주소에서 실제 가입→기록→다른 기기에서 랭킹 확인 (최종 점검 아직 안 함).
- 배치 편집기는 Claude 아티팩트 소유자만 쓸 수 있음 → Vercel에서도 쓰려면 관리자 로그인과 Supabase 쓰기 함수 필요.
- 게임 5~10번 칸 비어 있음.

## 7. 옛 Claude 아티팩트 데이터
옛 아티팩트의 공유 DB에는 테스트용 계정 2개와 기록 몇 개뿐이었다. 백업은 저장소가 아니라 사용자에게 따로 준 압축 파일(`private/artifact-db-backup`)에 있다 (비밀번호 해시가 들어 있어 공개 저장소에 올리지 않음).
