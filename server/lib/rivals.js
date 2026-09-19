// Rywale gracza w obrębie turnieju.
//
// Pojedynek dwóch graczy (server/lib/headToHead.js) istniał od dawna i jest
// policzony dobrze - ale wchodziło się w niego z JEDNEGO miejsca w całym
// serwisie i trzeba było WIEDZIEĆ, czyj profil otworzyć. Zmierzone: par
// graczy z choć jednym wspólnym meczem jest 84 542, a z co najmniej
// trzydziestoma - 19 421. Narzędzie było, materiału pod dostatkiem, a
// pytanie „z kim właściwie się ścigam" nie miało gdzie paść.
//
// Ten moduł na nie odpowiada: bierze wszystkie rozstrzygnięte mecze turnieju
// i mówi, kto obstawiał to samo co ten gracz i jak mu przy nim szło.
//
// CZYSTY I BEZ IMPORTÓW, tak jak buildUpsets i buildMapReading - dzięki temu
// reguła wyboru rywali daje się sprawdzić testem bez bazy.

/**
 * Ile rozstrzygniętych między sobą meczów musi być, żeby bilans coś znaczył.
 *
 * Próg leży na meczach ROZSTRZYGNIĘTYCH MIĘDZY NIMI, a nie na wspólnych - i to
 * jest tu cała rzecz. Zmierzone na produkcji: remisy stanowią 48% wspólnych
 * meczów, bo za 60% typów nie ma żadnych punktów, a dwa zera to remis. Próg
 * postawiony na „wspólnych >= 30" przepuszczałby więc bilanse liczone
 * z piętnastu meczów i pokazywał „70%" tam, gdzie jest 7-3.
 */
const MIN_ROZSTRZYGNIETYCH = 10;

/** Ilu rywali pokazać, zanim dojdą ci wyróżnieni odznaką. */
const ILU_POKAZAC = 5;

/**
 * Ilu rywali musi być, żeby odznaki skrajności miały sens.
 *
 * Przy dwóch rywalach „największa przewaga" i „największa strata" to po
 * prostu pierwszy i drugi, a „najrówniejszy" jest jednym z nich. Etykieta,
 * która przy takiej liczbie nie niesie informacji, wygląda na pomyłkę.
 */
const MIN_RYWALI_NA_ODZNAKI = 3;

function liczba(wartosc, zapasowa = 0) {
  const n = Number(wartosc);

  return Number.isFinite(n) ? n : zapasowa;
}

/**
 * Porównanie z rozstrzygnięciem remisów aż do identyfikatora.
 *
 * Kolejność musi być powtarzalna: bez ostatniego kroku dwóch rywali
 * z identycznym bilansem zamieniałoby się miejscami zależnie od tego,
 * w jakiej kolejności baza zwróciła wiersze - a odznaka „największa
 * przewaga" wędrowałaby przy każdym odświeżeniu.
 */
function porownaj(...kroki) {
  return (a, b) => {
    for (const krok of kroki) {
      const wynik = krok(a, b);

      if (wynik !== 0) return wynik;
    }

    return String(a.user_id) < String(b.user_id) ? -1 : 1;
  };
}

const wgRozstrzygnietych = (a, b) => b.decided - a.decided;

/**
 * Bilans gracza przeciwko każdemu, kto obstawiał te same mecze.
 *
 * @param rows     wiersze (user_id, match_id, points) - JEDEN na parę
 *                 gracz-mecz, wyłącznie mecze rozstrzygnięte. Punkty muszą
 *                 być już zsumowane na mecz: match_points trzyma osobno
 *                 punkty za serię i za mapy, więc surowe wiersze liczyłyby
 *                 każdy mecz dwa razy.
 * @param userId   gracz, dla którego liczymy
 * @param profiles nazwy i awatary: [{ user_id, displayname, avatar }]
 */
