import { PDFDocument, rgb } from 'pdf-lib'
import type { RedactionItem, KeyFile } from '../types'

export async function redactPDF(
  pdfBytes: ArrayBuffer,
  redactions: RedactionItem[],
  pageDimensions: Array<{ width: number; height: number }>
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes)
  const pages = pdfDoc.getPages()

  for (const r of redactions) {
    const page = pages[r.pageIndex]
    if (!page) continue

    const { width: pdfWidth, height: pdfHeight } = page.getSize()
    const viewWidth = pageDimensions[r.pageIndex]?.width ?? pdfWidth
    const viewHeight = pageDimensions[r.pageIndex]?.height ?? pdfHeight

    const scaleX = pdfWidth / viewWidth
    const scaleY = pdfHeight / viewHeight

    // pdf-lib uses bottom-left origin
    const x = r.bbox.x * scaleX
    const y = pdfHeight - (r.bbox.y + r.bbox.height) * scaleY
    const w = r.bbox.width * scaleX
    const h = r.bbox.height * scaleY

    page.drawRectangle({ x, y, width: w, height: h, color: rgb(0, 0, 0) })
  }

  return pdfDoc.save()
}

export async function unredactPDF(
  _redactedPdfBytes: ArrayBuffer,
  keyFile: KeyFile,
): Promise<Uint8Array> {
  // The key file stores the original PDF — return it directly for perfect restoration
  const binary = atob(keyFile.originalPdfBase64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}
