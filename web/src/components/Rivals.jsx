import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import Ladowanie from "./Ladowanie.jsx";
import PlayerAvatar from "./PlayerAvatar.jsx";
import { getPlayerRivals } from "../lib/api.js";
import { useT } from "../i18n/useLanguage.js";

// Rywale gracza w tym turnieju.
//
// Pojedynek dwóch graczy istniał od dawna i jest policzony dobrze - ale
// wchodziło się w niego z JEDNEGO miejsca w całym serwisie i trzeba było
// z góry wiedzieć, czyj profil otworzyć. Zmierzone: par graczy z choć jednym
// wspólnym meczem jest 84 542, a z co najmniej trzydziestoma - 19 421.
// Narzędzie było, materiału pod dostatkiem, a pytanie „z kim właściwie się
// ścigam" nie miało gdzie paść.
//
// SEKCJA POBIERA SIĘ SAMA, osobnym żądaniem. Wiersze potrzebne do bilansu
// liczą się 247 ms (mediana z pięciu prób na produkcji), a profil oddaje
// odpowiedź po jednej podróży do bazy - doklejone do tamtej fali opóźniłyby
// CAŁY profil dla sekcji stojącej na jego końcu.

// Kolor niesie znaczenie, którego sam napis nie niesie: przewaga na zielono,
// strata na czerwono. Nazwy klas stoją tu dosłownie, bo narzędzie do
// usuwania martwego CSS nie widzi nazw sklejanych ze zmiennej.
const KLASA_ODZNAKI = {
  best: "ui-badge ui-badge--ok",
  worst: "ui-badge ui-badge--danger",
  closest: "ui-badge ui-badge--accent",
  most: "ui-badge",
};

function Rivals({ slug, userId }) {
  const t = useT();

  const [dane, setDane] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let aktualne = true;

    async function wczytaj() {
      try {
        setLoading(true);
        setError("");

        const odpowiedz = await getPlayerRivals(slug, userId);

        // Gracz mógł już przejść na inny profil - wtedy ta odpowiedź dotyczy
        // kogoś, kogo nikt już nie ogląda.
        if (aktualne) setDane(odpowiedz);
      } catch (err) {
        if (aktualne) setError(err.message || t("rivals.error"));
      } finally {
        if (aktualne) setLoading(false);
      }
    }

    wczytaj();

    return () => {
      aktualne = false;
    };
  }, [slug, userId, t]);

  if (loading) {
    return (
      <section className="ui-card ui-stack">
        <Ladowanie>{t("rivals.loading")}</Ladowanie>
      </section>
    );
  }

  // Błąd tej sekcji nie może przewrócić profilu - reszta strony jest już
  // na ekranie i działa.
  if (error) {
    return (
      <section className="ui-card ui-stack">
        <p className="ui-note">{t("rivals.error")}</p>
      </section>
    );
  }

  if (!dane) return null;

  const rywale = dane.rivals ?? [];

  const naglowek = (
    <div className="ui-section-head">
      <div>
        <span className="ui-kicker">{t("rivals.kicker")}</span>

        <h2>{t("rivals.title")}</h2>

        <p>{t("rivals.intro")}</p>
      </div>
    </div>
  );

  // Dwa różne braki, dwa różne zdania. „Nikt nie ma z nim tylu meczów"
  // znaczy co innego niż „on nie ma jeszcze żadnych rozliczonych typów",
  // a jedno zdanie na obie sytuacje kłamałoby w połowie przypadków.
  if (rywale.length === 0) {
    return (
      <section className="ui-card ui-stack">
        {naglowek}

        <p className="ui-note">
          {dane.opponents > 0
            ? t("rivals.empty.tooFew", { count: dane.min_decided })
            : t("rivals.empty.none")}
        </p>
      </section>
    );
  }

  const ukryci = dane.total - rywale.length;

  return (
    <section className="ui-card ui-stack">
      {naglowek}

      <div className="ui-table rivals-table">
        <div className="ui-table__head" aria-hidden="true">
          <span />
          <span>{t("rivals.head.player")}</span>
          <span />
          <span>{t("rivals.head.record")}</span>
        </div>

        {rywale.map((rywal) => (
          <div className="ui-row-item" key={rywal.user_id}>
            {/* Nazwa prowadzi tam, gdzie prowadzi w każdej innej liście
                w tym serwisie - na profil. Zmiana celu tylko tutaj byłaby
                zaskoczeniem: ten sam element robiłby co innego niż zwykle. */}
            <Link
              className="ui-row-item__who"
              to={`/events/${slug}/player/${rywal.user_id}`}
            >
              <PlayerAvatar
                userId={rywal.user_id}
                avatar={rywal.avatar}
                name={rywal.displayname}
              />

              <span className="ui-row-item__stack">
                <span className="ui-row-item__name">{rywal.displayname}</span>

                <span className="ui-row-item__sub">
                  {t("rivals.sharedCount", { count: rywal.shared })}
                  {rywal.ties > 0 &&
                    ` · ${t("rivals.ties", { count: rywal.ties })}`}
                </span>
              </span>
            </Link>

            <div className="ui-row-item__meta">
              {rywal.badges.map((odznaka) => (
                <span className={KLASA_ODZNAKI[odznaka]} key={odznaka}>
                  {t(`rivals.badge.${odznaka}`)}
                </span>
              ))}

              <span className="ui-badge">
                {t("common.percentValue", { percent: rywal.win_percent })}
              </span>
            </div>

            {/* Bilans jest odnośnikiem do pojedynku, bo to jego streszczenie:
                klika się w liczbę, żeby zobaczyć, z czego wyszła. Cała ta
                sekcja powstała po to, żeby tamtą stronę dało się znaleźć -
                do tej pory wchodziło się w nią z jednego miejsca w serwisie.

                Strzałka jest potrzebna: bez niej liczba nie wygląda na coś,
                w co można kliknąć. aria-label mówi, dokąd prowadzi - samo
                „10–0" przeczytane na głos nie mówi nic o pojedynku.

                Półpauza, nie łącznik - to bilans, a nie zakres liczb. */}
            <Link
              className="ui-row-item__score rivals-duel"
              to={`/events/${slug}/h2h/${userId}/${rywal.user_id}`}
              aria-label={t("rivals.duel")}
            >
              {rywal.wins}–{rywal.losses}
              <span className="rivals-duel__arrow" aria-hidden="true">
                →
              </span>
            </Link>
          </div>
        ))}
      </div>

      {ukryci > 0 && (
        <p className="ui-note">{t("rivals.more", { count: ukryci })}</p>
      )}

      <p className="ui-note">
        {t("rivals.note", { count: dane.min_decided })}
      </p>
    </section>
  );
}

export default Rivals;
