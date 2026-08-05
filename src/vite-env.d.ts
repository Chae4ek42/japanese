/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONTEXT_LLM_ENDPOINT?: string
  readonly VITE_CONTEXT_LLM_API_KEY?: string
  readonly VITE_CONTEXT_LLM_MODEL?: string
  /** Optional; must match Worker secret `STATE_AUTH` when set. */
  readonly VITE_STATE_AUTH?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
