# Redactify

**Client-side PDF redaction for sensitive data.**

Redactify detects **personally identifiable information (PII)** in PDFs, allows users to review and manually add redactions, and securely produces a redacted document while keeping the original recoverable using an encrypted key file.

All processing happens **entirely in the browser** — no uploads, no server, no data leaves the device.

---

# Features

- **Automatic PII detection**
  - Names
  - Phone numbers
  - Emails
  - Addresses
  - IBAN
  - AHV / SSN
  - Policy / claim IDs
  - Credit cards

- **Manual redaction**
  - Click and drag anywhere on the document to add redaction boxes
  - Ensures nothing is missed by automated detection

- **Secure reversible redaction**
  - Generates an encrypted key file
  - Original document can be restored only with the correct key

- **Fully client-side**
  - No backend
  - No uploads
  - Works offline after initial load

- **Multilingual support**
  - English
  - German
  - French
  - Italian
  - Spanish

## Quickstart
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
2) Redaction mode auto-highlights detected PII (names, phones, emails, IBAN/AHV/SSN, addresses, policy/claim IDs, cards). Toggle highlights.  
3) If the system misses something, click-and-drag anywhere on the PDF to add manual redaction boxes.  
4) Click “Redact” to download `redacted.pdf` and `redactify-key.json`.  
5) Switch to “Un-redact” and upload the redacted PDF + its matching key file to restore the original. Only the correct key file works.

## Notes
- Fully client-side: no network needed beyond initial model download.  
- Multilingual NER (en/de/fr/it/es) plus regex tuned for EU IDs/IBAN/AHV/phones.  
- Key file encrypts the original PDF with AES-GCM; arbitrary JSON won’t restore.  

## Scripts
- `npm run dev` – start Vite dev server.  
- `npm run build` – type-check and build.  
- `npm run preview` – serve the production build locally.
