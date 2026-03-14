interface Props {
  confirmedCount: number
  totalCount: number
  onRedact: () => void
  onSelectAll: () => void
  onDeselectAll: () => void
  isProcessing: boolean
  processingMessage: string
}

export function ActionBar({
  confirmedCount,
  totalCount,
  onRedact,
  onSelectAll,
  onDeselectAll,
  isProcessing,
  processingMessage,
}: Props) {
  return (
    <div className="border-t border-gray-200 bg-white px-6 py-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onSelectAll}
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          Select all
        </button>
        <span className="text-gray-300">|</span>
        <button
          onClick={onDeselectAll}
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          Deselect all
        </button>
      </div>

      <div className="flex items-center gap-3">
        {isProcessing && (
          <span className="text-sm text-gray-500 animate-pulse">{processingMessage}</span>
        )}
        <span className="text-sm text-gray-500">
          {confirmedCount}/{totalCount} items selected
        </span>
        <button
          onClick={onRedact}
          disabled={confirmedCount === 0 || isProcessing}
          className="px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Redact & Export
        </button>
      </div>
    </div>
  )
}
