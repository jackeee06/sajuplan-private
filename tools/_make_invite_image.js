/**
 * 모집인 초대 카톡 카드용 정사각형 이미지(1차) 생성.
 *   사용: node tools/_make_invite_image.js <out.png>   (api/node_modules/sharp 사용)
 * 디자인: 보라→핑크 그라데이션 + 혜택 카피 + 사주플랜 워드마크. 디자이너 시안 나오면 교체.
 */
const path = require('path')
const sharp = require(path.join(__dirname, '..', 'api', 'node_modules', 'sharp'))

const W = 800
const svg = `<svg width="${W}" height="${W}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#8259F5"/>
      <stop offset="1" stop-color="#EC4899"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${W}" fill="url(#g)"/>
  <rect x="40" y="40" width="${W - 80}" height="${W - 80}" rx="36" fill="none" stroke="#FFFFFF" stroke-opacity="0.25" stroke-width="3"/>
  <text x="400" y="172" font-family="Malgun Gothic, sans-serif" font-size="33" font-weight="600" fill="#FFFFFF" fill-opacity="0.95" text-anchor="middle">사주플랜 서포터즈</text>
  <text x="400" y="300" font-family="Malgun Gothic, sans-serif" font-size="66" font-weight="800" fill="#FFFFFF" text-anchor="middle">소개만 하면</text>
  <text x="400" y="398" font-family="Malgun Gothic, sans-serif" font-size="62" font-weight="800" fill="#FFFFFF" text-anchor="middle">상담마다 <tspan fill="#FDE047">3% 자동수입</tspan></text>
  <text x="400" y="508" font-family="Malgun Gothic, sans-serif" font-size="30" fill="#FFFFFF" fill-opacity="0.95" text-anchor="middle">내가 소개한 분이 상담할 때마다</text>
  <text x="400" y="551" font-family="Malgun Gothic, sans-serif" font-size="30" fill="#FFFFFF" fill-opacity="0.95" text-anchor="middle">그 금액의 3%가 내 수입으로</text>
  <text x="400" y="672" font-family="Malgun Gothic, sans-serif" font-size="31" font-weight="700" fill="#FFFFFF" fill-opacity="0.85" text-anchor="middle">가입 후 3개월 · SAJUPLAN</text>
</svg>`

sharp(Buffer.from(svg))
  .png()
  .toFile(process.argv[2] || 'promoter-owner-invite.png')
  .then((info) => console.log('OK', JSON.stringify(info)))
  .catch((e) => {
    console.error('FAIL', e.message)
    process.exit(1)
  })
