import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useOutletContext,
  useParams,
} from "react-router-dom";

import { getEventPlayerProfile } from "../lib/api.js";
import BackLink from "../components/BackLink.jsx";
import TeamPicks from "../components/TeamPicks.jsx";
import PointsChart from "../components/PointsChart.jsx";
import BadgeShelf from "../components/BadgeShelf.jsx";
import PlayerHistory from "../components/PlayerHistory.jsx";
import PlayerPicker from "../components/PlayerPicker.jsx";
import Rivals from "../components/Rivals.jsx";
import { humanPhase } from "../lib/phaseLabels.js";
import { useT } from "../i18n/useLanguage.js";

/**
 * Jedna decyzja: mecz, drużyna i to, ilu jeszcze tak myślało.
 *
 * Nazwa drużyny, a nie strona - „postawił na A" nie znaczy nic dla kogoś,
 * kto ogląda profil pół roku po turnieju.
 */
function Decyzja({ mecz, slug, t }) {
  return (
    <li className="decision">
      {/* Odnośnik jest BEZPOŚREDNIM dzieckiem wiersza, i to nie jest
          kosmetyka: rozciągnięcie niżej stoi na `> a:only-of-type`, więc
          przy odnośniku schowanym o poziom głębiej reguła po prostu nie
          trafiała - klikalna zostawała sama nazwa meczu, a reszta wiersza
          wyglądała na klikalną i nie była. Zmierzone w przeglądarce. */}
      <Link
        className="decision__what"
        to={`/events/${slug}/matches/${mecz.match_id}`}
      >
        <span className="decision__match">
          {mecz.team_a} – {mecz.team_b}
        </span>

        <span className="decision__pick">
          {t("decisions.pick", { team: mecz.picked })}
          {mecz.phase ? ` · ${humanPhase(mecz.phase, t)}` : ""}
        </span>
      </Link>

      {/* Zero procent dostaje własne zdanie. „Razem z nim 0% z 53" brzmi
          jak usterka zaokrąglenia, a jest najmocniejszym wynikiem w tej
          sekcji: był jedyną osobą na pięćdziesiąt trzy. */}
      <span className="decision__support">
        {mecz.support > 0
          ? t("decisions.support", { percent: mecz.support, count: mecz.voters })
          : t("decisions.alone", { count: mecz.voters })}
      </span>
    </li>
  );
}

/** Dwie kolumny decyzji: trafione wbrew wszystkim i przegrane w samotności. */
function Decyzje({ decyzje, slug }) {
  const t = useT();

  const najlepsze = decyzje?.best ?? [];
  const najgorsze = decyzje?.worst ?? [];

  // Komplet nowicjusza potrafi nie mieć ani jednej samotnej decyzji -
  // wtedy nie ma o czym pisać i sekcja znika w całości, zamiast stać
  // pusta pod nagłówkiem.
  if (najlepsze.length === 0 && najgorsze.length === 0) return null;

  return (
    <div className="ui-card ui-card--flat ui-card--tight ui-stack decisions">
      <div>
        <strong>{t("decisions.title")}</strong>

        <p className="ui-stat__hint">{t("decisions.intro")}</p>
      </div>

      <div className="decisions__cols">
        {[
          ["best", najlepsze, "decisions.best"],
          ["worst", najgorsze, "decisions.worst"],
        ]
          .filter(([, lista]) => lista.length > 0)
          .map(([klucz, lista, naglowek]) => (
            <div className={`decisions__col decisions__col--${klucz}`} key={klucz}>
              <span className="ui-kicker">{t(naglowek)}</span>

              <ul className="decisions__list">
                {lista.map((mecz) => (
                  <Decyzja key={mecz.match_id} mecz={mecz} slug={slug} t={t} />
                ))}
              </ul>
            </div>
          ))}
      </div>

      <p className="ui-note">
        {t("decisions.note", { count: decyzje?.voters ?? 0 })}
      </p>
    </div>
  );
}

