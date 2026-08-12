/** Translate Japanese → Russian via MyMemory (no API key). */
export async function translateJaToRu(text: string): Promise<string> {
  const trimmed = text.trim()
  if (!trimmed) return ''

  const url = new URL('https://api.mymemory.translated.net/get')
  url.searchParams.set('q', trimmed.slice(0, 450))
  url.searchParams.set('langpair', 'ja|ru')

  const res = await fetch(url.toString())
  if (!res.ok) {
    throw new Error(`Перевод недоступен (${res.status})`)
  }
  const data = (await res.json()) as {
    responseStatus?: number | string
    responseData?: { translatedText?: string }
    responseDetails?: string
  }
  const status = Number(data.responseStatus)
  const translated = String(data.responseData?.translatedText ?? '').trim()
  if (!translated || (status && status !== 200)) {
    throw new Error(data.responseDetails || 'Не удалось получить перевод')
  }
  // MyMemory sometimes echoes QUOTA warnings in the text.
  if (/MYMEMORY WARNING/i.test(translated)) {
    throw new Error('Лимит бесплатного перевода исчерпан. Попробуйте позже.')
  }
  return translated
}
