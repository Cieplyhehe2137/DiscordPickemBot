-- `match_maps.picked_by` może być NIEZNANE.
--
-- CO SIĘ OKAZAŁO
--
-- Kolumna była dotąd wypełniana WYLICZENIEM z formatu serii: mapa 1 to pick
-- drużyny A, mapa 2 drużyny B, ostatnia decider. Tak samo liczy to etykieta
-- na stronie ("Pick NAVI", "Decider"), bo nie było z czego wziąć prawdy.
--
-- Prawda jest inna. Porównane na produkcji z prawdziwym przebiegiem veto dla
-- 37 meczów ESL Pro League Season 24, 113 map:
--
--   zgodne z wyliczeniem :  65
--   NIEZGODNE            :  48
--   trafność             :  58%
--
-- Decidery zgadzają się zawsze - ostatnia mapa jest deciderem niezależnie od
-- wszystkiego. Cała pomyłka siedzi w pickach: o tym, kto wybiera pierwszy,
-- decyduje procedura veto, a nie to, którą drużynę wpisano jako pierwszą.
--
--   #1 Falcons vs TYLOO  mapa 1 Mirage: wyliczenie mówi Falcons, pickował TYLOO
--   #3 Vitality vs 1win  mapa 1 Dust2:  wyliczenie mówi Vitality, pickował 1win
--
-- DLACZEGO NULL, A NIE DALSZE WYLICZANIE
--
-- Wyliczenie jest przybliżeniem do pokazania na ekranie, a nie faktem do
-- zapisania. Kolumna w bazie ma trzymać to, co wiemy - a gdy nie wiemy, ma
-- mówić "nie wiem", zamiast podawać zgadywanie z miną pewniaka. To ta sama
-- zasada, co przy godzinie startu bez strefy (server/lib/startTime.js):
--   "NIE ZGADUJE strefy - to jest decyzja, nie przeoczenie".
--
-- Nic nie jest tracone: wyliczenie da się odtworzyć w każdej chwili
-- z map_no i best_of, i front dalej je pokazuje tam, gdzie prawdy nie ma.

ALTER TABLE `match_maps`
  MODIFY COLUMN `picked_by` ENUM('TEAM_A','TEAM_B','DECIDER') NULL DEFAULT NULL
    COMMENT 'Kto wybral mape. NULL = nie wiemy (wpis reczny).';

-- Wiersze wpisane ręcznie niosą właśnie takie wyliczenie, nie wiedzę -
-- administrator podaje w panelu NAZWY map, nie przebieg veto. Czyścimy je,
-- żeby w tabeli nie zostało ani jedno zgadywanie udające fakt.
--
-- Wierszy od dostawcy to NIE dotyczy: tam `picked_by` pochodzi z prawdziwego
-- veto i jest jedynym powodem, dla którego ta kolumna w ogóle ma wartość.
UPDATE `match_maps`
   SET `picked_by` = NULL
 WHERE `source` = 'manual';
