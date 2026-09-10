// Walidacje i sanityzacja - czysta logika, bez bazy i bez Expressa.
//
// Wyciagniete z app.js przy jego rozbijaniu. Nie chodzilo o same linie:
// dopoki te funkcje siedzialy w srodku 12-tysiecznego pliku obok tras, nie
// dalo sie ich przetestowac inaczej niz przez uruchomienie calego serwera.
// Tutaj sa zwyklymi funkcjami i maja testy w test/walidacjaSerwera.test.js.
//
// Modul celowo nie ma zadnych zaleznosci - dzieki temu testy w katalogu
// glownym uruchamiaja sie bez instalowania server/node_modules.

// Ekranowanie do zapytan skladanych z tekstu. Uzywane tylko tam, gdzie
// parametryzacja nie wchodzi w gre (nazwy tabel w mysqldump).
export function sqlEscape(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");
}

// Nazwa pliku bezpieczna do zapisu na dysku i do naglowka Content-Disposition.
export function safeFileBase(value, fallback = "pickem_export") {
  const safe = String(value || fallback)
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_");

  return safe || fallback;
}

// Nazwy backupow przychodza z zewnatrz (pobieranie, odtwarzanie), wiec musza
// pasowac do wzorca, ktory sam generator produkuje - inaczej sciezka moglaby
// wyjsc poza katalog backupow.
export function assertSafeBackupFileName(fileName) {
  const name = String(fileName || "");

  if (!/^backup_[a-zA-Z0-9_-]+_\d{4}-\d{2}-\d{2}T[\d-]+Z\.sql$/.test(name)) {
    throw new Error("Invalid backup file name");
  }

  return name;
}

// Czy wynik mapy jest mozliwy w CS2.
//
// Regulaminowo: do 13 wygranych rund z przewaga, a przy 12:12 wchodzi
// dogrywka po 6 rund - stad kolejne mozliwe wyniki zwyciezcy 16, 19, 22...
// (16 + wielokrotnosc 3), gdzie przegrany ma od winner-4 do winner-2.
export function validateCs2Score(scoreA, scoreB) {
  const a = Number(scoreA);
  const b = Number(scoreB);

  if (!Number.isInteger(a) || !Number.isInteger(b)) {
    return false;
  }

  if (a < 0 || b < 0) {
    return false;
  }

  if (a === b) {
    return false;
  }

  const winner = Math.max(a, b);
  const loser = Math.min(a, b);

  if (winner === 13) {
    return loser >= 0 && loser <= 11;
  }

  if (winner >= 16 && (winner - 16) % 3 === 0) {
    return loser >= winner - 4 && loser <= winner - 2;
  }

  return false;
}

// Czy zestaw map da sie ulozyc jako prawdziwa seria BO.
//
// Pilnuje dwoch rzeczy naraz: seria musi sie skonczyc rozstrzygnieciem, i nie
// moze zawierac map rozegranych JUZ PO tym, jak ktos osiagnal wymagana liczbe
// wygranych. Bez tego dalo sie wytypowac 2:0 i dorzucic trzecia mape.
export function validateSeriesMapOrder(mapPicks, bestOf) {
  const winsNeeded = Math.ceil(bestOf / 2);

  let winsA = 0;
  let winsB = 0;

  for (let index = 0; index < mapPicks.length; index += 1) {
    const map = mapPicks[index];

    const scoreA = Number(map.pred_exact_a);
    const scoreB = Number(map.pred_exact_b);

    if (scoreA > scoreB) {
      winsA += 1;
    } else if (scoreB > scoreA) {
      winsB += 1;
    } else {
      return false;
    }

    const seriesFinished = winsA === winsNeeded || winsB === winsNeeded;

    if (seriesFinished && index !== mapPicks.length - 1) {
      return false;
    }
  }

  return winsA === winsNeeded || winsB === winsNeeded;
}
