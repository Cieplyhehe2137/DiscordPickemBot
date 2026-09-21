import { useEffect, useState } from "react";
import BackLink from "../components/BackLink.jsx";
import { T } from "../i18n/T.jsx";
import { Link, useOutletContext, useParams } from "react-router-dom";

import { getEventLeaderboard } from "../lib/api.js";
import { useAuth } from "../auth/useAuth.js";
import { useT } from "../i18n/useLanguage.js";

// Rozbicie punktów na fazy. Wcześniej sklejane w jeden szary ciąg
// ("Swiss 42 · Playoffs 4"), w którym nie dało się nic wyłowić wzrokiem.
//
// Nazwy etapów zostają po angielsku we wszystkich językach - tak nazywają
// je organizatorzy. Tłumaczenia wymaga tylko "Mecze"; "MVP" jest skrótem
// i też zostaje.
function rozbicieNaFazy(player, t) {
  return [
    ["Swiss", player.swiss_points],
    ["Play-In", player.playin_points],
    ["Playoffs", player.playoffs_points],
    ["Double Elim", player.doubleelim_points],
    [t("leaderboard.split.matches"), player.phase_match_points],
    ["MVP", player.mvp_points],
  ].filter(([, punkty]) => Number(punkty) > 0);
}

// Klasa miejsca na podium. Tablica, a nie sklejanie `ui-row-item--${rank}`:
// przy sklejaniu nazwa nie wystepuje w kodzie doslownie, wiec narzedzie do
// usuwania martwego CSS nie widzi jej jako uzywanej i skasowaloby cale
// podium razem z medalami.
const PODIUM = {
  1: " ui-row-item--1",
  2: " ui-row-item--2",
  3: " ui-row-item--3",
};

// Dwie osie tej samej tabeli. Nazwy jadą do serwera jako ?porzadek=, więc
// literówka nie wywraca niczego - po cichu wraca układ punktowy. Stała
// zamiast napisu w trzech miejscach.
const PO_PUNKTACH = "punkty";
const PO_SKUTECZNOSCI = "skutecznosc";

/**
 * Tłum: co dałoby typowanie zawsze tego, co większość.
 *
 * Jedyna liczba na tej stronie, która daje pozostałym skalę. Zmierzone
 * w IEM Cologne: taki gracz-widmo trafiłby 71 zwycięzców ze 106, czyli 67%,
 * i byłby CZTERNASTY wśród 48 osób, które przeszły z nim turniej - trzynaścioro
 * czyta mecze lepiej niż sam środek ciężkości ich wszystkich. W IEM Kraków
 * jest odwrotnie: tłum trafił 26 z 50, niewiele ponad rzut monetą, i pobiły
 * go czterdzieści cztery osoby z sześćdziesięciu jeden.
 *
 * Stawka jest mała celowo. Stało tu wcześniej „#6 z 410" - miejsce w liczbie
 * TRAFIEŃ wśród wszystkich, którzy oddali choć jeden typ. Obie liczby były
 * prawdziwe i obie mówiły za dużo: tłum typuje każdy mecz, a 163 z tych 410
 * osób oddało dokładnie jeden typ.
 */
