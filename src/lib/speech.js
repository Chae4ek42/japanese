export function normalizeReadingForSpeech(reading) {
  return String(reading ?? '')
    .replace(/^-/, '')
    .replace(/\./g, '')
    .trim()
}

export function readingsForSpeech(onyomi = [], kunyomi = []) {
  const seen = new Set()
  const result = []
  for (const reading of [...onyomi, ...kunyomi]) {
    const cleaned = normalizeReadingForSpeech(reading)
    if (!cleaned || seen.has(cleaned)) {
      continue
    }
    seen.add(cleaned)
    result.push(cleaned)
  }
  return result
}

export function speakJapanese(text) {
  if (typeof window === 'undefined' || !window.speechSynthesis || !text) {
    return false
  }

  const utterance = new SpeechSynthesisUtterance(String(text))
  utterance.lang = 'ja-JP'
  utterance.rate = 0.9
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utterance)
  return true
}

/** Озвучивает несколько чтений подряд с короткой паузой. */
export function speakJapaneseSequence(parts, { gapMs = 280 } = {}) {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    return false
  }

  const queue = (Array.isArray(parts) ? parts : [parts])
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)

  if (!queue.length) {
    return false
  }

  window.speechSynthesis.cancel()

  let index = 0
  const speakNext = () => {
    if (index >= queue.length) {
      return
    }
    const utterance = new SpeechSynthesisUtterance(queue[index])
    utterance.lang = 'ja-JP'
    utterance.rate = 0.9
    index += 1
    utterance.onend = () => {
      if (index < queue.length) {
        window.setTimeout(speakNext, gapMs)
      }
    }
    window.speechSynthesis.speak(utterance)
  }

  speakNext()
  return true
}

export function speakKanjiReadings(info) {
  if (!info) {
    return false
  }
  const readings = readingsForSpeech(info.onyomi, info.kunyomi)
  if (!readings.length) {
    return speakJapanese(info.character)
  }
  return speakJapaneseSequence(readings)
}
