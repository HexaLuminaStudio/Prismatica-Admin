/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** VITE_API_BASE_URL — 覆盖默认 baseUrl(可选) */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
