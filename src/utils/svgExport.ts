/**
 * Exports on-screen SVG diagrams as standalone SVG / PNG files. Diagrams style themselves with
 * `style="fill: var(--surface)"`; on export every var(--token) is replaced with the light print
 * palette, so files look the same in any viewer and print well regardless of the UI theme.
 */
import { downloadText } from './download'

/** Mirrors the light theme in style.css. */
export const PRINT_TOKENS: Record<string, string> = {
  bg: '#ffffff',
  surface: '#ffffff',
  'surface-2': '#f1f4f8',
  line: '#c9d1dc',
  fg: '#0f172a',
  muted: '#5b6678',
  accent: '#0e7490',
  'accent-soft': '#cff3f9',
  net: '#2563eb',
  'net-soft': '#dbe6fd',
  host: '#b45309',
  'host-soft': '#fdecd3',
  ok: '#15803d',
  'ok-soft': '#dcf5e3',
  warn: '#b45309',
  'warn-soft': '#fdf0d5',
  err: '#b91c1c',
  'err-soft': '#fde2e2',
}

const FONT = "'Inter', 'PingFang TC', 'Noto Sans TC', 'Microsoft JhengHei', Arial, sans-serif"

export function resolveTokens(text: string, tokens: Record<string, string> = PRINT_TOKENS): string {
  return text.replace(/var\(--([\w-]+)\)/g, (m, name: string) => tokens[name] ?? m)
}

/** Serializes an SVG element into a standalone document with a white background. */
export function serializeSvg(svg: SVGSVGElement, tokens: Record<string, string> = PRINT_TOKENS): string {
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.removeAttribute('class')
  const vb = clone.viewBox.baseVal
  if (vb && vb.width) {
    clone.setAttribute('width', String(vb.width))
    clone.setAttribute('height', String(vb.height))
  }
  clone.setAttribute('style', `font-family: ${FONT}; background: ${tokens.bg ?? '#fff'}`)
  // Interactive-only elements (hit areas, drag handles) are marked data-export="skip".
  clone.querySelectorAll('[data-export="skip"]').forEach((el) => el.remove())
  const xml = new XMLSerializer().serializeToString(clone)
  return `<?xml version="1.0" encoding="UTF-8"?>\n${resolveTokens(xml, tokens)}`
}

export function downloadSvg(svg: SVGSVGElement, filename: string): void {
  downloadText(filename, serializeSvg(svg), 'image/svg+xml')
}

/** Renders the SVG onto a canvas at `scale` and downloads it as PNG. */
export async function downloadPng(svg: SVGSVGElement, filename: string, scale = 2): Promise<void> {
  const text = serializeSvg(svg)
  const vb = svg.viewBox.baseVal
  const width = Math.ceil((vb?.width || svg.clientWidth) * scale)
  const height = Math.ceil((vb?.height || svg.clientHeight) * scale)
  const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('SVG render failed'))
      img.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(img, 0, 0, width, height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) return
    const pngUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = pngUrl
    a.download = filename
    a.click()
    URL.revokeObjectURL(pngUrl)
  } finally {
    URL.revokeObjectURL(url)
  }
}
