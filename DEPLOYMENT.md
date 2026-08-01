# Wdrożenie produkcyjne — panel webowy na Cybrancee (Plesk)

Ten dokument opisuje wystawienie panelu (`server/` + `web/`) na **web hostingu Cybrancee z panelem Plesk**, obok już działającego bota.

Układ docelowy:

| element | gdzie | zmiana |
|---|---|---|
| bot Discord | dotychczasowy hosting bota (panel Pterodactyl) | **żadna** |
| baza MySQL | dotychczasowa, wspólna dla wszystkich gildii | **żadna** |
| API + strona | nowy web hosting (Plesk), jeden proces Node | nowość |

`server/index.js` serwuje zbudowaną stronę z `web/dist` samodzielnie, więc to **jeden proces Node**, jedna domena i jeden origin — bez osobnego hostingu na frontend i bez ciasteczek cross-origin.

Nie mam dostępu do Twojego panelu ani do Discord Developer Portal — kroki poniżej wykonujesz sam. Jeśli coś nie zadziała, sekcja **Gdy coś nie działa** na końcu przypisuje objawy do przyczyn.

---

## 0. Zanim zaczniesz

0. **Właściwy produkt: „Node.js Hosting", nie „Web Hosting".** To u Cybrancee dwie różne usługi — zwykły web hosting nie wymienia obsługi Node'a, a ta aplikacja to proces Node. Najtańszy plan (Starter, 1 strona, 5 GB) w zupełności wystarcza: całość zajmuje ~85 MB. Node.js Hosting jest opisany jako „WebSocket Optimized", więc panel będzie się odświeżał na żywo bez obchodzenia problemu.
1. **Domena lub subdomena** wskazująca na hosting, np. `pickem.twojadomena.pl`. Darmowa domena bywa dodawana przy rozliczeniu rocznym; jeśli masz już domenę gdzie indziej, wystarczy subdomena z rekordem A na IP hostingu.
2. **Wersja Node w panelu: 20 LTS lub 22 LTS.** Nie schodź poniżej 18 — `server/` to moduły ESM (`"type": "module"`) i korzysta ze składni wymagającej nowszego runtime.
3. **Nie kasuj niczego po stronie bota.** To wdrożenie niczego nie migruje ani nie przenosi.

---

## 1. Discord Developer Portal

1. https://discord.com/developers/applications → wybierz aplikację bota.
2. **OAuth2 → General → Redirects** → dodaj dokładnie:
   ```
   https://TWOJA-DOMENA/api/auth/discord/callback
   ```
3. Zostaw istniejący wpis `http://localhost:...`, jeśli chcesz nadal testować lokalnie.
4. Zapisz.

Adres musi się zgadzać **co do znaku** z `DISCORD_REDIRECT_URI` z kroku 3 — łącznie z `https://` i bez ukośnika na końcu.

---

## 2. Wgranie plików

Wgraj całe repozytorium na hosting, np. do `/var/www/vhosts/TWOJA-DOMENA/pickem/`. Zachowaj strukturę katalogów — `server/` musi widzieć `../web/dist` i `../config`.

Musi się znaleźć na serwerze:

Lista wyliczona z realnych importów serwera (29 plików projektu), nie z pamięci:

| element | po co |
|---|---|
| `server/` | kod API |
| `web/dist/` | zbudowana strona (krok 4) |
| `utils/` | współdzielone z botem — `restoreBackup.js`, `guildRegistry.js`, repozytoria faz |
| `handlers/` | eksport klasyfikacji, przeliczanie wyników |
| `services/` | przeliczanie punktów meczów |
| `rules/` | zasady punktacji |
| `db.js` | pula połączeń per gildia — pojedynczy plik w katalogu głównym |
| `package.json` + `package-lock.json` | potrzebne do `npm install` w katalogu głównym (krok 5) |
| `config/*.env` | konfiguracje gildii — **serwer web też ich potrzebuje**: dane dostępowe do bazy per gildia oraz nazwy, slugi i link zaproszenia na Discorda |

Nie musi: `commands/`, `index.js` bota, `web/src/`, `web/node_modules/`, `node_modules/`.

> `config/*.env` i `server/.env` są w `.gitignore` i **nie wgrają się przez integrację z gitem** — wrzuć je ręcznie przez File Manager lub FTP.

---

## 3. `server/.env`

Utwórz `server/.env` (wzór: `server/.env.example`):

