import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getAdminServers } from "../lib/api.js";
import { odmien } from "../lib/odmiana.js";

// Lista serwerów była dostępna wyłącznie w panelu admina, za logowaniem -
// zwykły odwiedzający nie miał jak sprawdzić, gdzie bot w ogóle działa.
async function pobierzSerwery() {
  const dane = await getAdminServers();

  return dane.servers ?? [];
}

function Serwery() {
  const [serwery, setSerwery] = useState(null);
  const [blad, setBlad] = useState("");

  useEffect(() => {
    let anulowane = false;

    (async () => {
      try {
        const lista = await pobierzSerwery();

        if (!anulowane) setSerwery(lista);
      } catch (err) {
        console.error("SERVERS ERROR:", err);

        if (!anulowane) setBlad(err.message || "Nie udało się pobrać serwerów.");
      }
    })();

    return () => {
      anulowane = true;
    };
  }, []);

  // Sekcja jest dodatkiem do strony głównej, więc przy błędzie albo braku
  // serwerów po prostu jej nie ma - lepsze niż pusta ramka z komunikatem.
  if (blad || (serwery && !serwery.length)) return null;

  return (
    <section className="home-servers">
      <span className="home-kicker">Gdzie działa bot</span>

      <h2>Serwery</h2>

      {!serwery && <p className="home-servers__stan">Wczytywanie...</p>}

      {serwery && (
        <div className="home-servers__lista">
          {serwery.map((serwer) => (
            <article className="home-server" key={serwer.guild_id}>
              <strong>{serwer.name}</strong>

              <span className="home-server__liczby">
                {serwer.events_count}{" "}
                {odmien(serwer.events_count, "turniej", "turnieje", "turniejów")}
                {serwer.open_events > 0 && (
                  <em className="home-server__otwarte">
                    {serwer.open_events} w trakcie
                  </em>
                )}
              </span>

              {serwer.discord_url && (
                <a
                  className="home-server__link"
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
  return (
    <main className="home-page">
      <section className="home-hero">
        <div className="home-hero__content">
          <span className="home-kicker">CS2 Pick&apos;Em</span>

          <h1>
            Typuj.
            <span> Rywalizuj.</span>
            <span> Wygrywaj.</span>
          </h1>

          <p>
            Typuj mecze CS2, przewiduj wyniki map i zdobywaj punkty razem ze
            społecznością PickEmBot.
          </p>

          <div className="home-actions">
            <Link className="home-button home-button--primary" to="/events">
              Zobacz eventy
            </Link>

            <Link className="home-button home-button--secondary" to="/events">
              Ranking
            </Link>
          </div>
        </div>

        <div className="home-preview">
          <div className="home-preview__top">
            <span>Przykładowy mecz</span>
            <strong>BO3</strong>
          </div>

          <div className="home-preview__event">PickEmBot Major</div>

          <div className="home-preview__team">
            <div>
              <span className="home-team-logo">A</span>

              <div>
                <strong>Team Alpha</strong>
                <small>Twój typ</small>
              </div>
            </div>

            <b>2</b>
          </div>

          <div className="home-preview__vs">VS</div>

          <div className="home-preview__team">
            <div>
              <span className="home-team-logo home-team-logo--blue">B</span>

              <div>
                <strong>Team Bravo</strong>
                <small>Twój typ</small>
              </div>
            </div>

            <b>1</b>
          </div>

          <div className="home-preview__maps">
            <div>
              <span>Mapa 1</span>
              <strong>13 : 8</strong>
            </div>

            <div>
              <span>Mapa 2</span>
              <strong>9 : 13</strong>
            </div>

            <div>
              <span>Mapa 3</span>
              <strong>13 : 11</strong>
            </div>
          </div>
        </div>
      </section>

      <Serwery />
    </main>
  );
}

export default HomePage;
