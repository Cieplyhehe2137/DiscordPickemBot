import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getAdminServers, getAllEvents } from "../lib/api.js";
import { odmien } from "../lib/odmiana.js";

// Strona główna pokazywała wcześniej WYMYŚLONY mecz: "Team Alpha 2 : 1
// Team Bravo", "PickEmBot Major", mapy 13:8 / 9:13 / 13:11. Wszystko wpisane
// na sztywno. Pierwsze wrażenie robią prawdziwe liczby, a nie makieta - tym
// bardziej że dane są pod ręką i mówią same za siebie: ponad tysiąc typujących.

function liczby(events) {
  return events.reduce(
    (suma, e) => ({
      turnieje: suma.turnieje + 1,
      gracze: suma.gracze + Number(e.participants || 0),
      mecze: suma.mecze + Number(e.matches_count || 0),
    }),
    { turnieje: 0, gracze: 0, mecze: 0 },
  );
}

function Hero() {
  return (
    <section className="home-hero">
      <span className="ui-kicker">CS2 Pick&apos;Em</span>

      <h1 className="ui-display">
        Typuj. <span>Rywalizuj.</span> <span>Wygrywaj.</span>
      </h1>

      <p>
        Typuj mecze CS2, przewiduj wyniki map i zdobywaj punkty razem ze
        społecznością PickEmBot.
      </p>

      <div className="ui-row ui-row--wrap">
        <Link className="ui-btn ui-btn--primary" to="/events">
          Zobacz turnieje
        </Link>

        <Link className="ui-btn ui-btn--ghost" to="/events">
          Przeglądaj rankingi
        </Link>
      </div>
    </section>
  );
}

function Statystyki({ events }) {
  const suma = liczby(events);

  if (!suma.turnieje) return null;

  return (
    <div className="ui-stats">
      <div className="ui-stat ui-stat--featured">
        <span className="ui-stat__label">Typujących</span>
        <strong className="ui-stat__value">{suma.gracze}</strong>
        <span className="ui-stat__hint">suma zgłoszeń we wszystkich turniejach</span>
      </div>

      <div className="ui-stat">
        <span className="ui-stat__label">Turnieje</span>
        <strong className="ui-stat__value">{suma.turnieje}</strong>
        <span className="ui-stat__hint">rozegrane i w toku</span>
      </div>

      <div className="ui-stat">
        <span className="ui-stat__label">Mecze</span>
        <strong className="ui-stat__value">{suma.mecze}</strong>
        <span className="ui-stat__hint">do wytypowania</span>
      </div>
    </div>
  );
}

function KartaTurnieju({ event }) {
  const live = Boolean(event.is_live);

  return (
    <Link
      className="ui-card ui-card--interactive ui-tile"
      to={`/events/${event.slug}`}
    >
      <div className="ui-row ui-row--between ui-row--full">
        <span className={`ui-badge ${live ? "ui-badge--live" : ""}`}>
          {live ? "Trwa" : event.is_archived ? "Zakończony" : "Zaplanowany"}
        </span>

        {event.guild?.name && (
          <span className="ui-stat__hint">{event.guild.name}</span>
        )}
      </div>

      <strong className="ui-tile__name">{event.name}</strong>

      <div className="ui-row ui-row--wrap ui-tile__meta">
        <span className="ui-badge">
          {event.participants}{" "}
          {odmien(event.participants, "gracz", "gracze", "graczy")}
        </span>

        {Number(event.matches_count) > 0 && (
          <span className="ui-badge">
            {event.matches_count}{" "}
            {odmien(event.matches_count, "mecz", "mecze", "meczów")}
          </span>
        )}
      </div>
    </Link>
  );
}

