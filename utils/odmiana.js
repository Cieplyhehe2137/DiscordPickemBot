// Odmiana rzeczowników przez liczebnik.
//
// Potrzebne, odkąd liczby drużyn biorą się z konfiguracji eventu, a nie są
// wpisane w treść komunikatu na sztywno: "2 drużyny", ale "6 drużyn"
// i "1 drużyna".
//
// Reguła polska: 1 -> pojedyncza, 2-4 -> mnoga, 5+ -> dopełniacz,
// z wyjątkiem nastek (12-14), które idą do dopełniacza.
//
// Front ma własną kopię w web/src/lib/odmiana.js - to osobny moduł ESM
// w bundlu przeglądarki, więc bez kroku budowania nie da się jej współdzielić.
// Obie muszą mieć tę samą regułę.

function odmien(liczba, pojedyncza, mnoga, dopelniacz) {
  const n = Math.abs(Number(liczba) || 0);

  if (n === 1) return pojedyncza;

  const dwieOstatnie = n % 100;
  const ostatnia = n % 10;

  if (
    ostatnia >= 2 &&
    ostatnia <= 4 &&
    !(dwieOstatnie >= 12 && dwieOstatnie <= 14)
  ) {
    return mnoga;
  }

  return dopelniacz;
}

// Biernik - wszystkie użycia są po czasowniku "wybierz":
// "wybierz 1 drużynę", "wybierz 2 drużyny", "wybierz 6 drużyn".
function druzyny(liczba) {
  return odmien(liczba, "drużynę", "drużyny", "drużyn");
}

module.exports = { odmien, druzyny };
