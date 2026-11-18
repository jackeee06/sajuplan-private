// 정적 prerender — 빌드 후 ROUTES별 dist/{route}/index.html 생성.
// 카톡·네이버 봇은 JS를 실행 못 하므로, 각 경로에 per-page <title>·OG·봇용 소개 콘텐츠를 심는다.
// SPA는 그대로(React가 #root를 hydrate). nginx try_files $uri/가 /tojeong/ → /tojeong/index.html 서빙(서버 무변경).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, "..", "dist");
const BASE = "https://unse.sajuplan.com";

// 라우트별 메타 + 봇용 소개(검색 스니펫·공유 설명). 콘텐츠는 일반 안내(개인화 결과는 JS가 채움).
const PAGES = {
  today: ["오늘의 운세", "생년월일로 보는 오늘의 종합운·애정·금전·직장·건강운과 행운요소. 만세력 일진론 기반 무료 운세."],
  zodiac: ["띠별 운세", "쥐·소·호랑이…열두 띠별 오늘의 운세를 무료로. 내 띠 운세를 한눈에 확인하세요."],
  star: ["별자리 운세", "물병·물고기·양…열두 별자리 이번주 운세를 무료로 확인하세요."],
  newyear: ["신년운세", "올해와 내년 한 해의 세운·총운·분야별 운세를 만세력으로. 2027 신년운세 미리보기."],
  monthly: ["월간 운세", "이번 달 월운 흐름과 분야별 운세를 무료로 확인하세요."],
  lotto: ["오늘의 행운번호", "사주로 뽑는 평생 운명번호와 오늘의 행운번호. 무료 로또 행운번호 추천(당첨 보장 아님)."],
  dream: ["꿈해몽", "돼지꿈·뱀꿈·똥꿈 등 인기 꿈 100종 해몽을 상황별로 풍성하게. 길흉·행운번호까지 무료."],
  couple: ["궁합", "두 사람 생년월일로 보는 사주 궁합 — 겉궁합·속궁합·합충·전생 인연까지 무료로."],
  wealth: ["재물운", "사주로 보는 재물 그릇·돈 들어오는 시기·평생 재물 흐름을 무료로 확인하세요."],
  life: ["평생운세", "타고난 기질과 대운 흐름으로 보는 평생운세. 인생 캐릭터·황금기·천직까지."],
  taegil: ["택일", "이사·결혼·개업·계약·여행 좋은 날을 정통 택일로. 손없는날·황도길일·건제12신 무료."],
  tojeong: ["토정비결", "올해와 내년 토정비결 — 정통 144괘 작괘로 보는 신수와 달별 운세. 2027 토정비결 무료."],
  celeb: ["연예인 궁합", "좋아하는 스타 유형과 나의 케미를 사주 궁합으로. 이상형 판정·가상 데이트 시나리오까지."],
  blood: ["혈액형 궁합", "A·B·O·AB형 16조합 궁합과 성격·연애 스타일·실전 팁을 무료로(재미용)."],
  petal: ["꽃잎점", "그 사람의 마음을 꽃잎점으로 — 마음 게이지·썸 단계·고백 타이밍까지 짝사랑 리포트."],
  cookie: ["포춘쿠키", "오늘의 포춘쿠키 한 줄·분야별 운·행운요소·테마 쿠키를 매일 무료로."],
  mbti: ["MBTI 운세", "16가지 MBTI별 오늘의 운세와 MBTI 궁합을 무료로. 내 유형의 성격·연애·금전운까지 한눈에."],
  namecompat: ["이름 궁합", "두 사람 이름으로 보는 궁합 — 전통 성명학 오행 케미와 5항목 점수를 무료로(재미용)."],
  pastlife: ["전생 이야기", "생년월일로 보는 나의 전생 — 신분·성격·못다한 한·전생의 인연과 이번 생의 숙제까지."],
};

const tmpl = readFileSync(join(DIST, "index.html"), "utf8");

function build(route, title, desc) {
  const full = `${title} — 사주플랜`;
  const url = `${BASE}/${route}`;
  let html = tmpl
    .replace(/<title>[^<]*<\/title>/, `<title>${full}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${desc}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${full}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${desc}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${url}$2`);
  // 봇용 소개(JS 로드 전 잠깐 보이고, React mount 시 교체). 검색 스니펫·접근성에 도움.
  const seo = `<div id="root"><main style="padding:24px;font-family:Pretendard,sans-serif"><h1 style="font-size:20px;color:#ec4899">${title} — 사주플랜 무료 운세</h1><p style="margin-top:8px;color:#444;line-height:1.6">${desc}</p><p style="margin-top:8px;color:#888">불러오는 중…</p></main></div>`;
  html = html.replace('<div id="root"></div>', seo);
  const dir = join(DIST, route);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), html, "utf8");
}

let n = 0;
for (const [route, [title, desc]] of Object.entries(PAGES)) { build(route, title, desc); n++; }

// sitemap.xml — 검색엔진 색인용(home + 전 라우트). robots.txt — 봇 허용 + sitemap 위치.
const today = new Date().toISOString().slice(0, 10);
const urls = ["", ...Object.keys(PAGES)].map((r) => {
  const pri = r === "" ? "1.0" : ["today", "dream", "tojeong", "couple", "newyear"].includes(r) ? "0.9" : "0.7";
  return `  <url><loc>${BASE}/${r}</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>${pri}</priority></url>`;
}).join("\n");
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
writeFileSync(join(DIST, "sitemap.xml"), sitemap, "utf8");
const robots = `User-agent: *\nAllow: /\n\nSitemap: ${BASE}/sitemap.xml\n`;
writeFileSync(join(DIST, "robots.txt"), robots, "utf8");

console.log(`prerender: ${n}개 라우트 정적 페이지 + sitemap.xml(${Object.keys(PAGES).length + 1}) + robots.txt 생성`);
