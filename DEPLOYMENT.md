# Wdrożenie produkcyjne — server/ + web/

Ten dokument opisuje, jak wystawić panel webowy (`server/` + `web/`) w produkcji, obok już działającego bota. Kod i konfigurację przygotowałem tak, żeby dało się to zrobić **na tym samym hoście, na którym już działa bot** (Pterodactyl, wg `ecosystem.config.js`) — bez dodatkowego serwera, bez osobnego CORS, jeden proces obsługuje jednocześnie API i stronę.

Nie mam dostępu do Twojego hostingu/Discord Developer Portal — poniższe kroki musisz wykonać samodzielnie. Jeśli wolisz, żebym poprowadził Cię przez to na żywo (masz dostęp SSH/panel), daj znać.

---

## 0. Decyzje, które musisz podjąć przed startem

1. **Domena** — potrzebujesz jednej domeny (lub subdomeny) wskazującej na serwer, na którym stoi bot, np. `pickem.twojadomena.pl`. Jeśli nie masz jeszcze domeny:
   - najtańsza opcja: domena `.pl`/`.com` u dowolnego rejestratora (Cloudflare Registrar, OVH, home.pl) — zwykle kilka-kilkanaście zł/rok,
   - jeśli host bota (Pterodactyl) oferuje własną subdomenę/adres — to też wystarczy, byle był stabilny.
2. **Port** — serwer Node (`server/`) musi być dostępny z zewnątrz na porcie 80/443 (przez reverse proxy, patrz krok 3) albo bezpośrednio, jeśli Twój hosting już to zapewnia (niektóre panele Pterodactyl robią to automatycznie po przypisaniu allocation + subdomeny).

---

## 1. Discord Developer Portal

1. Wejdź na https://discord.com/developers/applications → wybierz aplikację bota.
2. **OAuth2 → General → Redirects** → dodaj:
   ```
   https://TWOJA-DOMENA/api/auth/discord/callback
   ```
   (zostaw też istniejący `http://localhost:5173/...` jeśli nadal chcesz testować lokalnie).
3. Zapisz zmiany.

---

## 2. Konfiguracja `server/.env`

Na serwerze, w katalogu `server/`, utwórz plik `.env` na podstawie `server/.env.example`:

```env
DB_HOST=... # ten sam co w config/*.env bota - to jedna wspólna baza
DB_PORT=3306
DB_USER=...
DB_PASS=...
DB_NAME=s25345_pickemdb

DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
DISCORD_REDIRECT_URI=https://TWOJA-DOMENA/api/auth/discord/callback
SESSION_SECRET=wygeneruj-losowy-dlugi-ciag-znakow

WEB_ORIGIN=https://TWOJA-DOMENA
NODE_ENV=production
PORT=3301
```

`SESSION_SECRET` — wygeneruj losowo, np. `openssl rand -hex 32`, i nie współdziel go nigdzie indziej.

`NODE_ENV=production` jest krytyczne — bez tego: sesje nie będą bezpieczne (`cookie.secure`) i zostanie aktywny `/api/auth/dev-login` (furtka logowania bez Discorda, która **musi** być wyłączona w produkcji).

---

## 3. Reverse proxy + HTTPS

Node/Express nie obsługuje HTTPS samodzielnie w tym projekcie — potrzebny jest reverse proxy przed portem 3301. Jeśli Twój hosting (Pterodactyl) już terminuje SSL na poziomie panelu/subdomeny — możesz pominąć ten krok. W przeciwnym razie, najprostsza opcja to **Caddy** (automatyczny Let's Encrypt, jeden plik configu):

```
# Caddyfile
TWOJA-DOMENA {
    reverse_proxy localhost:3301
}
```

Alternatywa: nginx + certbot, jeśli już go używasz do czegoś innego.

**Ważne dla Socket.io (aktualizacje na żywo):** reverse proxy musi wspierać WebSocket upgrade. Caddy robi to domyślnie. Dla nginx dodaj:
```
location /socket.io/ {
    proxy_pass http://localhost:3301;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

---

## 4. Build i start

Na serwerze, w katalogu repo:

```bash
# 1. Zbuduj stronę web/ (produkuje web/dist, które server/index.js serwuje statycznie)
cd web
npm ci
npm run build
cd ..

# 2. Zainstaluj zależności server/
cd server
npm ci
cd ..

# 3. Uruchom oba procesy przez PM2 (ecosystem.config.js ma teraz dwie pozycje:
#    "pickembot" - bot Discord, "pickembot-server" - API + strona)
pm2 start ecosystem.config.js
pm2 save
```

Po każdej zmianie w `web/` trzeba powtórzyć `npm run build` w `web/` i zrestartować `pickembot-server` (`pm2 restart pickembot-server`) — build jest statyczny, nie przeładowuje się sam.

---

## 5. Weryfikacja po wdrożeniu

- `pm2 status` — oba procesy (`pickembot`, `pickembot-server`) mają status `online`.
- `pm2 logs pickembot-server` — brak błędów przy starcie, log `WEB SERWER DZIAŁA NA http://localhost:3301`.
- Otwórz `https://TWOJA-DOMENA/public` w przeglądarce — strona publiczna powinna się załadować (dane społeczności, eventy).
- Kliknij „Zaloguj przez Discord" — powinieneś zostać przekierowany do Discorda i z powrotem, zalogowany.
- Zrestartuj `pickembot-server` (`pm2 restart pickembot-server`) będąc zalogowanym — sesja powinna przetrwać restart (bo sesje są w MySQL, nie w pamięci procesu — patrz Faza 5 w planie).
- Wejdź na `/app` jako admin serwera Discord — panel administracyjny powinien się załadować i pokazać Twoje serwery.

---

## Co zostaje bez zmian

- Bot Discord (`pickembot` w PM2) działa dokładnie tak jak dotąd, bez żadnych zmian w tym wdrożeniu.
- Baza danych jest jedna, współdzielona — nic nie trzeba migrować ani duplikować.
- Development lokalny (`npm run dev` w `web/` + `node server/index.js` bez `NODE_ENV=production`) działa bez zmian — blok serwowania statycznego z `web/dist` aktywuje się tylko przy `NODE_ENV=production`.
