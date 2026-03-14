# CLAUDE.md

## Project

Redactify — browser-only PDF redaction tool with local NER + regex PII detection, AES-256-GCM encrypted key files, and reversible redactions.

## Tech Stack

- React 18 + Vite 5 + TypeScript
- Tailwind CSS v3
- `pdfjs-dist` — PDF rendering and text extraction
- `pdf-lib` — PDF writing (drawing black rectangles)
- `@xenova/transformers` — in-browser NER via `Xenova/bert-base-NER`
- Web Crypto API — AES-256-GCM encryption

## Commands

```bash
npm run dev      # dev server at localhost:5173
npm run build    # production build → dist/
npm run preview  # preview the built output
```

> Note: `npm` is in `~/.nvm/versions/node/v24.14.0/bin/`. If running from a non-login shell, prefix with:
> `export PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH"`

## Architecture

```
src/
  types/index.ts          — TextItem, DetectedSpan, RedactionItem, KeyFile
  lib/
    pdfParser.ts          — extract TextItem[] + page dimensions via pdf.js
    regexDetector.ts      — EMAIL, PHONE, IBAN, CREDIT_CARD, SSN, AHV, PASSPORT, DATE, IP
    nerDetector.ts        — lazy-load Xenova/bert-base-NER, returns PERSON/LOC/ORG spans
    redactionEngine.ts    — merge/dedup spans, encrypt originals, build key file
    pdfWriter.ts          — draw black rects (redact) / white rects + text (unredact)
    cryptoUtils.ts        — generateKey, encryptText, decryptText, importKeyFromHex
  components/
    FileUpload.tsx         — drag-and-drop upload, mode toggle (redact/unredact)
    PDFViewer.tsx          — canvas render + SVG highlight overlay + drag-to-select
    RedactionSidebar.tsx   — entity list grouped by type with toggle controls
    ActionBar.tsx          — select all/none + Redact & Export button
    EntityBadge.tsx        — colored type chip
  App.tsx                  — 3-screen flow: Upload → Review → Done
```

## Key file format

```json
{
  "version": "1",
  "keyHex": "<64 hex chars>",
  "redactions": [
    {
      "id": "...", "encryptedText": "...", "iv": "...",
      "pageIndex": 0,
      "bbox": { "x": 0, "y": 0, "width": 0, "height": 0 },
      "entityType": "EMAIL"
    }
  ]
}
```
