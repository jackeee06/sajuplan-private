"""prod 의 모든 상담사에게 해시태그가 비어있으면 카테고리별 적절한 키워드로 채움.

규칙:
- post_counselor.hashtag1 / hashtag2 가 NULL 또는 빈 문자열이면 채움
- 이미 값이 있는 컬럼은 건드리지 않음
- 카테고리(사주/타로/신점/심리) 기반 + 보조 운세 키워드로 자연스럽게
- counselor 의 member_id 별로 결정적 (동일 회원은 항상 같은 해시태그) → 랜덤 시드 mb_id

사전 분석:
- post_counselor row 가 없는 상담사는 INSERT (member_id, hashtag1, hashtag2)
- 있으면 UPDATE (hashtag1/2 가 빈 경우만)
"""
from __future__ import annotations
import csv
import io
import os, sys
import paramiko

# 카테고리별 메인 해시태그 (hashtag1 후보)
MAIN_BY_CATEGORY = {
    '사주': ['정통사주', '사주명리', '사주풀이', '평생사주', '명리학', '신년운세'],
    '타로': ['타로점', '연애타로', '셀프타로', '카드해석', '결정타로', '직장타로'],
    '신점': ['신점', '무속신점', '신령접신', '영적상담', '운명풀이', '점복상담'],
    '심리': ['심리상담', '마음치유', '연애심리', '자아탐색', '인간관계', '상처치유'],
}

# 보조 해시태그 — 모든 카테고리 공통 (hashtag2 후보)
SUB_COMMON = [
    '연애운', '재물운', '직장운', '결혼운', '사업운',
    '재회상담', '궁합', '취업운', '학업운', '건강운',
    '가족운', '이직운', '대인관계', '이별상담', '진로상담',
]

# 카테고리 미상/기타일 때 fallback
FALLBACK_MAIN = ['전문상담', '운명상담', '인생상담']


def pick(items, seed: int) -> str:
    """결정적 선택 — 같은 seed 면 항상 같은 결과."""
    return items[seed % len(items)]


def hash_seed(s: str) -> int:
    h = 0
    for ch in s or '':
        h = (h * 131 + ord(ch)) & 0xFFFFFFFF
    return h


def normalize_category(specialty: str | None, hashtag1: str | None, hashtag2: str | None) -> str:
    """카테고리 추론 — specialty/기존 hashtag 에서 사주/타로/신점/심리 매칭."""
    text = ' '.join(filter(None, [specialty, hashtag1, hashtag2]))
    for cat in ['타로', '신점', '심리', '사주']:
        if cat in text:
            return cat
    return ''


