/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** The IrmaHS Labs account service. Defaults to https://auth.irmahs.dev. */
  readonly VITE_AUTH_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
