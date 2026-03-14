import type { DetectedSpan } from '../types'
import { EntityBadge } from './EntityBadge'

interface Props {
  spans: DetectedSpan[]
  onToggle: (index: number) => void
  onToggleAll: (entityType: string, confirmed: boolean) => void
}

export function RedactionSidebar({ spans, onToggle, onToggleAll }: Props) {
  // Group by entity type
  const groups = new Map<string, Array<{ span: DetectedSpan; index: number }>>()
  spans.forEach((span, index) => {
    const list = groups.get(span.entityType) ?? []
    list.push({ span, index })
    groups.set(span.entityType, list)
  })

  const confirmedCount = spans.filter(s => s.confirmed).length

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full">
      <div className="p-4 border-b border-gray-200">
        <h2 className="font-semibold text-gray-900">Detected PII</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          {confirmedCount} of {spans.length} selected for redaction
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {groups.size === 0 && (
          <div className="p-6 text-center text-gray-400 text-sm">
            No PII detected. You can draw manual redactions on the PDF.
          </div>
        )}

        {[...groups.entries()].map(([type, items]) => {
          const allConfirmed = items.every(i => i.span.confirmed)
          return (
            <div key={type} className="border-b border-gray-100">
              <div className="flex items-center justify-between px-4 py-2 bg-gray-50">
                <div className="flex items-center gap-2">
                  <EntityBadge entityType={type} />
                  <span className="text-xs text-gray-500">{items.length}</span>
                </div>
                <button
                  onClick={() => onToggleAll(type, !allConfirmed)}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  {allConfirmed ? 'Deselect all' : 'Select all'}
                </button>
              </div>

              {items.map(({ span, index }) => (
                <div
                  key={index}
                  onClick={() => onToggle(index)}
                  className={`flex items-start gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors ${
                    span.confirmed ? 'bg-red-50' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={span.confirmed}
                    onChange={() => onToggle(index)}
                    onClick={e => e.stopPropagation()}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300"
                  />
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800 truncate font-mono">{span.text}</p>
                    <p className="text-xs text-gray-400">Page {span.pageIndex + 1}</p>
                  </div>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
