const MAX_SEED_EXCLUSIVE = 2 ** 31

export const MAX_SPEC_FILE_BYTES = 128 * 1024

export function parseGenerationSpecJson(text: string): Record<string, unknown> {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error("所选文件不是有效的 JSON。")
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("GenerationSpec 必须是一个 JSON 对象。")
  }
  return parsed as Record<string, unknown>
}

export function nextSeed(current: number, entropy?: number): number {
  let raw = entropy
  if (raw === undefined) {
    const values = new Uint32Array(1)
    window.crypto.getRandomValues(values)
    raw = values[0]
  }
  const candidate = Math.abs(Math.trunc(raw)) % MAX_SEED_EXCLUSIVE
  return candidate === current ? (candidate + 1) % MAX_SEED_EXCLUSIVE : candidate
}

export function downloadJsonFile(filename: string, payload: unknown): void {
  const body = JSON.stringify(payload, null, 2)
  const blob = new Blob([body], { type: "application/json;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
