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

/** Languages the word of the day can be shown in. */
export const LANGUAGES: Language[] = [
  ENGLISH,
  { code: "zh-CN", name: "Mandarin", native: "中文" },
  { code: "es", name: "Spanish", native: "Español" },
];

export function findLanguage(code: string | null | undefined): Language | undefined {
  return LANGUAGES.find((l) => l.code === code);
}
