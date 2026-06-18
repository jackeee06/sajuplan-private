import * as crypto from 'crypto';

/**
 * 민감 개인정보(주민번호 등) 암호화 — AES-256-GCM.
 *
 * - 모집인 정산 원천징수 신고용 주민번호를 저장 at rest 암호화한다.
 * - 키는 안정적인 서버 시크릿(JWT_SECRET 등)에서 scrypt 로 32바이트 파생.
 *   시크릿이 바뀌면 복호화 불가하므로 운영 시 PII_CRYPT_KEY 고정 권장.
 * - 저장 포맷: base64(iv).base64(authTag).base64(ciphertext)  (점 구분)
 */
const ALGO = 'aes-256-gcm';

function deriveKey(rawSecret: string): Buffer {
  // scrypt: 동일 시크릿 → 동일 키. salt 는 고정(스키마 호환 목적).
  return crypto.scryptSync(rawSecret, 'sajuplan-promoter-pii', 32);
}

export function encryptPii(plain: string, rawSecret: string): string {
  const key = deriveKey(rawSecret);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${ct.toString('base64')}`;
}

export function decryptPii(enc: string, rawSecret: string): string {
  const parts = (enc || '').split('.');
  if (parts.length !== 3) throw new Error('잘못된 암호문 포맷');
  const [ivB64, tagB64, ctB64] = parts;
  const key = deriveKey(rawSecret);
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const pt = Buffer.concat([
    decipher.update(Buffer.from(ctB64, 'base64')),
    decipher.final(),
  ]);
  return pt.toString('utf8');
}

/** 주민번호 마스킹: 9012311234567 → 901231-1****** (앞 6 + 성별1자리 + 나머지 가림) */
export function maskRrn(rrn: string): string {
  const d = (rrn || '').replace(/\D/g, '');
  if (d.length < 7) return '******';
  return `${d.slice(0, 6)}-${d.slice(6, 7)}******`;
}
