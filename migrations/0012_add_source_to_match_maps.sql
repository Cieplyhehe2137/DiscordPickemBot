-- Skąd wzięła się nazwa mapy: z ręki administratora czy od dostawcy danych.
--
-- DLACZEGO TO W OGÓLE POTRZEBNE
--
-- Tabela `match_maps` istnieje od początku i jest PUSTA - zero wierszy, nic
-- do niej nie pisze. Dopiero teraz zaczyna się wypełniać, z dwóch źródeł
-- naraz: administrator wpisuje mapy po veto, a skrypt dociąga je z
-- Liquipedii. Bez tej kolumny nie da się odróżnić jednego od drugiego, a to
-- jest potrzebne z dwóch niezależnych powodów.
--
-- POWÓD PIERWSZY: LICENCJA. Dane Liquipedii są na CC-BY-SA 3.0, co wymaga
-- wskazania źródła. Atrybucja ma się pokazywać przy danych, które STAMTĄD
-- przyszły, a nie przy wszystkim - inaczej przypisalibyśmy Liquipedii mapy,
-- które wpisał administrator.
--
-- POWÓD DRUGI: RĘKA WYGRYWA. Automat nie może nadpisywać tego, co człowiek
-- wpisał świadomie - ten sam wzorzec, co w `team_logos`, gdzie wpisy
-- `source = 'manual'` są chronione przed skryptem logotypów
-- (scripts/fetchTeamLogos.mjs). Veto bywa podawane przez komentatorów
-- wcześniej, niż trafia do jakiejkolwiek bazy, więc administrator często
-- będzie szybszy od dostawcy.
--
-- DOMYŚLNIE 'manual', BO TAK JEST BEZPIECZNIEJ. Gdyby kiedyś powstał wiersz
-- bez podanego źródła, ma być traktowany jak wpis ręczny: chroniony przed
-- nadpisaniem i bez cudzej atrybucji. Odwrotna domyślna wartość kazałaby
-- przypisywać Liquipedii dane, których nam nie dała.
--
-- Tabela jest pusta, więc ta migracja nie dotyka ani jednego wiersza.

ALTER TABLE `match_maps`
  ADD COLUMN `source` VARCHAR(32) NOT NULL DEFAULT 'manual'
    COMMENT 'manual | liquipedia'
    AFTER `picked_by`;

-- Skrypt dociągający mapy pyta "czego jeszcze nie mam", a nie "pokaż
-- wszystko" - przy pełnym turnieju to różnica między czytaniem kilkunastu
-- wierszy a czytaniem całej tabeli.
CREATE INDEX `idx_match_maps_source` ON `match_maps` (`source`);
