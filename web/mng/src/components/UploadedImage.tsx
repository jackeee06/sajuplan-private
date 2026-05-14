import React from 'react'
import { FILE_BASE } from '../lib/runtime-env'

function resolve(u: string | null | undefined): string | null {
  if (!u) return null
  if (/^https?:\/\//.test(u)) return u
  if (u.startsWith('/')) return `${FILE_BASE}${u}`
  return u
}

interface Props extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string | null | undefined
  srcWebp?: string | null | undefined
  alt?: string
}

/**
 * 업로드 이미지 노출용 <picture> 래퍼 (관리자).
 * webp 가 있으면 우선, 없으면 원본 fallback. 사용자/관리자 모든 노출 지점에서 사용.
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
