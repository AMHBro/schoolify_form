import { useEffect } from 'react'

type Props = {
  src: string | null
  alt?: string
  onClose: () => void
}

export function Lightbox({ src, alt = '', onClose }: Props) {
  useEffect(() => {
    if (!src) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [src, onClose])

  if (!src) return null

  return (
    <div
      className="lightbox-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <button type="button" className="lightbox-close" onClick={onClose}>
        إغلاق
      </button>
      <figure className="lightbox-figure" onClick={(e) => e.stopPropagation()}>
        <img src={src} alt={alt} className="lightbox-img" />
      </figure>
    </div>
  )
}
