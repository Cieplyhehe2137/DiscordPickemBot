-- Licznik odwiedzin strony.
--
-- Jedna tabela, bez osobnego licznika zbiorczego. Suma to zwykłe COUNT(*),
-- a dzisiejsza liczba to COUNT(*) po jednym dniu - przy tej skali MySQL liczy
-- to natychmiast, a nie ma dwóch miejsc, które mogłyby się rozjechać.
--
-- Czego tu NIE ma i nie będzie: adresu IP, User-Agenta, identyfikatora
-- użytkownika ani ścieżki odwiedzonej strony. Do bazy trafia wyłącznie
-- nieodwracalny skrót z solą zmienianą co dobę (server/lib/visitorHash.js),
-- więc nawet mając dostęp do tej tabeli nie da się odtworzyć, kto i skąd
-- wchodził, ani powiązać tej samej osoby między dniami.
--
-- Klucz złożony (day, visitor_hash) robi całą robotę odróżniania: powtórne
-- wejście tego samego dnia wpada w INSERT IGNORE i nie zwiększa licznika.

CREATE TABLE IF NOT EXISTS site_visits (
  day DATE NOT NULL,
  visitor_hash BINARY(16) NOT NULL,
  first_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (day, visitor_hash),

  -- Osobny indeks po dacie: zapytanie o "dziś" i o zakres dni idzie po nim
  -- bez dotykania skrótów. Klucz główny zaczyna się od day, więc dla samego
  -- filtrowania po dacie wystarczyłby on - ten indeks jest węższy, bo nie
  -- niesie 16 bajtów skrótu, i to on zostanie użyty do COUNT(*).
  KEY idx_site_visits_day (day)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
