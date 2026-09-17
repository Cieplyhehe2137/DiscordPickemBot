import { useContext } from "react";

import { LanguageContext } from "./languageContext.js";

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }

  return context;
}

/**
 * Skrót do samej funkcji tłumaczącej.
 *
 * Komponenty prawie zawsze chcą tylko `t`, a `const { t } = useLanguage()`
 * w stu plikach to sto linii szumu. Przełącznik języka bierze pełny kontekst.
 */
export function useT() {
  return useLanguage().t;
}
