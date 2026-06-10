"""
라온선생(id=123) 더미 후기 5건 생성 — DB 직접 INSERT.
실행: python tools/_create_dummy_reviews.py
"""
import sys
import json
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HOST = "104.64.128.103"
SSH_USER = "root"
SSH_PW = "saju26moon@!!"
DB_PW = "2864a3fe5f86d4ef9f0ab958fce8f576dff56c1f3f698382"
DB = "sajumoon"
DB_USER = "sajumoon"
COUNSELOR_ID = 123  # 라온선생

# dummy_cust_01~05 (id 113~117)
REVIEWS = [
    {
        "member_id": 113, "mb_id": "dummy_cust_01",
        "title": "연애운 상담 정말 신기했어요",
        "content": (
            "라온선생님께 연애운 상담을 받았는데 정말 깜짝 놀랐어요. "
            "제가 요즘 마음이 흔들리는 사람이 있었는데, 먼저 말하지도 않았는데 "
            "그 상황을 정확하게 짚어주셨어요. 결과적으로 시작해보라는 말씀을 해주셨는데 "
            "그 후로 실제로 잘 되고 있어요. 신기하고 신뢰가 가는 선생님이세요. "
            "다음에도 꼭 다시 상담받을게요!"
        ),
        "consult_type": "채팅",
        "consult_duration": "12분 0초",
        "rating": 5,
    },
    {
        "member_id": 114, "mb_id": "dummy_cust_02",
        "title": "직장 이직 고민이 정리됐어요",
        "content": (
            "이직을 해야 할지 말아야 할지 너무 고민이었는데, "
            "선생님께서 현재 직장의 기운과 새 직장의 에너지를 비교해서 말씀해주셨어요. "
            "지금은 때가 아니다, 6개월 후가 맞다 라고 하셨는데 그 말이 딱 맞는 것 같아서 "
            "마음이 정리됐어요. 막연하게 불안했던 마음이 상담 후에 훨씬 편안해졌습니다."
        ),
        "consult_type": "전화",
        "consult_duration": "9분 0초",
        "rating": 5,
    },
    {
        "member_id": 115, "mb_id": "dummy_cust_03",
        "title": "재물운 사주 풀이가 명쾌해요",
        "content": (
            "올해 재물운이 어떤지 궁금해서 상담받았어요. "
            "생각보다 훨씬 상세하게 달별로 설명해주셨고, "
            "특히 하반기에 뜻밖의 수입이 생길 수 있다고 하셨는데 "
            "실제로 그런 기회가 찾아와서 신기했어요. "
            "설명도 어렵지 않게 해주셔서 처음 사주 상담 받는 분들께도 추천드립니다."
        ),
        "consult_type": "채팅",
        "consult_duration": "11분 0초",
        "rating": 4,
    },
    {
        "member_id": 116, "mb_id": "dummy_cust_04",
        "title": "가족 관계 고민, 위로받았어요",
        "content": (
            "부모님과의 갈등으로 너무 힘든 시기였는데, "
            "라온선생님께서 가족 관계의 흐름과 개선 시점을 말씀해주셨어요. "
            "단순히 점만 보는 게 아니라 진심으로 공감해주시면서 위로도 해주셔서 "
            "상담하는 내내 마음이 따뜻했어요. "
            "지금은 관계가 많이 나아졌고, 선생님 말씀대로 올해 안에 화해가 될 것 같아요."
        ),
        "consult_type": "전화",
        "consult_duration": "13분 30초",
        "rating": 5,
    },
    {
        "member_id": 117, "mb_id": "dummy_cust_05",
        "title": "결혼 궁합 봤는데 딱 맞아요",
        "content": (
            "남자친구와 결혼을 고려 중이라 궁합을 봐달라고 했는데, "
            "두 사람의 장단점을 정말 정확하게 짚어주셨어요. "
            "제가 미처 인식 못했던 부분도 말씀해주셔서 많이 생각하게 됐어요. "
            "궁합 자체는 좋다고 하셔서 안심했고, 조심해야 할 부분도 알려주셔서 "
            "도움이 많이 됐어요. 믿음이 가는 선생님입니다."
        ),
        "consult_type": "채팅",
        "consult_duration": "12분 30초",
        "rating": 5,
    },
]


def run_sql_file(client: paramiko.SSHClient, sql: str) -> str:
    sftp = client.open_sftp()
    tmp = "/tmp/_sajumoon_review.sql"
    with sftp.open(tmp, "w") as f:
        f.write(sql.encode("utf-8"))
    sftp.close()
    cmd = (
        f"PGPASSWORD='{DB_PW}' psql -h 127.0.0.1"
        f" -U {DB_USER} -d {DB} -tA -f {tmp} 2>&1"
    )
    _, stdout, _ = client.exec_command(cmd)
    return stdout.read().decode("utf-8", errors="replace").strip()


def main():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=SSH_USER, password=SSH_PW, timeout=20)

    created = []
    for rev in REVIEWS:
        extras = {
            "consult_type": rev["consult_type"],
            "consult_duration": rev["consult_duration"],
        }
        extras_json = json.dumps(extras, ensure_ascii=False).replace("'", "''")
        title = rev["title"].replace("'", "''")
        content = rev["content"].replace("'", "''")
        mb_id = rev["mb_id"]
        rating = rev.get("rating") or "NULL"

        sql = (
            f"INSERT INTO post_review "
            f"(member_id, mb_id, counselor_id, title, content, rating, "
            f"is_secret, has_file, extras) "
            f"VALUES ({rev['member_id']}, '{mb_id}', {COUNSELOR_ID}, "
            f"'{title}', '{content}', {rating}, "
            f"false, false, '{extras_json}'::jsonb) "
            f"RETURNING id;\n"
        )
        raw = run_sql_file(client, sql)
        review_id = next(
            (int(ln.strip()) for ln in raw.splitlines() if ln.strip().isdigit()),
            None,
        )
        if review_id:
            created.append((rev["mb_id"], review_id, rev["title"]))
            print(f"  ✅ [{rev['mb_id']}] id={review_id}: {rev['title']}")
        else:
            print(f"  ❌ [{rev['mb_id']}] 실패: {raw[:150]}")

    client.close()
    print(f"\n완료: {len(created)}/5건")


if __name__ == "__main__":
    main()
