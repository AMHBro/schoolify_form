/** تقليل حجم الصور قبل الرفع — Canvas + JPEG. الملفات غير الصور تُعاد كما هي. */

const MAX_LONG_EDGE = 1920
const JPEG_QUALITY = 0.82

function shouldSkipImageCompression(mime: string): boolean {
  const m = mime.toLowerCase()
  if (!m.startsWith('image/')) return true
  if (
    m === 'image/gif' ||
    m === 'image/svg+xml' ||
    m === 'image/x-icon' ||
    m === 'image/vnd.microsoft.icon'
  ) {
    return true
  }
  return false
}

function stemForCompressedName(fileName: string): string {
  const leaf = fileName.replace(/^.*[/\\]/, '').trim() || 'image'
  const dot = leaf.lastIndexOf('.')
  const stem = dot > 0 ? leaf.slice(0, dot) : leaf
  return stem
    .normalize('NFKC')
    .replace(/[\u0660-\u0669]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0x0660 + 0x0030)
    )
    .replace(/[\u06f0-\u06f9]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0x06f0 + 0x0030)
    )
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80)
}

async function bitmapToJpegFile(
  bitmap: ImageBitmap,
  outBaseName: string
): Promise<File | null> {
  let { width, height } = bitmap
  if (width < 1 || height < 1) return null

  const maxEdge = Math.max(width, height)
  const scale = maxEdge > MAX_LONG_EDGE ? MAX_LONG_EDGE / maxEdge : 1
  const w = Math.max(1, Math.round(width * scale))
  const h = Math.max(1, Math.round(height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) return null

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(bitmap, 0, 0, w, h)

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', JPEG_QUALITY)
  })
  if (!blob || blob.size < 1) return null

  const stem = stemForCompressedName(outBaseName) || 'image'
  return new File([blob], `${stem}.jpg`, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  })
}

/**
 * يضغط الصور (تصغير الأبعاد + JPEG). إن زاد الحجم أو فشل الفك، يُعاد الملف الأصلي.
 * PDF وغير الصور: بدون تغيير.
 */
export async function compressFileForUpload(file: File): Promise<File> {
  const mime = (file.type || '').toLowerCase()
  if (shouldSkipImageCompression(mime)) return file

  try {
    const bitmap = await createImageBitmap(file)
    try {
      const candidate = await bitmapToJpegFile(bitmap, file.name)
      if (!candidate) return file
      if (candidate.size >= file.size) return file
      return candidate
    } finally {
      bitmap.close()
    }
  } catch {
    return file
  }
}
