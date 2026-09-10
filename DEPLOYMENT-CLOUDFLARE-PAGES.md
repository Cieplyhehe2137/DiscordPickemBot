# Wdrożenie frontendu na Cloudflare Pages

Ten dokument opisuje wariant, w którym **sam frontend** (`web/`) stoi na Cloudflare Pages, a API i bot zostają tam, gdzie są.

To alternatywa dla [DEPLOYMENT.md](DEPLOYMENT.md), który opisuje układ jednoprocesowy — jedna domena, jeden origin, bez CORS i bez ciasteczek cross-origin. **Jeśli nie masz konkretnego powodu, żeby rozdzielać hosty, tamten wariant jest prostszy i mniej ruchomych części.** Poniżej jest napisane wprost, co się komplikuje.

---

## Co może stanąć na Pages, a co nie

Cloudflare Pages to hosting statyczny. Z tego repozytorium nadaje się na niego **wyłącznie zbudowany frontend**.

| element | Pages | dlaczego |
| --- | --- | --- |
| `web/` po `npm run build` | **tak** | statyczne pliki |
| `server/index.js` | **nie** | Express, sesje w MySQL, socket.io, połączenie TCP do bazy |
| `index.js` (bot) | **nie** | długo żyjący proces z połączeniem do Discorda |

API i bot muszą działać tam, gdzie dziś — Pages ich nie zastąpi. Ten wariant **dokłada** hosting frontu, nie zastępuje niczego.

---

## Warunek wstępny, bez którego to nie ruszy

**API musi być publicznie osiągalne po HTTPS.**

Front na `*.pages.dev` wysyła ciasteczko sesji jako `SameSite=None`, a przeglądarka odrzuca takie ciasteczko bez flagi `Secure`. `Secure` po HTTP nie działa. Czyli: bez HTTPS na API logowanie nie zadziała w ogóle, a objaw będzie mylący — logowanie przez Discorda przejdzie, po czym każde kolejne żądanie zwróci 401.

W chwili pisania `server/.env` wskazuje na `http://localhost:3301` i nie ma ustawionego `WEB_ORIGIN`, więc to konfiguracja lokalna. **Najpierw wystaw API pod publiczną domeną po HTTPS** (patrz DEPLOYMENT.md), dopiero potem wracaj tutaj.

---

## 1. Ustawienia projektu w Cloudflare Pages

| pole | wartość |
| --- | --- |
| Framework preset | None |
| Root directory | `web` |
| Build command | `npm ci && npm run build` |
| Build output directory | `dist` |
| Node version | 20 lub nowszy (zmienna `NODE_VERSION`) |

Katalog `web/public/_redirects` trafia do `dist` automatycznie i zawiera regułę `/* /index.html 200`. Bez niej wejście wprost na `/events/cos` albo odświeżenie strony daje 404, bo trasy obsługuje React Router po stronie klienta.

## 2. Zmienne środowiskowe w Pages

```
VITE_API_URL = https://api.twoja-domena.pl
```

Bez końcowego ukośnika. To adres **API**, nie frontu. Ustaw ją dla środowiska Production, a jeśli chcesz działających podglądów — także dla Preview.

Wzorzec jest w [web/.env.example](web/.env.example).

## 3. Zmienne po stronie API (`server/.env`)

```
WEB_ORIGIN=https://pickem-web.pages.dev,https://pickem.twoja-domena.pl
WEB_ORIGIN_SUFFIX=.pickem-web.pages.dev
CROSS_ORIGIN_WEB=1
DISCORD_REDIRECT_URI=https://api.twoja-domena.pl/api/auth/discord/callback
```

`WEB_ORIGIN` przyjmuje listę po przecinku. **Pierwszy wpis jest adresem, na który wraca logowanie** — pozostałe są tylko dopuszczone w CORS.

`WEB_ORIGIN_SUFFIX` dopuszcza podglądy Pages, które dostają adresy `<hash>.<projekt>.pages.dev`. Bez tego każdy podgląd odbija się o CORS. Zostaw puste, jeśli podglądy mają nie działać.

`CROSS_ORIGIN_WEB=1` przełącza ciasteczko sesji na `SameSite=None; Secure`. **Ustaw je tylko przy rozdzielonych hostach** — przy wdrożeniu jednoprocesowym zostaw niewłączone.

## 4. Discord Developer Portal

W OAuth2 → Redirects dodaj **adres API**, nie adres Pages:

```
https://api.twoja-domena.pl/api/auth/discord/callback
```

Przepływ logowania idzie przez API i dopiero ono odsyła użytkownika na front, więc Discord nigdy nie widzi adresu Pages.

---

## Co tracisz w tym wariancie

**Podgląd linków na Discordzie.** `server/index.js` wstrzykuje `og:title` i `og:description` w HTML po stronie serwera, bo Discord buduje podgląd bez uruchamiania JS. Pages serwuje statyczny `index.html`, więc linki do eventów stracą tytuły per event i pokażą tag domyślny. Odzyskanie tego wymagałoby Pages Functions albo prerenderingu.

**Ochronę CSRF, którą dawał `SameSite=Lax`.** Przy `None` ciasteczko leci również przy żądaniach inicjowanych z obcych stron. Aplikacja nie ma tokenów CSRF, więc to realne obniżenie poziomu zabezpieczeń — warto je nadrobić, zanim ten wariant trafi na produkcję z prawdziwym ruchem.

**Prostotę.** Dochodzi drugi hosting, konfiguracja CORS, HTTPS na API jako twardy wymóg i dwa miejsca, w których trzeba pamiętać o zmiennych.

## Co zyskujesz

CDN Cloudflare przed statykiem, podglądy per branch i wdrożenie frontu niezależne od restartu API. Przy tej skali ruchu to głównie wygoda, nie wydajność.

---

## Gdy coś nie działa

**Logowanie przechodzi, ale wszystko zwraca 401** — ciasteczko nie doszło. Sprawdź w tej kolejności: czy API stoi po HTTPS, czy `CROSS_ORIGIN_WEB=1`, czy origin Pages jest w `WEB_ORIGIN`. Wszystkie trzy naraz, brak jednego wystarczy.

**Błąd CORS w konsoli** — origin nie przeszedł. Jeśli to podgląd Pages, ustaw `WEB_ORIGIN_SUFFIX`.

**404 przy odświeżeniu podstrony** — brakuje `_redirects` w wyniku budowania. Sprawdź, czy `Build output directory` to `dist` i czy plik jest w `web/public/`.

**Front woła `/api` na własnym adresie zamiast API** — nie ustawiono `VITE_API_URL` przy budowaniu. To zmienna czasu budowania, nie runtime: po jej dodaniu trzeba przebudować projekt, samo przeładowanie strony nic nie zmieni.

**Socket nie łączy się, panel nie odświeża się na żywo** — ta sama przyczyna co wyżej; `web/src/lib/socket.js` korzysta z tej samej zmiennej.
