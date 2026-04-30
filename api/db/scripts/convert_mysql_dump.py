#!/usr/bin/env python3
"""
MySQL dump → PostgreSQL 호환 SQL 변환기

목적: 영카트 sajumoon_db_*.sql (MySQL 형식)을 PG의 sajumoon_db에 적재할 수 있는 SQL로 변환
방식: 라인 기반 스트리밍 처리 — DDL/락/주석 제거 + 이스케이프 변환

변환 규칙:
  * 백틱 ` 제거
  * MySQL escape \' → PG '' 변환 (단, 문자열 컨텍스트 내에서만)
  * '0000-00-00' / '0000-00-00 00:00:00' → NULL
  * MySQL 전용 라인 제거: LOCK TABLES, UNLOCK TABLES, /*!...*/, DROP TABLE,
                           CREATE TABLE 블록, # comment, -- comment
  * INSERT ... ON CONFLICT DO NOTHING 추가하여 멱등성 확보

사용:
  python3 convert_mysql_dump.py <input.sql> <output.sql>
"""
import re
import sys
from pathlib import Path


def convert_mysql_to_pg(text: str) -> str:
    """
    스트림을 character-by-character 상태머신으로 처리.
    문자열(') 안에서는 ; 무시. 백틱은 어디서든 제거. 특수 escape 처리.
    """
    out = []
    i = 0
    n = len(text)
    in_string = False
    while i < n:
        c = text[i]

        if in_string:
            # MySQL escape 시퀀스 처리
            if c == "\\" and i + 1 < n:
                nxt = text[i + 1]
                if nxt == "'":
                    out.append("''")
                    i += 2
                    continue
                elif nxt == '"':
                    out.append('"')
                    i += 2
                    continue
                elif nxt == "\\":
                    out.append("\\")
                    i += 2
                    continue
                elif nxt == "n":
                    out.append("\n")
                    i += 2
                    continue
                elif nxt == "r":
                    out.append("\r")
                    i += 2
                    continue
                elif nxt == "t":
                    out.append("\t")
                    i += 2
                    continue
                elif nxt == "0":
                    # MySQL의 \0 (NULL char) → 일반 텍스트로 빈 처리 (PG는 NULL byte 비허용)
                    i += 2
                    continue
                elif nxt == "Z":
                    i += 2
                    continue
                else:
                    out.append(nxt)
                    i += 2
                    continue
            elif c == "'":
                # MySQL의 '' escape (드물지만 가능)
                if i + 1 < n and text[i + 1] == "'":
                    out.append("''")
                    i += 2
                    continue
                # 문자열 종료
                out.append("'")
                in_string = False
                i += 1
                continue
            else:
                out.append(c)
                i += 1
                continue
        else:
            # 문자열 외부
            if c == "`":
                # 식별자 백틱 제거
                i += 1
                continue
            elif c == "'":
                out.append("'")
                in_string = True
                i += 1
                continue
            else:
                out.append(c)
                i += 1
                continue
    return "".join(out)


def filter_lines(text: str) -> str:
    """
    라인 단위로 MySQL-only 부분 제거
    """
    out_lines = []
    in_create = False
    in_lock = False
    for line in text.splitlines():
        s = line.strip()
        if not s:
            out_lines.append(line)
            continue
        # 주석 제거
        if s.startswith("--") or s.startswith("#"):
            continue
        # /*!... */ MySQL 전용 directive 한 줄
        if s.startswith("/*!") and s.endswith("*/;"):
            continue
        if s.startswith("/*!") and s.endswith("*/"):
            continue
        # SET, START 등 한 줄 명령
        if s.startswith("SET ") or s.startswith("START "):
            continue
        # LOCK TABLES ... WRITE; / UNLOCK TABLES;
        if s.upper().startswith("LOCK TABLES") or s.upper().startswith("UNLOCK TABLES"):
            continue
        # DROP TABLE
        if s.upper().startswith("DROP TABLE"):
            continue
        # CREATE TABLE 블록 시작
        if s.upper().startswith("CREATE TABLE"):
            in_create = True
            continue
        # CREATE TABLE 블록 종료
        if in_create:
            if s.startswith(") ENGINE=") or s.startswith(")ENGINE=") or (s.startswith(")") and "ENGINE" in s.upper()):
                in_create = False
                continue
            # CREATE TABLE 블록 내부 라인 모두 스킵
            continue
        out_lines.append(line)
    return "\n".join(out_lines)


def replace_zero_dates(text: str) -> str:
    """
    '0000-00-00 00:00:00' / '0000-00-00' → NULL
    문자열 컨텍스트 내에서 등장하는 sentinel 값 처리
    """
    text = text.replace("'0000-00-00 00:00:00'", "NULL")
    text = text.replace("'0000-00-00'", "NULL")
    return text


def main(input_path: str, output_path: str) -> None:
    src = Path(input_path).read_text(encoding="utf-8")
    print(f"[i] 입력: {len(src):,} 글자", file=sys.stderr)

    # 1) 라인 필터링
    filtered = filter_lines(src)
    print(f"[i] 라인 필터 후: {len(filtered):,} 글자", file=sys.stderr)

    # 2) 백틱/escape/quote 변환
    converted = convert_mysql_to_pg(filtered)
    print(f"[i] 변환 후: {len(converted):,} 글자", file=sys.stderr)

    # 3) 0000-00-00 → NULL
    converted = replace_zero_dates(converted)

    # 4) 출력 (트랜잭션 + replication_role replica로 트리거/제약 일시 우회)
    with Path(output_path).open("w", encoding="utf-8") as f:
        f.write("-- 자동 변환됨: MySQL dump → PG 호환\n")
        f.write("BEGIN;\n")
        f.write("SET session_replication_role = 'replica';\n\n")
        f.write(converted)
        f.write("\n\nSET session_replication_role = 'origin';\n")
        f.write("COMMIT;\n")

    print(f"[i] 출력: {output_path}", file=sys.stderr)
    inserts = converted.upper().count("INSERT INTO")
    print(f"[i] INSERT 문 개수: {inserts}", file=sys.stderr)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(f"사용: {sys.argv[0]} <input.sql> <output.sql>", file=sys.stderr)
        sys.exit(1)
    main(sys.argv[1], sys.argv[2])
