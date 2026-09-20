// Wszystkie słowniki w jednym miejscu, w KOMPLECIE - razem z napisami panelu.
//
// TEGO PLIKU NIE UŻYWA APLIKACJA. Strona bierze słowniki z dictionaries.js,
// który dociąga je po kawałku: polski od razu, pozostałe języki po wyborze,
// a napisy panelu dopiero przy wejściu na /admin. Powody i liczby stoją tam.
//
// Ten plik istnieje dla TESTÓW. Strażnik zestawów kluczy musi widzieć
// wszystkie pięć języków naraz i każdy w całości - inaczej nie ma jak
// powiedzieć, że czegoś brakuje. Import statyczny jest tu więc zaletą,
// a nie niedopatrzeniem: gdyby ten plik cokolwiek dociągał, test musiałby
// czekać, a czekający test łatwiej przeoczyć niż wolny.
//
// Sklejenie `{ ...pl, ...plAdmin }` jest tym samym, co robi
// `dostepneSlowniki()` po dociągnięciu panelu - jeden obiekt na język,
// bez śladu po podziale. Podział jest decyzją o POBIERANIU, nie o znaczeniu.

import pl from "./pl.js";
import en from "./en.js";
import de from "./de.js";
import ru from "./ru.js";
import uk from "./uk.js";

import plAdmin from "./pl.admin.js";
import enAdmin from "./en.admin.js";
import deAdmin from "./de.admin.js";
import ruAdmin from "./ru.admin.js";
import ukAdmin from "./uk.admin.js";

export const SLOWNIKI = {
  pl: { ...pl, ...plAdmin },
  en: { ...en, ...enAdmin },
  de: { ...de, ...deAdmin },
  ru: { ...ru, ...ruAdmin },
  uk: { ...uk, ...ukAdmin },
};

/** Same napisy panelu - dla testu pilnującego, co gdzie leży. */
export const SLOWNIKI_PANELU = {
  pl: plAdmin,
  en: enAdmin,
  de: deAdmin,
  ru: ruAdmin,
  uk: ukAdmin,
};

/** Same napisy publiczne - to jest to, co pobiera zwykły odwiedzający. */
export const SLOWNIKI_PUBLICZNE = { pl, en, de, ru, uk };

export { createTranslator, interpolate, selectForm } from "./translate.js";
