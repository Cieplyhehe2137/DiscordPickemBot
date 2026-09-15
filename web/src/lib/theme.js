// Motyw jasny i ciemny.
//
// CIEMNY ZOSTAJE DOMYŚLNY. Serwis od zawsze jest ciemny i tak ma zostać dla
// kogoś, kto nic nie zmienia - także wtedy, gdy jego system woli jasny.
// Automatyczne pójście za `prefers-color-scheme` zmieniłoby wygląd ludziom,
// którzy o to nie prosili; wybór ma być świadomy i to on jest zapamiętywany.
//
// Cały motyw to jeden atrybut na <html>: reszta dzieje się w CSS, bo paleta
// stoi na zmiennych. Nie ma tu żadnej klasy dokładanej do komponentów.

export const THEMES = ["dark", "light"];

export const DOMYSLNY = "dark";

// Ten sam klucz czyta wbudowany skrypt w index.html - gdyby się rozjechały,
// strona mrugałaby ciemnym motywem przed przełączeniem na jasny.
export const KLUCZ = "pickem-theme";

export const ATRYBUT = "data-theme";

/**
 * Sprowadza dowolną wartość do znanego motywu.
 *
 * Zapis w przeglądarce przeżywa wdrożenia i bywa śmieciem po starszej
 * wersji - nieznana wartość ma wrócić do domyślnej, a nie trafić do
 * atrybutu i zostawić stronę bez żadnej pasującej reguły.
 */
export function normalizeTheme(wartosc) {
  return THEMES.includes(wartosc) ? wartosc : DOMYSLNY;
}

export function otherTheme(theme) {
  return normalizeTheme(theme) === "dark" ? "light" : "dark";
}

/**
 * Motyw zapisany przez użytkownika albo domyślny.
 *
 * Odczyt w try/catch, bo localStorage potrafi rzucić: prywatne okno,
 * zablokowane dane witryny, polityka przeglądarki. Brak zapisu nie jest
 * powodem, żeby strona się nie otworzyła.
 */
export function readTheme(storage) {
  try {
    return normalizeTheme(storage?.getItem(KLUCZ));
  } catch {
    return DOMYSLNY;
  }
}

export function saveTheme(storage, theme) {
  // Brak magazynu sprawdzany JAWNIE. Przy `storage?.setItem(...)` wywołanie
  // po cichu nie robi nic i nic nie rzuca, więc funkcja zgłaszałaby sukces
  // mimo że niczego nie zapisała.
  if (!storage) return false;

  try {
    storage.setItem(KLUCZ, normalizeTheme(theme));

    return true;
  } catch {
    // Motyw i tak zadziała do końca tej wizyty - po prostu się nie zapamięta.
    return false;
  }
}

/**
 * Wpisuje motyw do dokumentu.
 *
 * Ciemny NIE dostaje atrybutu: to stan domyślny, opisany w samym `:root`.
 * Dzięki temu strona wygląda tak samo z atrybutem "dark" i bez niego,
 * a w HTML-u widać tylko odstępstwo od normy.
 */
export function applyTheme(root, theme) {
  if (!root) return DOMYSLNY;

  const wybrany = normalizeTheme(theme);

  if (wybrany === DOMYSLNY) root.removeAttribute(ATRYBUT);
  else root.setAttribute(ATRYBUT, wybrany);

  return wybrany;
}
