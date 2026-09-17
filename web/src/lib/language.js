// Wybór języka strony.
//
// POLSKI ZOSTAJE DOMYŚLNY. Serwis od zawsze jest po polsku i tak ma zostać
// dla kogoś, kto nic nie zmienia - także wtedy, gdy jego przeglądarka woli
// angielski. Automatyczne pójście za `navigator.language` zmieniłoby język
// ludziom, którzy o to nie prosili; wybór ma być świadomy i to on jest
// zapamiętywany.
//
// Ten moduł NIE IMPORTUJE niczego i tak ma zostać - dzięki temu da się go
// zaimportować w teście node:test, tak samo jak scoring.js i sitemap.js.
// Same teksty leżą w web/src/i18n/, bo to zupełnie inna rzecz: tu jest
// mechanizm, tam słownik.

export const LANGUAGES = ["pl", "en", "de", "ru", "uk"];

export const DOMYSLNY = "pl";

// Ten sam klucz czyta wbudowany skrypt w index.html - gdyby się rozjechały,
// strona ustawiałaby w <html lang> co innego, niż pokazuje.
export const KLUCZ = "pickem-lang";

/**
 * Nazwy języków W ICH WŁASNYM języku.
 *
 * Nie po polsku. Ktoś, kto nie zna polskiego, ma znaleźć swój język na
 * liście - a "Niemiecki" nie pomaga nikomu, kto szuka słowa "Deutsch".
 */
export const NAZWY = {
  pl: "Polski",
  en: "English",
  de: "Deutsch",
  ru: "Русский",
  uk: "Українська",
};

/**
 * Sprowadza dowolną wartość do znanego języka.
 *
 * Zapis w przeglądarce przeżywa wdrożenia i bywa śmieciem po starszej
 * wersji - nieznana wartość ma wrócić do domyślnej, a nie trafić do
 * atrybutu i zostawić stronę bez pasującego słownika.
 */
export function normalizeLanguage(wartosc) {
  return LANGUAGES.includes(wartosc) ? wartosc : DOMYSLNY;
}

/**
 * Język zapisany przez użytkownika albo domyślny.
 *
 * Odczyt w try/catch, bo localStorage potrafi rzucić: prywatne okno,
 * zablokowane dane witryny, polityka przeglądarki. Brak zapisu nie jest
 * powodem, żeby strona się nie otworzyła.
 */
export function readLanguage(storage) {
  try {
    return normalizeLanguage(storage?.getItem(KLUCZ));
  } catch {
    return DOMYSLNY;
  }
}

export function saveLanguage(storage, jezyk) {
  // Brak magazynu sprawdzany JAWNIE. Przy `storage?.setItem(...)` wywołanie
  // po cichu nie robi nic i nic nie rzuca, więc funkcja zgłaszałaby sukces
  // mimo że niczego nie zapisała. Ten sam błąd złapał test przy motywie.
  if (!storage) return false;

  try {
    storage.setItem(KLUCZ, normalizeLanguage(jezyk));

    return true;
  } catch {
    // Język i tak zadziała do końca tej wizyty - po prostu się nie zapamięta.
    return false;
  }
}

/**
 * Wpisuje język do dokumentu.
 *
 * W odróżnieniu od motywu atrybut ustawiany jest ZAWSZE, także dla
 * domyślnego polskiego: `<html lang>` czyta czytnik ekranu i wyszukiwarka,
 * więc pusty albo nieprawdziwy jest gorszy niż nadmiarowy.
 */
export function applyLanguage(root, jezyk) {
  if (!root) return DOMYSLNY;

  const wybrany = normalizeLanguage(jezyk);

  root.setAttribute("lang", wybrany);

  return wybrany;
}

/**
 * Kategoria liczby mnogiej dla danego języka.
 *
 * To NIE jest ozdoba ani uproszczenie - to jest powód, dla którego słownik
 * nie może być zwykłą mapą napisów. Języki dzielą liczby na różną liczbę
 * kategorii i robią to inaczej:
 *
 *   polski, rosyjski, ukraiński   "one" / "few" / "many"
 *   angielski, niemiecki          "one" / "other"
 *
 * POLSKI RÓŻNI SIĘ OD ROSYJSKIEGO I UKRAIŃSKIEGO przy dwudziestu jeden,
 * trzydziestu jeden i tak dalej, i to jest jedyne miejsce, w którym się
 * różnią:
 *
 *   po polsku      "21 drużyn"     (dopełniacz, czyli "many")
 *   po rosyjsku    "21 команда"    (mianownik liczby pojedynczej, "one")
 *
 * Napisana raz reguła słowiańska dawała po polsku "21 drużyna". Złapał to
 * test porównujący tę funkcję z odmien() bota - bot mówi po polsku i mówi
 * poprawnie, więc rozjazd znaczyłby, że ta sama liczba jest odmieniona
 * inaczej na Discordzie i na stronie.
 */
export function pluralCategory(jezyk, liczba) {
  const n = Math.abs(Number(liczba) || 0);
  const kod = normalizeLanguage(jezyk);

  if (!["pl", "ru", "uk"].includes(kod)) {
    return n === 1 ? "one" : "other";
  }

  const dwieOstatnie = n % 100;
  const ostatnia = n % 10;

  // Po polsku pojedyncza jest WYŁĄCZNIE jedynka; po rosyjsku i ukraińsku
  // każda końcówka 1 poza jedenastką.
  const pojedyncza =
    kod === "pl" ? n === 1 : ostatnia === 1 && dwieOstatnie !== 11;

  if (pojedyncza) return "one";

  if (
    ostatnia >= 2 &&
    ostatnia <= 4 &&
    !(dwieOstatnie >= 12 && dwieOstatnie <= 14)
  ) {
    return "few";
  }

  return "many";
}