```env
# Baza — te same wartości co w config/*.env bota, to jedna wspólna baza
DB_HOST=...
DB_PORT=3306
DB_USER=...
DB_PASS=...
DB_NAME=s25345_pickemdb

DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
DISCORD_REDIRECT_URI=https://TWOJA-DOMENA/api/auth/discord/callback
SESSION_SECRET=wygeneruj-losowy-dlugi-ciag

WEB_ORIGIN=https://TWOJA-DOMENA
NODE_ENV=production

# ŚCIEŻKA BEZWZGLĘDNA — patrz uwaga niżej
GUILD_CONFIG_DIR=/var/www/vhosts/TWOJA-DOMENA/pickem/config
```

Trzy rzeczy, które warto zrozumieć, zanim to wkleisz:

**`GUILD_CONFIG_DIR` musi być ścieżką bezwzględną.** Ścieżki względne są rozwijane względem katalogu roboczego procesu. Lokalnie proces startuje z `server/`, więc działa tam `../config`. Pod Passengerem katalogiem roboczym jest Application Root — ta sama ścieżka wskazałaby wtedy poza repozytorium i serwer nie znalazłby konfiguracji gildii.

**`NODE_ENV=production` jest krytyczne.** Bez tego zostaje aktywna furtka `/api/auth/dev-login`, pozwalająca zalogować się na admina **bez Discorda**. Włącza też bezpieczne ciasteczka sesji i serwowanie `web/dist`.

**`SESSION_SECRET`** wygeneruj losowo (`openssl rand -hex 32`) i nie używaj go nigdzie indziej. Zmiana tej wartości wylogowuje wszystkich.

`PORT` pomiń — Passenger przydziela port sam.

---

## 4. Zbudowanie strony

`web/dist` jest w `.gitignore`, więc nie przyjedzie z repozytorium. Zbuduj lokalnie i wgraj:

```bash
cd web
npm ci
npm run build
```

Powstanie `web/dist/` — wgraj **całą zawartość** do `web/dist/` na serwerze.

Alternatywa, jeśli wolisz budować na serwerze: wgraj `web/` z `package.json`, w panelu Node.js ustaw tymczasowo Application Root na `web/`, kliknij *NPM install*, uruchom skrypt `build`, po czym przestaw Application Root z powrotem na `server/`. Wersja lokalna jest prostsza i przewidywalna — hosting współdzielony bywa skąpy w pamięć przy budowaniu.

Po **każdej** późniejszej zmianie w `web/` trzeba powtórzyć build i wgrać `dist` na nowo — to pliki statyczne, nie odświeżą się same.

---

## 5. Aplikacja Node w Plesku

W panelu domeny → **Node.js**:

| ustawienie | wartość |
|---|---|
| Node.js version | 20 LTS lub 22 LTS |
| Application Mode | `production` |
| Application Root | `/var/www/vhosts/TWOJA-DOMENA/pickem/server` |
| Application Startup File | `index.js` |

**Application Root musi wskazywać na `server/`, nie na katalog główny repozytorium.** Powody:

- przycisk *NPM install* instaluje zależności z `package.json` znalezionego w Application Root — w katalogu głównym leżą zależności **bota**, nie serwera,
- `dotenv` szuka `.env` w katalogu roboczym, czyli znajdzie `server/.env`,
- backupy i archiwa również zapisują się względem katalogu roboczego, czyli trafią do `server/backup/` — tak samo jak lokalnie.

Ścieżka do strony (`web/dist`) jest liczona względem **pliku**, nie katalogu roboczego, więc przy Application Root ustawionym na `server/` nadal poprawnie wskazuje na `web/dist`.

### Zależności trzeba zainstalować w DWÓCH miejscach

To najczęstsza przyczyna „aplikacja nie startuje" przy tym układzie. `server/index.js` korzysta z `utils/`, `handlers/` i `services/` leżących w katalogu głównym, a Node szuka pakietów **od katalogu pliku, który ich wymaga** — nie od punktu wejścia. Pliki z `utils/` potrzebują więc `node_modules` w katalogu głównym i `server/node_modules` im nie pomoże.

Konkretnie z korzenia biorą się `winston`, `luxon`, `exceljs` i `mysql2`. `utils/logger.js` ładuje się przy starcie serwera, więc bez tego proces **nie wstanie w ogóle**, wywalając się na `Cannot find module 'winston'`.

Kolejność:

1. Application Root ustaw tymczasowo na katalog główny (`.../pickem`) → **NPM install**.
2. Application Root przestaw na `.../pickem/server` → **NPM install** ponownie.
3. **Restart App**.

Zajmie to ~85 MB (`node_modules` w korzeniu ~71 MB, `server/node_modules` ~12 MB, `web/dist` ~0,6 MB) — mieści się w 5 GB najtańszego planu z ogromnym zapasem.

