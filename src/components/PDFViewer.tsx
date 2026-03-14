import { useEffect, useRef, useState } from 'react'
import * as pdfjs from 'pdfjs-dist'
import type { DetectedSpan, PageDimensions } from '../types'

interface Props {
  pdfDocument: pdfjs.PDFDocumentProxy | null
  pageDimensions: PageDimensions[]
  spans: DetectedSpan[]
  onToggleSpan: (index: number) => void
  onAddManual: (span: DetectedSpan) => void
}

const ENTITY_COLORS: Record<string, string> = {
  PERSON: 'rgba(59,130,246,0.35)',
  LOCATION: 'rgba(34,197,94,0.35)',
  ORGANIZATION: 'rgba(168,85,247,0.35)',
  EMAIL: 'rgba(234,179,8,0.35)',
  PHONE: 'rgba(249,115,22,0.35)',
  IBAN: 'rgba(239,68,68,0.35)',
  CREDIT_CARD: 'rgba(239,68,68,0.35)',
  SSN: 'rgba(239,68,68,0.35)',
  MANUAL: 'rgba(239,68,68,0.35)',
}

const SCALE = 1.5

export function PDFViewer({ pdfDocument, pageDimensions, spans, onToggleSpan, onAddManual }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map())
  const renderTaskRefs = useRef<Map<number, pdfjs.RenderTask>>(new Map())
  const [renderedPages, setRenderedPages] = useState<Set<number>>(new Set())
  const [dragState, setDragState] = useState<{
    pageIndex: number
    startX: number
    startY: number
    currentX: number
    currentY: number
  } | null>(null)

  useEffect(() => {
    if (!pdfDocument) return
    setRenderedPages(new Set())

    let active = true

    const renderPage = async (pageIndex: number) => {
      const canvas = canvasRefs.current.get(pageIndex)
      if (!canvas || !active) return

      // Cancel any in-flight render for this page before starting a new one
      const existing = renderTaskRefs.current.get(pageIndex)
      if (existing) {
        try { existing.cancel() } catch { /* ignore */ }
        renderTaskRefs.current.delete(pageIndex)
      }

      const page = await pdfDocument.getPage(pageIndex + 1)
      if (!active) return

      const viewport = page.getViewport({ scale: SCALE })
      canvas.width = viewport.width
      canvas.height = viewport.height

      const ctx = canvas.getContext('2d')!
      const task = page.render({ canvasContext: ctx, viewport })
      renderTaskRefs.current.set(pageIndex, task)

      try {
        await task.promise
        if (active) setRenderedPages(prev => new Set([...prev, pageIndex]))
      } catch (e: unknown) {
        if (e instanceof Error && e.name !== 'RenderingCancelledException') {
          console.error('Render error:', e)
        }
      }
    }

    for (let i = 0; i < pdfDocument.numPages; i++) {
      renderPage(i)
    }

    return () => {
      // Cancel all in-flight renders when effect re-runs (e.g. StrictMode)
      active = false
      renderTaskRefs.current.forEach(task => {
        try { task.cancel() } catch { /* ignore */ }
      })
      renderTaskRefs.current.clear()
    }
  }, [pdfDocument])

  function getPageCoords(e: React.MouseEvent, pageIndex: number) {
    const canvas = canvasRefs.current.get(pageIndex)
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const dim = pageDimensions[pageIndex]
    if (!dim) return null
    return {
      x: ((e.clientX - rect.left) / rect.width) * dim.width,
      y: ((e.clientY - rect.top) / rect.height) * dim.height,
    }
  }

  function handleMouseDown(e: React.MouseEvent, pageIndex: number) {
    const coords = getPageCoords(e, pageIndex)
    if (!coords) return
    setDragState({ pageIndex, startX: coords.x, startY: coords.y, currentX: coords.x, currentY: coords.y })
  }

  function handleMouseMove(e: React.MouseEvent, pageIndex: number) {
    if (!dragState || dragState.pageIndex !== pageIndex) return
    const coords = getPageCoords(e, pageIndex)
    if (!coords) return
    setDragState(prev => prev ? { ...prev, currentX: coords.x, currentY: coords.y } : null)
  }

  function handleMouseUp(pageIndex: number) {
    if (!dragState || dragState.pageIndex !== pageIndex) return
    const minSize = 5
    const x = Math.min(dragState.startX, dragState.currentX)
    const y = Math.min(dragState.startY, dragState.currentY)
    const w = Math.abs(dragState.currentX - dragState.startX)
    const h = Math.abs(dragState.currentY - dragState.startY)
    if (w > minSize && h > minSize) {
      onAddManual({
        text: '[manual]',
        entityType: 'MANUAL',
        pageIndex,
        bbox: { x, y, width: w, height: h },
        confirmed: true,
        source: 'manual',
      })
    }
    setDragState(null)
  }

  if (!pdfDocument) return null

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto bg-gray-100 p-6 space-y-6">
      {Array.from({ length: pdfDocument.numPages }, (_, pageIndex) => {
        const dim = pageDimensions[pageIndex]
        const pageSpans = spans.map((s, i) => ({ span: s, index: i })).filter(s => s.span.pageIndex === pageIndex)
        const drag = dragState?.pageIndex === pageIndex ? dragState : null

        return (
          <div key={pageIndex} className="relative mx-auto shadow-lg" style={{ display: 'table' }}>
            <canvas
              ref={el => { if (el) canvasRefs.current.set(pageIndex, el) }}
              style={{ display: 'block' }}
            />

            {/* SVG overlay for highlights */}
            {dim && (
              <svg
                className="absolute inset-0 w-full h-full"
                viewBox={`0 0 ${dim.width} ${dim.height}`}
                style={{ pointerEvents: 'none', position: 'absolute', top: 0, left: 0 }}
              >
                {pageSpans.map(({ span, index }) => (
                  <rect
                    key={index}
                    x={span.bbox.x}
                    y={span.bbox.y}
                    width={span.bbox.width}
                    height={span.bbox.height}
                    fill={span.confirmed ? 'rgba(239,68,68,0.4)' : (ENTITY_COLORS[span.entityType] ?? 'rgba(251,191,36,0.4)')}
                    stroke={span.confirmed ? 'rgb(220,38,38)' : 'rgb(217,119,6)'}
                    strokeWidth={1}
                    style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                    onClick={() => onToggleSpan(index)}
                  />
                ))}

                {/* Drag preview */}
                {drag && (
                  <rect
                    x={Math.min(drag.startX, drag.currentX)}
                    y={Math.min(drag.startY, drag.currentY)}
                    width={Math.abs(drag.currentX - drag.startX)}
                    height={Math.abs(drag.currentY - drag.startY)}
                    fill="rgba(239,68,68,0.2)"
                    stroke="rgb(220,38,38)"
                    strokeWidth={1.5}
                    strokeDasharray="4"
                  />
                )}
              </svg>
            )}

            {/* Mouse capture layer for drawing */}
            {dim && (
              <div
                className="absolute inset-0"
                style={{ cursor: 'crosshair' }}
                onMouseDown={e => handleMouseDown(e, pageIndex)}
                onMouseMove={e => handleMouseMove(e, pageIndex)}
                onMouseUp={() => handleMouseUp(pageIndex)}
                onMouseLeave={() => setDragState(null)}
              />
            )}

            {!renderedPages.has(pageIndex) && (
              <div className="absolute inset-0 flex items-center justify-center bg-white text-gray-400 text-sm">
                Rendering page {pageIndex + 1}…
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
