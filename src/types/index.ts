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
  version: '2' | '1'
  keyHex: string
  // v2: encrypted original for integrity; v1 (legacy) uses plaintext base64
  encryptedOriginalBase64?: string
  ivOriginal?: string
  originalPdfBase64?: string
  redactions: Array<{
    id: string
    encryptedText: string
    iv: string
    pageIndex: number
    bbox: { x: number; y: number; width: number; height: number }
    entityType: string
  }>
}
