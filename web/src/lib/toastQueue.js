// Kolejka powiadomień - czysta logika, bez Reacta i bez DOM-u.
//
// Powód, dla którego to w ogóle powstało: potwierdzenie zapisu typów
// renderowało się jako `ui-note` w STAŁYM miejscu strony, nad przyciskiem.
// Na meczu z pięcioma mapami albo na stronie fazy z kilkunastoma meczami
// przycisk "Zapisz" jest na dole, a komunikat pojawia się poza ekranem.
// Z perspektywy gracza klik nie robi nic.
//
// Sama kolejka siedzi tutaj, a nie w komponencie, bo to jedyna część, która
// ma reguły warte sprawdzenia: co się dzieje przy trzecim kliknięciu "Zapisz"
// i co przy dziesiątym. Reszta to układ CSS.

// Ile powiadomień naraz. Trzy to granica, powyżej której stos zasłania róg
// ekranu, a i tak nikt nie zdąży przeczytać starszych.
export const TOAST_LIMIT = 3;

// Jak długo wisi jedno powiadomienie. Cztery sekundy to tyle, ile zajmuje
// przeczytanie zdania i spojrzenie w bok - krócej gubi się przy przewijaniu.
export const TOAST_DURATION_MS = 4000;

// Identyfikatory z licznika, nie z losowania ani z daty: dwa powiadomienia
// pokazane w tej samej milisekundzie muszą dostać różne klucze, bo inaczej
// React przestaje je rozróżniać.
let lastId = 0;

// Klasa tonu wypisana dosłownie, a nie sklejana z `ui-toast--${tone}`: nazwa
// zbudowana w locie nie występuje w źródle jako tekst, więc przegląd martwego
// CSS-a kasuje regułę, a powiadomienie cicho traci kolor. Ta sama zasada co
// przy EVENT_STATE_BADGE w lib/eventState.js.
export const TOAST_TONE_CLASS = {
  ok: "ui-toast--ok",
  warn: "ui-toast--warn",
};

export function createToastId() {
  lastId += 1;

  return `toast-${lastId}`;
}

/**
 * Reduktor stosu powiadomień.
 *
 * Stan to tablica `{ id, text, tone }` - od najstarszego do najnowszego.
 */
export function toastReducer(state, action) {
  switch (action.type) {
    case "show": {
      const { toast } = action;

      // Powtórzenie tej samej treści NIE dokłada drugiego kafelka, tylko
      // odświeża ten, który już wisi. Inaczej trzykrotne kliknięcie "Zapisz"
      // budowało wieżę z trzech identycznych "Typy zapisane ✅".
      //
      // Odświeżenie polega na nadaniu nowego identyfikatora: stary licznik
      // czasu zgłosi się po swoje i nie znajdzie nic do schowania, a nowy
      // odmierzy pełne cztery sekundy od ostatniego kliknięcia.
      const withoutDuplicate = state.filter(
        (item) => item.text !== toast.text || item.tone !== toast.tone,
      );

      const next = [...withoutDuplicate, toast];

      // Przy przekroczeniu limitu wypada najstarsze, nie najnowsze - świeży
      // komunikat dotyczy tego, co gracz właśnie zrobił.
      return next.slice(-TOAST_LIMIT);
    }

    case "dismiss":
      return state.filter((item) => item.id !== action.id);

    case "clear":
      return [];

    default:
      return state;
  }
}
