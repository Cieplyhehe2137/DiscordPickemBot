-- Naprawa flagi `active` w tabelach faz.
--
-- To NIE jest zmiana schematu, tylko naprawa danych - ale trafia tutaj z tego
-- samego powodu, dla którego istnieje ten folder: żeby zmiana zrobiona na
-- produkcji miała ślad w git, a nie tylko w historii poleceń na serwerze.
--
-- CO BYŁO NIE TAK
--
-- 1 705 wierszy w tabelach faz miało `active = 0`, mimo że żadna ścieżka
-- w kodzie nigdy tej wartości nie zapisuje. Bot wstawia jawne `active = 1`
-- i przy `ON DUPLICATE KEY UPDATE` również `1` (handlers/swiss/
-- submitSwissDropdown.js), a `calculateScores.js` wstawia wiersze punktów
-- bez tej kolumny, czyli z DEFAULT-em - który w tabelach punktów wynosi 1.
--
-- W czterech tabelach TYPÓW DEFAULT to natomiast 0. Wiersze z zerem weszły
-- więc do bazy z pominięciem INSERT-a bota: przy imporcie, który nie podał
-- tej kolumny. Ten sam import wyzerował wszystkie znaczniki czasu
-- (match_predictions.updated_at ma 16 różnych wartości na 10 328 wierszy,
-- wszystkie w 53 minutach 10.09.2026; matches.start_time_utc jest NULL
-- we wszystkich 156 wierszach).
--
-- CO TO PSUŁO
--
-- 1. IEM Cologne Major 2026 pokazywał `wynikOpublikowany: false` przy
--    WSZYSTKICH czterech fazach, choć poprawne odpowiedzi leżą w bazie.
--    server/routes/events.js pyta o wyniki faz z `AND active = 1`.
--
-- 2. handlers/matches/calculateScores.js czyta swiss_results i
--    playoffs_results z `AND active = 1`. Dla Cologne nie znajdował nic
--    i pomijał te fazy - przeliczenie punktów po prostu ich nie dotykało.
--    (Bez utraty danych: DELETE starych punktów stoi w gałęzi `else`.)
--
-- 3. server/routes/publicPickem.js czyta typy gracza z `AND active = 1`
--    w pięciu miejscach. Kto typował Cologne albo Kraków, widział na
--    stronie pusty panel zamiast własnych typów.
--
-- CZEGO TO NIE PSUŁO
--
-- Punktów i rankingu. Cztery zapytania w calculateScores.js czytające
-- tabele TYPÓW nie filtrują po `active`, a match_points w ogóle nie ma
-- tej kolumny.
--
-- UWAGA NA PÓŹNIEJ
--
-- Ta migracja nie zmienia ani jednego punktu, ale odblokowuje przeliczanie
-- faz dla Cologne. Sprawdzone przed wykonaniem: przeliczenie odtworzy Swiss
-- co do wiersza (583 z 583 zgodne), ale w playoffs obniży wynik 32 z 99
-- graczy o 2 punkty. Te 2 punkty pochodzą ze starszej wersji punktacji,
-- która przyznawała je za 3. miejsce także tym, którzy go nie wytypowali;
-- dzisiejszy kod ma już na to warunek i liczy poprawnie. Czołówka Cologne
-- się nie zmienia (pierwsze dwa miejsca bez ruchu), ale dalsze pozycje tak.
--
-- COFNIĘCIE
--
-- Lista identyfikatorów sprzed zmiany została zapisana przed wykonaniem.
-- Bez niej cofnięcie „wszystko z powrotem na 0" byłoby błędne, bo objęłoby
-- także wiersze dopisane później przez bota.

UPDATE swiss_results          SET active = 1 WHERE active = 0;
UPDATE playoffs_results       SET active = 1 WHERE active = 0;
UPDATE playin_results         SET active = 1 WHERE active = 0;
UPDATE doubleelim_results     SET active = 1 WHERE active = 0;

UPDATE swiss_predictions      SET active = 1 WHERE active = 0;
UPDATE playin_predictions     SET active = 1 WHERE active = 0;
UPDATE playoffs_predictions   SET active = 1 WHERE active = 0;
UPDATE doubleelim_predictions SET active = 1 WHERE active = 0;

UPDATE swiss_scores           SET active = 1 WHERE active = 0;
UPDATE playin_scores          SET active = 1 WHERE active = 0;
UPDATE playoffs_scores        SET active = 1 WHERE active = 0;
UPDATE doubleelim_scores      SET active = 1 WHERE active = 0;
