export type Language = {
  /** Code understood by the translation service (MyMemory). */
  code: string;
  /** English name. */
  name: string;
  /** Name in the language itself. */
  native: string;
  rtl?: boolean;
};

export const ENGLISH: Language = { code: "en", name: "English", native: "English" };

/** English plus 20 languages to translate the word of the day into. */
export const LANGUAGES: Language[] = [
  ENGLISH,
  { code: "es", name: "Spanish", native: "Español" },
  { code: "fr", name: "French", native: "Français" },
  { code: "de", name: "German", native: "Deutsch" },
  { code: "it", name: "Italian", native: "Italiano" },
  { code: "pt", name: "Portuguese", native: "Português" },
  { code: "nl", name: "Dutch", native: "Nederlands" },
  { code: "sv", name: "Swedish", native: "Svenska" },
  { code: "pl", name: "Polish", native: "Polski" },
  { code: "ru", name: "Russian", native: "Русский" },
  { code: "uk", name: "Ukrainian", native: "Українська" },
  { code: "el", name: "Greek", native: "Ελληνικά" },
  { code: "tr", name: "Turkish", native: "Türkçe" },
  { code: "ar", name: "Arabic", native: "العربية", rtl: true },
  { code: "he", name: "Hebrew", native: "עברית", rtl: true },
  { code: "hi", name: "Hindi", native: "हिन्दी" },
  { code: "zh-CN", name: "Chinese", native: "中文" },
  { code: "ja", name: "Japanese", native: "日本語" },
  { code: "ko", name: "Korean", native: "한국어" },
  { code: "vi", name: "Vietnamese", native: "Tiếng Việt" },
  { code: "sw", name: "Swahili", native: "Kiswahili" },
];

export function findLanguage(code: string | null | undefined): Language | undefined {
  return LANGUAGES.find((l) => l.code === code);
}
