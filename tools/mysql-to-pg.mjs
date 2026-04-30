#!/usr/bin/env node
// MySQL 덤프 → PostgreSQL CREATE TABLE 변환 (스키마만)
// 사용법: node mysql-to-pg.mjs <input.sql> <output.sql>
//
// 변환 대상:
//   - DROP TABLE IF EXISTS ... → 그대로 (quoting만 변경)
//   - CREATE TABLE ... → PostgreSQL 문법
//   - INSERT/LOCK/SET/ALTER는 전부 스킵 (스키마만 이관)
//
// 지원 변환:
//   백틱 제거, int(N)/bigint(N)/tinyint(1), enum→varchar+CHECK,
//   set→text, datetime→timestamp, mediumtext/longtext/tinytext→text,
//   AUTO_INCREMENT→IDENTITY, ENGINE/CHARSET/COLLATE 제거,
//   인라인 KEY → CREATE INDEX, 인라인 COMMENT → COMMENT ON COLUMN

import fs from 'node:fs'

const [, , inPath, outPath] = process.argv
if (!inPath || !outPath) {
  console.error('Usage: node mysql-to-pg.mjs <input.sql> <output.sql>')
  process.exit(1)
}

const src = fs.readFileSync(inPath, 'utf8')

// ────────────────────────────────────────────────
// 1) CREATE TABLE 블록 추출
// ────────────────────────────────────────────────
const tables = []
const re = /CREATE TABLE\s+`([^`]+)`\s*\(([\s\S]*?)\)\s*ENGINE[^;]*;/g
let m
while ((m = re.exec(src)) !== null) {
  tables.push({ name: m[1], body: m[2] })
}

// ────────────────────────────────────────────────
// 2) 타입 변환
// ────────────────────────────────────────────────
function convertType(mysqlType) {
  let t = mysqlType.trim()

  // unsigned → 제거 (PG에는 unsigned 없음)
  const unsigned = /\bunsigned\b/i.test(t)
  t = t.replace(/\s+unsigned\b/ig, '')

  // zerofill 제거
  t = t.replace(/\s+zerofill\b/ig, '')

  // CHARACTER SET / COLLATE 제거
  t = t.replace(/\s+CHARACTER\s+SET\s+\w+/ig, '')
  t = t.replace(/\s+COLLATE\s+\w+/ig, '')

  // tinyint(1) → smallint (값이 0/1인 MySQL boolean 관례)
  if (/^tinyint\s*\(\s*1\s*\)/i.test(t)) return t.replace(/^tinyint\s*\(\s*1\s*\)/i, 'smallint')
  // tinyint(N) → smallint
  if (/^tinyint\b/i.test(t)) return t.replace(/^tinyint(\s*\(\s*\d+\s*\))?/i, 'smallint')
  // smallint(N) → smallint
  if (/^smallint\b/i.test(t)) return t.replace(/^smallint(\s*\(\s*\d+\s*\))?/i, 'smallint')
  // mediumint(N) → integer
  if (/^mediumint\b/i.test(t)) return t.replace(/^mediumint(\s*\(\s*\d+\s*\))?/i, 'integer')
  // int(N) → unsigned면 bigint, 아니면 integer
  if (/^int\b/i.test(t)) return t.replace(/^int(\s*\(\s*\d+\s*\))?/i, unsigned ? 'bigint' : 'integer')
  // bigint(N) → bigint (PG는 signed 64bit. unsigned bigint는 numeric(20)이 안전하지만 대개 OK)
  if (/^bigint\b/i.test(t)) return t.replace(/^bigint(\s*\(\s*\d+\s*\))?/i, 'bigint')
  // decimal(N,M) / numeric → 그대로
  // float/double
  if (/^double\b/i.test(t)) return t.replace(/^double(\s*\(\s*\d+\s*,\s*\d+\s*\))?/i, 'double precision')
  if (/^float\b/i.test(t)) return t.replace(/^float(\s*\(\s*\d+\s*,\s*\d+\s*\))?/i, 'real')
  // datetime → timestamp
  if (/^datetime\b/i.test(t)) return t.replace(/^datetime(\s*\(\s*\d+\s*\))?/i, 'timestamp')
  // timestamp → timestamp
  // date → date
  // text 계열
  if (/^tinytext\b/i.test(t)) return t.replace(/^tinytext/i, 'text')
  if (/^mediumtext\b/i.test(t)) return t.replace(/^mediumtext/i, 'text')
  if (/^longtext\b/i.test(t)) return t.replace(/^longtext/i, 'text')
  // blob 계열 → bytea
  if (/^(tiny|medium|long)?blob\b/i.test(t)) return t.replace(/^(tiny|medium|long)?blob/i, 'bytea')

  // enum('a','b') → varchar(N) — 길이는 가장 긴 값 기준으로
  const enumMatch = t.match(/^enum\s*\(([^)]+)\)/i)
  if (enumMatch) {
    const vals = enumMatch[1].match(/'([^']*)'/g)?.map((v) => v.slice(1, -1)) ?? []
    const maxLen = Math.max(1, ...vals.map((v) => v.length))
    return t.replace(/^enum\s*\([^)]+\)/i, `varchar(${Math.max(maxLen, 16)})`)
  }

  // set('a','b') → text (PG에 set 없음. 콤마 구분 문자열로)
  if (/^set\s*\(/i.test(t)) return t.replace(/^set\s*\([^)]+\)/i, 'text')

  // year → integer
  if (/^year\b/i.test(t)) return t.replace(/^year(\s*\(\s*\d+\s*\))?/i, 'integer')

  // char(N), varchar(N), decimal, numeric 등은 그대로
  return t
}

// ────────────────────────────────────────────────
// 3) 컬럼/제약 분리 (괄호 깊이 고려한 split)
// ────────────────────────────────────────────────
function splitColumns(body) {
  const parts = []
  let depth = 0
  let buf = ''
  let inStr = false
  let strCh = ''
  for (let i = 0; i < body.length; i++) {
    const c = body[i]
    if (inStr) {
      buf += c
      if (c === strCh && body[i - 1] !== '\\') inStr = false
    } else {
      if (c === "'" || c === '"') { inStr = true; strCh = c; buf += c }
      else if (c === '(') { depth++; buf += c }
      else if (c === ')') { depth--; buf += c }
      else if (c === ',' && depth === 0) { parts.push(buf.trim()); buf = '' }
      else buf += c
    }
  }
  if (buf.trim()) parts.push(buf.trim())
  return parts
}

// ────────────────────────────────────────────────
// 4) 컬럼 라인 변환
// ────────────────────────────────────────────────
function convertColumnLine(line) {
  // `col` type [options] [COMMENT '...']
  const colMatch = line.match(/^`([^`]+)`\s+([\s\S]+)$/)
  if (!colMatch) return null
  const colName = colMatch[1]
  let rest = colMatch[2]

  // COMMENT '...' 분리 (값 안의 "'"는 SQL 이스케이프로 ''로 돼있음)
  let comment = null
  const cm = rest.match(/\s+COMMENT\s+'((?:[^']|'')*)'\s*$/i)
  if (cm) {
    comment = cm[1].replace(/''/g, "'")
    rest = rest.slice(0, cm.index)
  }

  // 타입 + 나머지 옵션 (NOT NULL, DEFAULT, AUTO_INCREMENT 등) 분리
  // 타입 추출: 첫 토큰(+ 괄호 포함) 을 타입으로 간주
  let typePart = ''
  let tail = ''
  const typeMatch = rest.match(/^([a-zA-Z]+(?:\s*\([^)]*\))?)\s*(.*)$/s)
  if (typeMatch) {
    typePart = typeMatch[1]
    tail = typeMatch[2]
  } else {
    typePart = rest
  }

  // type 뒤에 unsigned/zerofill이 붙을 수 있으므로 tail에서 추출
  const unsignedInTail = /\bunsigned\b/i.test(tail)
  if (unsignedInTail) typePart = typePart + ' unsigned'
  tail = tail.replace(/\bunsigned\b/ig, '').replace(/\bzerofill\b/ig, '')

  // tail에서 CHARACTER SET/COLLATE 제거
  tail = tail.replace(/(^|\s)CHARACTER\s+SET\s+\w+/ig, '')
  tail = tail.replace(/(^|\s)COLLATE\s+\w+/ig, '')

  // AUTO_INCREMENT 처리
  const isAutoInc = /\bAUTO_INCREMENT\b/i.test(tail)
  tail = tail.replace(/\s*AUTO_INCREMENT\b/ig, '')

  // ON UPDATE CURRENT_TIMESTAMP 제거 (PG는 트리거로 구현해야 함 — 일단 제거)
  tail = tail.replace(/\s+ON\s+UPDATE\s+CURRENT_TIMESTAMP(\s*\(\s*\)|\(\d+\))?/ig, '')

  // DEFAULT '0000-00-00 00:00:00' / '0000-00-00' → NULL로 (PG는 이 값 거부)
  tail = tail.replace(/DEFAULT\s+'0000-00-00(?:\s+00:00:00)?'/ig, 'DEFAULT NULL')

  // DEFAULT '0' 같은 숫자 문자열 → DEFAULT 0 (PG numeric 컬럼에 숫자 기대)
  // ── 위험하므로 숫자 타입에만 적용 (간단히 정수/decimal/float일 때)
  const pgType = convertType(typePart)
  const isNumeric = /^(smallint|integer|bigint|numeric|decimal|real|double precision|money)/i.test(pgType)
  if (isNumeric) {
    tail = tail.replace(/DEFAULT\s+'(-?\d+(?:\.\d+)?)'/ig, 'DEFAULT $1')
  }

  // AUTO_INCREMENT → GENERATED BY DEFAULT AS IDENTITY
  let finalType = pgType
  if (isAutoInc) {
    finalType = `${pgType} GENERATED BY DEFAULT AS IDENTITY`
  }

  const out = `"${colName}" ${finalType}${tail.trim() ? ' ' + tail.trim() : ''}`.trim()
  return { colName, line: out, comment }
}

