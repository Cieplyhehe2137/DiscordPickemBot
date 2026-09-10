import { Link } from "react-router-dom";

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
    </main>
  );
}

export default HomePage;
