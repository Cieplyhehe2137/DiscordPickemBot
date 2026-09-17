import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getAllEvents } from "../lib/api.js";
import { humanPhase } from "../lib/phaseLabels.js";
import {
  EVENT_STATE_BADGE,
  EVENT_STATE_KEY,
  eventState,
} from "../lib/eventState.js";
import { useT } from "../i18n/useLanguage.js";

function EventCard({ event }) {
  const t = useT();

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

        <span className="ui-stat__hint">{humanPhase(event.phase, t)}</span>
      </div>

      <strong className="ui-tile__name">{event.name}</strong>

      <div className="ui-row ui-row--wrap ui-tile__meta">
        {event.participants > 0 && (
          <span className="ui-badge">
            {t("common.playersCount", { count: event.participants })}
          </span>
        )}

        {event.matches_count > 0 && (
          <span className="ui-badge">
            {t("common.matchesCount", { count: event.matches_count })}
          </span>
        )}
      </div>
    </Link>
  );
}

function EventsPage() {
  const t = useT();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadEvents() {
      try {
        // getAllEvents zamiast getActiveEvents: /events/active odfiltrowuje
        // wszystko poza trwającym turniejem, więc zakończone Pick'Emy nie
        // miały z UI żadnego wejścia, mimo że ich podstrony działają.
        const data = await getAllEvents();

        setEvents(data.events ?? []);
      } catch (err) {
        console.error("EVENTS ERROR:", err);

        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadEvents();
  }, []);

  // Trzy kubełki zamiast dwóch. Wcześniej wszystko, co nie było live,
  // wpadało do "Zakończonych" - razem z turniejem, który dopiero czeka na
  // opublikowanie panelu na Discordzie.
  const aktywne = events.filter((event) => eventState(event) === "live");
  const wkrotce = events.filter((event) => eventState(event) === "upcoming");
  const zakonczone = events.filter((event) => eventState(event) === "finished");

  return (
    <main className="ui-page">
      <div className="ui-section-head">
        <div>
          <span className="ui-kicker">{t("events.kicker")}</span>

          <h2>{t("events.title")}</h2>

          <p>{t("events.intro")}</p>
        </div>
      </div>

      {loading && (
        <div
          className="ui-tiles"
          aria-busy="true"
          aria-label={t("common.loadingEvents")}
        >
          {Array.from({ length: 3 }, (_, i) => (
            <div className="ui-skeleton ui-skeleton--row" key={i} />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="ui-error" role="alert">
          <span className="ui-error__icon" aria-hidden="true">
            ⚠️
          </span>

          <strong className="ui-error__title">{t("events.error")}</strong>

          <p className="ui-error__text">{error}</p>
        </div>
      )}

      {!loading && !error && events.length === 0 && (
        <div className="ui-empty">
          <span className="ui-empty__icon" aria-hidden="true">
            🏆
          </span>

          <strong className="ui-empty__title">
            {t("events.empty.title")}
          </strong>

          <p className="ui-empty__text">{t("events.empty.text")}</p>
        </div>
      )}

      {!loading && !error && aktywne.length > 0 && (
        <section className="ui-stack ui-stack--loose">
          <div className="ui-section-head">
            <div>
              <span className="ui-kicker">{t("events.live.kicker")}</span>
              <h2>{t("events.live.title")}</h2>
            </div>
          </div>

          <div className="ui-tiles">
            {aktywne.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      )}

      {!loading && !error && wkrotce.length > 0 && (
        <section className="ui-stack ui-stack--loose">
          <div className="ui-section-head">
            <div>
              <span className="ui-kicker">
                {t("events.upcoming.kicker")}
              </span>
              <h2>{t("events.upcoming.title")}</h2>

              <p>{t("events.upcoming.text")}</p>
            </div>
          </div>

          <div className="ui-tiles">
            {wkrotce.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      )}

      {!loading && !error && zakonczone.length > 0 && (
        <section className="ui-stack ui-stack--loose">
          <div className="ui-section-head">
            <div>
              <span className="ui-kicker">
                {t("events.finished.kicker")}
              </span>
              <h2>{t("events.finished.title")}</h2>

              {/* Informacja zamiast osobnej karty "brak aktywnego turnieju" -
                  pusta karta w siatce wyglądała jak zepsuty kafelek. */}
              {aktywne.length === 0 && wkrotce.length === 0 && (
                <p>{t("events.finished.text")}</p>
              )}
            </div>
          </div>

          <div className="ui-tiles">
            {zakonczone.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

export default EventsPage;