Jeśli masz dostęp SSH, to po prostu `npm install --omit=dev` w obu katalogach.

---

## 6. HTTPS

W panelu domeny → **SSL/TLS Certificates** → wystaw darmowy certyfikat Let's Encrypt, potem włącz przekierowanie na HTTPS (*Hosting Settings → Permanent SEO-safe 301 redirect from HTTP to HTTPS*).

To nie jest opcjonalne: przy `NODE_ENV=production` ciasteczko sesji ma flagę `secure` i przeglądarka **nie wyśle go po zwykłym HTTP** — logowanie przestanie działać, bez żadnego błędu w logach.

Aplikacja jest już przygotowana na pracę za reverse proxy Pleska (`trust proxy`), więc rozpozna, że oryginalne połączenie było szyfrowane.

---

## 7. Weryfikacja

Po kolei, bo każdy krok sprawdza co innego:

1. `https://TWOJA-DOMENA/public` — strona publiczna z realnymi danymi. *Jeśli działa: Node wstał, baza odpowiada, `web/dist` jest na miejscu.*
2. „Zaloguj przez Discord" → powrót na stronę jako zalogowany. *Jeśli działa: redirect URI, HTTPS i ciasteczka sesji są poprawne.*
3. `https://TWOJA-DOMENA/api/auth/dev-login` — musi zwrócić **404**. *Jeśli zwraca cokolwiek innego, `NODE_ENV` nie jest ustawione na `production` i panel stoi otworem.*
4. `/app` → panel admina z listą Twoich serwerów. *Jeśli działa: konfiguracje gildii są znalezione (`GUILD_CONFIG_DIR`).*
5. Wejdź w serwer → turniej → **Operacje turniejowe → Utwórz backup**, potem **Pobierz**. *Jeśli plik się pobiera: katalog roboczy jest zapisywalny, a `mysqldump` działa.*
6. Restart aplikacji w panelu, będąc zalogowanym → sesja przeżywa restart. *Sesje siedzą w MySQL, nie w pamięci procesu.*

---

## Gdy coś nie działa

| objaw | przyczyna | co zrobić |
|---|---|---|
| Logowanie „przechodzi", ale wracasz niezalogowany | ciasteczko `secure` nie przechodzi przez HTTP | dokończ krok 6 (certyfikat + wymuszenie HTTPS) |
| `Invalid OAuth2 redirect_uri` | `DISCORD_REDIRECT_URI` ≠ wpis w Developer Portal | porównaj znak po znaku, także ukośnik końcowy |
| Strona publiczna działa, `/app` pokazuje pustą listę serwerów | serwer nie znalazł `config/*.env` | `GUILD_CONFIG_DIR` musi być ścieżką bezwzględną (krok 3) |
| Biała strona, w konsoli 404 na plikach `.js` | brak `web/dist` na serwerze | krok 4 |
| Aplikacja nie startuje, `Cannot find module 'winston'` (albo `luxon`/`exceljs`) | brak `node_modules` w katalogu **głównym** | *NPM install* trzeba wykonać w obu katalogach (krok 5) |
| Aplikacja nie startuje, `Cannot find module 'express'` | brak `server/node_modules` | jw. — drugi przebieg *NPM install* z Application Root na `server/` |
| Panel działa, ale nie odświeża się na żywo | WebSockety nie przechodzą | nic nie trzeba — Socket.io schodzi wtedy na long-polling i działa dalej, tylko wolniej |
| Backup zwraca 500 | katalog roboczy niezapisywalny | sprawdź prawa do `server/backup/` |

Logi aplikacji: panel Plesk → Node.js → **Log file**, albo Logs domeny.

---

## Co zostaje bez zmian

- **Bot Discord** — działa na dotychczasowym hostingu, bez żadnych zmian. `ecosystem.config.js` nadal opisuje oba procesy, ale przy tym wariancie wpis `pickembot-server` jest nieużywany (aplikacją webową zarządza Passenger, nie PM2).
- **Baza danych** — jedna, wspólna. Nic nie migrujesz i nie duplikujesz.
- **Development lokalny** — bez zmian. Serwowanie `web/dist` i bezpieczne ciasteczka włączają się dopiero przy `NODE_ENV=production`.

---

## Po wdrożeniu

- Zrób backup z panelu i **pobierz go na dysk** — dopiero kopia poza serwerem chroni przed utratą samego hostingu. Automatycznie trzymanych jest 10 najnowszych, starsze kasują się same.
- Zaktualizuj `DISCORD_INVITE_URL` w `config/*.env` dla gildii, które mają publiczne zaproszenie — bez tego przycisk „Dołącz do Discorda" po prostu się nie pokaże.
