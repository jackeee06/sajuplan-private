"""옛 dist JS/CSS 파일 청소 + 최종 워터마크 검증.

index.html 이 가리키는 현재 index-*.js / index-*.css 만 남기고 나머지 삭제.
삭제 후 워터마크(logo_b + opacity 0.06) 매칭 확인.
"""
import os, sys, paramiko, re

for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception: pass

pw = os.environ['SSHPASS']

TARGETS = [
    ('test','172.235.211.75','/data/wwwroot/sajumoon.kr'),
    ('prod','104.64.128.103','/data/wwwroot/sajumoon.co.kr'),
]

for label, host, web_remote in TARGETS:
    print(f"\n{'='*70}\n[{label}] {host}\n{'='*70}")
    c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, 22, 'root', pw, allow_agent=False, look_for_keys=False, timeout=20)

    # index.html 에서 참조하는 현재 파일명 추출
    _, o, _ = c.exec_command(f"cat {web_remote}/index.html | grep -oE 'index-[A-Za-z0-9_-]+\\.(js|css)'")
    refs = set(o.read().decode().strip().split())
    print(f"  index.html 참조: {sorted(refs)}")

    # 현재 assets 폴더의 모든 index-*.js/css 파일 목록
    _, o, _ = c.exec_command(f"ls {web_remote}/assets/ 2>/dev/null | grep -E 'index-[A-Za-z0-9_-]+\\.(js|css)' | sort")
    all_files = [x for x in o.read().decode().strip().split() if x]
    print(f"  assets 폴더 총 파일: {len(all_files)} 개")

    # 삭제 대상 = 현재 파일이 아닌 것
    to_delete = [f for f in all_files if f not in refs]
    if not to_delete:
        print(f"  ✅ 옛 파일 없음 (이미 깨끗)")
    else:
        print(f"  🗑  삭제 대상 {len(to_delete)} 개:")
        for f in to_delete:
            print(f"     - {f}")
        # 실제 삭제
        for f in to_delete:
            _, o, _ = c.exec_command(f"rm -f {web_remote}/assets/{f}")
            o.channel.recv_exit_status()
        print(f"  ✅ 삭제 완료")

    # 최종 검증 — 현재 파일에서 워터마크 매칭
    print(f"\n  [검증] 현재 파일 워터마크 매칭")
    for ref in refs:
        if ref.endswith('.js'):
            # logo_b.svg + opacity 0.06
            _, o, _ = c.exec_command(
                f"grep -oE 'opacity-\\[0\\.06\\]' {web_remote}/assets/{ref} 2>/dev/null | wc -l"
            )
            opa = o.read().decode().strip()
            _, o, _ = c.exec_command(
                f"grep -oE '/img/logo_b.svg' {web_remote}/assets/{ref} 2>/dev/null | wc -l"
            )
            logo = o.read().decode().strip()
            _, o, _ = c.exec_command(
                f"grep -oE '180px auto' {web_remote}/assets/{ref} 2>/dev/null | wc -l"
            )
            sz = o.read().decode().strip()
            _, o, _ = c.exec_command(
                f"grep -oE 'interactive-widget=resizes-content' "
                f"{web_remote}/index.html 2>/dev/null | wc -l"
            )
            meta = o.read().decode().strip()
            _, o, _ = c.exec_command(
                f"grep -oE 'visualViewport' {web_remote}/assets/{ref} 2>/dev/null | wc -l"
            )
            vv = o.read().decode().strip()

            ok_logo = int(logo) >= 1
            ok_opa = int(opa) >= 1
            ok_sz = int(sz) >= 1
            ok_meta = int(meta) >= 1
            ok_vv = int(vv) >= 1

            print(f"  📄 {ref}")
            print(f"     {'✅' if ok_logo else '❌'}  logo_b.svg 참조 = {logo}")
            print(f"     {'✅' if ok_opa else '❌'}  opacity-[0.06] = {opa}")
            print(f"     {'✅' if ok_sz else '❌'}  180px auto = {sz}")
            print(f"     {'✅' if ok_meta else '❌'}  interactive-widget 메타 = {meta}")
            print(f"     {'✅' if ok_vv else '❌'}  visualViewport API 사용 = {vv}")

    c.close()

print(f"\n{'='*70}\n끝.\n{'='*70}")
