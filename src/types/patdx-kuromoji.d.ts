declare module '@patdx/kuromoji' {
  export interface IpadicFeatures {
    word_id: number
    word_type: string
    word_position: number
    surface_form: string
    pos: string
    pos_detail_1: string
    pos_detail_2: string
    pos_detail_3: string
    conjugated_type: string
    conjugated_form: string
    basic_form: string
    reading?: string
    pronunciation?: string
  }

  export interface Tokenizer {
    tokenize(text: string): IpadicFeatures[]
  }

  export interface LoaderConfig {
    loadArrayBuffer(url: string): Promise<ArrayBufferLike>
  }

  export class TokenizerBuilder {
    constructor(options: { loader: LoaderConfig })
    build(): Promise<Tokenizer>
  }
}

declare module '@patdx/kuromoji/node' {
  import type { LoaderConfig } from '@patdx/kuromoji'
  export default class NodeDictionaryLoader implements LoaderConfig {
    constructor(options: { dic_path: string })
    loadArrayBuffer(file: string): Promise<ArrayBufferLike>
  }
}