function PlayerProfilePage() {
  const t = useT();

  const { slug, userId } = useParams();
  const { realtimeRefresh } = useOutletContext();
  const navigate = useNavigate();

  // Okno wyboru przeciwnika do porownania.
  const [wybierakOtwarty, setWybierakOtwarty] = useState(false);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedMatchId, setExpandedMatchId] = useState(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        setLoading(true);
        setError("");

        const data = await getEventPlayerProfile(slug, userId);

        setProfile(data);
      } catch (err) {
        setError(err.message || t("profile.errorText"));
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [slug, userId, t]);

  useEffect(() => {
    if (!realtimeRefresh?.version) {
      return;
    }

    const payload = realtimeRefresh.payload;

    if (payload?.slug && String(payload.slug) !== String(slug)) {
      return;
    }

    async function refreshProfile() {
      try {
        const data = await getEventPlayerProfile(slug, userId);

        setProfile(data);
        setError("");
      } catch (err) {
        console.error("PLAYER PROFILE REALTIME REFRESH ERROR:", err);
      }
    }

    refreshProfile();
  }, [realtimeRefresh, slug, userId]);

  if (loading) {
    return (
      <main className="ui-page">
        <div
          className="ui-stats ui-stats--4"
          aria-busy="true"
          aria-label={t("profile.loading")}
        >
          {Array.from({ length: 6 }, (_, i) => (
            <div className="ui-skeleton ui-skeleton--row" key={i} />
          ))}
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="ui-page">
        <BackLink to={`/events/${slug}/leaderboard`}>
          {t("profile.backToLeaderboard")}
        </BackLink>

        <div className="ui-error" role="alert">
          <span className="ui-error__icon" aria-hidden="true">
            ⚠️
          </span>

          <strong className="ui-error__title">{t("profile.error")}</strong>

          <p className="ui-error__text">{error}</p>
        </div>
      </main>
    );
  }

  if (!profile?.profile) {
    return (
      <main className="ui-page">
        <BackLink to={`/events/${slug}/leaderboard`}>
          {t("profile.backToLeaderboard")}
        </BackLink>

        <div className="ui-empty">
          <span className="ui-empty__icon" aria-hidden="true">
            🔎
          </span>

          <strong className="ui-empty__title">
            {t("profile.missing.title")}
          </strong>

          <p className="ui-empty__text">{t("profile.missing.text")}</p>
        </div>
      </main>
    );
  }

  const player = profile.profile;

  const averagePoints =
    player.finished_predictions > 0
      ? (
          Number(player.total_points ?? 0) / Number(player.finished_predictions)
        ).toFixed(1)
      : "0.0";

  const mapAccuracy =
    player.predicted_maps > 0
      ? Math.round(
          (Number(player.correct_maps ?? 0) / Number(player.predicted_maps)) *
            100,
        )
      : 0;

  const exactMapPercentage =
    player.predicted_maps > 0
      ? Math.round(
          (Number(player.exact_maps ?? 0) / Number(player.predicted_maps)) *
            100,
        )
      : 0;

  // CZY W TYM STARCIE SĄ W OGÓLE MECZE.
  //
  // Cała górna połowa tej strony liczy mecze i tylko mecze, a klasyfikacja
  // turnieju sumuje sześć składowych. Zmierzone na produkcji: 708 z 1294
  // wpisów gracz-turniej nie ma ani jednego wiersza w match_points -
  // dostawały „0.0 pkt / mecz", „Skuteczność 0% — 0 / 0 meczów", pusty
  // wykres i trzy zera w seriach, tuż pod prawdziwą sumą punktów.
  //
  // Pierwsze miejsce StarLadder Budapest 2025 ma 47 punktów i siedem
  // kafelków z zerem.
  const maMecze = Number(player.total_predictions ?? 0) > 0;

  const fazy = profile?.phase_points ?? null;

  const wobecTlumu = profile?.vs_crowd ?? null;

  // Skąd wzięła się liczba wyżej: mecze, w których ten gracz odszedł
  // od reszty. Te same wiersze, co `vs_crowd` - jedno zapytanie na oba.
  const decyzje = profile?.decisions ?? null;

  // Jak ten gracz typuje, a nie ile trafil: 2:0 to typ pewny, 2:1 to typ
  // z wahaniem. Wynik serii nie daje w tym turnieju ani jednego punktu.
  const pewnosc = profile?.confidence ?? null;

  // Druga strona tego samego turnieju: mecze, ktore rozstrzygnely sie
  // bez jego typu. Caly serwis liczy to, co ktos zrobil.
  const nieobecnosc = profile?.absence ?? null;

  const przebiegFaz = (fazy?.progress ?? []).map((p) => ({
    ...p,
    label: humanPhase(p.stage ?? p.phase, t),
  }));

  const przebiegMeczow = player.points_progress ?? [];

  const zEtapow = przebiegMeczow.length === 0 && przebiegFaz.length > 0;

  return (
    <main className="ui-page">
      <div className="ui-row ui-row--between ui-row--wrap ui-row--full">
        <BackLink to={`/events/${slug}/leaderboard`}>
          {t("profile.backToLeaderboard")}
        </BackLink>

        <button
          type="button"
          className="ui-btn ui-btn--accent ui-btn--sm"
          onClick={() => setWybierakOtwarty(true)}
        >
          ⚔️ {t("profile.compare")}
        </button>
      </div>

      {/* Montowane dopiero przy otwarciu - dzięki temu wpisana fraza
          i wyniki szukania giną same przy zamknięciu. */}
      {wybierakOtwarty && (
        <PlayerPicker
          slug={slug}
          excludeUserId={userId}
          onClose={() => setWybierakOtwarty(false)}
          onPick={(gracz) => {
            setWybierakOtwarty(false);
            navigate(`/events/${slug}/h2h/${userId}/${gracz.user_id}`);
          }}
        />
      )}

      <section className="ui-card ui-stack">
        <div className="ui-row ui-row--wrap">
          {/* Awatar mają tylko gracze z wiersza w user_profiles - reszta
              dostaje inicjał, żeby nagłówek nie skakał. */}
          {player.avatar ? (
            <img
              className="ui-avatar ui-avatar--xl"
              src={`https://cdn.discordapp.com/avatars/${player.user_id}/${player.avatar}.png?size=128`}
              alt=""
            />
          ) : (
            <span className="ui-avatar ui-avatar--xl ui-avatar--initials">
              {player.displayname?.[0] ?? "?"}
            </span>
          )}

          <div>
            <span className="ui-kicker">{t("profile.kicker")}</span>

            <h2>{player.displayname}</h2>

            {/* Droga W GÓRĘ, do dorobku ponad turniejami. Klasyfikacja
                wszech czasów i niespodzianki prowadzą tam i dalej w dół,
                na tę stronę - ale kto wszedł tu z rankingu turnieju, nie
                miał skąd się dowiedzieć, że tamta strona istnieje.

                W nagłówku, a nie w sekcji z innymi startami: tamta nie
                pojawia się dla 85% graczy, którzy zagrali raz - a dorobek
                ponad turniejami ma dla nich sens tak samo, bo pokazuje
                typy na drużyny i chodzenie pod prąd. */}
            <Link
              className="ui-btn ui-btn--ghost ui-btn--sm"
              to={`/player/${userId}`}
            >
              {t("profile.career")} →
            </Link>
          </div>
        </div>

        <div className="ui-stats ui-stats--4">
          <div className="ui-stat ui-stat--featured">
            <span>{t("profile.points")}</span>
            <strong>{player.total_points}</strong>

            {/* „0.0 pkt / mecz" pod prawdziwą sumą punktów to nie jest
                skromna liczba, tylko zaprzeczenie kafelka, w którym stoi. */}
            {maMecze && (
              <small>{t("profile.pointsPerMatch", { value: averagePoints })}</small>
            )}
          </div>

          <div className="ui-stat">
            <span>{t("profile.rank")}</span>
            <strong>{player.rank > 0 ? `#${player.rank}` : "—"}</strong>
          </div>

          {/* Reszta kafelków liczy WYŁĄCZNIE mecze. Bez nich nie ma z czego
              ich policzyć - i nie ma po co pokazywać sześciu zer. */}
          {maMecze && (
            <>
              <div className="ui-stat">
                <span>{t("profile.accuracy")}</span>
                <strong>{player.accuracy}%</strong>
                <small>
                  {t("profile.accuracyHint", {
                    correct: player.correct_winners,
                    count: player.finished_predictions,
                  })}
                </small>
              </div>

              <div className="ui-stat">
                <span>{t("profile.exactMaps")}</span>
                <strong>{player.exact_maps}</strong>
                <small>
                  {t("profile.exactMapsHint", { percent: exactMapPercentage })}
                </small>
              </div>

              <div className="ui-stat">
                <span>{t("profile.correctMaps")}</span>
                <strong>{player.correct_maps}</strong>
                <small>
                  {t("profile.correctMapsHint", { percent: mapAccuracy })}
                </small>
              </div>

              <div className="ui-stat">
                <span>{t("profile.bestMatch")}</span>
                <strong>{player.best_match_points ?? 0}</strong>
                <small>{t("profile.bestMatchHint")}</small>
              </div>

              <div className="ui-stat">
                <span>{t("profile.seriesPoints")}</span>
                <strong>{player.series_points ?? 0}</strong>
              </div>

              <div className="ui-stat">
                <span>{t("profile.mapPoints")}</span>
                <strong>{player.map_points ?? 0}</strong>
              </div>
            </>
          )}
        </div>
      </section>

      {/* PUNKTY Z FAZ.
          Osobna sekcja, a nie kafelki dorzucone wyżej: tamte mówią o
          meczach, te o typach na całą fazę - inne pytanie i inna skala.
          Dla gracza bez meczów to jedyne miejsce, które w ogóle tłumaczy
          jego wynik. */}
      {fazy?.groups?.length > 0 && (
        <section className="ui-card ui-stack">
          <div className="ui-section-head">
            <div>
              <span className="ui-kicker">{t("profile.phase.kicker")}</span>

              <h2>{t("profile.phase.title")}</h2>

              <p>{t("profile.phase.intro")}</p>
            </div>
          </div>

          {!maMecze && (
            <div className="ui-empty">
              <span className="ui-empty__icon" aria-hidden="true">
                🗓️
              </span>

              <strong className="ui-empty__title">
                {t("profile.noMatches.title")}
              </strong>

              <p className="ui-empty__text">{t("profile.noMatches.text")}</p>
            </div>
          )}

          <div className="ui-stats ui-stats--4">
            <div className="ui-stat ui-stat--featured">
              <span>{t("profile.phase.total")}</span>
              <strong>{fazy.total}</strong>
            </div>

            {fazy.groups.map((g) => (
              <div className="ui-stat" key={g.phase}>
                <span>{humanPhase(g.phase, t)}</span>
                <strong>{g.points}</strong>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Starty w innych turniejach zaraz pod nazwiskiem, bo mówią,
          KTO to jest, a nie jak mu poszło tutaj. Dla 85% graczy sekcja
          nie pojawia się wcale - tylu zagrało w jednym turnieju. */}
      <PlayerHistory events={profile?.other_events} userId={userId} />

      {/* Odznaki zaraz za statystykami, bo są ich podsumowaniem -
          nazwą nadaną liczbom, które stoją wyżej. */}
      <BadgeShelf profile={player} maMecze={maMecze} />

      {/* Wykres stoi PRZED seriami, bo mówi to samo, tylko obrazkiem:
          gdzie szło dobrze, a gdzie się posypało. Serie pod spodem
          podają tę samą rzecz liczbą. */}
      <section className="ui-card ui-stack">
        <div className="ui-section-head">
          <div>
            <span className="ui-kicker">{t("profile.progress.kicker")}</span>

            <h2>{t("profile.progress.title")}</h2>
          </div>
        </div>

        {/* Gdy nie ma ani jednego rozliczonego meczu, przebieg rysuja
            ETAPY. U pierwszego miejsca Budapesztu to 12 -> 28 -> 40 -> 47,
            czyli dokladnie ta historia, ktorej wykres ma dotyczyc -
            a ktora do tej pory konczyla sie pustym miejscem. */}
        <PointsChart
          kind={zEtapow ? "phase" : "match"}
          series={[
            {
              side: "a",
              name: player.displayname,
              points: zEtapow ? przebiegFaz : przebiegMeczow,
            },
          ]}
          caption={t(
            zEtapow
              ? "profile.progress.captionPhase"
              : "profile.progress.caption",
          )}
        />
      </section>

      {/* Serie liczy sie z ciagu rozliczonych meczow - bez meczow to
          trzy zera pod naglowkiem „Forma gracza". */}
      {/* WOBEC TŁUMU.
          Cała reszta profilu mówi, ile ten człowiek trafił. To jedyne
          miejsce, które mówi, czy jego własny osąd cokolwiek dołożył do
          osądu grupy - a zmierzone w Kolonii, u 75% graczy nie dołożył nic.

          Sekcja pojawia się dopiero od dwudziestu meczów: niżej różnica
          jednego trafienia to szum, a stałaby obok liczb z setki meczów. */}
      {wobecTlumu?.enough && (
        <section className="ui-card ui-stack">
          <div className="ui-section-head">
            <div>
              <span className="ui-kicker">{t("crowd.kicker")}</span>

              <h2>{t("crowd.player.title")}</h2>

              <p>{t("crowd.player.intro")}</p>
            </div>
          </div>

          <div className="ui-stats ui-stats--4">
            <div
              className={`ui-stat ui-stat--featured crowd-gap crowd-gap--${
                wobecTlumu.advantage > 0
                  ? "over"
                  : wobecTlumu.advantage < 0
                    ? "under"
                    : "even"
              }`}
            >
              <span>{t("crowd.player.gap")}</span>

              <strong>
                {wobecTlumu.advantage > 0 ? "+" : ""}
                {wobecTlumu.advantage}
              </strong>

              <small>
                {t("crowd.player.gapHint", { count: wobecTlumu.matches })}
              </small>
            </div>

            <div className="ui-stat">
              <span>{t("crowd.player.you")}</span>
              <strong>{wobecTlumu.correct}</strong>
              <small>{t("crowd.player.ofMatches", { count: wobecTlumu.matches })}</small>
            </div>

            <div className="ui-stat">
              <span>{t("crowd.player.crowd")}</span>
              <strong>{wobecTlumu.crowd}</strong>
              <small>{t("crowd.player.ofMatches", { count: wobecTlumu.matches })}</small>
            </div>
          </div>

          {/* SKĄD WZIĘŁA SIĘ TA LICZBA.
              Suma wyżej jest prawdziwa, ale niewidoczna - bierze się
              z kilku decyzji, nie ze stu sześciu. Zmierzone w Kolonii:
              tylko 8% typów (504 z 6405) oddano wbrew trzem czwartym
              stawki; reszta to chodzenie z tłumem, gdzie wszyscy
              dostają to samo. */}
          <Decyzje decyzje={decyzje} slug={slug} />

          <p className="ui-note">{t("crowd.disclaimer")}</p>
        </section>
      )}

      {/* KOLUMNA, KTÓRA NIE DAJE ANI JEDNEGO PUNKTU.
          Wynik serii jest w tym turnieju nieoceniany - płaci się wyłącznie
          za zwycięzcę - a niesie najmocniejszy sygnał w całej tabeli:
          zmierzone na wszystkich turniejach, typy 2:0 trafiają zwycięzcę
          w 67%, a 2:1 w 52%. Osobna sekcja, bo to jest pytanie o SPOSÓB
          typowania, a nie o wynik. */}
      {pewnosc?.enough && (
        <section className="ui-card ui-stack">
          <div className="ui-section-head">
            <div>
              <span className="ui-kicker">{t("confidence.kicker")}</span>

              <h2>{t("confidence.title")}</h2>

              <p>{t("confidence.intro")}</p>
            </div>
          </div>

          <div className="ui-stats ui-stats--4">
            <div className="ui-stat">
              <span>{t("confidence.sure")}</span>

              <strong>
                {t("common.percentValue", { percent: pewnosc.sure.accuracy })}
              </strong>

              <small>{t("confidence.ofPicks", { count: pewnosc.sure.picks })}</small>
            </div>

            <div className="ui-stat">
              <span>{t("confidence.close")}</span>

              <strong>
                {t("common.percentValue", { percent: pewnosc.close.accuracy })}
              </strong>

              <small>{t("confidence.ofPicks", { count: pewnosc.close.picks })}</small>
            </div>

            {/* Znak niesie kierunek, kolor tylko go wzmacnia - ta sama
                zasada, co przy przewadze nad tłumem. */}
            <div
              className={`ui-stat ui-stat--featured crowd-gap crowd-gap--${
                pewnosc.gap > 0 ? "over" : pewnosc.gap < 0 ? "under" : "even"
              }`}
            >
              <span>{t("confidence.gap")}</span>

              <strong>
                {pewnosc.gap > 0 ? "+" : ""}
                {pewnosc.gap}
              </strong>

              <small>{t("confidence.gapHint")}</small>
            </div>
          </div>

          {/* Jedyny przypadek, w którym ta sekcja mówi komuś coś, czego
              nie wie. Reszta dostaje potwierdzenie własnego wyczucia. */}
          {pewnosc.inverted && (
            <p className="ui-note ui-note--danger">{t("confidence.inverted")}</p>
          )}

          {/* BEZ TEGO ZDANIA sekcja czyta się jak „bądź pewny siebie,
              a będziesz trafiał", czyli jak przyczynowość, której w tych
              danych nie ma. */}
          <p className="ui-note">
            {t("confidence.note", { count: pewnosc.threshold })}
          </p>
        </section>
      )}

      {/* CO PRZESZLO OBOK.
          Sekcja wyzej mowi, jak ten czlowiek wypadl na meczach, ktore
          wytypowal. Ta mowi o tych, ktorych nie - a to w tych danych nie
          jest margines: zmierzone w Kolonii, mediana typujacego pominela
          103 ze 106 meczow, a komplet wytypowaly cztery osoby. */}
      {nieobecnosc?.enough && (
        <section className="ui-card ui-stack">
          <div className="ui-section-head">
            <div>
              <span className="ui-kicker">{t("absence.kicker")}</span>

              <h2>{t("absence.title")}</h2>

              <p>{t("absence.intro")}</p>
            </div>
          </div>

          <div className="ui-stats ui-stats--4">
            <div className="ui-stat">
              <span>{t("absence.skipped")}</span>

              <strong>{nieobecnosc.skipped}</strong>

              <small>
                {t("absence.ofSettled", { count: nieobecnosc.settled })}
              </small>
            </div>

            <div className="ui-stat ui-stat--featured">
              <span>{t("absence.points")}</span>

              <strong>{nieobecnosc.points}</strong>

              <small>{t("absence.pointsHint")}</small>
            </div>

            <div className="ui-stat">
              <span>{t("absence.coverage")}</span>

              <strong>
                {t("common.percentValue", { percent: nieobecnosc.coverage })}
              </strong>

              <small>{t("absence.coverageHint")}</small>
            </div>
          </div>

          <p className="ui-stat__hint">
            {t("absence.crowdHit", { count: nieobecnosc.crowdHits })}
          </p>

          {/* BEZ TEGO ZDANIA liczba czyta sie jak krzywda. Wiekszosci nie
              dalo sie znac przed terminem, wiec nie byla to strategia,
              ktora ktokolwiek mogl zastosowac. */}
          <p className="ui-note">{t("absence.note")}</p>
        </section>
      )}

      {maMecze && (
        <section className="ui-card ui-stack">
          <div className="ui-section-head">
            <div>
              <span className="ui-kicker">{t("profile.form.kicker")}</span>

              <h2>{t("profile.form.title")}</h2>
            </div>
          </div>

          <div className="ui-stats ui-stats--4">
            <div className="ui-stat">
              <span>🔥 {t("profile.bestStreak")}</span>
              <strong>{player.best_correct_streak ?? 0}</strong>
              <small>{t("profile.streakHint")}</small>
            </div>

            <div className="ui-stat">
              <span>⚡ {t("profile.currentStreak")}</span>
              <strong>{player.current_correct_streak ?? 0}</strong>
              <small>{t("profile.streakHint")}</small>
            </div>

            <div className="ui-stat">
              <span>💎 {t("profile.perfect")}</span>
              <strong>{player.perfect_matches ?? 0}</strong>
              <small>{t("profile.perfectHint")}</small>
            </div>
          </div>
        </section>
      )}

      {/* Rekordy meczowe. Ta sama zasada: nie ma meczow, nie ma rekordu. */}
      {maMecze && (
        <section className="ui-card ui-stack">
          <div className="ui-section-head">
            <div>
              <span className="ui-kicker">{t("profile.records.kicker")}</span>

              <h2>{t("profile.records.title")}</h2>
            </div>
          </div>

          <div className="ui-card ui-card--flat ui-card--tight ui-stack ui-stack--tight">
            <div className="ui-row ui-row--between ui-row--full">
              <div>
                <strong>🗺️ {t("profile.bestMapScore")}</strong>

                <p className="ui-stat__hint">{t("profile.bestMapScoreHint")}</p>
              </div>

              <span className="ui-count">
                {t("common.pointsValue", {
                  value: player.best_map_match_points ?? 0,
                })}
              </span>
            </div>

            <div className="ui-row ui-row--between ui-row--full">
              <div>
                <strong>📈 {t("profile.avgCorrect")}</strong>

                <p className="ui-stat__hint">{t("profile.avgCorrectHint")}</p>
              </div>

              <span className="ui-count">
                {t("common.pointsValue", {
                  value: Number(
                    player.average_points_correct_match ?? 0,
                  ).toFixed(1),
                })}
              </span>
            </div>
          </div>
        </section>
      )}

      {player.event_comparison && (
        <section className="ui-card ui-stack">
          <div className="ui-section-head">
            <div>
              <span className="ui-kicker">
                {t("profile.comparison.kicker")}
              </span>

              <h2>{t("profile.comparison.title")}</h2>
            </div>
          </div>

          <div className="ui-stats ui-stats--4">
            {[
              {
                label: `🏆 ${t("profile.points")}`,
                data: player.event_comparison.points,
              },
              {
                label: `🎯 ${t("profile.accuracy")}`,
                data: player.event_comparison.accuracy,
              },
              {
                label: `💎 ${t("profile.exactMaps")}`,
                data: player.event_comparison.exact_maps,
              },
              {
                label: `🗺️ ${t("profile.correctMaps")}`,
                data: player.event_comparison.correct_maps,
              },
            ].map((item) => (
              <div className="ui-stat" key={item.label}>
                <span>{item.label}</span>

                <strong>#{item.data?.rank ?? 0}</strong>

                <small>
                  {t("profile.comparison.hint", {
                    total: item.data?.total ?? 0,
                    percent: item.data?.top_percent ?? 0,
                  })}
                </small>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Rywale PO własnych liczbach gracza, a przed szczegółami typów.

          Sekcja pobiera się sama, więc dochodzi na stronę chwilę po reszcie
          - wysoko na stronie przesuwałaby w dół wszystko, co pod nią.
          Tutaj to, co się przesuwa, jest i tak poza ekranem.

          Na górze strony stoi przycisk „Porównaj”, który prowadzi w to samo
          miejsce - ale wymaga, żeby wiedzieć z góry, kogo się szuka. */}
      <Rivals slug={slug} userId={userId} />

      {/* Typy drużyn stoją PRZED historią meczów: dotyczą całego turnieju,
          a nie pojedynczych spotkań, więc czyta się je jako podsumowanie,
          zanim zejdzie się do listy meczów. */}
      <TeamPicks phases={profile?.team_picks} logos={profile?.team_logos} />

      {/* Lista OSTATNICH TYPOW NA MECZE. Pusty stan mowil „Ten gracz nie
          zapisal jeszcze zadnego typu w tym evencie" - nieprawda dla
          kogos, kto typowal same fazy, i to tuz pod sekcja, ktora te
          typy wymienia. */}
      {maMecze && (
        <section className="ui-card ui-stack">
          <div className="ui-section-head">
            <div>
              <span className="ui-kicker">{t("profile.history.kicker")}</span>

              <h2>{t("profile.history.title")}</h2>
            </div>
          </div>

          {player.recent_predictions?.length ? (
            <div className="ui-stack ui-stack--tight">
              {player.recent_predictions.map((prediction) => {
                const finished =
                  prediction.res_a !== null && prediction.res_b !== null;

                const correct =
                  finished &&
                  ((prediction.pred_a > prediction.pred_b &&
                    prediction.res_a > prediction.res_b) ||
                    (prediction.pred_b > prediction.pred_a &&
                      prediction.res_b > prediction.res_a));

                const expanded = expandedMatchId === prediction.match_id;

                return (
                  <div
                    className="ui-card ui-card--flat ui-card--tight"
                    key={prediction.match_id}
                  >
                    <button
                      type="button"
                      className="ui-disclosure"
                      aria-expanded={expanded}
                      onClick={() =>
                        setExpandedMatchId((current) =>
                          current === prediction.match_id
                            ? null
                            : prediction.match_id,
                        )
                      }
                    >
                      <span className="ui-disclosure__icon" aria-hidden="true">
                        {finished ? (correct ? "✅" : "❌") : "⏳"}
                      </span>

                      <span className="ui-disclosure__main">
                        <strong>
                          {prediction.team_a}
                          {" vs "}
                          {prediction.team_b}
                        </strong>

                        <span>
                          {t("profile.pick", {
                            a: prediction.pred_a,
                            b: prediction.pred_b,
                          })}
                          {finished &&
                            t("profile.result", {
                              a: prediction.res_a,
                              b: prediction.res_b,
                            })}
                        </span>
                      </span>

                      <span
                        className={`ui-disclosure__points ${
                          prediction.points > 0
                            ? "ui-disclosure__points--scored"
                            : ""
                        }`}
                      >
                        {t("common.pointsValue", {
                          value:
                            prediction.points > 0
                              ? `+${prediction.points}`
                              : prediction.points,
                        })}
                      </span>

                      <span className="ui-disclosure__chevron" aria-hidden="true">
                        ▾
                      </span>
                    </button>

                    {expanded && (
                      <div className="ui-stack ui-stack--tight">
                        <p className="ui-stat__hint">
                          {t("profile.split", {
                            series: player.series_points,
                            maps: player.map_points,
                          })}
                        </p>

                        {prediction.maps?.length > 0 &&
                          prediction.maps.map((map) => (
                            <div className="ui-map-row" key={map.map_no}>
                              <span className="ui-map-row__label">
                                {t("common.mapNo", { no: map.map_no })}
                              </span>

                              <div className="ui-row ui-row--wrap">
                                <span className="ui-badge">
                                  {t("common.mapPick", {
                                    a: map.pred_a,
                                    b: map.pred_b,
                                  })}
                                </span>

                                <span className="ui-badge">
                                  {t("common.mapResult", {
                                    a: map.res_a,
                                    b: map.res_b,
                                  })}
                                </span>

                                <span
                                  className={`ui-badge ${
                                    map.exact
                                      ? "ui-badge--accent"
                                      : map.correct_winner
                                        ? "ui-badge--ok"
                                        : "ui-badge--danger"
                                  }`}
                                >
                                  {map.exact
                                    ? `🎯 ${t("profile.map.exact")}`
                                    : map.correct_winner
                                      ? `✅ ${t("profile.map.winner")}`
                                      : `❌ ${t("profile.map.miss")}`}
                                </span>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="ui-empty">
              <span className="ui-empty__icon" aria-hidden="true">
                🗒️
              </span>

              <strong className="ui-empty__title">
                {t("profile.empty.title")}
              </strong>

              <p className="ui-empty__text">{t("profile.empty.text")}</p>
            </div>
          )}
        </section>
      )}
    </main>
  );
}

export default PlayerProfilePage;
