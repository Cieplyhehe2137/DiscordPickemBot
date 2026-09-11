// Konfiguracja typowania druzyn dla eventu: ktore fazy ma turniej i ile
// druzyn wchodzi w kazda kategorie.
//
// Zapis sprawdza sie wobec zamrozonych faz (server/lib/frozenPhases.js) -
// limitow nie wolno ruszac, gdy ktos juz w tej fazie typowal.

export function registerPickemConfigRoutes(
  app,
  {
    getFrozenPhases,
    FAZY_PICKEM,
    buildPublicMatch,
    emitDashboardRefresh,
    getEventPickemConfig,
    getOpenEventId,
    guildIdFromEventSlug,
    guildRegistry,
    io,
    logInfo,
    parseMatchList,
    pool,
    registerGuildEventRoutes,
    registerPublicOverviewRoutes,
    requireGuildAdmin,
    runInTransaction,
    setEventPickemConfig,
  },
) {
  app.get(
    "/api/events/:slug/pickem-config",
    requireGuildAdmin(guildIdFromEventSlug),
    async (req, res) => {
      try {
        const { guildId } = req;

        const [[event]] = await pool.query(
          "SELECT id, name FROM events WHERE guild_id = ? AND slug = ? LIMIT 1",
          [guildId, req.params.slug],
        );

        if (!event) {
          return res.status(404).json({ error: "Nie znaleziono turnieju." });
        }

        const konfiguracja = await getEventPickemConfig(pool, guildId, event.id);
        const zamrozone = await getFrozenPhases(event.id);

        return res.json({
          event: { id: event.id, name: event.name },
          skonfigurowany: konfiguracja.skonfigurowany,
          fazy: FAZY_PICKEM.map((faza) => ({
            faza,
            enabled: konfiguracja.fazy[faza].enabled,
            limity: konfiguracja.fazy[faza].limity,
            zamrozona: Boolean(zamrozone[faza]),
            powodZamrozenia: zamrozone[faza] || null,
          })),
        });
      } catch (err) {
        console.error("PICKEM CONFIG GET:", err);
        return res.status(500).json({ error: "Błąd bazy danych." });
      }
    },
  );

  app.put(
    "/api/events/:slug/pickem-config",
    requireGuildAdmin(guildIdFromEventSlug),
    async (req, res) => {
      try {
        const { guildId } = req;
        const { fazy } = req.body || {};

        if (!Array.isArray(fazy) || !fazy.length) {
          return res
            .status(400)
            .json({ error: "fazy musi być niepustą tablicą." });
        }

        const [[event]] = await pool.query(
          "SELECT id FROM events WHERE guild_id = ? AND slug = ? LIMIT 1",
          [guildId, req.params.slug],
        );

        if (!event) {
          return res.status(404).json({ error: "Nie znaleziono turnieju." });
        }

        // API i panel mówią o fazie "faza", moduł konfiguracji - "phase".
        // Bez tego mapowania wpisy były po cichu pomijane (jestFaza(undefined)
        // zwraca false), endpoint odpowiadał 200, a nic się nie zapisywało.
        const doZapisu = fazy.map((wpis) => ({
          phase: wpis?.phase ?? wpis?.faza,
          enabled: Boolean(wpis?.enabled),
          limity: wpis?.limity,
        }));

        const nieznane = doZapisu.filter((w) => !FAZY_PICKEM.includes(w.phase));

        if (nieznane.length) {
          return res.status(400).json({
            error: `Nieznane fazy: ${nieznane.map((w) => w.phase).join(", ")}`,
          });
        }

        // Zamrożonej fazy nie wolno przestawić - zapisane typy były sprawdzane
        // wobec innych liczb, a zakończony turniej musi zostać opisany tak, jak
        // faktycznie został rozegrany.
        const zamrozone = await getFrozenPhases(event.id);
        const biezaca = await getEventPickemConfig(pool, guildId, event.id);

        const naruszenia = doZapisu.filter((wpis) => {
          if (!zamrozone[wpis.phase]) return false;

          const stare = biezaca.fazy[wpis.phase];

          if (Boolean(stare.enabled) !== Boolean(wpis.enabled)) return true;

          return Object.entries(stare.limity || {}).some(
            ([grupa, wartosc]) =>
              Number(wpis.limity?.[grupa] ?? wartosc) !== Number(wartosc),
          );
        });

        if (naruszenia.length) {
          return res.status(409).json({
            error:
              "Nie można zmienić tych faz: " +
              naruszenia
                .map((w) => `${w.phase} (${zamrozone[w.phase]})`)
                .join(", ") +
              ".",
            zamrozone: naruszenia.map((w) => w.phase),
          });
        }

        await setEventPickemConfig(pool, guildId, event.id, doZapisu);

        const konfiguracja = await getEventPickemConfig(pool, guildId, event.id);

        logInfo("pickem", "Event pickem config saved", {
          guildId,
          eventId: event.id,
          by: req.session?.user?.id,
          extra: {
            wlaczone: FAZY_PICKEM.filter((f) => konfiguracja.fazy[f].enabled),
          },
        });

        emitDashboardRefresh({
          slug: req.params.slug,
          guildId,
          reason: "pickem_config_updated",
        });

        const poZapisie = await getFrozenPhases(event.id);

        return res.json({
          ok: true,
          fazy: FAZY_PICKEM.map((faza) => ({
            faza,
            enabled: konfiguracja.fazy[faza].enabled,
            limity: konfiguracja.fazy[faza].limity,
            zamrozona: Boolean(poZapisie[faza]),
            powodZamrozenia: poZapisie[faza] || null,
          })),
        });
      } catch (err) {
        console.error("PICKEM CONFIG PUT:", err);
        return res.status(500).json({ error: "Błąd bazy danych." });
      }
    },
  );

  // Przeniesione do server/routes/publicOverview.js. Wywolanie stoi tam, gdzie byly trasy -
  // kolejnosc rejestracji jest zachowaniem, bo Express bierze pierwsza.
  registerPublicOverviewRoutes(app, {
    buildPublicMatch,
    guildRegistry,
    pool,
  });

  // Przeniesione do server/routes/guildEvents.js. Wywolanie stoi tam, gdzie byly trasy -
  // kolejnosc rejestracji jest zachowaniem, bo Express bierze pierwsza.
  registerGuildEventRoutes(app, {
    getOpenEventId,
    io,
    logInfo,
    parseMatchList,
    pool,
    requireGuildAdmin,
    runInTransaction,
  });
}
