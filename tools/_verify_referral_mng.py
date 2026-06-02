"""mng 프론트 + 도메인 통한 API 엄격검증.

체크:
  1. https://mng.sajumoon.kr/referrals 가 SPA fallback 으로 200 + index.html
  2. https://mng.sajuplan.com/referrals 동일
  3. https://api.sajumoon.kr/api/admin/referrals 가 nginx 통해 401 응답
  4. https://api.sajuplan.com/api/admin/referrals 동일
  5. 정적 자산이 새 ReferralList 모듈 포함 (grep "추천 수당" in JS bundle)
"""
import os, sys, urllib.request, urllib.error, ssl

for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception: pass

ctx = ssl.create_default_context()


def http(url: str, method: str = "GET", body: bytes | None = None) -> tuple[int, str, bytes]:
    req = urllib.request.Request(url, method=method, data=body)
    if body is not None:
        req.add_header("Content-Type", "application/json")
    try:
        r = urllib.request.urlopen(req, timeout=15, context=ctx)
        b = r.read()
        return r.status, r.headers.get("Content-Type", ""), b
    except urllib.error.HTTPError as e:
        b = e.read() if hasattr(e, "read") else b""
        return e.code, e.headers.get("Content-Type", ""), b


def main() -> int:
    fail = 0

    targets = [
        ("test", "https://sajumoon.kr/mng/", "https://api.sajumoon.kr"),
        ("prod", "https://sajuplan.com/mng/", "https://api.sajuplan.com"),
    ]
    for label, mng_root, api_base in targets:
        print(f"\n========== [{label}] ==========")

        # 1) /mng/ 인덱스
        code, ctype, body = http(mng_root)
        if code == 200 and "text/html" in ctype:
            print(f"  ✓ [{code}] {mng_root}")
        else:
            print(f"  ✗ [{code}] {mng_root} ({ctype})")
            fail += 1

        # SPA fallback — referrals 경로
        code, ctype, body = http(mng_root + "referrals")
        if code == 200 and "text/html" in ctype:
            print(f"  ✓ [{code}] {mng_root}referrals (SPA fallback)")
        else:
            print(f"  ✗ [{code}] {mng_root}referrals — fallback 실패")
            fail += 1

        # 2) 정적 JS 번들에 새 코드가 들어갔는지 — index.html → asset URL → grep
        try:
            html = body.decode("utf-8", "replace")
        except Exception:
            html = ""
        # index-XXXXX.js asset 경로 추출
        import re
        m = re.search(r'src="([^"]*assets/index-[A-Za-z0-9_-]+\.js)"', html)
        if not m:
            print(f"  ✗ index.html 에서 main JS asset 못 찾음")
            fail += 1
        else:
            asset_path = m.group(1)
            asset_url = mng_root.rstrip("/") + (asset_path if asset_path.startswith("/") else "/" + asset_path)
            # 절대경로/상대경로 보정
            if asset_path.startswith("/mng/"):
                # https://sajumoon.kr/mng/assets/...
                asset_url = mng_root.rstrip("/").rsplit("/mng", 1)[0] + asset_path
            print(f"     asset: {asset_url}")
            code2, _, body2 = http(asset_url)
            if code2 != 200:
                print(f"  ✗ [{code2}] asset fetch 실패")
                fail += 1
            else:
                txt = body2.decode("utf-8", "replace")
                # 한글이 minify 후에도 string literal 로 살아 있음
                hits = ["추천 수당", "/admin/referrals", "이번 달 지급"]
                miss = [h for h in hits if h not in txt]
                if miss:
                    print(f"  ✗ JS 번들 누락 토큰: {miss}")
                    fail += 1
                else:
                    print(f"  ✓ JS 번들에 ReferralList 코드 포함 ({len(body2):,} bytes)")

        # 3) API 인증 거부 확인 (nginx → node → AdminAuthGuard)
        for path in ["/api/admin/referrals", "/api/admin/referrals/counselor-search?q=test"]:
            code, _, _ = http(api_base + path)
            if code == 401:
                print(f"  ✓ [401] {api_base}{path}")
            else:
                print(f"  ✗ [{code}] {api_base}{path}")
                fail += 1

    print(f"\n========== 결과 ==========")
    if fail == 0:
        print("✓ 모든 검증 통과")
        return 0
    print(f"✗ {fail} 개 실패")
    return 1


if __name__ == "__main__":
    sys.exit(main())
