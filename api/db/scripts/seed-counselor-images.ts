/**
 * 상담사 25명에게 paired 이미지 (square / wide) 15쌍을 round-robin 으로 분배.
 *
 * 입력:
 *   - <repo>/images/square/square_01..15.png  → kind='profile' (정사각, 아바타)
 *   - <repo>/images/oblong/wide_01..15.png    → kind='wide'    (직사각, 히어로)
 *
 * 동작:
 *   1) member 에서 role='counselor' AND left_at IS NULL 을 id ASC 로 조회
 *   2) 각 counselor 의 index i 에 대해 pair = (i % 15) + 1
 *   3) api/uploads/member/ 에 timestamp_random 명으로 복사 (counselor 별 고유 파일명)
 *   4) sharp 로 .webp 사이블링 생성
 *   5) member_file 에서 해당 member 의 kind IN ('profile','wide') 삭제 후 새 row 삽입
 */
import 'dotenv/config';
import { promises as fsp } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import postgres from 'postgres';
import { convertImageToWebp } from '../../src/shared/common/image-to-webp';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('[err] DATABASE_URL 미설정');
  process.exit(1);
}

const REPO_ROOT = join(__dirname, '..', '..', '..');
const IMG_SQUARE_DIR = join(REPO_ROOT, 'images', 'square');
const IMG_OBLONG_DIR = join(REPO_ROOT, 'images', 'oblong');
const UPLOADS_MEMBER = join(process.cwd(), 'uploads', 'member');

const PAIR_COUNT = 15;

const sql = postgres(DATABASE_URL, { max: 1, prepare: false });

function genStoredName(ext: string): string {
  // 운영 컨벤션: <13-digit ms>_<6-char alnum>.<ext>
  const ts = Date.now().toString();
  const rand = randomBytes(4).toString('base64url').slice(0, 6).toLowerCase();
  return `${ts}_${rand}${ext}`;
}

async function main() {
  await fsp.mkdir(UPLOADS_MEMBER, { recursive: true });
  console.log(`▸ uploads/member: ${UPLOADS_MEMBER}`);

  const counselors = await sql<{ id: number; mb_id: string; nickname: string }[]>`
    SELECT id, mb_id, nickname
      FROM member
     WHERE role='counselor' AND left_at IS NULL
     ORDER BY id ASC
  `;
  console.log(`▸ 활성 상담사: ${counselors.length}명`);

  let ok = 0;
  for (let i = 0; i < counselors.length; i++) {
    const c = counselors[i];
    const pair = (i % PAIR_COUNT) + 1;
    const nn = String(pair).padStart(2, '0');

    const srcSquare = join(IMG_SQUARE_DIR, `square_${nn}.png`);
    const srcOblong = join(IMG_OBLONG_DIR, `wide_${nn}.png`);

    // 고유 stored_name 생성 (counselor 별로 다른 파일이 되도록)
    const profileName = genStoredName('.png');
    // 같은 ms 안에 두 번 호출되면 충돌 가능 — wide 는 1ms 후 호출되도록 약간 대기
    await new Promise((r) => setTimeout(r, 2));
    const wideName = genStoredName('.png');

    const profileDest = join(UPLOADS_MEMBER, profileName);
    const wideDest = join(UPLOADS_MEMBER, wideName);

    await fsp.copyFile(srcSquare, profileDest);
    await fsp.copyFile(srcOblong, wideDest);

    const profileWebp = await convertImageToWebp(profileDest);
    const wideWebp = await convertImageToWebp(wideDest);

    const profileSize = (await fsp.stat(profileDest)).size;
    const wideSize = (await fsp.stat(wideDest)).size;

    // 트랜잭션: 기존 profile/wide 정리 후 새로 삽입
    await sql.begin(async (tx) => {
      await tx`
        DELETE FROM member_file
         WHERE member_id = ${c.id}
           AND kind IN ('profile','wide')
      `;
      const maxRows = await tx<{ max: number | null }[]>`
        SELECT COALESCE(MAX(no), 0) AS max FROM member_file WHERE member_id = ${c.id}
      `;
      let nextNo = (Number(maxRows[0]?.max ?? 0) || 0) + 1;

      await tx`
        INSERT INTO member_file
          (member_id, no, kind, source_name, stored_name, stored_name_webp,
           filesize, file_type)
        VALUES
          (${c.id}, ${nextNo}, 'profile', ${`square_${nn}.png`},
           ${profileName}, ${profileWebp.webpFilename ?? null},
           ${profileSize}, 1)
      `;
      nextNo++;
      await tx`
        INSERT INTO member_file
          (member_id, no, kind, source_name, stored_name, stored_name_webp,
           filesize, file_type)
        VALUES
          (${c.id}, ${nextNo}, 'wide', ${`wide_${nn}.png`},
           ${wideName}, ${wideWebp.webpFilename ?? null},
           ${wideSize}, 1)
      `;
    });

    ok++;
    console.log(
      `  [${ok}/${counselors.length}] #${c.id} ${c.nickname} ← pair${nn} ` +
        `(profile=${profileName}, wide=${wideName})`,
    );
  }

  console.log(`\n✓ 완료 — ${ok}명 처리`);
  await sql.end();
}

main().catch((e) => {
  console.error('[err]', e);
  process.exit(1);
});
