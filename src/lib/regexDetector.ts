import type { TextItem, DetectedSpan } from '../types'

interface Pattern {
  type: string
  regex: RegExp
}

const PATTERNS: Pattern[] = [
  // Swiss-focused combined PII (AHV, IBAN, CH phones, postal+street, policy-like, email)
  { type: 'SWISS_PII', regex: new RegExp(String.raw`\b(756[\.\s]?\d{4}[\.\s]?\d{4}[\.\s]?\d{2}|CH\d{2}(?:\s?\d{4}){4}\s?\d|\+41\s?\d{2}\s?\d{3}\s?\d{2}\s?\d{2}|0041\s?\d{2}\s?\d{3}\s?\d{2}\s?\d{2}|0\d{2}\s?\d{3}\s?\d{2}\s?\d{2}|[1-9][0-9]{3}\s[A-Za-zäöüÄÖÜß\-]+|[A-Z]{2,5}-\d{2,6}-\d{2,6}(?:-\d{2,6})?|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\b`, 'giu') },
  { type: 'EMAIL', regex: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g },
  // Phone (intl / NANP / CH formats)
  { type: 'PHONE', regex: /(?:\+\d{1,3}[\s\-.]?\(?\d{1,4}\)?[\s\-.]?\d{2,4}[\s\-.]?\d{2,4}[\s\-.]?\d{0,4}|\(\d{2,4}\)[\s\-.]?\d{3,4}[\s\-.]?\d{3,4}|\b\d{3}[\s\-\.]\d{3}[\s\-\.]\d{4}\b)/g },
  // Address lines like "Seestrasse 88", "123 Main St", "Bahnhofstrasse 12"
  // Uses Unicode letters to support accents; hyphen explicit at start to avoid range
  { type: 'ADDRESS', regex: /\b(?:[-\p{L}\p{M}'.]{3,}\s)+(?:strasse|straße|street|st\.?|road|rd\.?|avenue|ave\.?|boulevard|blvd\.?|weg|platz|allee|lane|ln\.?|drive|dr\.?)\s*\d+[A-Za-z0-9\/-]*\b/giu },
  // Name labels (backup when NER misses)
  { type: 'NAME', regex: /\b(?:Name|Recipient|Insured person|Patient)[:\s]+([A-Z][A-Za-z'’.-]+\s+[A-Z][A-Za-z'’.-]+)\b/gi },
  { type: 'IBAN', regex: /\b[A-Z]{2}\d{2}[A-Z0-9]{4,}\b/g },
  { type: 'BANK_ACCOUNT', regex: /\b(?:Account|Acct|ACCT|Acct\\.|Konto)[:\\s#-]*[A-Z0-9]{8,20}\b/gi },
  { type: 'CREDIT_CARD', regex: /\b(?:\d{4}[\s\-]?){3}\d{4}\b/g },
  { type: 'SSN', regex: /\b\d{3}-\d{2}-\d{4}\b/g },
  { type: 'AHV', regex: /\b756\.\d{4}\.\d{4}\.\d{2}\b/g },
  { type: 'NATIONAL_ID', regex: /\b\d{3}\.\d{4}\.\d{4}\.\d{2}\b/g },
  { type: 'PATIENT_ID', regex: /\b(?:Patient ID[:\\s]*)?[A-Z]{2,4}-?\d{6,}\b/gi },
  { type: 'INSURANCE_POLICY', regex: /\b[A-Z]{2,5}-[A-Z]{0,3}-?\d{2,}-\d{2,}-\d{2,}\b/g },
  { type: 'CLAIM_NUMBER', regex: /\bCLM-\d{4}-\d{2}-\d{5,}\b/g },
  { type: 'PASSPORT', regex: /\b[A-Z]{1,2}\d{6,9}\b/g },
  { type: 'DATE_OF_BIRTH', regex: /\b(?:\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})\b/g },
  { type: 'IP_ADDRESS', regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g },
  // Swiss-style payment references and IBAN-like references (e.g., RF18 0048 1200 0000 0000 9)
  { type: 'REFERENCE', regex: /\bRF\d{2}\s?(?:\d{4}\s?){4,5}\d\b/gi },
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
    const itemStarts: number[] = []

    for (let i = 0; i < items.length; i++) {
      const start = fullText.length
      itemStarts[i] = start
      fullText += items[i].str + ' '
      for (let c = 0; c < items[i].str.length + 1; c++) {
        charMap.push({ itemIndex: i, charOffset: start + c })
      }
    }

    for (const pattern of PATTERNS) {
      pattern.regex.lastIndex = 0
      let match: RegExpExecArray | null

      while ((match = pattern.regex.exec(fullText)) !== null) {
        let matchText = (match[1] ?? match[0]).trim()
        if (!matchText) continue

        // Skip credit cards that fail Luhn
        if (pattern.type === 'CREDIT_CARD' && !luhnCheck(matchText)) continue

        // Find which items this match spans
        const groupStartOffset = match[1]
          ? match[0].indexOf(match[1])
          : 0
        let startIdx = match.index + groupStartOffset

        // If a label like "Name:" is included in the match (no capture group case),
        // trim everything up to the first colon so only the value is redacted.
        if (!match[1]) {
          const colonPos = matchText.indexOf(':')
          if (colonPos !== -1 && colonPos <= 20 && colonPos + 1 < matchText.length) {
            const after = matchText.slice(colonPos + 1).trimStart()
            const offsetIntoMatch = match[0].indexOf(after)
            if (after && offsetIntoMatch !== -1) {
              startIdx = match.index + offsetIntoMatch
              matchText = after
            }
          }
        }

        const endIdx = startIdx + matchText.length - 1

        const startItemIndex = charMap[startIdx]?.itemIndex
        const endItemIndex = charMap[Math.min(endIdx, charMap.length - 1)]?.itemIndex

        if (startItemIndex === undefined) continue

        // Compute a tighter bbox that only covers the matched substring
        const lastIdx = endItemIndex ?? startItemIndex
        let x1 = Number.POSITIVE_INFINITY
        let y1 = Number.POSITIVE_INFINITY
        let x2 = Number.NEGATIVE_INFINITY
        let y2 = Number.NEGATIVE_INFINITY

        for (let i = startItemIndex; i <= lastIdx; i++) {
          const item = items[i]
          const itemStart = itemStarts[i]
          const itemEnd = itemStart + item.str.length - 1

          const coveredStart = Math.max(startIdx, itemStart)
          const coveredEnd = Math.min(endIdx, itemEnd)
          if (coveredStart > coveredEnd) continue

          const relStart = coveredStart - itemStart
          const relEnd = coveredEnd - itemStart
          const widthPerChar = item.str.length > 0 ? item.bbox.width / item.str.length : 0
          const subX1 = item.bbox.x + widthPerChar * relStart
          const subX2 = item.bbox.x + widthPerChar * (relEnd + 1)

          x1 = Math.min(x1, subX1)
          x2 = Math.max(x2, subX2)
          y1 = Math.min(y1, item.bbox.y)
          y2 = Math.max(y2, item.bbox.y + item.bbox.height)
        }

        if (!isFinite(x1) || !isFinite(x2) || !isFinite(y1) || !isFinite(y2)) continue

        spans.push({
          text: matchText,
          entityType: pattern.type,
          pageIndex,
          bbox: { x: x1, y: y1, width: x2 - x1, height: y2 - y1 },
          confirmed: false,
          source: 'regex',
        })
      }
    }
  }

  return spans
}
