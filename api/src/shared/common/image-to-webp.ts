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

export interface ConvertOptions {
  /** WebP 품질 (1-100). 기본 80 */
  quality?: number;
  /** 최대 가로/세로. 둘 중 큰 쪽이 이 값 이하로 축소. 0 또는 미설정 = 리사이즈 안 함 */
  maxDimension?: number;
}

/**
 * multer로 저장된 이미지 파일을 동일 디렉토리에 .webp 사이블링으로 변환한다.
 *
 * - 이미 webp 면 변환하지 않고 같은 파일명을 그대로 반환 (alreadyWebp = true).
 * - jpg/jpeg/png/gif 만 변환. 그 외 (pdf 등)는 null.
 * - 변환 실패 시 (sharp 오류) null. 원본 업로드는 영향 없음.
 * - maxDimension 지정 시 큰 쪽을 그 값에 맞춰 비율 유지 축소 (확대는 안 함).
 *
 * @param storedAbsPath 디스크에 저장된 원본 경로 (multer file.path)
 * @param options quality / maxDimension
 */
export async function convertImageToWebp(
  storedAbsPath: string,
  options: ConvertOptions | number = {},
): Promise<WebpResult> {
  // 하위 호환: 두 번째 인자가 number 면 quality 로 간주
  const opts: ConvertOptions =
    typeof options === 'number' ? { quality: options } : options;
  const quality = opts.quality ?? 80;
  const maxDimension = opts.maxDimension ?? 0;

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
    let pipeline = sharp(storedAbsPath, { animated: false });
    if (maxDimension > 0) {
      // withoutEnlargement: 원본이 작으면 그대로 (확대 안 함)
      pipeline = pipeline.resize({
        width: maxDimension,
        height: maxDimension,
        fit: 'inside',
        withoutEnlargement: true,
      });
    }
    await pipeline.webp({ quality, effort: 4 }).toFile(webpPath);
    return { webpFilename: webpName, alreadyWebp: false };
  } catch {
    // 변환 실패 — 부분 파일 정리
    await fsp.unlink(webpPath).catch(() => {});
    return { webpFilename: null, alreadyWebp: false };
  }
}
