/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional; must match Worker secret `STATE_AUTH` when set. */
  readonly VITE_STATE_AUTH?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
