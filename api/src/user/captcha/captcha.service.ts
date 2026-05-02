import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'node:crypto';

interface CaptchaPayload {
  type: 'captcha';
  text: string;
}

/**
 * 자동등록방지(캡차) — 단기 JWT 토큰 + SVG 이미지.
 *
 *  1) GET /captcha → 서버가 텍스트 + 토큰 발급 (5분 유효)
 *     - 텍스트는 SVG 안에서만 렌더되고 응답에 평문으로 노출하지 않는다
 *  2) 폼 제출 시 토큰 + 사용자가 본 텍스트(input) 를 같이 보냄
 *     - 서버가 토큰 서명 검증 + 평문 텍스트 일치 검증
 *
 * SVG 는 글자 회전 + 라인/점 노이즈로 봇 OCR 회피.
 */
@Injectable()
export class CaptchaService {
  constructor(private readonly jwt: JwtService) {}

  async issue(): Promise<{ token: string; svg: string }> {
    // 6자리 영숫자 (대문자만, 0/O/1/I 등 헷갈리는 문자 제외)
    const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const buf = randomBytes(6);
    let text = '';
    for (let i = 0; i < 6; i++) {
      text += ALPHABET[buf[i] % ALPHABET.length];
    }
    const token = await this.jwt.signAsync(
      { type: 'captcha', text } satisfies CaptchaPayload,
      { expiresIn: '5m' },
    );
    return { token, svg: this.renderSvg(text) };
  }

  async verify(token: string, input: string): Promise<void> {
    if (!token || !input) {
      throw new BadRequestException('자동등록방지 입력이 올바르지 않습니다.');
    }
    let payload: CaptchaPayload;
    try {
      payload = await this.jwt.verifyAsync<CaptchaPayload>(token);
    } catch {
      throw new BadRequestException(
        '자동등록방지가 만료되었습니다. 새로고침 후 다시 시도해주세요.',
      );
    }
    if (payload.type !== 'captcha') {
      throw new BadRequestException('자동등록방지 토큰이 올바르지 않습니다.');
    }
    if (payload.text.toUpperCase() !== input.trim().toUpperCase()) {
      throw new BadRequestException('자동등록방지 숫자가 틀렸습니다.');
    }
  }

  /**
   * 텍스트를 변형된 SVG 로 렌더 — 강한 회전 + 글자 겹침 + 노이즈 라인/점.
   * 봇이 평문으로 응답을 파싱해 사용하지 못하게 한다.
   * 사람은 충분히 알아볼 수 있도록 글자 색은 짙게, 노이즈는 옅게.
   */
  private renderSvg(text: string): string {
    const W = 130;
    const H = 44;
    const charColors = ['#1E2939', '#0F172A', '#374151', '#1F2937', '#111827'];
    const noiseColors = [
      '#9B7AF7',
      '#8259F5',
      '#FF6467',
      '#00BBA7',
      '#F59E0B',
      '#3B82F6',
      '#10B981',
    ];
    const rand = (min: number, max: number) => Math.random() * (max - min) + min;

    const parts: string[] = [];
    parts.push(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
    );
    parts.push(`<rect width="${W}" height="${H}" fill="#F9FAFB"/>`);

    // 곡선 노이즈 라인 — 더 많이 (8개)
    for (let i = 0; i < 8; i++) {
      const x1 = rand(0, W);
      const y1 = rand(0, H);
      const x2 = rand(0, W);
      const y2 = rand(0, H);
      const cx = rand(0, W);
      const cy = rand(0, H);
      const stroke = noiseColors[Math.floor(rand(0, noiseColors.length))];
      const sw = rand(0.6, 1.4).toFixed(1);
      parts.push(
        `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="${stroke}" stroke-width="${sw}" fill="none" opacity="0.55"/>`,
      );
    }

    // 점 노이즈 — 더 많이 (60개)
    for (let i = 0; i < 60; i++) {
      const cx = rand(0, W);
      const cy = rand(0, H);
      const r = rand(0.4, 1.8).toFixed(1);
      const fill = noiseColors[Math.floor(rand(0, noiseColors.length))];
      parts.push(
        `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r}" fill="${fill}" opacity="0.55"/>`,
      );
    }

    // 글자 — 강한 회전(-35°~+35°), 글자 폭 좁게 → 살짝 겹침, 사이즈 조금씩 다르게
    const charWidth = (W - 14) / text.length - 2; // 살짝 좁게 → 겹침
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const x = 12 + i * charWidth + charWidth / 2 + rand(-3, 3);
      const y = H / 2 + 7 + rand(-3, 3);
      const rot = rand(-35, 35).toFixed(1);
      const fontSize = (22 + rand(-2, 4)).toFixed(0);
      const fill = charColors[Math.floor(rand(0, charColors.length))];
      const skew = rand(-8, 8).toFixed(1);
      parts.push(
        `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-family="Pretendard, monospace" font-size="${fontSize}" font-weight="800" fill="${fill}" text-anchor="middle" transform="rotate(${rot} ${x.toFixed(1)} ${y.toFixed(1)}) skewX(${skew})">${ch}</text>`,
      );
    }

    // 글자 위로 추가 라인 노이즈 (글자를 가로지름)
    for (let i = 0; i < 3; i++) {
      const y1 = rand(H * 0.2, H * 0.8);
      const y2 = rand(H * 0.2, H * 0.8);
      const stroke = noiseColors[Math.floor(rand(0, noiseColors.length))];
      parts.push(
        `<line x1="0" y1="${y1.toFixed(1)}" x2="${W}" y2="${y2.toFixed(1)}" stroke="${stroke}" stroke-width="1" opacity="0.35"/>`,
      );
    }

    parts.push('</svg>');
    return parts.join('');
  }
}
