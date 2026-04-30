/**
 * 관리자 비밀번호 설정/리셋 CLI
 *
 * 사용:
 *   ts-node db/scripts/set-admin-password.ts <login_id> <new_password>
 *   ts-node db/scripts/set-admin-password.ts admin 'StrongPass!234'
 *
 * 동작:
 *   - member 테이블의 role='admin' & login_id 조회
 *   - 비밀번호를 bcrypt(cost=12)로 해시하여 갱신
 *   - 평문 비밀번호는 stdout에 출력하지 않음 (셸 히스토리 외부 노출 주의)
 */
import 'dotenv/config';
import bcrypt from 'bcrypt';
import postgres from 'postgres';

async function main() {
  const [, , loginId, newPassword] = process.argv;
  if (!loginId || !newPassword) {
    console.error('사용법: ts-node db/scripts/set-admin-password.ts <login_id> <new_password>');
    process.exit(1);
  }
  if (newPassword.length < 8) {
    console.error('비밀번호는 8자 이상이어야 합니다.');
    process.exit(1);
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL 미설정. api/.env 확인');
    process.exit(1);
  }

  const sql = postgres(url, { max: 1 });
  try {
    const hash = await bcrypt.hash(newPassword, 12);
    const rows = await sql<{ id: number; login_id: string | null }[]>`
      UPDATE member
         SET password = ${hash}
       WHERE login_id = ${loginId}
         AND role = 'admin'
         AND left_at IS NULL
       RETURNING id, login_id
    `;
    if (rows.length === 0) {
      console.error(`role='admin'인 login_id='${loginId}' 멤버를 찾지 못했습니다.`);
      process.exit(2);
    }
    console.log(`OK: id=${rows[0].id}, login_id=${rows[0].login_id} 비밀번호 갱신 완료`);
  } finally {
    await sql.end({ timeout: 2 });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