function Turnieje({ events, loading, blad }) {
  if (loading) {
    return (
      <div className="ui-stats" aria-busy="true" aria-label="Ładowanie turniejów">
        {Array.from({ length: 3 }, (_, i) => (
          <div className="ui-skeleton ui-skeleton--row" key={i} />
        ))}
      </div>
    );
  }

  // Sekcja jest dodatkiem do strony głównej, więc przy błędzie po prostu jej
  // nie ma - komunikat o awarii API na stronie powitalnej nikomu nie pomaga.
  if (blad) return null;

  if (!events.length) {
    return (
      <div className="ui-empty">
        <span className="ui-empty__icon" aria-hidden="true">
          🏆
        </span>

        <strong className="ui-empty__title">Pierwszy turniej przed nami</strong>

        <p className="ui-empty__text">
          Gdy tylko ruszy typowanie, turnieje pojawią się tutaj.
        </p>
      </div>
    );
  }

  // Trwające na górze - to one są powodem, żeby wejść na stronę dzisiaj.
  const kolejnosc = [...events].sort(
    (a, b) => Number(Boolean(b.is_live)) - Number(Boolean(a.is_live)),
  );

  return (
    <div className="ui-tiles">
      {kolejnosc.map((event) => (
        <KartaTurnieju event={event} key={event.id ?? event.slug} />
      ))}
    </div>
  );
}

// Lista serwerów była dostępna wyłącznie w panelu admina, za logowaniem -
// zwykły odwiedzający nie miał jak sprawdzić, gdzie bot w ogóle działa.
function Serwery() {
  const [serwery, setSerwery] = useState(null);
  const [blad, setBlad] = useState("");

  useEffect(() => {
    let anulowane = false;

    (async () => {
      try {
        const dane = await getAdminServers();

        if (!anulowane) setSerwery(dane.servers ?? []);
      } catch (err) {
        console.error("SERVERS ERROR:", err);

        if (!anulowane) setBlad(err.message || "Nie udało się pobrać serwerów.");
      }
    })();

    return () => {
      anulowane = true;
    };
  }, []);

  if (blad || (serwery && !serwery.length)) return null;

  return (
    <section className="ui-stack ui-stack--loose">
      <div className="ui-section-head">
        <div>
          <span className="ui-kicker">Gdzie działa bot</span>
          <h2>Serwery</h2>
        </div>
      </div>

      {!serwery ? (
        <div className="ui-stats" aria-busy="true">
          {Array.from({ length: 3 }, (_, i) => (
            <div className="ui-skeleton ui-skeleton--row" key={i} />
          ))}
        </div>
      ) : (
        <div className="ui-tiles">
          {serwery.map((serwer) => (
            <article className="ui-card ui-tile" key={serwer.guild_id}>
              <strong className="ui-tile__name">{serwer.name}</strong>

              <div className="ui-row ui-row--wrap ui-tile__meta">
                <span className="ui-badge">
                  {serwer.events_count}{" "}
                  {odmien(
                    serwer.events_count,
                    "turniej",
                    "turnieje",
                    "turniejów",
                  )}
                </span>

                {serwer.open_events > 0 && (
                  <span className="ui-badge ui-badge--live">
                    {serwer.open_events} w trakcie
                  </span>
                )}
              </div>

              {serwer.discord_url && (
                <a
                  className="ui-btn ui-btn--ghost ui-btn--sm"
                  href={serwer.discord_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Dołącz na Discordzie
                </a>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function HomePage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [blad, setBlad] = useState("");

  useEffect(() => {
    let anulowane = false;

    (async () => {
      try {
        const dane = await getAllEvents();

        if (!anulowane) setEvents(dane.events ?? []);
      } catch (err) {
        console.error("HOME EVENTS ERROR:", err);

        if (!anulowane) setBlad(err.message || "Nie udało się pobrać turniejów.");
      } finally {
        if (!anulowane) setLoading(false);
      }
    })();

    return () => {
      anulowane = true;
    };
  }, []);

  return (
    <main className="ui-page">
      <Hero />

      {!loading && !blad && <Statystyki events={events} />}

      <section className="ui-stack ui-stack--loose">
        <div className="ui-section-head">
          <div>
            <span className="ui-kicker">Turnieje</span>
            <h2>Gdzie się teraz typuje</h2>
          </div>

          <Link className="ui-btn ui-btn--ghost ui-btn--sm" to="/events">
            Wszystkie turnieje →
          </Link>
        </div>

        <Turnieje events={events} loading={loading} blad={blad} />
      </section>

      <Serwery />
    </main>
  );
}

export default HomePage;
