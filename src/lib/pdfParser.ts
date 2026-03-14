import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'
import type { TextItem as PdfjsTextItem } from 'pdfjs-dist/types/src/display/api'
import type { TextItem, PageDimensions } from '../types'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export interface ParsedPDF {
  textItems: TextItem[]
  pageDimensions: PageDimensions[]
  pdfDocument: pdfjs.PDFDocumentProxy
}

export async function parsePDF(arrayBuffer: ArrayBuffer): Promise<ParsedPDF> {
  // Use a copy so the original ArrayBuffer isn't transferred/detached by pdfjs
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer.slice(0) })
  const pdfDocument = await loadingTask.promise

  const textItems: TextItem[] = []
  const pageDimensions: PageDimensions[] = []

  for (let pageIndex = 0; pageIndex < pdfDocument.numPages; pageIndex++) {
    const page = await pdfDocument.getPage(pageIndex + 1)
    const viewport = page.getViewport({ scale: 1 })
    pageDimensions.push({ width: viewport.width, height: viewport.height })

    const textContent = await page.getTextContent()

    for (const item of textContent.items) {
      if (!('str' in item)) continue
      const textItem = item as PdfjsTextItem
      if (!textItem.str.trim()) continue

      // transform = [scaleX, skewY, skewX, scaleY, tx, ty]
      const [, , , scaleY, tx, ty] = textItem.transform
      const height = Math.abs(scaleY)
      const width = textItem.width

      // pdf.js uses bottom-left origin; convert to top-left
      const x = tx
      const y = viewport.height - ty - height

      textItems.push({
        str: textItem.str,
        pageIndex,
        bbox: { x, y, width, height },
      })
    }
  }

  return { textItems, pageDimensions, pdfDocument }
}
