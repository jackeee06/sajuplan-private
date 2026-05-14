import React from 'react'
import { FILE_BASE } from '../lib/runtime-env'

function resolve(u: string | null | undefined): string | null {
  if (!u) return null
  if (/^https?:\/\//.test(u)) return u
  if (u.startsWith('/')) return `${FILE_BASE}${u}`
  return u
}

interface Props extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  /** 원본 이미지 URL (jpg/png/gif). null/undefined 면 렌더 안 함. */
  src: string | null | undefined
  /** WebP 변환본 URL — 우선 노출. 백엔드가 image_url_webp / stored_name_webp 등으로 제공. */
  srcWebp?: string | null | undefined
  alt?: string
}

/**
 * 업로드된 이미지를 <picture>로 렌더링한다.
 *
 * 사용 규칙: **사용자에게 노출되는 모든 업로드 이미지는 이 컴포넌트로 통일.**
 * srcWebp 가 있으면 WebP 우선, 없으면 원본 그대로 (브라우저 호환 자동).
 *
 * 백엔드에서 webp 컬럼 (image_url_webp, profile_image_webp 등)을 함께 내려주므로,
 * API 응답을 그대로 src/srcWebp 에 매핑하면 된다.
 */
export default function UploadedImage({ src, srcWebp, alt = '', ...rest }: Props) {
  const original = resolve(src)
  const webp = resolve(srcWebp)
  if (!original) return null
  return (
    <picture>
      {webp && <source srcSet={webp} type="image/webp" />}
      <img src={original} alt={alt} {...rest} />
    </picture>
  )
}