export function buildRivals(
  rows,
  userId,
  {
    profiles = [],
    minDecided = MIN_ROZSTRZYGNIETYCH,
    limit = ILU_POKAZAC,
  } = {},
) {
  const ja = String(userId);

  // Mecze tego gracza. Mapa, a nie lista, bo dla każdego wiersza wszystkich
  // pozostałych graczy trzeba odpowiedzieć na pytanie „czy on to obstawiał".
  const moje = new Map();

  for (const row of rows || []) {
    if (String(row?.user_id) === ja) {
      moje.set(String(row.match_id), liczba(row.points));
    }
  }

  const bilanse = new Map();

  for (const row of rows || []) {
    const kto = String(row?.user_id);

    if (kto === ja) continue;

    const mecz = String(row?.match_id);

    if (!moje.has(mecz)) continue;

    const mojePunkty = moje.get(mecz);
    const jegoPunkty = liczba(row.points);

    let bilans = bilanse.get(kto);

    if (!bilans) {
      bilans = {
        user_id: kto,
        shared: 0,
        wins: 0,
        losses: 0,
        ties: 0,
        my_points: 0,
        their_points: 0,
      };

      bilanse.set(kto, bilans);
    }

    bilans.shared += 1;
    bilans.my_points += mojePunkty;
    bilans.their_points += jegoPunkty;

    if (mojePunkty > jegoPunkty) bilans.wins += 1;
    else if (jegoPunkty > mojePunkty) bilans.losses += 1;
    else bilans.ties += 1;
  }

  const wszyscy = [...bilanse.values()].map((b) => {
    const decided = b.wins + b.losses;

    return {
      ...b,

      decided,

      // Procent liczony z meczów ROZSTRZYGNIĘTYCH, nie ze wspólnych.
      // Inaczej remis - a tych jest połowa - wyglądałby jak porażka.
      win_percent: decided > 0 ? Math.round((100 * b.wins) / decided) : 0,

      badges: [],
    };
  });

  const rywale = wszyscy.filter((r) => r.decided >= minDecided);

  // Nazwy dopiero teraz, gdy wiadomo, o kogo chodzi. Złączenie ich w bazie
  // zwróciłoby tę samą nazwę tyle razy, ile ktoś oddał typów.
  const nazwy = new Map();

  for (const p of profiles || []) {
    const kto = String(p?.user_id ?? "");

    // PIERWSZY wpis o graczu wygrywa - stad `has` przed `set`. Trasa
    // podaje najpierw profile, potem nazwy z tabel faz: profil niesie
    // awatar i jest odswiezany przy kazdym logowaniu, a zapis z fazy
    // pamieta nick z dnia typowania.
    if (kto && !nazwy.has(kto)) nazwy.set(kto, p);
  }

  for (const r of rywale) {
    const profil = nazwy.get(r.user_id);

    // Sam identyfikator zostaje jako nazwa ostatniej szansy. Po połączeniu
    // user_profiles z tabelami faz bez nazwy zostają 32 osoby z 638 - i
    // lepiej pokazać liczbę niż puste miejsce w wierszu.
    r.displayname = profil?.displayname || r.user_id;
    r.avatar = profil?.avatar ?? null;
  }

  przypnijOdznaki(rywale);

  // Lista to najczęstsi rywale PLUS ci z odznaką. Bez drugiej części
  // „największa przewaga" trafiałaby czasem poza pokazywaną piątkę
  // i odznaka nie byłaby widoczna nigdzie.
  const wgLiczby = [...rywale].sort(
    porownaj(wgRozstrzygnietych, (a, b) => b.shared - a.shared),
  );

  const pokazani = new Set(wgLiczby.slice(0, limit).map((r) => r.user_id));

  for (const r of rywale) {
    if (r.badges.length > 0) pokazani.add(r.user_id);
  }

  return {
    // Ilu w ogóle spełnia próg - lista bywa krótsza, bo pokazujemy czołówkę.
    total: rywale.length,

    // Ilu graczy ma z nim CHOĆ JEDEN wspólny mecz. Gdy lista jest pusta,
    // to ta liczba mówi dlaczego: czy nie ma z kim, czy za mało razem.
    opponents: wszyscy.length,

    min_decided: minDecided,

    rivals: wgLiczby.filter((r) => pokazani.has(r.user_id)),
  };
}

/**
 * Odznaki skrajności.
 *
 * Nie osobne kafelki na gracza, tylko etykiety doklejone do wierszy jednej
 * listy: ten sam człowiek bywa jednocześnie najczęstszym i najrówniejszym
 * rywalem, a dwa kafelki z tą samą twarzą wyglądają jak błąd.
 */
function przypnijOdznaki(rywale) {
  if (rywale.length < MIN_RYWALI_NA_ODZNAKI) return;

  const najwiecejWspolnych = [...rywale].sort(
    porownaj((a, b) => b.shared - a.shared, wgRozstrzygnietych),
  )[0];

  najwiecejWspolnych.badges.push("most");

  const najrowniejszy = [...rywale].sort(
    porownaj(
      (a, b) => Math.abs(a.win_percent - 50) - Math.abs(b.win_percent - 50),
      wgRozstrzygnietych,
    ),
  )[0];

  najrowniejszy.badges.push("closest");

  // PRZEWAGA LICZONA W MECZACH, NIE W PROCENTACH.
  //
  // Na produkcji procent daje tu zły wynik: „największa przewaga" trafiała
  // do bilansu 8-2 (80% z dziesięciu rozstrzygnięć, czyli z samego progu),
  // a nie do 46-27 - a to drugie jest przewagą, o której da się cokolwiek
  // powiedzieć. Przy skrajnościach najwyższy procent zawsze wygrywa
  // najmniejsza próba, bo w dziesięciu meczach łatwiej o 80% niż
  // w siedemdziesięciu.
  //
  // Różnica wygranych i przegranych sama pilnuje próby: na +19 nie da się
  // wyjść w dziesięciu meczach. Do tego „przewaga" tyle właśnie znaczy -
  // o ile więcej meczów, a nie o ile wyższy udział.
  //
  // Dlaczego „najrówniejszy" wyżej ZOSTAJE przy procencie: bo to nie jest
  // teza o niczyjej wyższości, tylko jej brak. Twierdzenie „ogrywasz go"
  // wymaga dowodu, twierdzenie „idzie wam po równo" jest stanem wyjściowym
  // i mała próba niczego w nim nie zawyża.
  const przewaga = (r) => r.wins - r.losses;

  const wgPrzewagi = [...rywale].sort(
    porownaj((a, b) => przewaga(b) - przewaga(a), wgRozstrzygnietych),
  );

  const najlepszy = wgPrzewagi[0];
  const najgorszy = wgPrzewagi[wgPrzewagi.length - 1];

  // Gdy wszyscy mają tę samą przewagę, „najlepszy" i „najgorszy" to ta sama
  // osoba, a etykiety kłamałyby obie. Wtedy nie ma skrajności do pokazania.
  if (przewaga(najlepszy) === przewaga(najgorszy)) return;

  najlepszy.badges.push("best");
  najgorszy.badges.push("worst");
}