// ────────────────────────────────────────────────
// 5) 테이블 변환
// ────────────────────────────────────────────────
function convertTable({ name, body }) {
  const parts = splitColumns(body)

  const colLines = []
  const pkLines = []
  const indexes = []  // {name, cols, unique}
  const columnComments = []  // {col, comment}

  for (const raw of parts) {
    const t = raw.trim()
    if (!t) continue

    // PRIMARY KEY (`col`[, `col2`])
    const pkMatch = t.match(/^PRIMARY\s+KEY\s*\(([^)]+)\)/i)
    if (pkMatch) {
      const cols = pkMatch[1].match(/`([^`]+)`/g)?.map((x) => `"${x.slice(1, -1)}"`).join(', ')
      pkLines.push(`PRIMARY KEY (${cols})`)
      continue
    }

    // UNIQUE KEY `name` (`col`, ...)
    const uniqMatch = t.match(/^UNIQUE\s+(?:KEY|INDEX)?\s*`([^`]+)`\s*\(([^)]+)\)/i)
    if (uniqMatch) {
      const idxName = uniqMatch[1]
      const cols = uniqMatch[2].match(/`([^`]+)`(?:\s*\(\d+\))?/g)
        ?.map((x) => `"${x.replace(/`/g, '').replace(/\s*\(\d+\)$/, '')}"`).join(', ')
      indexes.push({ name: idxName, cols, unique: true })
      continue
    }

    // KEY `name` (`col`, ...) / INDEX
    const keyMatch = t.match(/^(?:KEY|INDEX)\s+`([^`]+)`\s*\(([^)]+)\)/i)
    if (keyMatch) {
      const idxName = keyMatch[1]
      const cols = keyMatch[2].match(/`([^`]+)`(?:\s*\(\d+\))?/g)
        ?.map((x) => `"${x.replace(/`/g, '').replace(/\s*\(\d+\)$/, '')}"`).join(', ')
      indexes.push({ name: idxName, cols, unique: false })
      continue
    }

    // CONSTRAINT/FULLTEXT/SPATIAL — 일단 스킵
    if (/^(CONSTRAINT|FULLTEXT|SPATIAL)\b/i.test(t)) continue

    // 컬럼 라인
    const parsed = convertColumnLine(t)
    if (parsed) {
      colLines.push(parsed.line)
      if (parsed.comment) columnComments.push({ col: parsed.colName, comment: parsed.comment })
    }
  }

  let sql = ''
  sql += `DROP TABLE IF EXISTS "${name}" CASCADE;\n`
  sql += `CREATE TABLE "${name}" (\n`
  sql += [...colLines, ...pkLines].map((l) => '  ' + l).join(',\n')
  sql += '\n);\n'

  for (const idx of indexes) {
    // 인덱스 이름 충돌 방지를 위해 테이블명 prefix 추가
    const idxName = `${name}_${idx.name}`
    sql += `CREATE ${idx.unique ? 'UNIQUE ' : ''}INDEX "${idxName}" ON "${name}" (${idx.cols});\n`
  }

  for (const cc of columnComments) {
    const escaped = cc.comment.replace(/'/g, "''")
    sql += `COMMENT ON COLUMN "${name}"."${cc.col}" IS '${escaped}';\n`
  }

  sql += '\n'
  return sql
}

// ────────────────────────────────────────────────
// 6) 출력
// ────────────────────────────────────────────────
let out = ''
out += '-- 자동 변환 (MySQL → PostgreSQL, 스키마만)\n'
out += `-- 원본: ${inPath}\n`
out += `-- 변환: ${new Date().toISOString()}\n`
out += `-- 테이블 수: ${tables.length}\n\n`
out += 'BEGIN;\n\n'

for (const tb of tables) {
  out += `-- ============ ${tb.name} ============\n`
  out += convertTable(tb)
}

out += 'COMMIT;\n'

fs.writeFileSync(outPath, out, 'utf8')
console.log(`✓ ${tables.length}개 테이블 변환 완료 → ${outPath}`)
console.log(`  라인 수: ${out.split('\n').length}`)
