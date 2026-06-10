#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import urllib.request, ssl, time

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

# 홈페이지가 실제로 호출하는 엔드포인트들
endpoints = [
    "/api/user/counselors?limit=300",
    "/api/user/counselors?tab=popular&limit=300",
    "/api/user/counselors?tab=new&limit=300",
    "/api/user/counselors?tab=chat&limit=300",
    "/api/user/counselors?category=사주&limit=300",
    "/api/user/stats/main",
    "/api/user/banners",
]

base = "https://api.sajuplan.com"
for path in endpoints:
    try:
        start = time.time()
        r = urllib.request.urlopen(base + path, context=ctx, timeout=10)
        elapsed = time.time() - start
        body = r.read()
        print(f"OK {r.status} {elapsed:.2f}s {len(body)}bytes | {path}")
    except Exception as e:
        print(f"FAIL | {path} | {e}")
