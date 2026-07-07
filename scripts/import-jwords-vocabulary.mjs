import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { kanaToRomaji, katakanaToHiragana } from '../src/lib/romaji.js'

const VOC_URL = 'https://japanese-words.org/ru/training/vocabulary'
const API_URL = 'https://japanese-words.org/ru/training/vocabulary/test/get'
const REGIMES = ['0', 'wm', 'mw', 'rw', 'wr']
const KANA_RE = /^[\u3040-\u309f\u30a0-\u30ffー]+$/

const limitArg = process.argv.find((a) => a.startsWith('--limit='))
const lessonLimit = limitArg ? Number(limitArg.split('=')[1]) : Infinity

function parseVocData(html) {
  const start = html.indexOf('var reactTrainingVocData = ')
  const end = html.indexOf('</script>', start)
  const objText = html.slice(start + 'var reactTrainingVocData = '.length, end).trim().replace(/,\s*$/, '')
  return Function(`return (${objText})`)()
}

function hasJapanese(text) {
  return /[\u3040-\u30ff\u4e00-\u9fff]/.test(text)
}

function hasCyrillic(text) {
  return /[\u0400-\u04ff]/.test(text)
}

function normalizeKana(text) {
  if (!text) return ''
  const trimmed = text.trim()
  if (!KANA_RE.test(trimmed)) return ''
  return katakanaToHiragana(trimmed)
}

function normalizeMeanings(raw) {
  return [...new Set(
    (raw || '')
      .split(/[,;]/)
      .map((part) => part.trim())
      .filter((part) => part && !hasJapanese(part)),
  )]
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'word'
}

function safeRomaji(kana) {
  const normalized = normalizeKana(kana)
  if (!normalized) return ''
  try {
    return kanaToRomaji(normalized)
  } catch {
    return ''
  }
}

async function fetchQuestion(categoryId, type, id = 0, count = 0) {
  const body = new URLSearchParams({
    type,
    category: String(categoryId),
    light: 'yes',
    id: String(id),
    count: String(count),
  })

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body,
      })
      const text = await res.text()
      if (!text) return null
      return JSON.parse(text)
    } catch (error) {
      const waitMs = 500 * (attempt + 1)
      console.warn(`  retry ${attempt + 1}/5 after error: ${error.message}`)
      await new Promise((r) => setTimeout(r, waitMs))
    }
  }
  return null
}

function extractFromCard(card, lessonId) {
  const results = []
  const { type, question, hint, variants = [] } = card
  const cleanHint = (hint || '').trim()
  const variantItems = variants.map((v) =>
    typeof v === 'string' ? { text: v, hint: '' } : { text: v.text || '', hint: v.hint || '' },
  )

  if (type === 'rw' || type === 'wr') {
    const questionKana = normalizeKana(question)
    if (questionKana) {
      const meanings = normalizeMeanings(cleanHint)
      for (const variant of variantItems) {
        if (!hasJapanese(variant.text) || !/[\u4e00-\u9fff]/.test(variant.text)) continue
        results.push({ kanji: variant.text, kana: questionKana, meanings, lessonId })
      }
    } else if (hasCyrillic(question)) {
      const meanings = normalizeMeanings(question)
      for (const variant of variantItems) {
        if (!hasJapanese(variant.text)) continue
        const kana = normalizeKana(variant.hint) || normalizeKana(variant.text)
        if (!kana) continue
        results.push({ kanji: variant.text, kana, meanings, lessonId })
      }
    }
  }

  if (type === 'wm' && hasJapanese(question)) {
    const kana = normalizeKana(cleanHint) || normalizeKana(question)
    if (kana) {
      results.push({
        kanji: question,
        kana,
        meanings: variantItems.map((v) => v.text).filter((t) => t && !hasJapanese(t)),
        lessonId,
      })
    }
  }

  if (type === 'mw' && (hasCyrillic(question) || /^[a-z\s?,!.-]+$/i.test(question))) {
    const meanings = normalizeMeanings(question)
    for (const variant of variantItems) {
      if (!hasJapanese(variant.text)) continue
      const kana = normalizeKana(variant.hint) || normalizeKana(variant.text)
      if (!kana) continue
      results.push({ kanji: variant.text, kana, meanings, lessonId })
    }
  }

  return results
}

