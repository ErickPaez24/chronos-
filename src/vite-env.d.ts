/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TEMP_MASTER_PIN?: string;
  readonly VITE_TEMP_MASTER_PIN_DATE?: string;
  readonly VITE_REPORT_TIMEZONE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