function TlumKontraLudzie({ tlum, slug }) {
  const t = useT();

  const pobili = tlum.beatenBy ?? [];

  // Ilu pokazać z imienia. Przy pięciu nazwiska są treścią, przy
  // dwudziestu siedmiu - ścianą; wtedy liczy się sama liczba.
  const ILU_Z_IMIENIA = 5;

  return (
    <section className="ui-card ui-stack crowd-baseline">
      <div className="ui-section-head">
        <div>
          <span className="ui-kicker">{t("crowd.kicker")}</span>

          <h2>{t("crowd.title")}</h2>

          <p>{t("crowd.intro")}</p>
        </div>
      </div>

      <div className="ui-stats ui-stats--4">
        <div className="ui-stat ui-stat--featured">
          <span>{t("crowd.stat.correct")}</span>
          <strong>
            {tlum.correct}/{tlum.matches}
          </strong>
          <small>{t("common.percentValue", { percent: tlum.accuracy })}</small>
        </div>

        <div className="ui-stat">
          <span>{t("crowd.stat.place")}</span>
          <strong>#{tlum.rank}</strong>

          {/* Bez „+1". Stawka to te same czterdzieści osiem osób, co w kafelku
              obok - dwie sąsiadujące liczby („z 49" i „z 48") czytały się jak
              pomyłka, a nie jak rozróżnienie. Trzynaścioro lepszych i miejsce
              czternaste w stawce czterdziestu ośmiu zgadza się ze sobą. */}
          <small>{t("crowd.stat.ofPlayers", { count: tlum.players })}</small>
        </div>

        <div className="ui-stat">
          <span>{t("crowd.stat.beatenBy")}</span>
          <strong>{pobili.length}</strong>
          <small>{t("crowd.stat.ofPlayers", { count: tlum.players })}</small>
        </div>
      </div>

      {pobili.length > 0 && pobili.length <= ILU_Z_IMIENIA && (
        <div className="ui-row ui-row--wrap">
          <span className="ui-stat__hint">{t("crowd.whoBeat")}</span>

          {pobili.map((gracz) => (
            <Link
              className="ui-badge ui-badge--accent"
              key={gracz.user_id}
              to={`/events/${slug}/player/${gracz.user_id}`}
            >
              {gracz.displayname || gracz.user_id} ·{" "}
              {t("common.percentValue", { percent: gracz.accuracy })}
            </Link>
          ))}
        </div>
      )}

      {/* KIM JEST TYCH CZTERDZIEŚCI OSIEM OSÓB. Bez tego zdania "#14 z 48"
          przy turnieju, który ma 523 sklasyfikowanych, wygląda na pomyłkę. */}
      {tlum.threshold > 0 && (
        <p className="ui-note">
          {t("crowd.field", {
            threshold: tlum.threshold,
            all: tlum.matches,
          })}
        </p>
      )}

      {/* TO NIE JEST STRATEGIA, KTÓRĄ KTOŚ MÓGŁ ZASTOSOWAĆ - i strona ma to
          powiedzieć wprost, zanim ktoś słusznie zapyta, skąd miał wiedzieć,
          co wybierze większość. */}
      <p className="ui-note">{t("crowd.disclaimer")}</p>
    </section>
  );
}

