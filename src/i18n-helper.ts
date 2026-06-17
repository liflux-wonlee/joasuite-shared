/**
 * Helper to merge shared i18n resources into the host app's i18n config.
 *
 * Usage in each app's `src/i18n/index.ts`:
 *
 *   import { mergeSharedResources } from "@joasuite/shared-ui";
 *   import en from "./locales/en.json";
 *   import ko from "./locales/ko.json";
 *   // ... etc
 *
 *   const resources = mergeSharedResources({ en, ko, zh, es, vi });
 *   i18n.init({ resources, ... });
 */
import sharedEn from "./i18n/en.json";
import sharedKo from "./i18n/ko.json";
import sharedZh from "./i18n/zh.json";
import sharedEs from "./i18n/es.json";
import sharedVi from "./i18n/vi.json";

const SHARED: Record<string, Record<string, unknown>> = {
  en: sharedEn as Record<string, unknown>,
  ko: sharedKo as Record<string, unknown>,
  zh: sharedZh as Record<string, unknown>,
  es: sharedEs as Record<string, unknown>,
  vi: sharedVi as Record<string, unknown>,
};

/**
 * Deep-merge shared namespaces (`suite.*`, `people.*`, `account.*`,
 * `bell.*`, `common.*`, `set.*`) into the host app's per-language
 * resources. App-specific keys override shared keys.
 */
export function mergeSharedResources(
  appResources: Record<string, Record<string, unknown>>,
): Record<string, { translation: Record<string, unknown> }> {
  const out: Record<string, { translation: Record<string, unknown> }> = {};
  for (const lang of Object.keys(SHARED)) {
    const shared = SHARED[lang] ?? {};
    const app = appResources[lang] ?? {};
    out[lang] = { translation: deepMerge(shared, app) };
  }
  return out;
}

function deepMerge(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...a };
  for (const k of Object.keys(b)) {
    const av = a[k];
    const bv = b[k];
    if (isObj(av) && isObj(bv)) {
      out[k] = deepMerge(av, bv);
    } else {
      out[k] = bv;
    }
  }
  return out;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "ko", label: "한국어" },
  { code: "zh", label: "中文" },
  { code: "es", label: "Español" },
  { code: "vi", label: "Tiếng Việt" },
] as const;
