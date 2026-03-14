import type { TextItem, DetectedSpan } from '../types'

type ProgressCallback = (progress: number, message: string) => void

type NERPipeline = (text: string) => Promise<NERResult[]>

interface NERResult {
  word: string
  entity: string
  score: number
  start: number
  end: number
}

let nerPipeline: NERPipeline | null = null

export async function loadNERModel(onProgress?: ProgressCallback): Promise<boolean> {
  try {
    onProgress?.(0, 'Loading NER model...')

    const { pipeline, env } = await import('@huggingface/transformers')

    // Single-threaded WASM — no SharedArrayBuffer required
    env.backends.onnx.wasm.numThreads = 1

    nerPipeline = await pipeline('token-classification', 'Xenova/bert-base-NER', {
      progress_callback: (info: { progress?: number; status?: string }) => {
        if (info.progress !== undefined) {
          onProgress?.(info.progress, `Downloading model: ${Math.round(info.progress)}%`)
        }
      },
    }) as unknown as NERPipeline

    onProgress?.(100, 'Model ready')
    return true
  } catch (err) {
    console.warn('NER model failed to load, falling back to regex only:', err)
    onProgress?.(100, 'Model unavailable, using regex only')
    return false
  }
}

export async function detectNERSpans(textItems: TextItem[]): Promise<DetectedSpan[]> {
  if (!nerPipeline) return []

  const spans: DetectedSpan[] = []
  const pages = new Map<number, TextItem[]>()
  for (const item of textItems) {
    const list = pages.get(item.pageIndex) ?? []
    list.push(item)
    pages.set(item.pageIndex, list)
  }

  for (const [pageIndex, items] of pages) {
    let fullText = ''
    const charToItem: number[] = []

    for (let i = 0; i < items.length; i++) {
      const start = fullText.length
      fullText += items[i].str + ' '
      for (let c = 0; c < items[i].str.length + 1; c++) {
        charToItem[start + c] = i
      }
    }

    const CHUNK_SIZE = 500
    for (let offset = 0; offset < fullText.length; offset += CHUNK_SIZE) {
      const chunk = fullText.slice(offset, offset + CHUNK_SIZE)
      let results: NERResult[]
      try {
        const raw = await nerPipeline(chunk)
        results = Array.isArray(raw) ? raw as NERResult[] : []
      } catch {
        continue
      }

      const groups: Array<{ type: string; start: number; end: number; words: string[] }> = []
      for (const r of results) {
        const entityType = r.entity.replace(/^[BI]-/, '')
        const absStart = offset + r.start
        const absEnd = offset + r.end

        if (
          r.entity.startsWith('B-') ||
          groups.length === 0 ||
          groups[groups.length - 1].type !== entityType
        ) {
          groups.push({ type: entityType, start: absStart, end: absEnd, words: [r.word] })
        } else {
          groups[groups.length - 1].end = absEnd
          groups[groups.length - 1].words.push(r.word)
        }
      }

      for (const group of groups) {
        if (!['PER', 'LOC', 'ORG', 'MISC'].includes(group.type)) continue

        const startItem = charToItem[Math.min(group.start, charToItem.length - 1)]
        const endItem = charToItem[Math.min(group.end - 1, charToItem.length - 1)]
        if (startItem === undefined) continue

        const spanned = items.slice(startItem, (endItem ?? startItem) + 1)
        const x = Math.min(...spanned.map(it => it.bbox.x))
        const y = Math.min(...spanned.map(it => it.bbox.y))
        const right = Math.max(...spanned.map(it => it.bbox.x + it.bbox.width))
        const bottom = Math.max(...spanned.map(it => it.bbox.y + it.bbox.height))

        const typeMap: Record<string, string> = {
          PER: 'PERSON', LOC: 'LOCATION', ORG: 'ORGANIZATION', MISC: 'MISC',
        }

        spans.push({
          text: group.words.join(' ').replace(/\s?##/g, ''),
          entityType: typeMap[group.type] ?? group.type,
          pageIndex,
          bbox: { x, y, width: right - x, height: bottom - y },
          confirmed: false,
          source: 'ner',
        })
      }
    }
  }

  return spans
}
