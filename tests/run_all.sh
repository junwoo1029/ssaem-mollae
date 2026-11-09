#!/bin/sh
# 전체 테스트: 빌드 → 로컬 모드(계정·프로필·설정·터치) → 휴대폰/패드 화면 → Supabase 흉내 서버 연동
# 필요: python3, playwright(pip install playwright && playwright install chromium), node
set -e
cd "$(dirname "$0")/.."
python3 src/build.py --single
python3 -m http.server 8765 >/dev/null 2>&1 & SRV=$!
trap "kill $SRV" EXIT
sleep 1
python3 tests/test_local.py
python3 tests/test_mobile.py
python3 tests/test_home_card.py
python3 tests/test_supabase_mock.py
echo "스크린샷: build/shots/"