async function collectLesson(categoryId, expectedCount) {
  const words = new Map()
  const seenCards = new Set()
  const target = Math.ceil(expectedCount * 1.15)

  for (const regime of REGIMES) {
    if (words.size >= target) break

    let id = 0
    let type = regime
    let stagnant = 0
    const attempts = Math.max(expectedCount * 3, 40)

    for (let i = 0; i < attempts; i++) {
      if (words.size >= target) break

      const card = await fetchQuestion(categoryId, type, id, i)
      if (!card?.question) {
        stagnant += 1
        if (stagnant > 4) break
        continue
      }
      stagnant = 0

      const sig = `${card.type}|${card.question}|${card.hint}|${JSON.stringify(card.variants)}`
      if (!seenCards.has(sig)) {
        seenCards.add(sig)
        for (const raw of extractFromCard(card, categoryId)) {
          if (!raw.kanji || !raw.kana || !raw.meanings.length) continue
          const key = `${raw.kanji}||${raw.kana}`
          const existing = words.get(key)
          if (!existing) {
            words.set(key, raw)
          } else {
            for (const meaning of raw.meanings) {
              if (!existing.meanings.includes(meaning)) existing.meanings.push(meaning)
            }
          }
          if (words.size >= target) break
        }
      }

      id = card.id
      type = card.type
      await new Promise((r) => setTimeout(r, 90))
    }
  }

  return [...words.values()].slice(0, expectedCount)
}

const html = await (await fetch(VOC_URL)).text()
const vocData = parseVocData(html)
const lessons = vocData.categories.flatMap((c) =>
  c.children.map((child) => ({
    parentId: c.parent.id,
    parentName: c.parent.name,
    id: child.id,
    name: child.name,
    expectedCount: Number((child.name.match(/\((\d+)\)/) || [])[1] || 30),
  })),
)

console.log(`Lessons: ${lessons.length}, importing ${Math.min(lessons.length, lessonLimit)}`)

const partialPath = 'public/data/jwords-vocabulary.json'
let allWords = new Map()
let groups = []

if (existsSync(partialPath)) {
  const partial = JSON.parse(readFileSync(partialPath, 'utf8'))
  for (const word of partial.words ?? []) allWords.set(word.id, word)
  groups = partial.groups ?? []
  console.log(`Resume: ${groups.length} lessons, ${allWords.size} words`)
}

const completedLessonIds = new Set(groups.map((group) => group.id.replace('lesson-', '')))

for (const lesson of lessons.slice(0, lessonLimit)) {
  if (completedLessonIds.has(String(lesson.id))) {
    console.log(`Skip ${lesson.name}`)
    continue
  }
  console.log(`Collecting ${lesson.name}...`)
  const lessonWords = await collectLesson(lesson.id, lesson.expectedCount)
  let wordIds = []

  for (const word of lessonWords) {
    const romaji = safeRomaji(word.kana)
    if (!romaji) continue

    const id = `jw-${slugify(word.kanji)}-${slugify(word.kana)}`
    const normalized = {
      id,
      kanji: word.kanji,
      kana: word.kana,
      romaji,
      meanings: word.meanings,
      en: '',
      pos: [],
      audio: '',
      lessonId: lesson.id,
    }

    if (!allWords.has(id)) {
      allWords.set(id, normalized)
    } else {
      const existing = allWords.get(id)
      for (const meaning of normalized.meanings) {
        if (!existing.meanings.includes(meaning)) existing.meanings.push(meaning)
      }
    }
    if (!wordIds.includes(id)) wordIds.push(id)
  }

  wordIds = wordIds.slice(0, lesson.expectedCount)

  groups.push({
    id: `lesson-${lesson.id}`,
    label: lesson.name,
    parentId: lesson.parentId,
    parentName: lesson.parentName,
    wordIds,
    preview: lessonWords.slice(0, 8).map((w) => w.kanji).join(' · '),
  })
  console.log(`  got ${wordIds.length}/${lesson.expectedCount} words`)

  writeFileSync(
    'public/data/jwords-vocabulary.json',
    JSON.stringify(
      {
        version: 1,
        generatedAt: new Date().toISOString(),
        source: 'https://japanese-words.org/ru/training/vocabulary',
        count: allWords.size,
        categories: vocData.categories,
        groups,
        words: [...allWords.values()],
      },
      null,
      2,
    ),
  )
}

const words = [...allWords.values()]
const output = {
  version: 1,
  generatedAt: new Date().toISOString(),
  source: 'https://japanese-words.org/ru/training/vocabulary',
  count: words.length,
  categories: vocData.categories,
  groups,
  words,
}

writeFileSync('public/data/jwords-vocabulary.json', JSON.stringify(output, null, 2))
console.log(`Saved ${words.length} words, ${groups.length} lesson groups`)
