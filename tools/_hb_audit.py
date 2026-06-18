import re, json, os, glob
from pathlib import Path

ROOT = Path(r'c:/claudeworkspace/sajumoon')
allmenus = (ROOT/'web/mng/src/pages/AllMenus.tsx').read_text(encoding='utf-8')

# 1) HANDBOOK_MAP 블록
m = re.search(r'const HANDBOOK_MAP[^=]*=\s*\{(.*?)\n\}', allmenus, re.S)
block = m.group(1) if m else ''
hbmap = dict(re.findall(r"'(/[^']+)':\s*'([^']+)'", block))

# 2) 메뉴 path 전체
paths = [p for p in re.findall(r"path:\s*'(/[^']+)'", allmenus) if not p.startswith('/handbook')]

# 3) index.json 슬러그
idx = json.loads((ROOT/'_HANDBOOK/index.json').read_text(encoding='utf-8'))
idx_slugs = {it['slug'] for c in idx['categories'] for it in c['items']}

# 4) 실제 .md (tech 제외)
md_files = set()
for f in glob.glob(str(ROOT/'_HANDBOOK'/'**'/'*.md'), recursive=True):
    rel = Path(f).relative_to(ROOT/'_HANDBOOK').as_posix()
    if rel.endswith('.tech.md'):
        continue
    md_files.add(rel[:-3])

print(f"메뉴 {len(paths)} / MAP {len(hbmap)} / index.json {len(idx_slugs)} / 실제 .md {len(md_files)}\n")

def show(title, rows):
    print(f"=== {title} ===")
    if rows:
        for r in rows:
            print("  " + r)
    else:
        print("  (없음)")
    print()

show("① 깨진 링크: MAP 가리키는데 .md 없음",
     [f"{p}  ->  {s}.md (없음)" for p,s in hbmap.items() if s not in md_files])
show("② MAP 슬러그가 index.json 미등록 (뷰어 목록 안뜸)",
     [f"{p}  ->  {s}" for p,s in hbmap.items() if s not in idx_slugs])
show("3. 메뉴인데 MAP 없음 (book 링크 안뜸)",
     [p for p in paths if p not in hbmap])
show("④ index.json 등록인데 .md 없음",
     [s for s in sorted(idx_slugs) if s not in md_files])
show("⑤ .md 있는데 index.json 미등록 (고아 문서)",
     [s for s in sorted(md_files) if s not in idx_slugs])
mapped = set(hbmap.values())
show("⑥ index.json 문서인데 연결 메뉴 없음 (정책전용·참고)",
     [s for s in sorted(idx_slugs) if s not in mapped])
