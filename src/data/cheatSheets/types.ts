export interface CheatSheetExample {
  jp: string
  gloss: string
  note?: string
}

export interface CheatSheetSection {
  id: string
  title: string
  lead?: string
  notes?: string[]
  bullets?: string[]
  headers?: string[]
  rows?: string[][]
  examples?: CheatSheetExample[]
}

export interface CheatSheetDoc {
  id: string
  title: string
  lead: string
  sections: CheatSheetSection[]
}
