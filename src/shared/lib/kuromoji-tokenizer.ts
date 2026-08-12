import * as kuromoji from '@patdx/kuromoji'
import type { IpadicFeatures, Tokenizer } from '@patdx/kuromoji'

const DICT_BASE = '/kuromoji-dict/'

async function gunzipArrayBuffer(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Браузер не поддерживает DecompressionStream (нужен современный Chrome/Firefox/Safari).')
  }
  const stream = new Response(buffer).body!.pipeThrough(new DecompressionStream('gzip'))
  return await new Response(stream).arrayBuffer()
}

function createBrowserDictLoader(): kuromoji.LoaderConfig {
  return {
    async loadArrayBuffer(file: string) {
      const name = file.split('/').pop() || file
      const res = await fetch(`${DICT_BASE}${name}`)
      if (!res.ok) {
        throw new Error(`Не удалось загрузить словарь Kuromoji (${name}): ${res.status}`)
      }
      return gunzipArrayBuffer(await res.arrayBuffer())
    },
  }
}

let tokenizerPromise: Promise<Tokenizer> | null = null

/** Lazy singleton: loads ~17 MB gzip IPADIC once per session. */
export function getKuromojiTokenizer(): Promise<Tokenizer> {
  if (!tokenizerPromise) {
    tokenizerPromise = new kuromoji.TokenizerBuilder({
      loader: createBrowserDictLoader(),
    }).build()
  }
  return tokenizerPromise
}

export async function tokenizeWithKuromoji(text: string): Promise<IpadicFeatures[]> {
  const tokenizer = await getKuromojiTokenizer()
  return tokenizer.tokenize(String(text ?? ''))
}

export type { IpadicFeatures, Tokenizer }
