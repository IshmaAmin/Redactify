import type { DetectedSpan, RedactionItem, KeyFile } from '../types'
import { encryptText } from './cryptoUtils'

function bboxOverlaps(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  )
}

export function mergeDetections(
  nerSpans: DetectedSpan[],
  regexSpans: DetectedSpan[]
): DetectedSpan[] {
  const all = [...nerSpans, ...regexSpans]
  const merged: DetectedSpan[] = []

  for (const span of all) {
    const overlapping = merged.findIndex(
      m => m.pageIndex === span.pageIndex && bboxOverlaps(m.bbox, span.bbox)
    )
    if (overlapping === -1) {
      merged.push({ ...span })
    }
    // Keep the first (NER takes priority over regex)
  }

  // Sort by page, then top-to-bottom, left-to-right
  merged.sort((a, b) => {
    if (a.pageIndex !== b.pageIndex) return a.pageIndex - b.pageIndex
    if (Math.abs(a.bbox.y - b.bbox.y) > 5) return a.bbox.y - b.bbox.y
    return a.bbox.x - b.bbox.x
  })

  return merged
}

function generateId(): string {
  // Use crypto.randomUUID if available
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  // Fallback
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export async function confirmRedactions(
  spans: DetectedSpan[],
  key: CryptoKey
): Promise<RedactionItem[]> {
  const items: RedactionItem[] = []
  for (const span of spans) {
    if (!span.confirmed) continue
    const { encryptedText, iv } = await encryptText(key, span.text)
    items.push({
      ...span,
      id: generateId(),
      encryptedText,
      iv,
    })
  }
  return items
}

export function buildKeyFile(
  keyHex: string,
  redactions: RedactionItem[],
  originalPdfBytes: ArrayBuffer
): KeyFile {
  // Store original PDF as base64 so restoration is pixel-perfect
  const bytes = new Uint8Array(originalPdfBytes)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  const originalPdfBase64 = btoa(binary)

  return {
    version: '1',
    keyHex,
    originalPdfBase64,
    redactions: redactions.map(r => ({
      id: r.id,
      encryptedText: r.encryptedText,
      iv: r.iv,
      pageIndex: r.pageIndex,
      bbox: r.bbox,
      entityType: r.entityType,
    })),
  }
}
