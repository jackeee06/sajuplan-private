import * as crypto from 'crypto';

/**
 * AG9 자동결제 등록 시 카드정보 AES-128-CBC 암호화.
 *
 * 매뉴얼 (docs/엠투넷-결제-v1.6 별첨1) 규칙:
 *   "암호화 키는 엠투넷에서 배포한 Authorization 값의 앞 16자리만 취하여 사용한다.
 *    알고리즘: AES CBC(인코딩), SHA512(키)"
 *
 * 절차:
 *   1) Authorization 값(예: "f58cdy2sXhkOdp2YSJUjuqEJB", 25자)의 앞 16자만 자른다 → seed16
 *   2) IV = seed16 (16 bytes, utf8)
 *   3) SHA512(seed16) 의 hex string의 앞 16 chars → key (16 bytes, utf8)
 *      (PHP openssl_encrypt 의 키 truncate 동작과 매칭)
 *   4) AES-128-CBC, OPENSSL_RAW_DATA → base64
 *
 * 즉 raw input(.env의 CARD_CRYPT_KEY) 길이와 무관하게 항상 앞 16자만 사용한다.
 */
export function encryptCardField(plain: string, rawKey: string): string {
  const seed16 = rawKey.slice(0, 16);                                       // Authorization 앞 16자
  const shaHex = crypto.createHash('sha512').update(seed16, 'utf8').digest('hex');
  const key = Buffer.from(shaHex.slice(0, 16), 'utf8');                     // SHA512 hex의 앞 16 ASCII chars
  const iv = Buffer.from(seed16, 'utf8');                                   // IV = seed16 (16 bytes)
  const cipher = crypto.createCipheriv('aes-128-cbc', key, iv);
  const buf = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return buf.toString('base64');
}

/** 카드번호 마스킹: 1234567812345678 → 1234-****-****-5678 */
export function maskCardNumber(cardno: string): string {
  const digits = cardno.replace(/\D/g, '');
  if (digits.length < 12) return '****';
  return `${digits.slice(0, 4)}-****-****-${digits.slice(-4)}`;
}
