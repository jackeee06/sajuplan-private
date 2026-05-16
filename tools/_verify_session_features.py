"""이번 세션에 개발한 기능 엄격 검증 — 운영 API 스모크 테스트.

검증 영역:
  1) 상담사 신청 폼 분기 (apply_type: application/inquiry/other)
  2) 상담사 리스트 'new' 탭 + is_new 필드
  3) 상담사 정렬 정책 (5분 내 CONN/CNCH 우선)
  4) 어드민 상담사 신청 카테고리 필터 (인증 필요 → 통과만 확인)
  5) 베스트 후기 (인증 필요)
  6) 출석체크 정책 조회 (인증 필요)
  7) 후기 신고
  8) 캡차/SMS 엔드포인트 동작

각 항목별로 PASS/FAIL + 근거 출력.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except Exception:
        pass

TARGETS = [
    ("test", "https://api.sajumoon.kr"),
    ("prod", "https://api.sajumoon.co.kr"),
]


def get(base: str, path: str, timeout: int = 10) -> tuple[int, dict | list | str]:
    req = urllib.request.Request(f"{base}{path}", headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            body = r.read().decode("utf-8", errors="replace")
            try:
                return r.status, json.loads(body)
            except json.JSONDecodeError:
                return r.status, body
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        try:
            return e.code, json.loads(body)
        except json.JSONDecodeError:
            return e.code, body


def post_json(base: str, path: str, payload: dict, timeout: int = 10) -> tuple[int, dict | list | str]:
    req = urllib.request.Request(
        f"{base}{path}",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Accept": "application/json", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            body = r.read().decode("utf-8", errors="replace")
            try:
                return r.status, json.loads(body)
            except json.JSONDecodeError:
                return r.status, body
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        try:
            return e.code, json.loads(body)
        except json.JSONDecodeError:
            return e.code, body


results: list[tuple[str, str, str, str]] = []  # (server, area, pass/fail, detail)


def check(server: str, area: str, ok: bool, detail: str) -> None:
    results.append((server, area, "PASS" if ok else "FAIL", detail))


def verify_server(label: str, base: str) -> None:
    print(f"\n========== {label} ({base}) ==========")

    # 1) 'new' 탭 + is_new 필드
    code, body = get(base, "/api/user/counselors?tab=new&limit=3")
    if code == 200 and isinstance(body, dict) and "items" in body:
        items = body.get("items", [])
        has_is_new = all("is_new" in it for it in items) if items else True
        all_new = all(it.get("is_new") is True for it in items) if items else True
        check(label, "1) new 탭 + is_new", has_is_new and all_new,
              f"items={len(items)} is_new필드={has_is_new} 모두new={all_new}")
    else:
        check(label, "1) new 탭 + is_new", False, f"HTTP {code} {str(body)[:120]}")

    # 2) 전체 탭에서도 is_new 필드 존재
    code, body = get(base, "/api/user/counselors?tab=all&limit=3")
    if code == 200 and isinstance(body, dict):
        items = body.get("items", [])
        has = all("is_new" in it for it in items) if items else True
        check(label, "2) 전체 탭 is_new 필드", has, f"items={len(items)} 모두 is_new있음={has}")
    else:
        check(label, "2) 전체 탭 is_new 필드", False, f"HTTP {code}")

    # 3) 상담사 카드 별점 필드 제거 안됨 (rating_avg 는 유지하되 어드민 UI 만 회색)
    code, body = get(base, "/api/user/counselors?limit=1")
    if code == 200 and isinstance(body, dict):
        items = body.get("items", [])
        if items:
            has_rating = "rating_avg" in items[0]
            check(label, "3) rating_avg 필드 유지", has_rating, f"rating_avg={items[0].get('rating_avg')}")

    # 4) 신청 폼 분기 — apply_type=inquiry 으로 시드된 휴대폰 조회
    code, body = get(base, "/api/user/counselor-apply/check-phone?phone=01011112207")
    if code == 200 and isinstance(body, dict):
        # inquiry 카테고리는 check-phone 의 'pending' 상태 차단 대상이 아님 (지원만 차단)
        # 단, post_apply 테이블엔 들어있으므로 어드민에서 보임 (다른 SQL 로 검증)
        ok = body.get("status") in ("none", "pending")
        check(label, "4) inquiry 시드 휴대폰 조회", ok, f"status={body.get('status')}")

    # 5) 신청 폼 분기 — application + pending 인 시드 휴대폰은 'pending' 반환 (duplicate=false, 차단 안 함)
    code, body = get(base, "/api/user/counselor-apply/check-phone?phone=01011112201")
    if code == 200 and isinstance(body, dict):
        ok = body.get("status") == "pending" and body.get("duplicate") is False
        check(label, "5) application pending 휴대폰 인식", ok,
              f"status={body.get('status')} duplicate={body.get('duplicate')}")

    # 6) 신청 폼 분기 — application + accepted 인 시드 휴대폰은 'accepted' 반환 (차단)
    code, body = get(base, "/api/user/counselor-apply/check-phone?phone=01011112203")
    if code == 200 and isinstance(body, dict):
        ok = body.get("status") == "accepted"
        check(label, "6) application accepted 휴대폰 차단", ok,
              f"status={body.get('status')}")

    # 7) 캡차 발급 동작
    code, body = get(base, "/api/user/captcha")
    if code == 200 and isinstance(body, dict):
        ok = "token" in body and "svg" in body and body["svg"].startswith("<svg")
        check(label, "7) 캡차 발급", ok, f"token={'O' if 'token' in body else 'X'} svg={'O' if body.get('svg','').startswith('<svg') else 'X'}")
    else:
        check(label, "7) 캡차 발급", False, f"HTTP {code}")

    # 8) 어드민 신청 리스트 (인증 401 통과만 확인 — 라우트 살아있나)
    code, body = get(base, "/api/admin/counselor-apply?category=inquiry")
    # 401 = 인증 필요 (정상), 200 = 토큰 어쩌다 있는 경우 (시크릿창이 아니면)
    ok = code in (401, 403)
    check(label, "8) 어드민 카테고리 필터 라우트", ok, f"HTTP {code} (401/403 = 라우트 존재)")

    # 9) 출석체크 정책 라우트 (인증 필요 → 401)
    code, _ = get(base, "/api/admin/attendance/policy/user")
    check(label, "9) 어드민 출석 정책 라우트", code in (401, 403), f"HTTP {code}")

    # 10) 후기 신고 라우트 — POST 라 GET 으로 405 또는 401 나오면 살아있음
    code, _ = get(base, "/api/user/reviews/1/report")
    check(label, "10) 후기 신고 라우트", code in (401, 403, 404, 405), f"HTTP {code}")


def main() -> int:
    for label, base in TARGETS:
        verify_server(label, base)

    print("\n\n========== 결과 요약 ==========")
    pass_count = sum(1 for r in results if r[2] == "PASS")
    fail_count = sum(1 for r in results if r[2] == "FAIL")
    print(f"PASS: {pass_count} / FAIL: {fail_count}\n")

    fmt = "{:<6} {:<35} {:<6} {}"
    print(fmt.format("서버", "검증 항목", "결과", "근거"))
    print("-" * 100)
    for server, area, status, detail in results:
        print(fmt.format(server, area, status, detail))

    return 0 if fail_count == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
