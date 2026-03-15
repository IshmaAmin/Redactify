import { useState, useCallback } from 'react'
import type { DetectedSpan, RedactionItem, KeyFile, PageDimensions } from './types'
import { FileUpload } from './components/FileUpload'
import { PDFViewer } from './components/PDFViewer'
import { RedactionSidebar } from './components/RedactionSidebar'
import { ActionBar } from './components/ActionBar'
import { parsePDF } from './lib/pdfParser'
import { detectRegexSpans } from './lib/regexDetector'
import { loadNERModel, detectNERSpans } from './lib/nerDetector'
import { mergeDetections, confirmRedactions, buildKeyFile } from './lib/redactionEngine'
import { generateKey } from './lib/cryptoUtils'
import { redactPDF, unredactPDF } from './lib/pdfWriter'
import type { PDFDocumentProxy } from 'pdfjs-dist'

type Screen = 'upload' | 'review' | 'done'

function downloadBlob(data: Uint8Array, filename: string, mime: string) {
  const blob = new Blob([data.buffer as ArrayBuffer], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('upload')
  const [mode, setMode] = useState<'redact' | 'unredact'>('redact')

  // PDF state
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null)
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null)
  const [pageDimensions, setPageDimensions] = useState<PageDimensions[]>([])

  // Detection state
  const [spans, setSpans] = useState<DetectedSpan[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingMessage, setProcessingMessage] = useState('')

  // Done screen
  const [redactedBytes, setRedactedBytes] = useState<Uint8Array | null>(null)
  const [exportedKeyFile, setExportedKeyFile] = useState<KeyFile | null>(null)

  // Called when user clicks "Start Redacting" or "Restore PDF"
  const handleConfirm = useCallback(async (file: File, keyFileObj?: File) => {
    setPdfFile(file)
    setIsProcessing(true)

    try {
      const bytes = await file.arrayBuffer()
      setPdfBytes(bytes)

      if (mode === 'unredact') {
        // Unredact: parse for dimensions, then restore immediately
        if (!keyFileObj) { alert('Please select a key file.'); return }
        setProcessingMessage('Parsing PDF…')
        const { pageDimensions: dims } = await parsePDF(bytes)
        setPageDimensions(dims)

        const keyText = await keyFileObj.text()
        const kf = JSON.parse(keyText) as KeyFile

        setProcessingMessage('Decrypting and restoring…')
        const output = await unredactPDF(bytes, kf)
        downloadBlob(output, 'restored.pdf', 'application/pdf')
        // Stay on upload screen — just downloads the file
        return
      }

      // Redact flow: parse + detect, then go to review screen
      setProcessingMessage('Parsing PDF…')
      const { textItems, pageDimensions: dims, pdfDocument: doc } = await parsePDF(bytes)
      setPdfDocument(doc)
      setPageDimensions(dims)

      setProcessingMessage('Running regex detection…')
      const regexSpans = detectRegexSpans(textItems)

      setProcessingMessage('Loading NER model…')
      await loadNERModel((_p, msg) => setProcessingMessage(msg))

      setProcessingMessage('Running NER detection…')
      const nerSpans = await detectNERSpans(textItems)

      const merged = mergeDetections(nerSpans, regexSpans)
      setSpans(merged.map(s => ({ ...s, confirmed: true })))
      setScreen('review')
    } catch (err) {
      console.error(err)
      alert('Failed to process PDF: ' + String(err))
    } finally {
      setIsProcessing(false)
      setProcessingMessage('')
    }
  }, [mode])

  const handleToggleSpan = useCallback((index: number) => {
    setSpans(prev => prev.map((s, i) => i === index ? { ...s, confirmed: !s.confirmed } : s))
  }, [])

  const handleToggleAll = useCallback((entityType: string, confirmed: boolean) => {
    setSpans(prev => prev.map(s => s.entityType === entityType ? { ...s, confirmed } : s))
  }, [])

  const handleSelectAll = useCallback(() => {
    setSpans(prev => prev.map(s => ({ ...s, confirmed: true })))
  }, [])

  const handleDeselectAll = useCallback(() => {
    setSpans(prev => prev.map(s => ({ ...s, confirmed: false })))
  }, [])

  const handleAddManual = useCallback((span: DetectedSpan) => {
    setSpans(prev => [...prev, span])
  }, [])

  const handleRedact = useCallback(async () => {
    if (!pdfBytes) return
    setIsProcessing(true)
    setProcessingMessage('Encrypting and redacting…')

    try {
      const { key, keyHex } = await generateKey()
      const redactions: RedactionItem[] = await confirmRedactions(spans, key)
      const kf = await buildKeyFile(keyHex, key, redactions, pdfBytes)
      const output = await redactPDF(pdfBytes, redactions, pageDimensions)

      setRedactedBytes(output)
      setExportedKeyFile(kf)
      setScreen('done')
    } catch (err) {
      console.error(err)
      alert('Redaction failed: ' + String(err))
    } finally {
      setIsProcessing(false)
      setProcessingMessage('')
    }
  }, [pdfBytes, spans, pageDimensions])

  // ── Upload screen ────────────────────────────────────────────────────────
  if (screen === 'upload') {
    return (
      <div>
        {isProcessing && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-8 max-w-sm w-full text-center shadow-xl">
              <div className="animate-spin text-4xl mb-4">⚙️</div>
              <p className="text-gray-700 font-medium">{processingMessage}</p>
            </div>
          </div>
        )}
        <FileUpload
          onConfirm={handleConfirm}
          mode={mode}
          onModeChange={setMode}
        />
      </div>
    )
  }

  // ── Review screen ────────────────────────────────────────────────────────
  if (screen === 'review') {
    return (
      <div className="flex flex-col h-screen">
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setScreen('upload')}
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              ← Back
            </button>
            <h1 className="font-semibold text-gray-900">{pdfFile?.name}</h1>
          </div>
          <p className="text-sm text-gray-500">
            Click highlights to toggle · Drag to add manual redaction
          </p>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <PDFViewer
            pdfDocument={pdfDocument}
            pageDimensions={pageDimensions}
            spans={spans}
            onToggleSpan={handleToggleSpan}
            onAddManual={handleAddManual}
          />
          <RedactionSidebar
            spans={spans}
            onToggle={handleToggleSpan}
            onToggleAll={handleToggleAll}
          />
        </div>

        <ActionBar
          confirmedCount={spans.filter(s => s.confirmed).length}
          totalCount={spans.length}
          onRedact={handleRedact}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
          isProcessing={isProcessing}
          processingMessage={processingMessage}
        />
      </div>
    )
  }

  // ── Done screen ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm p-8 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Redaction complete</h2>
        <p className="text-gray-500 mb-8">
          Save both files. You need the key file to restore the original text later.
        </p>

        <div className="space-y-3">
          {redactedBytes && (
            <button
              onClick={() => downloadBlob(redactedBytes, 'redacted.pdf', 'application/pdf')}
              className="w-full px-5 py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
            >
              📄 Download Redacted PDF
            </button>
          )}
          {exportedKeyFile && (
            <button
              onClick={() => {
                const json = JSON.stringify(exportedKeyFile, null, 2)
                const bytes = new TextEncoder().encode(json)
                downloadBlob(bytes, 'redactify-key.json', 'application/json')
              }}
              className="w-full px-5 py-3 bg-yellow-500 text-white rounded-lg font-medium hover:bg-yellow-600 transition-colors"
            >
              🔑 Download Key File
            </button>
          )}
          <button
            onClick={() => {
              setScreen('upload')
              setSpans([])
              setPdfBytes(null)
              setPdfDocument(null)
              setRedactedBytes(null)
              setExportedKeyFile(null)
            }}
            className="w-full px-5 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            Redact another PDF
          </button>
        </div>
      </div>
    </div>
  )
}
