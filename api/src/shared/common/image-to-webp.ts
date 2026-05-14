import { promises as fsp } from 'node:fs';
import { extname, join, dirname, basename } from 'node:path';
import sharp from 'sharp';

const WEBP_EXT = '.webp';
const RASTER_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif']);

export interface WebpResult {
  /** WebP 저장 파일명 (디렉토리 제외). 변환 실패/비대상이면 null. */
  webpFilename: string | null;
  /** 원본이 이미 .webp 면 true — 이 경우 webpFilename = 원본 filename */
  alreadyWebp: boolean;
}

/**
 * multer로 저장된 이미지 파일을 동일 디렉토리에 .webp 사이블링으로 변환한다.
 *
 * - 이미 webp 면 변환하지 않고 같은 파일명을 그대로 반환 (alreadyWebp = true).
 * - jpg/jpeg/png/gif 만 변환. 그 외 (pdf 등)는 null.
 * - 변환 실패 시 (sharp 오류) null. 원본 업로드는 영향 없음.
 *
 * @param storedAbsPath 디스크에 저장된 원본 경로 (multer file.path)
 * @param quality WebP 품질 (기본 80)
 */
export async function convertImageToWebp(
  storedAbsPath: string,
  quality = 80,
): Promise<WebpResult> {
  const ext = extname(storedAbsPath).toLowerCase();

  if (ext === WEBP_EXT) {
    return { webpFilename: basename(storedAbsPath), alreadyWebp: true };
  }
  if (!RASTER_EXTS.has(ext)) {
    return { webpFilename: null, alreadyWebp: false };
  }

  const dir = dirname(storedAbsPath);
  const base = basename(storedAbsPath, ext);
  const webpName = `${base}${WEBP_EXT}`;
  const webpPath = join(dir, webpName);

  try {
    // GIF 는 첫 프레임만 변환 (animated webp 는 용량/호환성 이슈로 보류)
    await sharp(storedAbsPath, { animated: false })
      .webp({ quality, effort: 4 })
      .toFile(webpPath);
    return { webpFilename: webpName, alreadyWebp: false };
  } catch {
    // 변환 실패 — 부분 파일 정리
    await fsp.unlink(webpPath).catch(() => {});
    return { webpFilename: null, alreadyWebp: false };
  }
}
