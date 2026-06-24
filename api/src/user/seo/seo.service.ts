import { Inject, Injectable, Logger } from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';
import { runtimeEnv } from '../../shared/env/runtime-env';
import { UserCounselorsService } from '../counselors/counselors.service';
import { UserNoticesService } from '../notices/notices.service';
import { UserEventsService } from '../events/events.service';

/**
 * SEO 서버렌더 엔진 (dynamic rendering).
 *
 * 사용자 사이트는 CSR SPA 라 크롤러/카톡 스크래퍼가 빈 #root 만 본다.
 * nginx 가 봇 UA 요청을 /api/seo/render 로 프록시(X-Original-Path 헤더에 원 경로) →
 * 이 서비스가 DB 데이터로 풀 HTML(제목·메타·OG·JSON-LD·본문)을 그려서 돌려준다.
 * 사람(일반 UA)은 nginx try_files 로 기존 SPA 를 그대로 받는다.
 *
 * 클로킹 금지 원칙: 봇에게 주는 본문은 사람이 SPA 에서 보는 것과 동일한 공개 데이터다.
 * 별점(rating)은 현재 UI 비노출 정책이라 구조화 데이터에도 넣지 않는다(화면-데이터 불일치 패널티 회피).
 */
@Injectable()
export class SeoService {
  private readonly logger = new Logger(SeoService.name);
  private readonly cache = new Map<string, { html: string; status: number; exp: number }>();
  private readonly RENDER_TTL = 600_000; // 10분
  private readonly SITEMAP_TTL = 1_800_000; // 30분

  constructor(
    @Inject(SQL) private readonly sql: Sql,
    private readonly counselors: UserCounselorsService,
    private readonly notices: UserNoticesService,
    private readonly events: UserEventsService,
  ) {}

  private site(): string {
    return (runtimeEnv().userSiteUrl || 'https://sajuplan.com').replace(/\/$/, '');
  }

  // ── 공개 진입점 ──────────────────────────────
  async render(originalPath: string): Promise<{ status: number; html: string }> {
    const path = this.cleanPath(originalPath);
    const cached = this.cache.get(`r:${path}`);
    const now = Date.now();
    if (cached && cached.exp > now) return { status: cached.status, html: cached.html };

    let out: { status: number; html: string };
    try {
      out = await this.route(path);
    } catch (e) {
      this.logger.warn(`render fail path=${path}: ${e instanceof Error ? e.message : String(e)}`);
      out = { status: 404, html: this.notFoundHtml(path) };
    }
    this.cache.set(`r:${path}`, { ...out, exp: now + this.RENDER_TTL });
    return out;
  }

  async sitemap(): Promise<string> {
    const cached = this.cache.get('sitemap');
    const now = Date.now();
    if (cached && cached.exp > now) return cached.html;
    const xml = await this.buildSitemap();
    this.cache.set('sitemap', { html: xml, status: 200, exp: now + this.SITEMAP_TTL });
    return xml;
  }

  // ── 라우팅 ──────────────────────────────────
  private async route(path: string): Promise<{ status: number; html: string }> {
    if (path === '/' || path === '') return { status: 200, html: await this.renderHome() };
    if (path === '/counselors') return { status: 200, html: await this.renderCounselorList() };

    const cDetail = path.match(/^\/counselors\/(\d+)$/);
    if (cDetail) return this.renderCounselorDetail(Number(cDetail[1]));

    const notice = path.match(/^\/mypage\/notices\/(\d+)$/);
    if (notice) return this.renderNotice(Number(notice[1]));

    const event = path.match(/^\/mypage\/events\/(\d+)$/);
    if (event) return this.renderEvent(Number(event[1]));

    // nginx 가 위 경로만 보내므로 여기 도달은 드묾 — 메인으로 안전 폴백(noindex)
    return { status: 200, html: await this.renderHome() };
  }

