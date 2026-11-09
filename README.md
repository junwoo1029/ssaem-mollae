# 쌤몰래

쉬는 시간에 한 판 하는 웹 게임 사이트 — 서킷 타임어택 레이싱, 블록 낙하, 2048, F1 출발 반응 테스트.
PC·아이패드·휴대폰에서 동작합니다. 공유 랭킹·계정은 Supabase를 씁니다.

- 사이트: https://ssaem-mollae.vercel.app
- 이어서 작업하기: [CLAUDE.md](CLAUDE.md), 인계 문서: [docs/HANDOFF.md](docs/HANDOFF.md)

```sh
python3 src/build.py --single   # src/ → 사이트 파일(루트) + build/ssaem.html
sh tests/run_all.sh             # 테스트 (playwright 필요)
```

루트의 `index.html`, `app.css`, `a0~a5.js`는 빌드 결과물입니다. 수정은 `src/`에서 하세요.
