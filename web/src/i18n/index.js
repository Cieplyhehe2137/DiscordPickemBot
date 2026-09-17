// Wszystkie słowniki w jednym miejscu.
//
// Wczytywane NA SZTYWNO, wszystkie pięć naraz, a nie dociągane po wyborze
// języka. Powód: całość tekstów to kilkadziesiąt kilobajtów - mniej niż
// jeden obrazek na stronie - a dociąganie oznaczałoby moment, w którym
// strona stoi bez napisów, i drugi tryb awaryjny do obsłużenia, gdyby
// dociągnięcie się nie udało. Nie warto.

import pl from "./pl.js";
import en from "./en.js";
import de from "./de.js";
import ru from "./ru.js";
import uk from "./uk.js";

export const SLOWNIKI = { pl, en, de, ru, uk };

export { createTranslator, interpolate, selectForm } from "./translate.js";