  // ── 페이지별 렌더 ────────────────────────────
  private async renderHome(): Promise<string> {
    const site = this.site();
    let cards = '';
    try {
      const items = await this.counselors.list({ tab: 'all', limit: 24 });
      cards = items
        .map(
          (c) =>
            `<li><a href="/counselors/${c.id}">${esc(c.nickname || c.name)}</a>` +
            (c.headline ? ` — ${esc(c.headline)}` : '') +
            `</li>`,
        )
        .join('\n');
    } catch {
      /* 목록 실패해도 메인은 렌더 */
    }
    const title = '사주플랜 — 사주·타로·신점 전화/채팅 상담';
    const description =
      '검증된 사주·타로·신점·심리 상담사와 전화·채팅으로 바로 상담하세요. 사주플랜에서 나에게 맞는 상담사를 찾아보세요.';
    const jsonLd = [
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: '사주플랜',
        url: site + '/',
        potentialAction: {
          '@type': 'SearchAction',
          target: `${site}/search?q={query}`,
          'query-input': 'required name=query',
        },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: '사주플랜',
        url: site + '/',
        logo: `${site}/android-chrome-512x512.png`,
      },
    ];
    const body = `
      <h1>사주플랜 — 사주·타로·신점 상담</h1>
      <p>${esc(description)}</p>
      <nav><a href="/counselors">상담사 전체 보기</a></nav>
      <h2>추천 상담사</h2>
      <ul>${cards}</ul>`;
    return this.page({
      title,
      description,
      canonicalPath: '/',
      image: `${site}/android-chrome-512x512.png`,
      ogType: 'website',
      jsonLd,
      body,
    });
  }

  private async renderCounselorList(): Promise<string> {
    const site = this.site();
    let cards = '';
    try {
      const items = await this.counselors.list({ tab: 'all', limit: 100 });
      cards = items
        .map(
          (c) =>
            `<li><a href="/counselors/${c.id}">${esc(c.nickname || c.name)}</a>` +
            (c.category ? ` <span>[${esc(c.category)}]</span>` : '') +
            (c.headline ? ` — ${esc(c.headline)}` : '') +
            `</li>`,
        )
        .join('\n');
    } catch {
      /* ignore */
    }
    const title = '상담사 전체 — 사주·타로·신점·심리 | 사주플랜';
    const description =
      '사주플랜의 사주·타로·신점·심리 상담사를 한눈에. 전화·채팅으로 바로 상담 가능한 상담사를 찾아보세요.';
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: title,
      url: site + '/counselors',
    };
    const body = `
      <h1>상담사 전체</h1>
      <p>${esc(description)}</p>
      <ul>${cards}</ul>`;
    return this.page({ title, description, canonicalPath: '/counselors', ogType: 'website', jsonLd, body });
  }

  private async renderCounselorDetail(id: number): Promise<{ status: number; html: string }> {
    const site = this.site();
    const c = await this.counselors.getDetail(id).catch(() => null);
    if (!c) return { status: 404, html: this.notFoundHtml(`/counselors/${id}`) };

    const displayName = c.nickname || c.name;
    const cat = c.category && c.category !== '기타' ? c.category : '사주·타로·신점';
    const descSrc =
      c.headline ||
      stripHtml(c.intro || '') ||
      stripHtml(c.bio || '') ||
      `${displayName} 상담사와 사주플랜에서 전화·채팅 상담을 시작해보세요.`;
    const description = truncate(descSrc, 155);
    const title = `${displayName} (${cat} 상담사) | 사주플랜`;
    const image = this.abs(c.profile_image || c.hero_image);
    const canonicalPath = `/counselors/${id}`;

    const hashtags = (c.hashtags || []).filter(Boolean);
    const fields = (c.fields || []).filter(Boolean);

    const jsonLd: Record<string, unknown>[] = [
      {
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: displayName,
        url: site + canonicalPath,
        ...(image ? { image } : {}),
        jobTitle: `${cat} 상담사`,
        ...(c.headline ? { description: c.headline } : {}),
        worksFor: { '@type': 'Organization', name: '사주플랜', url: site + '/' },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '상담사', item: site + '/counselors' },
          { '@type': 'ListItem', position: 2, name: displayName, item: site + canonicalPath },
        ],
      },
    ];

    const body = `
      <article>
        <h1>${esc(displayName)} <small>${esc(cat)} 상담사</small></h1>
        ${image ? `<img src="${esc(image)}" alt="${esc(displayName)} 프로필" width="240" />` : ''}
        ${c.headline ? `<p class="headline">${esc(c.headline)}</p>` : ''}
        ${fields.length ? `<p>전문분야: ${fields.map(esc).join(', ')}</p>` : ''}
        ${hashtags.length ? `<p>${hashtags.map((h) => '#' + esc(h)).join(' ')}</p>` : ''}
        <p>후기 ${Number(c.review_count) || 0}개 · 단골 ${Number(c.fan_count) || 0}명</p>
        ${c.intro ? `<section><h2>상담사 소개</h2><div>${sanitizeBlock(c.intro)}</div></section>` : ''}
        ${c.career && c.career.length ? `<section><h2>약력</h2><ul>${c.career.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>` : ''}
        ${c.notice_content ? `<section><h2>공지</h2><div>${sanitizeBlock(c.notice_content)}</div></section>` : ''}
        <p><a href="/counselors">다른 상담사 보기</a></p>
      </article>`;

    return {
      status: 200,
      html: this.page({ title, description, canonicalPath, image, ogType: 'profile', jsonLd, body }),
    };
  }

  private async renderNotice(id: number): Promise<{ status: number; html: string }> {
    const n = await this.notices.detail(id).catch(() => null);
    if (!n) return { status: 404, html: this.notFoundHtml(`/mypage/notices/${id}`) };
    const title = `${n.title} | 사주플랜 공지`;
    const description = truncate(stripHtml(n.content || ''), 155) || n.title;
    const canonicalPath = `/mypage/notices/${id}`;
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: n.title,
      datePublished: n.created_at,
      dateModified: n.updated_at || n.created_at,
      author: { '@type': 'Organization', name: '사주플랜' },
      url: this.site() + canonicalPath,
    };
    const body = `<article><h1>${esc(n.title)}</h1><div>${sanitizeBlock(n.content || '')}</div></article>`;
    return { status: 200, html: this.page({ title, description, canonicalPath, ogType: 'article', jsonLd, body }) };
  }

  private async renderEvent(id: number): Promise<{ status: number; html: string }> {
    const ev = await this.events.detail(id).catch(() => null);
    if (!ev) return { status: 404, html: this.notFoundHtml(`/mypage/events/${id}`) };
    const title = `${ev.title} | 사주플랜 이벤트`;
    const description = truncate(stripHtml(ev.content || ''), 155) || ev.title;
    const canonicalPath = `/mypage/events/${id}`;
    const image = this.abs(ev.thumbnail_url);
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: ev.title,
      ...(image ? { image } : {}),
      datePublished: ev.created_at,
      dateModified: ev.updated_at || ev.created_at,
      author: { '@type': 'Organization', name: '사주플랜' },
      url: this.site() + canonicalPath,
    };
    const body = `<article><h1>${esc(ev.title)}</h1>${image ? `<img src="${esc(image)}" alt="${esc(ev.title)}" />` : ''}<div>${sanitizeBlock(ev.content || '')}</div></article>`;
    return { status: 200, html: this.page({ title, description, canonicalPath, image, ogType: 'article', jsonLd, body }) };
  }

  // ── sitemap ─────────────────────────────────
  private async buildSitemap(): Promise<string> {
    const site = this.site();
    const urls: { loc: string; priority: string; changefreq: string }[] = [
      { loc: `${site}/`, priority: '1.0', changefreq: 'daily' },
      { loc: `${site}/counselors`, priority: '0.9', changefreq: 'daily' },
      { loc: `${site}/search`, priority: '0.5', changefreq: 'weekly' },
    ];
    try {
      // 전수 조회(전용 read-only) — list() 는 50개 cap 이라 sitemap 에 부적합.
      // 탈퇴(left_at) 제외한 모든 승인 상담사. 부재중도 프로필은 유효 공개 콘텐츠라 포함.
      const rows = await this.sql<{ id: number }[]>`
        SELECT id FROM member
         WHERE role = 'counselor'
           AND left_at IS NULL
         ORDER BY id ASC
         LIMIT 50000
      `;
      for (const c of rows) urls.push({ loc: `${site}/counselors/${c.id}`, priority: '0.8', changefreq: 'weekly' });
    } catch (e) {
      this.logger.warn(`sitemap counselors query fail: ${e instanceof Error ? e.message : String(e)}`);
    }
    try {
      const { items } = await this.notices.list({ page: 1, limit: 500 });
      for (const n of items) urls.push({ loc: `${site}/mypage/notices/${n.id}`, priority: '0.4', changefreq: 'monthly' });
    } catch {
      /* ignore */
    }
    try {
      const { items } = await this.events.list({ page: 1, limit: 500 });
      for (const ev of items) urls.push({ loc: `${site}/mypage/events/${ev.id}`, priority: '0.5', changefreq: 'weekly' });
    } catch {
      /* ignore */
    }
    const body = urls
      .map((u) => `  <url><loc>${esc(u.loc)}</loc><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`)
      .join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`;
  }

  // ── HTML 조립 헬퍼 ───────────────────────────
  private page(o: {
    title: string;
    description: string;
    canonicalPath: string;
    image?: string | null;
    ogType: string;
    jsonLd: unknown;
    body: string;
    noindex?: boolean;
  }): string {
    const site = this.site();
    const canonical = site + o.canonicalPath;
    const img = o.image ? this.abs(o.image) : `${site}/android-chrome-512x512.png`;
    const ld = Array.isArray(o.jsonLd) ? o.jsonLd : [o.jsonLd];
    const ldTags = ld
      .map((x) => `<script type="application/ld+json">${jsonLdSafe(x)}</script>`)
      .join('\n');
    const robots = o.noindex ? 'noindex, follow' : 'index, follow';
    return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.description)}" />
<meta name="robots" content="${robots}" />
<link rel="canonical" href="${esc(canonical)}" />
<meta property="og:type" content="${esc(o.ogType)}" />
<meta property="og:site_name" content="사주플랜" />
<meta property="og:title" content="${esc(o.title)}" />
<meta property="og:description" content="${esc(o.description)}" />
<meta property="og:url" content="${esc(canonical)}" />
<meta property="og:image" content="${esc(img)}" />
<meta property="og:locale" content="ko_KR" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(o.title)}" />
<meta name="twitter:description" content="${esc(o.description)}" />
<meta name="twitter:image" content="${esc(img)}" />
${ldTags}
</head>
<body>
${o.body}
</body>
</html>`;
  }

  private notFoundHtml(path: string): string {
    return this.page({
      title: '페이지를 찾을 수 없습니다 | 사주플랜',
      description: '요청하신 페이지를 찾을 수 없습니다.',
      canonicalPath: path,
      ogType: 'website',
      jsonLd: { '@context': 'https://schema.org', '@type': 'WebPage', name: 'Not Found' },
      body: '<h1>페이지를 찾을 수 없습니다</h1><p><a href="/">사주플랜 홈으로</a></p>',
      noindex: true,
    });
  }

  /** 상대 /uploads 경로 → 절대 URL (sajuplan.com 동일 오리진에서 서빙됨). */
  private abs(url: string | null | undefined): string {
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) return url;
    return this.site() + (url.startsWith('/') ? url : '/' + url);
  }

  private cleanPath(raw: string): string {
    let p = (raw || '/').split('?')[0].split('#')[0].trim();
    if (!p.startsWith('/')) p = '/' + p;
    if (p.length > 1) p = p.replace(/\/+$/, '');
    return p || '/';
  }
}

// ── 순수 함수 헬퍼 ─────────────────────────────
function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 본문 HTML 블록 — 스크립트/이벤트 핸들러만 제거하고 서식은 유지(봇 가독성). */
function sanitizeBlock(html: string): string {
  return String(html ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/ on[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/ on[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript:/gi, '');
}

function stripHtml(html: string): string {
  return String(html ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(s: string, n: number): string {
  const t = String(s ?? '').trim();
  return t.length <= n ? t : t.slice(0, n - 1).trimEnd() + '…';
}

/** JSON-LD 안전 직렬화 — </script> 주입 방지. */
function jsonLdSafe(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}