def main() -> int:
    pw = os.environ.get('SSHPASS')
    if not pw:
        print('SSHPASS env required', file=sys.stderr); return 2

    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect('104.64.128.103', username='root', password=pw, timeout=20,
              look_for_keys=False, allow_agent=False)

    # 1) 모든 상담사 + 현재 hashtag/specialty 조회
    select_sql = """
SELECT m.id, m.mb_id, m.nickname, m.counselor_category,
       COALESCE(pc.hashtag1, '') AS hashtag1,
       COALESCE(pc.hashtag2, '') AS hashtag2,
       COALESCE(pc.specialty, '') AS specialty,
       (pc.id IS NOT NULL) AS pc_exists
  FROM member m
  LEFT JOIN post_counselor pc ON pc.member_id = m.id
 WHERE m.role = 'counselor' AND m.left_at IS NULL
 ORDER BY m.id;
"""
    tmp_select = f'/tmp/sel_hashtags_{os.getpid()}.sql'
    i, o, _ = c.exec_command(f'cat > {tmp_select}')
    i.write(select_sql); i.channel.shutdown_write(); o.channel.recv_exit_status()
    _, env, _ = c.exec_command('grep ^DATABASE_URL= /data/wwwroot/api.sajumoon.co.kr/.env')
    db_url = env.read().decode().strip().split('=', 1)[1].strip().strip('"').strip("'")
    _, out, _ = c.exec_command(f'psql "{db_url}" --csv -t -f {tmp_select}', timeout=30)
    csv_text = out.read().decode('utf-8', errors='replace')

    counselors = []
    reader = csv.reader(io.StringIO(csv_text))
    for cols in reader:
        if len(cols) < 8: continue
        try:
            cid = int(cols[0])
        except (ValueError, IndexError):
            continue
        counselors.append({
            'id': cid, 'mb_id': cols[1], 'nickname': cols[2],
            'category': cols[3] or '',
            'hashtag1': cols[4] or '',
            'hashtag2': cols[5] or '',
            'specialty': cols[6] or '',
            'pc_exists': cols[7].strip().lower() in ('t', 'true'),
        })

    print(f'총 상담사: {len(counselors)}명')

    # 2) 각 상담사별 hashtag 결정 + UPDATE/INSERT SQL 생성
    update_lines = []
    plan = []
    for c_row in counselors:
        cat = normalize_category(c_row['category'] or c_row['specialty'], c_row['hashtag1'], c_row['hashtag2'])
        main_pool = MAIN_BY_CATEGORY.get(cat, FALLBACK_MAIN)
        seed = hash_seed(c_row['mb_id'] or str(c_row['id']))
        new_h1 = c_row['hashtag1'].strip() if c_row['hashtag1'] and c_row['hashtag1'] != '\\N' else ''
        new_h2 = c_row['hashtag2'].strip() if c_row['hashtag2'] and c_row['hashtag2'] != '\\N' else ''
        h1_changed = False
        h2_changed = False
        if not new_h1:
            new_h1 = pick(main_pool, seed)
            h1_changed = True
        if not new_h2:
            new_h2 = pick(SUB_COMMON, seed // 7)
            h2_changed = True
        if not (h1_changed or h2_changed):
            continue  # 이미 둘 다 있음 → skip

        h1_esc = new_h1.replace("'", "''")
        h2_esc = new_h2.replace("'", "''")
        if c_row['pc_exists']:
            # 빈 컬럼만 채움 — 이미 값 있으면 유지
            sql = (
                "UPDATE post_counselor SET "
                f"  hashtag1 = COALESCE(NULLIF(hashtag1, ''), '{h1_esc}'), "
                f"  hashtag2 = COALESCE(NULLIF(hashtag2, ''), '{h2_esc}') "
                f"WHERE member_id = {c_row['id']};"
            )
        else:
            sql = (
                "INSERT INTO post_counselor (member_id, hashtag1, hashtag2) "
                f"VALUES ({c_row['id']}, '{h1_esc}', '{h2_esc}');"
            )
        update_lines.append(sql)
        plan.append(f"  id={c_row['id']:<4} mb={c_row['mb_id']:<20} cat={cat or '?':<3} → #{new_h1} #{new_h2}")

    print(f'\n채울 상담사: {len(plan)}명 (둘 다 빈 경우 또는 하나만 빈 경우)')
    for p in plan[:30]: print(p)
    if len(plan) > 30: print(f'  ... +{len(plan)-30}명')

    if not update_lines:
        print('\n이미 모두 채워져 있음. 작업 없음.')
        c.close(); return 0

    # 3) 실행
    full_sql = '\n'.join(update_lines)
    tmp_update = f'/tmp/upd_hashtags_{os.getpid()}.sql'
    i, o, _ = c.exec_command(f'cat > {tmp_update}')
    i.write(full_sql); i.channel.shutdown_write(); o.channel.recv_exit_status()
    _, out, err = c.exec_command(
        f'psql "{db_url}" -v ON_ERROR_STOP=1 -f {tmp_update} && rm -f {tmp_update} {tmp_select}',
        timeout=60,
    )
    out_text = out.read().decode()
    err_text = err.read().decode()
    print('\n--- 실행 결과 ---')
    print(out_text[-2000:] if len(out_text) > 2000 else out_text)
    if err_text: print('STDERR:', err_text, file=sys.stderr)
    c.close()
    return 0


if __name__ == '__main__':
    sys.exit(main())
