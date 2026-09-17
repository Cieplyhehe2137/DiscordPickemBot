import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getAdminServers, getAllEvents, getVisitStats } from "../lib/api.js";
import {
  EVENT_STATE_BADGE,
  EVENT_STATE_KEY,
  eventState,
  eventsHeadingKey,
} from "../lib/eventState.js";
import { useT } from "../i18n/useLanguage.js";

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
  const t = useT();

  return (
    <section className="home-hero">
      <span className="ui-kicker">CS2 Pick&apos;Em</span>

      <h1 className="ui-display">
        {t("home.hero.predict")} <span>{t("home.hero.compete")}</span>{" "}
        <span>{t("home.hero.win")}</span>
      </h1>

      <p>{t("home.hero.text")}</p>

      <div className="ui-row ui-row--wrap">
        <Link className="ui-btn ui-btn--primary" to="/events">
          {t("home.hero.events")}
        </Link>

        <Link className="ui-btn ui-btn--ghost" to="/events">
          {t("home.hero.rankings")}
        </Link>
      </div>
    </section>
  );
}

function Statystyki({ events }) {
  const t = useT();

  const suma = liczby(events);

  // Licznik odwiedzin osobno od reszty: te liczby przychodza z /events, a ta
  // z wlasnego zapytania. Gdy padnie, kafelek po prostu znika - trzy pozostale
  // statystyki nie maja powodu czekac na licznik ani znikac razem z nim.
  const [odwiedziny, setOdwiedziny] = useState(null);

  useEffect(() => {
    let anulowane = false;

    getVisitStats()
      .then((dane) => {
        if (!anulowane) setOdwiedziny(dane);
      })
      .catch(() => {
        // Cisza jest tu zamierzona - patrz komentarz wyzej.
      });

    return () => {
      anulowane = true;
    };
  }, []);

  if (!suma.turnieje) return null;

  return (
    <div className="ui-stats">
      <div className="ui-stat ui-stat--featured">
        <span className="ui-stat__label">{t("home.stats.players")}</span>
        <strong className="ui-stat__value">{suma.gracze}</strong>
        <span className="ui-stat__hint">{t("home.stats.playersHint")}</span>
      </div>

      <div className="ui-stat">
        <span className="ui-stat__label">{t("home.stats.events")}</span>
        <strong className="ui-stat__value">{suma.turnieje}</strong>
        <span className="ui-stat__hint">{t("home.stats.eventsHint")}</span>
      </div>

      <div className="ui-stat">
        <span className="ui-stat__label">{t("home.stats.matches")}</span>
        <strong className="ui-stat__value">{suma.mecze}</strong>
        <span className="ui-stat__hint">{t("home.stats.matchesHint")}</span>
      </div>

      {odwiedziny && (
        <div className="ui-stat">
          <span className="ui-stat__label">{t("home.stats.visits")}</span>
          <strong className="ui-stat__value">{odwiedziny.total}</strong>
          <span className="ui-stat__hint">
            {t("home.stats.visitsToday", { count: odwiedziny.today })}
          </span>
        </div>
      )}
    </div>
  );
}

function KartaTurnieju({ event }) {
  const t = useT();

  // Ta sama reguła co na liście eventów. Wcześniej stała tu własna kopia,
  // opierająca się na is_archived zamiast na statusie - turniej zakończony,
  // ale jeszcze niezarchiwizowany, pokazywał się jako "Zaplanowany".
  const stan = eventState(event);

  return (
    <Link
      className="ui-card ui-card--interactive ui-tile"
      to={`/events/${event.slug}`}
    >
      <div className="ui-row ui-row--between ui-row--full">
        <span className={EVENT_STATE_BADGE[stan]}>
          {t(EVENT_STATE_KEY[stan])}
        </span>

        {event.guild?.name && (
          <span className="ui-stat__hint">{event.guild.name}</span>
        )}
      </div>

      <strong className="ui-tile__name">{event.name}</strong>

      <div className="ui-row ui-row--wrap ui-tile__meta">
        <span className="ui-badge">
          {t("common.playersCount", { count: event.participants })}
        </span>

        {Number(event.matches_count) > 0 && (
          <span className="ui-badge">
            {t("common.matchesCount", { count: event.matches_count })}
          </span>
        )}
      </div>
    </Link>
  );
}

function Turnieje({ events, loading, blad }) {
  const t = useT();

  if (loading) {
    return (
      <div
        className="ui-stats"
        aria-busy="true"
        aria-label={t("common.loadingEvents")}
      >
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

        <strong className="ui-empty__title">{t("home.empty.title")}</strong>

        <p className="ui-empty__text">{t("home.empty.text")}</p>
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
  const t = useT();

  const [serwery, setSerwery] = useState(null);
  const [blad, setBlad] = useState("");

  useEffect(() => {
    let anulowane = false;

    (async () => {
      try {
        const dane = await getAdminServers();

        // Serwer bez jednego turnieju nie ma czego pokazać odwiedzającemu,
        // a na liście wygląda jak zaproszenie donikąd - tak trafiał tam "Test
        // Server" z zerem turniejów. Filtr jest po danych, nie po nazwie:
        // następny testowy serwer nazwie się inaczej.
        if (!anulowane) {
          const widoczne = (dane.servers ?? []).filter(
            (s) => Number(s.events_count) > 0,
          );

          setSerwery(widoczne);
        }
      } catch (err) {
        console.error("SERVERS ERROR:", err);

        if (!anulowane) setBlad(err.message || t("home.servers.error"));
      }
    })();

    return () => {
      anulowane = true;
    };
  }, [t]);

  if (blad || (serwery && !serwery.length)) return null;

  return (
    <section className="ui-stack ui-stack--loose">
      <div className="ui-section-head">
        <div>
          <span className="ui-kicker">{t("home.servers.kicker")}</span>
          <h2>{t("home.servers.title")}</h2>
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
                  {t("common.eventsCount", { count: serwer.events_count })}
                </span>

                {serwer.open_events > 0 && (
                  <span className="ui-badge ui-badge--live">
                    {t("home.servers.open", { count: serwer.open_events })}
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
                  {t("home.servers.join")}
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
  const t = useT();

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

        if (!anulowane) setBlad(err.message || t("common.eventsError"));
      } finally {
        if (!anulowane) setLoading(false);
      }
    })();

    return () => {
      anulowane = true;
    };
  }, [t]);

  return (
    <main className="ui-page">
      <Hero />

      {!loading && !blad && <Statystyki events={events} />}

      <section className="ui-stack ui-stack--loose">
        <div className="ui-section-head">
          <div>
            <span className="ui-kicker">{t("home.events.kicker")}</span>
            <h2>{t(eventsHeadingKey(events))}</h2>
          </div>

          <Link className="ui-btn ui-btn--ghost ui-btn--sm" to="/events">
            {t("home.allEvents")}
          </Link>
        </div>

        <Turnieje events={events} loading={loading} blad={blad} />
      </section>

      <Serwery />
    </main>
  );
}

export default HomePage;
