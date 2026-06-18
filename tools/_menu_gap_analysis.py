"""_HANDBOOK 용어(tags) vs AllMenus(전체메뉴) 검색용어 갭분석.
전체메뉴에서 검색해도 안 잡히는 누락 용어 + 어느 바이블 문서에 있는지 리포트."""
import json
import io
import re
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

d = json.load(open('_HANDBOOK/index.json', encoding='utf-8'))

# A: 모든 tags (용어 마스터) + title 단어
terms = {}  # term -> [slug, ...]
for c in d['categories']:
    for it in c['items']:
        for tg in it.get('tags', []):
            terms.setdefault(tg.strip(), it['slug'])

# B: AllMenus.tsx 의 모든 문자열 리터럴 (label+aliases+subFeatures 등)
am = open('web/mng/src/pages/AllMenus.tsx', encoding='utf-8').read()
lits = re.findall(r"'([^']*)'", am) + re.findall(r'"([^"]*)"', am)
Bnorm = (' '.join(lits)).replace(' ', '').lower()

# 누락: tag 가 B 어디에도 부분포함 안 됨 (공백제거 부분일치)
missing = []
for t, slug in sorted(terms.items()):
    tn = t.replace(' ', '').lower()
    if tn and tn not in Bnorm:
        missing.append((t, slug))

print(f'_HANDBOOK 총 용어(tags 고유): {len(terms)}개')
print(f'AllMenus 미포함(누락 후보): {len(missing)}개\n')

# 슬러그(문서)별로 그룹핑해서 보기 좋게
bydoc = {}
for t, slug in missing:
    bydoc.setdefault(slug, []).append(t)
print('=== 누락 용어 (바이블 문서별) ===')
for slug in sorted(bydoc):
    print(f'\n[{slug}]')
    print('  ' + ', '.join(bydoc[slug]))
