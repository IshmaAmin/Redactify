import type { TextItem, DetectedSpan } from '../types'

interface Pattern {
  type: string
  regex: RegExp
}

const PATTERNS: Pattern[] = [
  { type: 'EMAIL', regex: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g },
  // Requires country code or area code format to avoid false positives
  { type: 'TEXT', regex: /(?:\+\d{1,3}[\s\-.]?\(?\d{1,4}\)?[\s\-.]?\d{2,4}[\s\-.]?\d{2,4}[\s\-.]?\d{0,4}|\(\d{2,4}\)[\s\-.]?\d{3,4}[\s\-.]?\d{3,4}|\b\d{3}[\s\-\.]\d{3}[\s\-\.]\d{4}\b)/g },
  { type: 'IBAN', regex: /\b[A-Z]{2}\d{2}[A-Z0-9]{4,}\b/g },
  { type: 'CREDIT_CARD', regex: /\b(?:\d{4}[\s\-]?){3}\d{4}\b/g },
  { type: 'SSN', regex: /\b\d{3}-\d{2}-\d{4}\b/g },
  { type: 'AHV', regex: /\b756\.\d{4}\.\d{4}\.\d{2}\b/g },
  { type: 'PASSPORT', regex: /\b[A-Z]{1,2}\d{6,9}\b/g },
  { type: 'DATE_OF_BIRTH', regex: /\b(?:\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})\b/g },
  { type: 'IP_ADDRESS', regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g },
]

function luhnCheck(num: string): boolean {
  const digits = num.replace(/\D/g, '')
  let sum = 0
  let alternate = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10)
    if (alternate) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
    alternate = !alternate
  }
  return sum % 10 === 0
}

export function detectRegexSpans(textItems: TextItem[]): DetectedSpan[] {
  const spans: DetectedSpan[] = []

  // Process page by page
  const pages = new Map<number, TextItem[]>()
  for (const item of textItems) {
    const list = pages.get(item.pageIndex) ?? []
    list.push(item)
    pages.set(item.pageIndex, list)
  }

  for (const [pageIndex, items] of pages) {
    // Build a full-text string and track char→item mapping
    let fullText = ''
    const charMap: Array<{ itemIndex: number; charOffset: number }> = []

    for (let i = 0; i < items.length; i++) {
      const start = fullText.length
      fullText += items[i].str + ' '
      for (let c = 0; c < items[i].str.length + 1; c++) {
        charMap.push({ itemIndex: i, charOffset: start + c })
      }
    }

    for (const pattern of PATTERNS) {
      pattern.regex.lastIndex = 0
      let match: RegExpExecArray | null

      while ((match = pattern.regex.exec(fullText)) !== null) {
        const matchText = match[0].trim()
        if (!matchText) continue

        // Skip credit cards that fail Luhn
        if (pattern.type === 'CREDIT_CARD' && !luhnCheck(matchText)) continue

        // Find which items this match spans
        const startIdx = match.index
        const endIdx = match.index + match[0].length - 1

        const startItemIndex = charMap[startIdx]?.itemIndex
        const endItemIndex = charMap[Math.min(endIdx, charMap.length - 1)]?.itemIndex

        if (startItemIndex === undefined) continue

        // Merge bboxes across spanned items
        const spannedItems = items.slice(startItemIndex, (endItemIndex ?? startItemIndex) + 1)
        if (spannedItems.length === 0) continue

        const x = Math.min(...spannedItems.map(it => it.bbox.x))
        const y = Math.min(...spannedItems.map(it => it.bbox.y))
        const right = Math.max(...spannedItems.map(it => it.bbox.x + it.bbox.width))
        const bottom = Math.max(...spannedItems.map(it => it.bbox.y + it.bbox.height))

        spans.push({
          text: matchText,
          entityType: pattern.type,
          pageIndex,
          bbox: { x, y, width: right - x, height: bottom - y },
          confirmed: false,
          source: 'regex',
        })
      }
    }
  }

  return spans
}
