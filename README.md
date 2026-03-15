# Redactify

Client-side PDF redaction: detect PII, review highlights, burn black boxes, and keep the original recoverable via an encrypted key file. Runs entirely in the browser—no uploads.

## Quickstart (judges)
1) **Install deps**  
   ```bash
   npm install
   ```
2) **Dev server** (interactive demo)  
   ```bash
   npm run dev
   ```  
   Open the shown URL (usually http://localhost:5173).  
3) **Build** (static bundle)  
   ```bash
   npm run build
   ```
4) **Preview built app** (optional)  
   ```bash
   npm run preview
   ```

## How to test
1) Load any PDF (digital text preferred).  
2) Redaction mode auto-highlights detected PII (names, phones, emails, IBAN/AHV/SSN, addresses, policy/claim IDs, cards). Toggle highlights or draw boxes.  
3) Click “Redact” to download `redacted.pdf` and `redactify-key.json`.  
4) Switch to “Un-redact” and upload the redacted PDF + its matching key file to restore the original. Only the correct key file works.
5) Missed something? Click-and-drag anywhere on the PDF to add manual redaction boxes; they’re included in the same key file.

## Notes for judges
- Fully client-side: no network needed beyond initial model download.  
- Multilingual NER (en/de/fr/it/es) plus regex tuned for EU IDs/IBAN/AHV/phones.  
- Key file now encrypts the original PDF with AES-GCM; arbitrary JSON won’t restore.  
- OCR for scans is not enabled in this build (text-layer PDFs only).

## Scripts
- `npm run dev` – start Vite dev server.  
- `npm run build` – type-check and build.  
- `npm run preview` – serve the production build locally.
