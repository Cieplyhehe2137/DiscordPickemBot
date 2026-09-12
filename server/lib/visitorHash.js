import crypto from "node:crypto";

// Rozpoznawanie powracającego odwiedzającego BEZ zapisywania czegokolwiek,
// co go identyfikuje.
//
// Żeby policzyć unikalne wejścia, trzeba odróżnić dwie osoby od jednej, która
// odświeżyła stronę. Adres IP to dane osobowe w rozumieniu RODO, więc nie
// trafia do bazy ani do logów - do tabeli idzie wyłącznie skrót.
//
// Sól zmienia się co dobę i siedzi w zmiennej środowiskowej, nie w bazie.
// To dwie osobne własności:
//
//   - sól poza bazą znaczy, że sam dostęp do MySQL-a nie wystarczy, żeby
//     przemielić cztery miliardy adresów IPv4 i dopasować skrót do adresu;
//   - sól zmieniana co dobę znaczy, że skróty tej samej osoby z dwóch dni
//     są nie do powiązania, więc z tabeli nie da się odtworzyć historii
//     odwiedzin konkretnego człowieka.
//
// Konsekwencja drugiej własności jest taka, że "łącznie" NIE znaczy "tylu
// różnych ludzi" - ta sama osoba wchodząca w poniedziałek i wtorek to dwa
// wpisy. To jest metryka odwiedzin (wizyt), nie osób, i tak musi być
// podpisana na stronie.

// Znak rozdzielający pola w danych wejściowych skrótu.
//
// Musi to być znak, który NIE MOŻE wystąpić w żadnym z pól, inaczej dwa różne
// zestawy dają ten sam ciąg do zahaszowania: adres "1.2.3" z przeglądarką
// "4 Chrome" i adres "1.2.3 4" z przeglądarką "Chrome" są nie do odróżnienia,
// gdy skleić je spacją. Ani adres IP, ani User-Agent nie zawiera bajtu
// zerowego.
//
// Zbudowany funkcją, a nie wpisany do literału: prawdziwy bajt zerowy
// w źródle sprawia, że git uznaje plik za binarny i przestaje pokazywać
// zmiany, a sekwencja ucieczki bywa po drodze zamieniana na ten bajt.
const ROZDZIELNIK = String.fromCharCode(0);

// Dzień liczony w strefie serwera i ZAWSZE w Node, nigdy przez CURDATE().
// Gdyby jedno miejsce brało dzień z Node, a drugie z MySQL-a, to przy innej
// strefie bazy wpisy rozjechałyby się o dobę dokładnie w okolicach północy -
// czyli w momencie, w którym nikt tego nie zauważy.
export function dayKey(now = new Date()) {
  const rok = now.getFullYear();
  const miesiac = String(now.getMonth() + 1).padStart(2, "0");
  const dzien = String(now.getDate()).padStart(2, "0");

  return `${rok}-${miesiac}-${dzien}`;
}

// Fragmenty User-Agenta, po których poznajemy automat. Lista jest z założenia
// niepełna - chodzi o odcięcie masowych crawlerów, a nie o szczelność, której
// po User-Agencie i tak nie da się osiągnąć, bo nagłówek podaje sam klient.
const AUTOMATY = [
  "bot",
  "crawler",
  "spider",
  "slurp",
  "curl",
  "wget",
  "python-requests",
  "headlesschrome",
  "phantomjs",
  "lighthouse",
  "pingdom",
  "uptimerobot",
  "facebookexternalhit",
  "preview",
];

export function isBot(userAgent) {
  const wartosc = String(userAgent || "").toLowerCase();

  // Wejście bez User-Agenta to prawie zawsze skrypt. Przeglądarki go wysyłają.
  if (!wartosc) {
    return true;
  }

  return AUTOMATY.some((fragment) => wartosc.includes(fragment));
}

// Skrót odwiedzającego: 16 bajtów, bo to wystarcza, żeby kolizja była
// nieosiągalna przy tej skali, a zajmuje połowę tego co pełny SHA-256.
export function visitorHash({ ip, userAgent, day, secret }) {
  const dane = [day, secret, ip, userAgent].join(ROZDZIELNIK);

  return crypto.createHash("sha256").update(dane).digest().subarray(0, 16);
}

// Sól procesu.
//
// Bez VISIT_SALT losujemy ją przy starcie: licznik działa od razu po
// wdrożeniu, ale restart w środku dnia sprawia, że wcześniejsi odwiedzający
// policzą się tego dnia drugi raz. Ustawienie zmiennej usuwa ten efekt.
// Losowa wartość jest tu lepsza niż stała zaszyta w kodzie, bo tamta nie
// byłaby żadnym sekretem.
export function resolveSecret(env = process.env) {
  const zeSrodowiska = String(env.VISIT_SALT || "").trim();

  if (zeSrodowiska) {
    return zeSrodowiska;
  }

  return crypto.randomBytes(32).toString("hex");
}
