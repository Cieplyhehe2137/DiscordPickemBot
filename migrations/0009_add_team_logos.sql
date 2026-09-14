-- Logotypy drużyn, wiązane po NAZWIE.
--
-- Dlaczego osobna tabela, a nie kolumna w `teams`: typy faz i mecze nie
-- odwołują się do `teams` w ogóle. Trzymają nazwy drużyn jako zwykły tekst
-- ("B8, BetBoom"), a sama tabela `teams` ma dziś 18 wierszy, z czego 17 to
-- pozostałości po testach ("TEST", "QWER", "REYRETYERYE"). Realnie występuje
-- w bazie 48 różnych nazw drużyn i żadna poza jedną nie ma tam swojego
-- wiersza. Dopinanie logotypów do tabeli, której nikt nie używa jako źródła
-- drużyn, nie dałoby się z niczym połączyć.
--
-- Klucz to nazwa taka, jaka pada w typach - łącznie z jej zapisem. Ta sama
-- drużyna bywa zapisana na kilka sposobów ("PARIVISION" i "Parivision",
-- "The MongolZ" i "The Mongolz", "FaZe" i "FaZe Clan"), a widok szuka
-- dokładnie tego, co ma w danych. Stąd też `canonical_name`: żeby było
-- widać, że kilka wierszy wskazuje na tę samą drużynę.
--
-- name_key to nazwa sprowadzona do porównywalnej postaci (małe litery, bez
-- znaków poza literami i cyframi) i to na niej stoi klucz unikalny - inaczej
-- "FaZe" i "faze" byłyby dwoma wierszami o tym samym znaczeniu.

CREATE TABLE IF NOT EXISTS team_logos (
  id INT NOT NULL AUTO_INCREMENT,

  -- Nazwa dokładnie tak, jak występuje w typach i meczach.
  name VARCHAR(100) NOT NULL,

  -- Ta sama nazwa znormalizowana - po niej odbywa się wyszukiwanie.
  name_key VARCHAR(100) NOT NULL,

  -- Nazwa u dostawcy, dla orientacji przy przeglądaniu tabeli.
  canonical_name VARCHAR(100) DEFAULT NULL,

  logo_url TEXT DEFAULT NULL,

  -- Skąd pochodzi wpis: "pandascore" albo "manual" dla uzupełnień ręcznych.
  source VARCHAR(32) NOT NULL DEFAULT 'pandascore',

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uniq_team_logos_name_key (name_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
