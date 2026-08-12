export interface CheatSheetExample {
  jp: string
  gloss: string
  note?: string
}

export interface CheatSheetSense {
  id: string
  title: string
  lead?: string
  bullets?: string[]
  examples: CheatSheetExample[]
}

/** Detail page opened from a table cell / row in a cheat sheet. */
export interface CheatSheetTopic {
  id: string
  badge: string
  reading?: string
  title: string
  lead: string
  senses: CheatSheetSense[]
  tips?: string[]
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
  /** First-column cell text → topic id (row becomes clickable). */
  topicByCell?: Record<string, string>
}

export interface CheatSheetDoc {
  id: string
  title: string
  lead: string
  sections: CheatSheetSection[]
  topics?: CheatSheetTopic[]
}
