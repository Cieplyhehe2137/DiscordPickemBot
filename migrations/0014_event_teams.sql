-- 0014_event_teams.sql
--
-- ROSTER TURNIEJU, a nie rostera serwera.
--
-- CO JEST DZIS. Tabela `teams` to jedna lista na serwer Discorda, a kolumna
-- `active` pelni w niej role, do ktorej nie byla zrobiona: "bierze udzial
-- w BIEZACYM turnieju". Przed turniejem administrator wlacza dwadziescia
-- kilka druzyn, po turnieju je wylacza. Stan z produkcji: jeden serwer ma
-- 16 aktywnych i 13 NIEAKTYWNYCH druzyn, a wszystkie 300 zapisanych typow
-- playoffs zawiera co najmniej jedna z tych wylaczonych.
--
-- CO Z TEGO WYNIKA - trzy rzeczy, nie jedna:
--
--   1. Nie da sie przygotowac nastepnego turnieju bez zmiany biezacego.
--   2. Dwa turnieje naraz na jednym serwerze sa niemozliwe.
--   3. Wylaczenie druzyny W TRAKCIE turnieju psuje ponowny zapis typu, ktory
--      ja zawiera: lista w formularzu dokleja ja z zapisanego typu (zeby
--      gracz nie ogladal wlasnego typu jako pustego), ale walidacja zapisu
--      pyta o `active = 1` i odrzuca caly typ bledem 400.
--
-- CZEGO TA ZMIANA NIE PSUJE. Nic nie jest "przypisane" do wiersza w `teams`:
-- server/routes/teams.js nie ma ani jednego `FROM teams`, a cala strona
-- Druzyny - statystyki, zaufanie, win rate, historia, typy fazowe - liczy sie
-- z `matches`, `match_results`, `match_predictions` i `swiss_*`, po NAZWIE.
-- Wiersz w `teams` trzyma tylko nazwe, skrot, logo, `active` i `sort_order`;
-- sluzy do WYBIERANIA, nie do liczenia. Ukrycie druzyny nie kosztuje wiec
-- niczego historycznie.
--
-- JAK TO WCHODZI BEZ WIELKIEGO WYBUCHU. utils/loadEventTeams.js czyta te
-- tabele, a gdy turniej nie ma tu ani jednego wiersza - siega po dzisiejszy
-- roster `active = 1`. Czyli kazdy istniejacy turniej dziala dokladnie jak
-- przed migracja, a nowy dostaje wlasna liste wtedy, gdy ktos ja wskaze.
-- Ten sam wzorzec ma `event_pickem_phases`: brak zapisanej konfiguracji
-- znaczy wartosci domyslne.
--
-- Kod znosi takze BRAK tej tabeli (ER_NO_SUCH_TABLE schodzi na ten sam
-- zapas), wiec kolejnosc wdrozenia jest dowolna: migracja moze pojsc przed
-- kodem albo po nim.
--
-- POWIAZANIE PO `team_id`, NIE PO NAZWIE. Historia i tak idzie po nazwie
-- z meczow, a tu chodzi o wskazanie wiersza slownika - przez id zmiana nazwy
-- druzyny nie zrywa rostera turnieju.
--
-- `sort_order` JEST TU DRUGI RAZ CELOWO. W `teams` jest jedna kolejnosc na
-- caly serwer, a rozstawienie jest wlasnoscia TURNIEJU - inne na majorze,
-- inne na lidze. Przy okazji rozwiazuje to pytanie, ktore zostalo otwarte po
-- sprzataniu dropdownow: Playoffs sortuje po sort_order, a Double Elim
-- alfabetycznie, i nie bylo wiadomo, ktora kolejnosc jest sluszna.
--
-- ON DELETE CASCADE zgodnie z kluczami z migracji 0005 i 0006. Zadna sciezka
-- w kodzie nie kasuje eventow ani druzyn (archiwizacja to flaga
-- is_archived), wiec CASCADE dziala dopiero przy recznym czyszczeniu bazy.
--
-- Ta migracja TWORZY pusta tabele i nie dotyka ani jednego istniejacego
-- wiersza.

CREATE TABLE `event_teams` (
  `event_id` INT NOT NULL,
  `team_id` INT NOT NULL,

  -- Rozstawienie w TYM turnieju. Zero znaczy "bez rozstawienia" i wtedy
  -- decyduje nazwa - tak samo jak dzis w `teams`.
  `sort_order` INT NOT NULL DEFAULT 0,

  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Jedna druzyna raz na turniej. Klucz glowny zamiast osobnego id, bo ta
  -- tabela nie ma wlasnej tozsamosci - jest wylacznie powiazaniem.
  PRIMARY KEY (`event_id`, `team_id`),

  -- Lista druzyn turnieju czyta sie zawsze w calosci i w kolejnosci
  -- rozstawienia, wiec indeks obejmuje oba pola.
  KEY `idx_event_teams_sort` (`event_id`, `sort_order`),

  -- Druga strona relacji: "w ktorych turniejach gra ta druzyna".
  KEY `idx_event_teams_team` (`team_id`),

  CONSTRAINT `fk_event_teams_event`
    FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE,

  CONSTRAINT `fk_event_teams_team`
    FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON DELETE CASCADE
)
-- Kolacja nie ma tu dzis znaczenia, bo tabela nie ma ANI JEDNEJ kolumny
-- tekstowej - oba klucze obce sa na INT. Wpisana jest jawnie i taka sama jak
-- w `teams`, zeby ewentualna przyszla kolumna tekstowa nie wpadla w rozjazd:
-- `events` ma utf8mb4_0900_ai_ci, a `teams` utf8mb4_unicode_ci, i wlasnie
-- z tego mieszania biora sie rzutowania COLLATE rozsiane po zapytaniach
-- rankingu i profilu.
ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
