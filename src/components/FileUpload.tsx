import { useRef, useState } from 'react'

interface Props {
  onConfirm: (pdfFile: File, keyFile?: File) => void
  mode: 'redact' | 'unredact'
  onModeChange: (mode: 'redact' | 'unredact') => void
}

export function FileUpload({ onConfirm, mode, onModeChange }: Props) {
  const pdfInputRef = useRef<HTMLInputElement>(null)
  const keyInputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [keyFile, setKeyFile] = useState<File | null>(null)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file?.type === 'application/pdf') setPdfFile(file)
  }

  const canConfirm = pdfFile && (mode === 'redact' || keyFile)

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-xl">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Redactify</h1>
        <p className="text-gray-500 mb-8">Browser-only PDF redaction. Nothing leaves your device.</p>

        {/* Mode toggle */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => { onModeChange('redact'); setPdfFile(null); setKeyFile(null) }}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              mode === 'redact' ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 border border-gray-300'
            }`}
          >
            Redact PDF
          </button>
          <button
            onClick={() => { onModeChange('unredact'); setPdfFile(null); setKeyFile(null) }}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              mode === 'unredact' ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 border border-gray-300'
            }`}
          >
            Un-redact PDF
          </button>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => pdfInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
            dragging
              ? 'border-blue-400 bg-blue-50'
              : pdfFile
              ? 'border-green-400 bg-green-50'
              : 'border-gray-300 bg-white hover:border-gray-400'
          }`}
        >
          <div className="text-4xl mb-3">{pdfFile ? '✅' : '📄'}</div>
          {pdfFile ? (
            <>
              <p className="text-gray-800 font-medium">{pdfFile.name}</p>
              <p className="text-gray-400 text-sm mt-1">Click to change</p>
            </>
          ) : (
            <>
              <p className="text-gray-700 font-medium">Drop a PDF here or click to browse</p>
              <p className="text-gray-400 text-sm mt-1">PDF files only</p>
            </>
          )}
          <input
            ref={pdfInputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) setPdfFile(f) }}
          />
        </div>

        {/* Key file (unredact mode) */}
        {mode === 'unredact' && (
          <div className="mt-3">
            <button
              onClick={() => keyInputRef.current?.click()}
              className={`w-full border rounded-xl p-4 text-left transition-colors ${
                keyFile
                  ? 'border-green-400 bg-green-50'
                  : 'border-gray-300 bg-white hover:border-gray-400'
              }`}
            >
              <p className="text-sm font-medium text-gray-700">
                {keyFile ? `🔑 ${keyFile.name}` : 'Select key file (.json)'}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">The key file downloaded when you redacted</p>
            </button>
            <input
              ref={keyInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) setKeyFile(f) }}
            />
          </div>
        )}

        {/* Action button */}
        <button
          onClick={() => pdfFile && onConfirm(pdfFile, keyFile ?? undefined)}
          disabled={!canConfirm}
          className="mt-6 w-full py-3 rounded-xl font-medium text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-red-600 text-white hover:bg-red-700"
        >
          {mode === 'redact' ? 'Start Redacting →' : 'Restore PDF →'}
        </button>
      </div>
    </div>
  )
}
