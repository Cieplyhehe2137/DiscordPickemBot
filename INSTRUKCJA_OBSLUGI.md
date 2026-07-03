# Instrukcja obsługi strony webowej Pick'Em

Ta instrukcja opisuje panel webowy bota Pick'Em: stronę publiczną (dla osób typujących) oraz panel administracyjny (dla adminów serwerów Discord).

## Spis treści

1. [Dla typujących (użytkowników)](#1-dla-typujących-użytkowników)
2. [Dla administratorów](#2-dla-administratorów)

---

## 1. Dla typujących (użytkowników)

### 1.1 Logowanie

Wszystkie strony publiczne (`/public/...`) można przeglądać bez logowania. Żeby zapisać typ, trzeba się zalogować przyciskiem **„Zaloguj przez Discord"** w prawym górnym rogu — logowanie działa przez konto Discord, tym samym, którym typujesz na serwerze.

Po zalogowaniu w prawym górnym rogu pojawia się Twój awatar/nick — kliknięcie otwiera menu z linkami: **Mój Profil**, **Moje Typy**, **Ranking**, oraz **Wyloguj**.

### 1.2 Strona główna — `/public`

Lista wszystkich społeczności (serwerów Discord) korzystających z bota, wraz z:
- statystykami platformy (liczba społeczności, otwartych eventów),
- rankingiem TOP graczy,
- sekcją **Popularne wydarzenia** — aktualnie aktywne eventy ze wszystkich społeczności.

Każda karta społeczności ma przycisk **„Otwórz stronę"** (przechodzi do strony danej społeczności) i **„Dołącz do Discorda"** (jeśli społeczność udostępnia publiczny link).

### 1.3 Strona eventu — `/public/event/:slug`

To główna strona, na której typujesz mecze. Zawiera:

- **Nagłówek eventu** — nazwa, status, przycisk kopiowania linku publicznego, link do pełnego Pick'Em i do rankingu eventu.
- **Wyróżniony mecz** — najbliższy/aktualnie trwający mecz, z przyciskiem **„Typuj ten mecz"**.
- **Puls społeczności** — statystyki: liczba meczów na żywo, wszystkie typy, skuteczność społeczności, najbardziej zaufany typ i największa niespodzianka.
- **Lista meczów** — filtrowanie po statusie (Wszystkie/Otwarte/Na żywo/Zakończone/Zablokowane), przełącznik **„Moje typy"** (pokazuje tylko mecze, które już otypowałeś).

**Jak wpisać typ na mecz:**
1. Kliknij **„Wpisz typ"** przy meczu (lub „Typuj ten mecz" na wyróżnionym meczu).
2. **Krok 1 — Wynik serii**: wybierz jedną z opcji wyniku serii (np. „TeamA 2:1").
3. **Krok 2 — Wyniki map**: dla każdej mapy wchodzącej w skład wybranego wyniku wpisz dokładny wynik rundowy (np. 13:9). Liczba pól zależy od formatu (BO1 = 1 mapa, BO3 = do 3 map, BO5 = do 5 map).
4. Kliknij **„Zapisz typ"**.

Typ można edytować, dopóki mecz nie zostanie zablokowany (**Zablokowane**) lub zakończony (**Zakończony**) — wtedy przycisk zmienia się na „Typowanie zamknięte" i nie da się go już kliknąć.

### 1.4 Typowanie faz turnieju

Oprócz pojedynczych meczów, event może mieć osobne formularze do typowania całych faz turnieju. Linki do nich znajdziesz w nagłówku strony eventu lub bezpośrednio pod adresami:

- **Swiss** — `/public/event/:slug/pickem/stage1` (oraz `stage2`, `stage3`): wybierz 2 drużyny na wynik 3-0, 2 drużyny na wynik 0-3 i 6 drużyn awansujących. Typy dla każdego etapu Swiss zapisywane są osobno.
- **Playoffs** — `/public/event/:slug/playoffs`: wybierz 4 półfinalistów, spośród nich 2 finalistów, zwycięzcę (spośród finalistów) i zdobywcę 3. miejsca (spośród półfinalistów, ale nie może to być zwycięzca ani finalista).
- **Play-In** — `/public/event/:slug/playin`: wybierz dokładnie 8 drużyn awansujących z Play-In.
- **Double Elimination** — `/public/event/:slug/doubleelim`: wybierz po 2 drużyny dla każdej z 4 drabinek (Upper Final A/B, Lower Final A/B).

Każdy z tych formularzy pokazuje pasek postępu i blokuje zapis, dopóki nie wybierzesz kompletu wymaganych drużyn. Jeśli faza jest zamknięta (deadline minął), zobaczysz komunikat „Pick'Em zablokowane".

### 1.5 Ranking

- **Ranking globalny** — `/public/leaderboard`: wszyscy gracze ze wszystkich eventów, sortowanie po punktach / skuteczności / dokładnych trafieniach / liczbie typów.
- **Ranking eventu** — `/public/event/:slug/leaderboard`: wyniki tylko dla jednego eventu (punkty Swiss, meczowe, Playoffs, Play-In, Double Elim razem i osobno).

### 1.6 Mój profil i moje typy

- **Mój Profil** — `/public/users/:userId`: Twoje statystyki (pozycja, punkty, skuteczność, osiągnięcia), historia typów Swiss, ostatnie typy meczowe i oś czasu aktywności. Profil każdego gracza jest publiczny pod tym samym adresem (z jego ID).
- **Moje Typy** — `/public/me/predictions` (wymaga logowania): lista wszystkich Twoich zapisanych typów ze wszystkich eventów, z filtrami (Wszystkie/Otwarte/Zablokowane/Trafione/Dokładne) i sortowaniem.

### 1.7 Archiwum — `/public/archives`

Lista zakończonych i zarchiwizowanych turniejów z możliwością pobrania pełnego eksportu wyników w formacie Excel (**„Pobierz Excel"**).

---

## 2. Dla administratorów

Panel administracyjny znajduje się pod adresem **`/app`**. Dostęp mają wyłącznie osoby zalogowane przez Discord, które mają uprawnienie **Administrator** na danym serwerze Discord (to samo uprawnienie, które daje dostęp do komend admina na Discordzie — panel webowy nie wymaga żadnej dodatkowej konfiguracji).

Jeśli nie masz uprawnień administratora na żadnym serwerze korzystającym z bota, zobaczysz ekran „Brak uprawnień administratora".

### 2.1 Wybór serwera — `/app/guilds`

Lista wszystkich serwerów Discord, na których masz uprawnienia administratora. Kliknięcie karty przenosi do panelu danego serwera.

### 2.2 Panel serwera — `/app/guilds/:guildId`

Główny widok zarządzania jednym serwerem:

- **Zarządzaj drużynami** — przycisk przenoszący do listy drużyn (patrz 2.3).
- **Ustaw deadline'y** — otwiera modal do ustawiania terminów (patrz 2.6).
- **Statystyki serwera** — liczba eventów: wszystkich / aktywnych / zamkniętych / zarchiwizowanych.
- **Lista eventów** — z filtrowaniem po statusie, wyszukiwarką i sortowaniem. Każda karta eventu ma:
  - przycisk **„Utwórz event"** (u góry listy) — otwiera formularz z nazwą i automatycznie generowanym slugiem (adresem URL),
  - przycisk **„Otwórz panel eventu"** — przechodzi do szczegółowego zarządzania danym eventem (patrz 2.4),
  - przyciski **Otwórz / Zamknij / Archiwizuj** — zmiana statusu eventu,
  - przyciski do kopiowania/otwierania publicznego linku eventu.

### 2.3 Zarządzanie drużynami — `/app/guilds/:guildId/teams`

- **Dodaj drużynę** — pojedynczo, z nazwą i opcjonalną krótką nazwą.
- Każda drużyna na liście: strzałki ▲▼ do zmiany kolejności, przełącznik **Aktywuj/Dezaktywuj** (nieaktywne drużyny nie pojawiają się przy tworzeniu meczów ani w formularzach typowania faz), **Edytuj**, **Usuń** (zablokowane, jeśli drużyna występuje w istniejących meczach).
- **Importuj z JSON** — masowe wgranie całej listy drużyn naraz, w formacie tablicy JSON, np. `["FaZe","NAVI","G2","Vitality"]`.
  ⚠️ **Uwaga: to działanie w pełni zastępuje aktualną listę drużyn** (usuwa wszystkie istniejące i wstawia nowe) — dokładnie tak samo działa odpowiednik tej funkcji na Discordzie. Żeby potwierdzić, trzeba wpisać słowo `REPLACE`.

### 2.4 Panel eventu — `/app/events/:slug`

To centrum zarządzania pojedynczym turniejem. Sekcje od góry:

**Podstawowe informacje** — nazwa, status, faza, statystyki (uczestnicy/mecze/typy), przyciski zmiany statusu i „Wstecz".

**Panel administracyjny:**
- **Przelicz wyniki** — ręcznie przelicza punkty wszystkich graczy na podstawie aktualnych wyników meczów i faz. Używaj po każdej zmianie wyniku, jeśli punkty nie zaktualizowały się automatycznie.
- **Zmień fazę** — ustawia aktualną fazę turnieju (Nierozpoczęta / Play-In / Swiss / Playoffs / Zakończona).
- **Zamknij event** — zmienia status na zamknięty.
- **Eksportuj klasyfikację** — pobiera pełny eksport Excel (identyczny z tym dostępnym na Discordzie).

**Oficjalne wyniki fazy** — cztery osobne panele, jeden na fazę turnieju. Wpisane tu wyniki są źródłem prawdy do liczenia punktów graczy (użyj potem „Przelicz wyniki"):
- **Swiss** — osobno dla każdego etapu (zakładki Etap 1/2/3): drużyny z wynikiem 3-0 (max 2), 0-3 (max 2), awansujące (max 6).
- **Playoffs** — półfinaliści (max 4), finaliści (max 2), zwycięzca (1), 3. miejsce (1).
- **Double Elimination** — cztery sloty po 2 drużyny (Upper/Lower Final A/B).
- **Play-In** — dokładnie 8 awansujących drużyn (przycisk zapisu odblokowuje się dopiero po zaznaczeniu dokładnie 8).

**Strefa zagrożenia — Wyczyść fazę** — trwale usuwa wszystkie mecze, typy, wyniki i punkty dla jednej wybranej fazy (Play-In/Swiss/Playoffs) tego konkretnego eventu. Przed skasowaniem pokazywany jest podgląd liczby rekordów do usunięcia, a potwierdzenie wymaga wpisania nazwy fazy. **Ta operacja jest nieodwracalna.**

**Mecze:**
- **Utwórz mecz** — wybór fazy, drużyny A/B (tylko aktywne drużyny), formatu (BO1/BO3/BO5) i opcjonalnie czasu rozpoczęcia.
- Wyszukiwarka, sortowanie i filtry statusu dla listy meczów.
- Przy każdym meczu: **Otwórz/Ukryj** (szczegóły i statystyki typów), **Zablokuj/Odblokuj** (blokada uniemożliwia dalsze typowanie tego meczu), **Wpisz wynik** (wynik serii, np. 2:1 — automatycznie przelicza punkty), **Dokładne wyniki** (wynik rundowy 0-99 dla każdej rozegranej mapy — również przelicza punkty).
- Przyciski **Zablokuj widoczne / Odblokuj widoczne** — masowa blokada/odblokowanie wszystkich meczów pasujących do aktualnego filtra.

**Ranking** — podgląd aktualnej klasyfikacji eventu (ten sam ranking co na stronie publicznej).

**MVP:**
- **Dodaj / zastąp kandydatów** — wklej listę w formacie `nick | drużyna` (jeden wiersz na kandydata; drużyna opcjonalna) — zastępuje całą dotychczasową listę kandydatów.
- **Ustaw oficjalnego MVP** — wybór jednego z aktywnych kandydatów jako oficjalnego zwycięzcy głosowania MVP.

### 2.5 Dokładne wyniki (Exact Scores)

Osobna od „Wpisz wynik" funkcja — dotyczy dokładnego wyniku rundowego pojedynczej mapy (np. 13:9), a nie wyniku całej serii. Dla BO1 to jedna mapa, dla BO3/BO5 — do 3 lub 5 map. Można zapisać dowolny podzbiór map na raz (np. tylko rozegrane dotąd), reszta zostanie uzupełniona później.

### 2.6 Deadline'y — modal „Ustaw deadline'y" (z panelu serwera)

Dwa niezależne typy deadline'u, ustawiane osobno:
- **Deadline typowania** — termin, do którego gracze mogą zapisywać typy na daną fazę. Dla fazy Swiss trzeba dodatkowo wybrać etap (1/2/3).
- **Deadline wyników meczów** — termin zamknięcia typowania wyników meczów. Dla Swiss **nie jest** rozbijany na etapy (to zachowanie odziedziczone z Discorda, nie błąd panelu).

Deadline dotyczy aktualnie aktywnego panelu Discorda dla wybranej fazy — jeśli żaden taki panel nie został jeszcze wysłany na Discordzie, zapis zwróci błąd „Nie znaleziono aktywnego panelu". Czas podajesz w swojej lokalnej strefie, zapisywany jest w czasie Europe/Warsaw.

---

## Uwagi ogólne

- Wszystkie akcje w panelu administracyjnym wymagają uprawnienia **Administrator** na danym serwerze Discord — te same uprawnienia, co komendy admina bota na Discordzie.
- Panel webowy i bot na Discordzie współdzielą tę samą bazę danych — zmiana wprowadzona w jednym miejscu jest natychmiast widoczna w drugim.
- Operacje oznaczone jako nieodwracalne (czyszczenie fazy, import drużyn z zastąpieniem) zawsze wymagają dodatkowego potwierdzenia przez wpisanie konkretnego słowa/nazwy.
