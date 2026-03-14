export interface TextItem {
  str: string
  pageIndex: number
  bbox: { x: number; y: number; width: number; height: number }
}

export interface PageDimensions {
  width: number
  height: number
}

export interface DetectedSpan {
  text: string
  entityType: string
  pageIndex: number
  bbox: { x: number; y: number; width: number; height: number }
  confirmed: boolean
  source: 'ner' | 'regex' | 'manual'
}

export interface RedactionItem extends DetectedSpan {
  id: string
  encryptedText: string
  iv: string
}

export interface KeyFile {
  version: '1'
  keyHex: string
  originalPdfBase64: string   // base64-encoded original PDF for perfect restoration
  redactions: Array<{
    id: string
    encryptedText: string
    iv: string
    pageIndex: number
    bbox: { x: number; y: number; width: number; height: number }
    entityType: string
  }>
}
