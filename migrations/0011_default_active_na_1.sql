-- Domyślna wartość kolumny `active` w tabelach faz: 0 -> 1.
--
-- Migracja 0010 naprawiła 1 705 wierszy, które miały `active = 0`. To jest
-- druga połowa tamtej roboty: usunięcie przyczyny, żeby nie trzeba było
-- naprawiać skutku po raz drugi.
--
-- DLACZEGO ZERO BYŁO ZŁE
--
-- Żadna ścieżka w kodzie nie zapisuje `active = 0` w tabelach typów. Wiersze
-- z zerem powstały przy imporcie, który tej kolumny nie podał - i dostały
-- DEFAULT. Dopóki DEFAULT wynosi 0, każdy kolejny import pomijający tę
-- kolumnę odtworzy dokładnie ten sam defekt: turniej zniknie z widoku faz,
-- gracze przestaną widzieć własne typy, a przeliczanie punktów po cichu
-- ominie fazy.
--
-- DLACZEGO ZMIANA JEST BEZPIECZNA
--
-- Sprawdzone przed wykonaniem: w całym repozytorium jest DWANAŚCIE miejsc
-- wstawiających wiersze do tych sześciu tabel i KAŻDE podaje `active`
-- jawnie - sześć w handlers/ (bot) i sześć w server/routes/ (strona).
-- Żadne nie polega na wartości domyślnej, więc jej zmiana nie może zmienić
-- zachowania istniejącego kodu. Dotyczy wyłącznie zapisów, które tę kolumnę
-- POMIJAJĄ - czyli dokładnie tego przypadku, który zawiódł.
--
-- Zmieniana jest sama wartość domyślna, bez dotykania typu i danych:
-- ALTER COLUMN ... SET DEFAULT to w MySQL operacja na samych metadanych,
-- więc nie przepisuje tabeli i nie rusza żadnego istniejącego wiersza.
--
-- ZAKRES
--
-- Sześć tabel, nie cztery. Oprócz czterech tabel TYPÓW zero mają także
-- playin_results i playoffs_results; swiss_results i doubleelim_results
-- miały poprawną jedynkę od początku, stąd asymetria na tej liście.
--
-- CZEGO TU NIE MA
--
-- Kolumny zostają NULL-owalne. NULL zachowuje się przy `WHERE active = 1`
-- tak samo jak zero, więc NOT NULL byłoby mocniejszą gwarancją - ale dziś
-- nie ma ani jednego NULL-a w żadnej z tych tabel, a zmiana nullowalności
-- przepisuje tabelę i może odrzucić zapis, którego nie przewidziałem.
-- To osobna decyzja, nie skutek uboczny tej.

ALTER TABLE swiss_predictions      ALTER COLUMN active SET DEFAULT 1;
ALTER TABLE playin_predictions     ALTER COLUMN active SET DEFAULT 1;
ALTER TABLE playoffs_predictions   ALTER COLUMN active SET DEFAULT 1;
ALTER TABLE doubleelim_predictions ALTER COLUMN active SET DEFAULT 1;

ALTER TABLE playin_results         ALTER COLUMN active SET DEFAULT 1;
ALTER TABLE playoffs_results       ALTER COLUMN active SET DEFAULT 1;
