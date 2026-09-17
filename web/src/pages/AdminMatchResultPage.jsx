import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { apiRequest, getMatch, getMatchExactResult } from "../lib/api.js";
import BackLink from "../components/BackLink.jsx";
import ScoreLine from "../components/ScoreLine.jsx";
import { useT } from "../i18n/useLanguage.js";
import { useAuth } from "../auth/useAuth.js";
import Ladowanie from "../components/Ladowanie.jsx";

function validateCs2Score(a, b) {
  const scoreA = Number(a);
  const scoreB = Number(b);

  if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB)) {
    return false;
  }

  if (scoreA < 0 || scoreB < 0 || scoreA === scoreB) {
    return false;
  }

  const winner = Math.max(scoreA, scoreB);
  const loser = Math.min(scoreA, scoreB);

  // Regulaminowy wynik MR12: 13:0 - 13:11
  if (winner === 13) {
    return loser >= 0 && loser <= 11;
  }

  // Dogrywki: 16:12-14, 19:15-17, 22:18-20 itd.
  if (winner >= 16 && (winner - 16) % 3 === 0) {
    return loser >= winner - 4 && loser <= winner - 2;
  }

  return false;
}

function AdminMatchResultPage() {
  const t = useT();

  const { matchId } = useParams();
  const { user, canAccessAdmin, authLoading } = useAuth();

  // Strona nie miała żadnej kontroli uprawnień - komponent RequireAdmin,
  // który to robił, zniknął przy przepisywaniu frontu. Zapis był bezpieczny
  // (requireGuildAdmin na serwerze), ale każdy zalogowany widział pełny
  // formularz wpisywania oficjalnego wyniku.
  //
  // "sprawdzanie" -> "ok" | "brak". Ostateczną odpowiedź daje serwer:
  // getMatch() jest za requireGuildAdmin, więc 403 = brak uprawnień do
  // TEGO meczu, nawet jeśli użytkownik jest adminem gdzie indziej.
  const [dostep, setDostep] = useState("sprawdzanie");

  // Wstępny filtr po stronie klienta. Ostateczną odpowiedź i tak daje serwer:
  // getMatch() jest za requireGuildAdmin, więc admin innego serwera dostanie
  // 403 i wyląduje w tym samym ekranie "brak uprawnień".
  const mozeBycAdmin = !authLoading && Boolean(user) && canAccessAdmin;

  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // Czy ostatni komunikat to sukces. Osobno od jego treści, bo ton
  // plakietki nie może zależeć od brzmienia zdania - patrz niżej.
  const [udane, setUdane] = useState(false);

  function pokazBlad(tekst) {
    setUdane(false);
    setMessage(tekst);
  }
  const [match, setMatch] = useState(null);

  const [mapScores, setMapScores] = useState([
    { exactA: "", exactB: "" },
    { exactA: "", exactB: "" },
    { exactA: "", exactB: "" },
    { exactA: "", exactB: "" },
    { exactA: "", exactB: "" },
  ]);

  function updateMapScore(index, side, value) {
    setMapScores((current) =>
      current.map((map, mapIndex) =>
        mapIndex === index
          ? {
              ...map,
              [side]: value,
            }
          : map,
      ),
    );
  }

  useEffect(() => {
    async function loadMatch() {
      try {
        const [matchData, resultData] = await Promise.all([
          getMatch(matchId),
          getMatchExactResult(matchId),
        ]);

        const loadedMatch = matchData.match ?? matchData;

        setMatch(loadedMatch);
        setDostep("ok");

        if (Number(loadedMatch.best_of) === 1) {
          const map = resultData.maps?.[0];

          setScoreA(
            map?.exactA !== null && map?.exactA !== undefined
              ? String(map.exactA)
              : "",
          );

          setScoreB(
            map?.exactB !== null && map?.exactB !== undefined
              ? String(map.exactB)
              : "",
          );
        } else {
          setMapScores((current) =>
            current.map((map, index) => {
              const savedMap = resultData.maps?.find(
                (item) => Number(item.mapNo) === index + 1,
              );

              return {
                exactA:
                  savedMap?.exactA !== null && savedMap?.exactA !== undefined
                    ? String(savedMap.exactA)
                    : "",
                exactB:
                  savedMap?.exactB !== null && savedMap?.exactB !== undefined
                    ? String(savedMap.exactB)
                    : "",
              };
            }),
          );
        }
      } catch (err) {
        console.error("MATCH LOAD ERROR:", err);
        setDostep("brak");
      }
    }

    // Bez logowania albo bez uprawnień nigdzie - nie ma po co pytać serwera.
    // Ten przypadek wyliczamy przy renderze (mozeBycAdmin), a nie ustawiamy
    // stanu w efekcie - synchroniczne setState w efekcie wywołuje kaskadę
    // renderów i jest łapane przez react-hooks/set-state-in-effect.
    if (!mozeBycAdmin) return;

    loadMatch();
  }, [matchId, mozeBycAdmin]);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!match) {
      return;
    }

    try {
      setSaving(true);
      setUdane(false);
      setMessage("");

      const bestOf = Number(match.best_of);
      const requiredWins = Math.ceil(bestOf / 2);

      const maps =
        bestOf === 1
          ? [
              {
                mapNo: 1,
                exactA: Number(scoreA),
                exactB: Number(scoreB),
              },
            ]
          : mapScores
              .map((map, index) => ({
                mapNo: index + 1,
                exactA: map.exactA,
                exactB: map.exactB,
              }))
              .filter((map) => map.exactA !== "" && map.exactB !== "")
              .map((map) => ({
                ...map,
                exactA: Number(map.exactA),
                exactB: Number(map.exactB),
              }));

      if (!maps.length) {
        pokazBlad(t("adminResult.needOneMap"));
        return;
      }

      if (
        maps.some(
          (map) =>
            !Number.isFinite(map.exactA) ||
            !Number.isFinite(map.exactB) ||
            map.exactA < 0 ||
            map.exactB < 0,
        )
      ) {
        pokazBlad(t("adminResult.badNumbers"));
        return;
      }

      if (maps.some((map) => !validateCs2Score(map.exactA, map.exactB))) {
        pokazBlad(t("adminResult.badScore"));
        return;
      }

      if (maps.some((map) => map.exactA === map.exactB)) {
        pokazBlad(t("adminResult.noDraw"));
        return;
      }

      const winsA = maps.filter((map) => map.exactA > map.exactB).length;

      const winsB = maps.filter((map) => map.exactB > map.exactA).length;

      let runningWinsA = 0;
      let runningWinsB = 0;
      let seriesEndedAt = null;

      for (let i = 0; i < maps.length; i += 1) {
        if (maps[i].exactA > maps[i].exactB) {
          runningWinsA += 1;
        } else {
          runningWinsB += 1;
        }

        if (runningWinsA === requiredWins || runningWinsB === requiredWins) {
          seriesEndedAt = i + 1;
          break;
        }
      }

      if (seriesEndedAt !== null && maps.length > seriesEndedAt) {
        pokazBlad(t("adminResult.seriesOver", { map: seriesEndedAt }));
        return;
      }

      if (winsA < requiredWins && winsB < requiredWins) {
        pokazBlad(
          t("adminResult.seriesUnfinished", {
            bo: bestOf,
            wins: requiredWins,
          }),
        );
        return;
      }

      await apiRequest(`/matches/${matchId}/exact`, {
        method: "POST",
        body: JSON.stringify({ maps }),
      });

      setUdane(true);
      setMessage(t("adminResult.saved"));
    } catch (err) {
      console.error("RESULT SAVE ERROR:", err);

      pokazBlad(err.message || t("adminResult.saveError"));
    } finally {
      setSaving(false);
    }
  }

  const bestOf = Number(match?.best_of ?? 0);

  const liveMaps =
    bestOf === 1
      ? scoreA !== "" && scoreB !== ""
        ? [
            {
              exactA: Number(scoreA),
              exactB: Number(scoreB),
            },
          ]
        : []
      : mapScores
          .slice(0, bestOf)
          .filter((map) => map.exactA !== "" && map.exactB !== "")
          .map((map) => ({
            exactA: Number(map.exactA),
            exactB: Number(map.exactB),
          }));

  const liveWinsA = liveMaps.filter((map) => map.exactA > map.exactB).length;

  const liveWinsB = liveMaps.filter((map) => map.exactB > map.exactA).length;

  const liveRequiredWins = bestOf > 0 ? Math.ceil(bestOf / 2) : 0;

  const liveWinner =
    liveWinsA >= liveRequiredWins
      ? match?.team_a
      : liveWinsB >= liveRequiredWins
        ? match?.team_b
        : null;

  let liveSeriesEndedAt = null;
  let runningLiveWinsA = 0;
  let runningLiveWinsB = 0;

  for (let i = 0; i < liveMaps.length; i += 1) {
    if (liveMaps[i].exactA > liveMaps[i].exactB) {
      runningLiveWinsA += 1;
    } else if (liveMaps[i].exactB > liveMaps[i].exactA) {
      runningLiveWinsB += 1;
    }

    if (
      runningLiveWinsA >= liveRequiredWins ||
      runningLiveWinsB >= liveRequiredWins
    ) {
      liveSeriesEndedAt = i + 1;
      break;
    }
  }

  if (authLoading) {
    return (
      <main className="ui-page">
        <p>{t("adminResult.checking")}</p>
      </main>
    );
  }

  if (mozeBycAdmin && dostep === "sprawdzanie") {
    return (
      <main className="ui-page">
        <Ladowanie>{t("adminResult.loading")}</Ladowanie>
      </main>
    );
  }

  if (!mozeBycAdmin || dostep === "brak") {
    return (
      <main className="ui-page">
        <BackLink to="/">{t("notFound.home")}</BackLink>

        <div className="ui-empty">
          <span className="ui-empty__icon" aria-hidden="true">
            🚫
          </span>

          <strong className="ui-empty__title">
            {t("adminResult.noAccess")}
          </strong>

          <p className="ui-empty__text">{t("adminResult.noAccessText")}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="ui-page">
      <BackLink to="/admin">{t("adminResult.backToPanel")}</BackLink>
      <div className="ui-section-head">
        <div>
          <span className="ui-kicker">
            {t("adminResult.kicker", { no: matchId })}
          </span>

          <h2>{t("adminResult.title")}</h2>

          {match && (
            <p>
              {match.team_a} vs {match.team_b} · BO{match.best_of}
            </p>
          )}
        </div>
      </div>

      {match && (
        <section className="ui-card ui-stack ui-stack--tight">
          <span className="ui-kicker">{t("adminResult.seriesScore")}</span>

          <ScoreLine
            teamA={match.team_a}
            teamB={match.team_b}
            scoreA={liveWinsA}
            scoreB={liveWinsB}
          />

          {liveWinner ? (
            <span className="ui-badge ui-badge--accent">🏆 {liveWinner}</span>
          ) : (
            <span className="ui-hint">{t("adminResult.stillRunning")}</span>
          )}
        </section>
      )}

      <form className="ui-stack" onSubmit={handleSubmit}>
        {Number(match?.best_of) === 1 ? (
          <div className="ui-score">
            <label className="ui-field">
              <span className="ui-field__label">
                {match?.team_a ?? "Team A"}
              </span>

              <input
                className="ui-field__input"
                type="number"
                min="0"
                value={scoreA}
                onChange={(event) => setScoreA(event.target.value)}
              />
            </label>

            <span className="ui-score__separator">:</span>

            <label className="ui-field">
              <span className="ui-field__label">
                {match?.team_b ?? "Team B"}
              </span>

              <input
                className="ui-field__input"
                type="number"
                min="0"
                value={scoreB}
                onChange={(event) => setScoreB(event.target.value)}
              />
            </label>
          </div>
        ) : (
          <div className="ui-stack">
            {mapScores
              .slice(0, Number(match?.best_of) || 0)
              .map((map, index) => {
                const mapNo = index + 1;

                const disabled =
                  liveSeriesEndedAt !== null && mapNo > liveSeriesEndedAt;

                const teamAWon =
                  map.exactA !== "" &&
                  map.exactB !== "" &&
                  Number(map.exactA) > Number(map.exactB);

                const teamBWon =
                  map.exactA !== "" &&
                  map.exactB !== "" &&
                  Number(map.exactB) > Number(map.exactA);

                return (
                  <div
                    className="ui-card ui-card--flat ui-card--tight ui-stack ui-stack--tight"
                    key={index}
                  >
                    <span className="ui-kicker">
                      {t("common.mapNo", { no: mapNo })}
                      {disabled && t("adminResult.notPlayed")}
                    </span>

                    <div className="ui-score">
                      <label
                        className={`ui-field ${teamAWon ? "ui-field--winner" : ""}`}
                      >
                        <span className="ui-field__label">{match?.team_a}</span>

                        <input
                          className="ui-field__input"
                          type="number"
                          min="0"
                          value={map.exactA}
                          disabled={disabled}
                          onChange={(event) =>
                            updateMapScore(index, "exactA", event.target.value)
                          }
                        />
                      </label>

                      <span className="ui-score__separator">:</span>

                      <label
                        className={`ui-field ${teamBWon ? "ui-field--winner" : ""}`}
                      >
                        <span className="ui-field__label">{match?.team_b}</span>

                        <input
                          className="ui-field__input"
                          type="number"
                          min="0"
                          value={map.exactB}
                          disabled={disabled}
                          onChange={(event) =>
                            updateMapScore(index, "exactB", event.target.value)
                          }
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        <button
          className="ui-btn ui-btn--primary"
          type="submit"
          disabled={saving}
        >
          {saving ? t("admin.saving") : t("adminResult.save")}
        </button>
      </form>

      {message && (
        // Ton komunikatu bierze się z osobnego stanu, a nie z porównania
        // treści: po przetłumaczeniu strony to samo zdanie brzmi inaczej
        // w każdym języku, a porównanie napisu cicho przestałoby trafiać
        // i sukces malowałby się na czerwono.
        <p
          className={`ui-note ${udane ? "ui-note--ok" : "ui-note--danger"}`}
        >
          {message}
        </p>
      )}
    </main>
  );
}

export default AdminMatchResultPage;