function LeaderboardPage() {
  const t = useT();

  const { slug } = useParams();
  const { realtimeRefresh } = useOutletContext();
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState([]);
  const [uczestnicy, setUczestnicy] = useState(0);
  const [meczow, setMeczow] = useState(0);
  const [strony, setStrony] = useState(null);
  const [tlum, setTlum] = useState(null);
  const [stawka, setStawka] = useState(null);

  // Którą osią ułożona jest tabela. Trzymane razem z turniejem, tak samo
  // jak numer strony - inaczej wejście na turniej bez rozstrzygniętych
  // meczów zostawiłoby wybraną skuteczność, której tam nie ma.
  const [wybranyPorzadek, setWybranyPorzadek] = useState({
    slug,
    czym: PO_PUNKTACH,
  });

  const porzadek = wybranyPorzadek.slug === slug ? wybranyPorzadek.czym : PO_PUNKTACH;

  const poSkutecznosci = porzadek === PO_SKUTECZNOSCI;

  // Numer strony trzymamy razem z turniejem, dla którego go wybrano.
  // Dzięki temu wejście na inny turniej wraca na stronę 1 samo, bez
  // zerowania stanu w efekcie (to wywołuje kaskadę renderów).
  const [wybranaStrona, setWybranaStrona] = useState({ slug, numer: 1 });

  const strona = wybranaStrona.slug === slug ? wybranaStrona.numer : 1;

  const idzDoStrony = (numer) => setWybranaStrona({ slug, numer });

  // To, co wpisano, i to, czego faktycznie szukamy, to dwie różne rzeczy -
  // bez odczekania każde naciśnięcie klawisza byłoby osobnym zapytaniem.
  const [wpisane, setWpisane] = useState("");
  const [szukane, setSzukane] = useState({ slug, fraza: "" });

  const szukaj = szukane.slug === slug ? szukane.fraza : "";

  // Skok do własnego miejsca: serwer sam liczy, na której stronie stoi gracz.
  const [znajdz, setZnajdz] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const licznik = setTimeout(() => {
      setSzukane({ slug, fraza: wpisane.trim() });
      setWybranaStrona({ slug, numer: 1 });
    }, 350);

    return () => clearTimeout(licznik);
  }, [wpisane, slug]);

  useEffect(() => {
    async function loadLeaderboard() {
      try {
        setLoading(true);
        setError(null);

        const data = await getEventLeaderboard(slug, {
          strona,
          szukaj,
          znajdz,

          // Punkty to układ domyślny, więc nie doklejamy go do adresu -
          // inaczej każde wejście na ranking ma w URL-u parametr, który
          // niczego nie zmienia.
          porzadek: porzadek === PO_SKUTECZNOSCI ? porzadek : undefined,
        });

        setLeaderboard(data.leaderboard ?? []);
        setUczestnicy(Number(data.uczestnicy) || 0);
        setMeczow(Number(data.meczow) || 0);
        setStrony(data.strony ?? null);
        setTlum(data.tlum ?? null);
        setStawka(data.skutecznosc ?? null);

        // Skok jest jednorazowy - inaczej każde kliknięcie "Następna"
        // wracałoby na stronę z naszym miejscem.
        if (znajdz && data.strony?.numer) {
          setWybranaStrona({ slug, numer: data.strony.numer });
          setZnajdz(null);
        }
      } catch (err) {
        console.error("LEADERBOARD ERROR:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadLeaderboard();
  }, [slug, strona, szukaj, znajdz, porzadek]);

  useEffect(() => {
    if (!realtimeRefresh?.version) {
      return;
    }

    const payload = realtimeRefresh.payload;

    if (payload?.slug && String(payload.slug) !== String(slug)) {
      return;
    }

    async function refreshLeaderboard() {
      try {
        const data = await getEventLeaderboard(slug, {
          strona,
          szukaj,
          porzadek: porzadek === PO_SKUTECZNOSCI ? porzadek : undefined,
        });

        setLeaderboard(data.leaderboard ?? []);
        setUczestnicy(Number(data.uczestnicy) || 0);
        setMeczow(Number(data.meczow) || 0);
        setStrony(data.strony ?? null);
        setTlum(data.tlum ?? null);
        setStawka(data.skutecznosc ?? null);
        setError(null);
      } catch (err) {
        console.error("LEADERBOARD REALTIME REFRESH ERROR:", err);
      }
    }

    refreshLeaderboard();
  }, [realtimeRefresh, slug, strona, szukaj, porzadek]);

  // Szkielet zamiast spinnera: lista od razu pokazuje, ile wierszy będzie,
  // więc układ nie skacze w chwili, gdy dane dojdą.
  if (loading) {
    return (
      <main className="ui-page">
        <div className="ui-section-head">
          <div>
            <span className="ui-kicker">{t("leaderboard.kicker")}</span>
            <h2>{t("leaderboard.title")}</h2>
          </div>
        </div>

        <div
          className="ui-table"
          aria-busy="true"
          aria-label={t("leaderboard.loading")}
        >
          {Array.from({ length: 8 }, (_, i) => (
            <div className="ui-skeleton ui-skeleton--row" key={i} />
          ))}
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="ui-page">
        <div className="ui-error" role="alert">
          <span className="ui-error__icon" aria-hidden="true">
            ⚠️
          </span>

          <strong className="ui-error__title">{t("leaderboard.error")}</strong>

          <p className="ui-error__text">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="ui-page">
      <div className="ui-section-head">
        <div>
          <span className="ui-kicker">{t("leaderboard.kicker")}</span>

          <h2>{t("leaderboard.title")}</h2>

          {/* Tylko przy punktach. W widoku skuteczności ta sama liczba
              znaczyłaby co innego - "48 graczy w klasyfikacji" przy 523
              sklasyfikowanych jest po prostu nieprawdą, bo czterdziestu
              ośmiu to STAWKA tej tabeli, a nie klasyfikacja turnieju.
              Kto jest w stawce, mówi wprost notatka pod przełącznikiem. */}
          {!poSkutecznosci && strony?.wRankingu > 0 && (
            <p>{t("leaderboard.ranked", { count: strony.wRankingu })}</p>
          )}
        </div>

        <BackLink to={`/events/${slug}`} />
      </div>

      {/* Przy 500 graczach na 11 stronach jedyną drogą do własnego miejsca
          było klikanie "Następna" dziewięć razy. */}
      <div className="ui-row ui-row--wrap leaderboard-search">
        <input
          type="search"
          value={wpisane}
          onChange={(e) => setWpisane(e.target.value)}
          placeholder={t("common.searchPlayer")}
          aria-label={t("common.searchPlayerLabel")}
        />

        {user?.id && (
          <button
            type="button"
            className="ui-btn ui-btn--sm"
            onClick={() => setZnajdz(user.id)}
          >
            {t("leaderboard.findMe")}
          </button>
        )}

        {/* Wejście w rywali prosto stąd. Sekcja siedzi na profilu gracza,
            czyli dwa kliknięcia dalej, i nic w rankingu nie mówiło, że coś
            takiego w ogóle jest.

            Kotwica #rywale, bo sekcja stoi nisko na profilu; przewinięcie
            do niej robi sam komponent, gdy dane dojdą - patrz Rivals.jsx.

            Tylko dla zalogowanego: bez tego nie wiadomo, czyich rywali
            pokazać. */}
        {user?.id && (
          <Link
            className="ui-btn ui-btn--sm"
            to={`/events/${slug}/player/${user.id}#rywale`}
          >
            ⚔️ {t("leaderboard.myRivals")}
          </Link>
        )}
      </div>

      {szukaj && strony && (
        <p className="ui-stat__hint">
          {strony.wszystkich > 0 ? (
            <T
              k="leaderboard.foundOf"
              vars={{
                found: <strong>{strony.wszystkich}</strong>,
                count: strony.wRankingu,
              }}
            />
          ) : (
            <T
              k="leaderboard.noMatch"
              vars={{ query: <strong>{szukaj}</strong> }}
            />
          )}
        </p>
      )}

      {/* POPRZECZKA DLA WSZYSTKICH LICZB W TABELI.
          Ranking mówi, kto był lepszy od kogo. Nie mówi, czy ktokolwiek był
          lepszy od najprostszego możliwego sposobu typowania. */}
      {tlum?.matches > 0 && <TlumKontraLudzie tlum={tlum} slug={slug} />}

      {/* DRUGA OŚ TEJ SAMEJ TABELI.
          Punkty rosną z każdym oddanym typem, więc ranking punktowy w dużej
          mierze mierzy obecność - zmierzone w Kolonii: mediana typującego
          pominęła 103 ze 106 meczów. Przełącznik pokazuje tych samych ludzi
          ułożonych po odsetku trafień, gdzie piąty wynik turnieju należy do
          kogoś, kto punktowo stoi czterdziesty piąty.

          Pokazuje się tylko tam, gdzie jest co przełączać: w turnieju
          z samych faz (StarLadder Budapest 2025) stawka jest pusta. */}
      {stawka?.players > 0 && (
        <div
          className="ui-switcher"
          role="group"
          aria-label={t("leaderboard.order.label")}
        >
          {[
            [PO_PUNKTACH, "leaderboard.order.points"],
            [PO_SKUTECZNOSCI, "leaderboard.order.accuracy"],
          ].map(([czym, klucz]) => (
            <button
              type="button"
              key={czym}
              className="ui-switcher__opt"
              aria-pressed={porzadek === czym}
              onClick={() => {
                if (porzadek === czym) return;

                setWybranyPorzadek({ slug, czym });
                setWybranaStrona({ slug, numer: 1 });
              }}
            >
              {t(klucz)}
            </button>
          ))}
        </div>
      )}

      {poSkutecznosci && (
        <div className="ui-stack accuracy-note">
          <p>{t("leaderboard.accuracy.intro")}</p>

          <p className="ui-note">
            {t("leaderboard.accuracy.field", {
              count: stawka?.players ?? 0,
              threshold: stawka?.threshold ?? 0,
              all: meczow,
            })}
          </p>

          {/* „Znajdź mnie" u kogoś spoza stawki nie ma dokąd skoczyć.
              Bez tego zdania wygląda to na zepsuty guzik. */}
          {strony?.pozaStawka && (
            <p className="ui-note ui-note--danger">
              {t("leaderboard.accuracy.outside")}
            </p>
          )}
        </div>
      )}

      {leaderboard.length === 0 ? (
        <div className="ui-empty">
          <span className="ui-empty__icon" aria-hidden="true">
            {uczestnicy > 0 ? "⏳" : "🎯"}
          </span>

          {uczestnicy > 0 ? (
            <>
              <strong className="ui-empty__title">
                {t("leaderboard.notStarted.title")}
              </strong>

              <p className="ui-empty__text">
                {t("leaderboard.notStarted.text", { count: uczestnicy })}
              </p>
            </>
          ) : (
            <>
              <strong className="ui-empty__title">
                {t("leaderboard.nobody.title")}
              </strong>

              <p className="ui-empty__text">{t("leaderboard.nobody.text")}</p>
            </>
          )}
        </div>
      ) : (
        <div className="ui-table leaderboard-table">
          <div className="ui-table__head" aria-hidden="true">
            <span>#</span>
            <span>{t("leaderboard.head.player")}</span>
            <span>{t("leaderboard.head.breakdown")}</span>
            <span>
              {poSkutecznosci
                ? t("leaderboard.head.accuracy")
                : t("leaderboard.head.points")}
            </span>
          </div>

          {leaderboard.map((player) => {
            // Miejsce bierzemy z pola rank, policzonego po stronie serwera na
            // pełnej liście. Wcześniej szło z indeksu w tablicy, więc każda
            // strona zaczynała się od pierwszego miejsca i medali.
            const podium = PODIUM[player.rank] ?? "";

            const ja =
              user?.id && String(user.id) === String(player.user_id)
                ? " ui-row-item--me"
                : "";

            const fazy = rozbicieNaFazy(player, t);

            return (
              <div
                className={`ui-row-item ui-row-item--link${podium}${ja}`}
                key={player.user_id}
              >
                <span className="ui-row-item__rank">{player.rank}</span>

                <Link
                  className="ui-row-item__who"
                  to={`/events/${slug}/player/${player.user_id}`}
                >
                  {/* Awatar zawsze zajmuje miejsce - bez tego wiersze graczy
                      bez awatara były węższe i lista falowała.

                      Bez awatara idzie inicjał, tak samo jak na stronie
                      eventu i w profilu gracza. Wcześniej była tu pusta
                      szara kropka, więc ta sama osoba miała w rankingu
                      krążek bez znaku, a piętro wyżej literę - a awatara
                      nie ma dziś 1108 z 1110 graczy, więc to był widok
                      domyślny, nie wyjątek. */}
                  {player.avatar ? (
                    <img
                      className="ui-avatar"
                      src={`https://cdn.discordapp.com/avatars/${player.user_id}/${player.avatar}.png?size=64`}
                      alt=""
                      loading="lazy"
                    />
                  ) : (
                    <span className="ui-avatar ui-avatar--initials">
                      {player.displayname?.[0]?.toUpperCase() ?? "?"}
                    </span>
                  )}

                  <span className="ui-row-item__stack">
                    <span className="ui-row-item__name">
                      {player.displayname ?? player.user_id}
                    </span>

                    {/* Z ILU TYPOW wzial sie ten wynik.

                        Bez tego dwa sasiednie miejsca wygladaja na
                        wyrownana walke rownych graczy: #38 ma 187 pkt
                        z 99 typow przy 54% trafien, #39 ma 181 pkt
                        z 60 typow przy 67%.

                        Znika tam, gdzie nie ma meczow - w turnieju
                        zlozonym z samych faz (StarLadder Budapest 2025)
                        kazdy mialby tu zero, a zero mowiloby nieprawde
                        o kims, kto wytypowal wszystkie trzy etapy. */}
                    {meczow > 0 && (
                      <span className="ui-row-item__sub">
                        {/* W widoku skuteczności odsetek stoi już w kolumnie
                            obok, więc powtarzanie go tutaj byłoby stratą
                            miejsca. Idzie za to MIEJSCE PUNKTOWE - bez niego
                            nie widać, że piąta skuteczność turnieju należy
                            do kogoś z czterdziestego piątego miejsca, a to
                            jest cała informacja, po którą się tu przychodzi. */}
                        {poSkutecznosci ? (
                          <>
                            {t("leaderboard.picks", {
                              done: player.total_predictions,
                              all: meczow,
                            })}

                            {player.points_rank ? (
                              <>
                                {" · "}
                                {t("leaderboard.pointsRank", {
                                  rank: player.points_rank,
                                })}
                              </>
                            ) : null}
                          </>
                        ) : player.total_predictions > 0 ? (
                          t("leaderboard.picksHit", {
                            done: player.total_predictions,
                            all: meczow,
                            percent: player.accuracy,
                          })
                        ) : (
                          t("leaderboard.picks", { done: 0, all: meczow })
                        )}
                      </span>
                    )}
                  </span>
                </Link>

                <div className="ui-row-item__meta">
                  {fazy.length > 0 ? (
                    fazy.map(([nazwa, punkty]) => (
                      <span className="ui-badge" key={nazwa}>
                        {nazwa} {punkty}
                      </span>
                    ))
                  ) : (
                    <span>{t("leaderboard.noPoints")}</span>
                  )}
                </div>

                {/* W widoku skuteczności liczbą wiersza jest odsetek
                    trafień - punkty stoją wtedy pod nazwą, jako miejsce
                    w tamtej tabeli. */}
                <strong className="ui-row-item__score">
                  {poSkutecznosci
                    ? t("common.percentValue", { percent: player.accuracy })
                    : Number(player.total_points ?? 0)}
                </strong>
              </div>
            );
          })}
        </div>
      )}

      {/* Pasek stron pokazuje się dopiero, gdy jest co przewijać. */}
      {strony && strony.ile > 1 && (
        <nav
          className="ui-row ui-row--between leaderboard-pages"
          aria-label={t("leaderboard.pages")}
        >
          <button
            type="button"
            className="ui-btn ui-btn--ghost ui-btn--sm"
            disabled={strona <= 1}
            onClick={() => idzDoStrony(strona - 1)}
          >
            {t("leaderboard.prev")}
          </button>

          <span className="ui-stat__hint">
            <T
              k="leaderboard.pageOf"
              vars={{
                page: <strong>{strony.numer}</strong>,
                total: strony.ile,
              }}
            />
          </span>

          <button
            type="button"
            className="ui-btn ui-btn--ghost ui-btn--sm"
            disabled={strona >= strony.ile}
            onClick={() => idzDoStrony(strona + 1)}
          >
            {t("leaderboard.next")}
          </button>
        </nav>
      )}
    </main>
  );
}

export default LeaderboardPage;
