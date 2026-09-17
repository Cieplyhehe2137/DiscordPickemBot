// Stan turnieju widziany przez odwiedzającego.
//
// Baza opisuje go czterema polami naraz - `status`, `is_open`, `is_active`,
// `is_archived` - a API dokłada wyliczone `is_live`. Widok potrzebuje z tego
// jednej z trzech odpowiedzi, więc zamiana mieszka tutaj, a nie w każdym
// komponencie osobno.
//
// Powód jest konkretny: strona główna miała własną regułę z trzema stanami
// ("Trwa" / "Zakończony" / "Zaplanowany"), a lista eventów własną z dwoma -
// wszystko, co nie jest live, było "Zakończone". Skutek: turniej utworzony
// przez /start_pickem, a jeszcze bez opublikowanego panelu, lądował na liście
// pod nagłówkiem "Archiwum — Zakończone", zanim się w ogóle zaczął.
//
// Kolejność sprawdzeń ma znaczenie. `is_archived` idzie PRZED `status`, bo
// zarchiwizowany turniej zachowuje swój historyczny status i potrafi nadal
// mieć "UPCOMING" - a archiwum jest ostateczne.

export function eventState(event) {
  if (event?.is_live) return "live";
  if (event?.is_archived) return "finished";

  return String(event?.status ?? "").toUpperCase() === "UPCOMING"
    ? "upcoming"
    : "finished";
}

// Klucze słownika i tony wypisane dosłownie, a nie sklejane ze stanu: nazwa
// klasy zbudowana przez `ui-badge--${stan}` nie występuje w źródle jako tekst,
// więc przegląd martwego CSS-a kasuje regułę, a plakietka cicho traci kolor.
// Z kluczem jest tak samo: `eventState.${stan}` byłby niewidoczny dla
// wyszukiwania i dla testu porównującego zestawy kluczy.
export const EVENT_STATE_KEY = {
  live: "eventState.live",
  upcoming: "eventState.upcoming",
  finished: "eventState.finished",
};

export const EVENT_STATE_BADGE = {
  live: "ui-badge ui-badge--live",
  upcoming: "ui-badge ui-badge--accent",
  finished: "ui-badge",
};

// Klucz nagłówka sekcji turniejów na stronie głównej.
//
// Brzmiał "Gdzie się teraz typuje" zawsze - także wtedy, gdy wszystkie trzy
// turnieje pod nim miały plakietkę ZAKOŃCZONY. Dla kogoś, kto wchodzi
// pierwszy raz z podesłanego linku, nagłówek kłócący się z treścią pod nim
// czyta się jak strona, o której zapomniano.
//
// Lista eventów jest posortowana, ale nie ma gwarancji, że pierwszy jest
// najważniejszy - stąd decyzja po najwyższym stanie, jaki w niej występuje:
// trwający bije nadchodzący, nadchodzący bije zakończony.
export function eventsHeadingKey(events = []) {
  const stany = new Set(events.map((e) => eventState(e)));

  if (stany.has("live")) return "home.heading.live";
  if (stany.has("upcoming")) return "home.heading.upcoming";

  return "home.heading.recent";
}
