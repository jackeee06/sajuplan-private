/**
 * 클라이언트 이미지 자동 리사이즈
 * 큰 사진을 업로드해도 브라우저에서 maxSize 이하 정사각형 영역에 맞춰 줄임.
 * 결과는 JPEG (퀄리티 0.85) 또는 PNG (투명도 보존 필요 시).
 */
export async function resizeImage(
  file: File,
  maxSize = 1024,
): Promise<File> {
  // 너무 작은 파일은 그대로 (이미 작음)
  if (file.size < 500 * 1024) return file

  // 이미지가 아니면 그대로
  if (!file.type.startsWith('image/')) return file

  // GIF 는 애니메이션이라 리사이즈하면 첫 프레임만 남음 — 그대로 반환 (서버에서 처리)
  if (file.type === 'image/gif') return file

  const dataUrl = await readFileAsDataURL(file)
  const img = await loadImage(dataUrl)

  const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1)
  const w = Math.round(img.width * ratio)
  const h = Math.round(img.height * ratio)

  // 이미 작으면 그대로
  if (ratio === 1 && file.size < 2 * 1024 * 1024) return file

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(img, 0, 0, w, h)

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', 0.85)
  })
  if (!blob) return file

  // 확장자는 jpg 로 변경 — 서버 webp 변환 파이프라인이 jpg 정상 처리
  const newName = file.name.replace(/\.[^.]+$/, '.jpg')
  return new File([blob], newName, { type: 'image/jpeg' })
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('이미지를 읽을 수 없습니다.'))
    img.src = src
  })
}
