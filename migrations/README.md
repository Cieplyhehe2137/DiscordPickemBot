# Migracje

Do dziś zmiany schematu były robione ręcznie na produkcji, bez śladu w repo — jedyne źródło prawdy o strukturze bazy to była sama baza. `../schema.sql` to snapshot tego stanu (wygenerowany z `SHOW CREATE TABLE`, wszystkie 3 gildie dzielą jedną fizyczną bazę `s25345_pickemdb`).

Od teraz każda zmiana schematu produkcyjnego powinna:

1. Mieć plik w tym folderze: `NNNN_krotki_opis.sql` (numer kolejny, cztery cyfry, np. `0001_add_index_matches_guild_phase.sql`).
2. Zawierać sam `ALTER TABLE` / `CREATE TABLE` / itp. — bez transakcji wokół (MySQL i tak nie robi DDL transakcyjnie).
3. Być poprzedzona pełnym backupem (`handlers/admin/backupDatabase.js` już to robi) — **zawsze przed wykonaniem, nie po**.
4. Po wykonaniu na produkcji: zaktualizować `../schema.sql` (albo ręcznie, albo przez ponowne `SHOW CREATE TABLE`), żeby snapshot nie rozjechał się z rzeczywistością.

Nie ma tu (jeszcze) automatycznego runnera migracji — to jest tylko konwencja porządkująca, żeby zmiany schematu miały ślad w git zamiast istnieć wyłącznie w historii `ALTER TABLE` na serwerze.
