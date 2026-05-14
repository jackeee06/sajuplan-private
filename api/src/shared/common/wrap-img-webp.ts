import { promises as fsp } from 'node:fs';
import { join } from 'node:path';

const RASTER_EXTS = ['.png', '.jpg', '.jpeg', '.gif'];
const IMG_TAG_RE = /<img\b[^>]*?\ssrc=["']([^"']+)["'][^>]*>/gi;

/**
 * 본문 HTML 의 <img src="/uploads/.../foo.png"> 를
 * <picture><source srcset="/uploads/.../foo.webp" type="image/webp"><img …></picture> 로 감싼다.
 *
 * 어드민 업로드(`/admin/<board>/upload`)는 png/jpg/jpeg/gif 를 디스크에 저장하면서 동일 디렉토리에
 * `.webp` 사이블링도 함께 만든다 (image-to-webp.ts). Toast UI Editor 는 본문에 원본 URL 만 삽입하므로,
 * 사용자 응답 시점에 webp 사이블링이 실재할 때만 <picture> 로 감싸 webp 우선 노출을 켠다.
 *
 * - 외부 URL 은 그대로 (변환 대상 아님).
 * - webp 사이블링 파일이 없으면 원본 <img> 그대로.
 * - 동일 src 가 여러 번 나오면 한 번만 fs.access 한다.
 */
export async function wrapImgsWithWebp(html: string | null | undefined): Promise<string> {
  if (!html) return '';
  if (!html.includes('<img')) return html;

  const uploadsRoot = join(process.cwd(), 'uploads');

  const srcSet = new Set<string>();
  IMG_TAG_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = IMG_TAG_RE.exec(html)) !== null) {
    srcSet.add(m[1]);
  }
  if (srcSet.size === 0) return html;

  const webpMap = new Map<string, string>();
  await Promise.all(
    Array.from(srcSet).map(async (src) => {
      const webpUrl = toWebpUrl(src);
      if (!webpUrl) return;
      const diskPath = resolveUploadsDiskPath(webpUrl, uploadsRoot);
      if (!diskPath) return;
      try {
        await fsp.access(diskPath);
        webpMap.set(src, webpUrl);
      } catch {
        /* webp 사이블링 없음 — 원본 유지 */
      }
    }),
  );
  if (webpMap.size === 0) return html;

  return html.replace(IMG_TAG_RE, (full, src: string) => {
    const webp = webpMap.get(src);
    if (!webp) return full;
    return `<picture><source srcset="${escapeAttr(webp)}" type="image/webp">${full}</picture>`;
  });
}

function toWebpUrl(src: string): string | null {
  // strip query/hash for ext check, but preserve in final URL
  const [pathPart, qs] = splitQuery(src);
  const lower = pathPart.toLowerCase();
  for (const ext of RASTER_EXTS) {
    if (lower.endsWith(ext)) {
      return pathPart.slice(0, -ext.length) + '.webp' + (qs ?? '');
    }
  }
  return null;
}

function splitQuery(url: string): [string, string | null] {
  const i = url.search(/[?#]/);
  if (i < 0) return [url, null];
  return [url.slice(0, i), url.slice(i)];
}

/** /uploads/... 또는 https://host/uploads/... → 디스크 절대경로. 외부/비-uploads URL은 null. */
function resolveUploadsDiskPath(url: string, uploadsRoot: string): string | null {
  const [pathPart] = splitQuery(url);
  let rel: string | null = null;
  if (pathPart.startsWith('/uploads/')) {
    rel = pathPart.slice('/uploads/'.length);
  } else {
    const m = pathPart.match(/^https?:\/\/[^/]+(\/uploads\/.+)$/);
    if (m) rel = m[1].slice('/uploads/'.length);
  }
  if (!rel) return null;
  if (rel.includes('..')) return null;
  return join(uploadsRoot, rel);
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}
