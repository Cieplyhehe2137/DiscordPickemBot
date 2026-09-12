-- Numeracja meczów ciągła w obrębie eventu.
--
-- Do tej pory każda faza liczyła numery od nowa, więc w jednym turnieju
-- istniały trzy mecze "#1". Kod naprawiony w utils/matchNumbers.js; ta
-- migracja domyka dwie rzeczy po stronie bazy.
--
-- 1. PRZENUMEROWANIE ISTNIEJĄCYCH MECZÓW
--
-- Dwa przebiegi, bo klucz uniq_matches_scope zderzyłby się sam ze sobą
-- w połowie operacji: Double Elim #1 ma dostać #21, a #21 w tej fazie jest
-- w tym momencie jeszcze zajęte przez inny mecz. Pierwszy przebieg odsuwa
-- wszystkie numery poza zakres roboczy, drugi nadaje docelowe.
--
-- Kolejność nadawania to kolejność `id`, czyli kolejność tworzenia. Nie ma
-- tu stałej z kolejnością faz i nie trzeba jej wymyślać: sprawdzone na
-- danych, że każda faza zajmuje ciągły zakres id we właściwej kolejności
-- turniejowej.
--
-- ROW_NUMBER(), a nie sztuczka ze zmiennymi sesji: ta druga polega na
-- kolejności przypisań w obrębie jednej instrukcji, czego MySQL 8 nie
-- gwarantuje i odradza. Serwer to 8.0.46, więc funkcja okienkowa jest
-- dostępna i daje wynik deterministyczny.
--
-- 2. ZAWĘŻENIE KLUCZA UNIKALNEGO
--
-- Stary klucz (guild_id, event_id, phase, match_no) pozwalał na ten sam
-- numer w różnych fazach - czyli dokładnie na stan, który naprawiamy.
-- Nowy (guild_id, event_id, match_no) sprawia, że baza nie przyjmie
-- powtórzonego numeru w evencie, niezależnie od tego, co zrobi kod.

-- --- przebieg 1: odsunięcie numerów poza zakres roboczy ---
UPDATE matches SET match_no = match_no + 100000;

-- --- przebieg 2: numery 1..N w obrębie eventu, w kolejności tworzenia ---
UPDATE matches m
JOIN (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY guild_id, event_id ORDER BY id) AS numer
  FROM matches
) AS kolejnosc
  ON kolejnosc.id = m.id
SET m.match_no = kolejnosc.numer;

-- --- zawężenie klucza ---
ALTER TABLE matches DROP INDEX uniq_matches_scope;

ALTER TABLE matches
  ADD UNIQUE KEY uniq_matches_scope (guild_id, event_id, match_no);
