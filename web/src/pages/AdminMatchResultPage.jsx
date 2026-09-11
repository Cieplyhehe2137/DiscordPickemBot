import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { apiRequest, getMatch, getMatchExactResult } from "../lib/api.js";
import BackLink from "../components/BackLink.jsx";
import { useAuth } from "../auth/useAuth.js";
import { isAdminAnywhere } from "../lib/permissions.js";
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
  const { matchId } = useParams();
  const { user, authLoading } = useAuth();

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
  const mozeBycAdmin = !authLoading && Boolean(user) && isAdminAnywhere(user);

  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
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
        setMessage("Wpisz przynajmniej jeden wynik mapy.");
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
        setMessage(
          "Wyniki map muszą być poprawnymi liczbami większymi lub równymi 0.",
        );
        return;
      }

      if (maps.some((map) => !validateCs2Score(map.exactA, map.exactB))) {
        setMessage(
          "Nieprawidłowy wynik CS2. Dozwolone np. 13:8, 13:11, 16:13, 19:17.",
        );
        return;
      }

      if (maps.some((map) => map.exactA === map.exactB)) {
        setMessage("Mapa nie może zakończyć się remisem.");
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
        setMessage(
          `Seria zakończyła się po mapie ${seriesEndedAt}. Usuń wyniki kolejnych map.`,
        );
        return;
      }

      if (winsA < requiredWins && winsB < requiredWins) {
        setMessage(
          `Seria BO${bestOf} nie jest zakończona. Jedna z drużyn musi wygrać ${requiredWins} map.`,
        );
        return;
      }

      await apiRequest(`/matches/${matchId}/exact`, {
        method: "POST",
        body: JSON.stringify({ maps }),
      });

      setMessage("Wynik zapisany.");
    } catch (err) {
      console.error("RESULT SAVE ERROR:", err);

      setMessage(err.message || "Nie udało się zapisać wyniku.");
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
      <main className="admin-result-page">
        <p>Sprawdzanie uprawnień...</p>
      </main>
    );
  }

  if (mozeBycAdmin && dostep === "sprawdzanie") {
    return (
      <main className="admin-result-page">
        <Ladowanie>Ładowanie meczu...</Ladowanie>
      </main>
    );
  }

  if (!mozeBycAdmin || dostep === "brak") {
    return (
      <main className="admin-result-page">
        <BackLink to="/">Strona główna</BackLink>

        <h1>Brak uprawnień</h1>

        <p>
          Wpisywanie oficjalnego wyniku wymaga uprawnień administratora na
          serwerze, do którego należy ten mecz.
        </p>
      </main>
    );
  }

  return (
    <main className="admin-result-page">
      <BackLink to="/admin">Wróć do panelu</BackLink>
      <h1>Ustaw wynik meczu</h1>

      <p>Match ID: {matchId}</p>

      {match && (
        <h2>
          {match.team_a} vs {match.team_b} — BO
          {match.best_of}
        </h2>
      )}

      {match && (
        <section className="admin-result-summary">
          <span>Wynik serii</span>

          <strong>
            {match.team_a} {liveWinsA} : {liveWinsB} {match.team_b}
          </strong>

          {liveWinner ? (
            <p className="admin-result-summary__winner">
              🏆 Zwycięzca:
              <strong>{liveWinner}</strong>
            </p>
          ) : (
            <p>Seria jeszcze trwa</p>
          )}
        </section>
      )}

      <form className="admin-result-form" onSubmit={handleSubmit}>
        {Number(match?.best_of) === 1 ? (
          <div className="admin-result-score">
            <label>
              <span>{match?.team_a ?? "Team A"}</span>

              <input
                type="number"
                min="0"
                value={scoreA}
                onChange={(event) => setScoreA(event.target.value)}
              />
            </label>

            <strong>:</strong>

            <label>
              <span>{match?.team_b ?? "Team B"}</span>

              <input
                type="number"
                min="0"
                value={scoreB}
                onChange={(event) => setScoreB(event.target.value)}
              />
            </label>
          </div>
        ) : (
          <div className="admin-result-maps">
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
                  <div className="admin-result-map" key={index}>
                    <span className="admin-result-map__label">
                      Mapa {mapNo}
                      {disabled && " — nie rozegrano"}
                    </span>

                    <div className="admin-result-score">
                      <label
                        className={
                          teamAWon
                            ? "admin-result-score__team admin-result-score__team--winner"
                            : "admin-result-score__team"
                        }
                      >
                        <span>{match?.team_a}</span>

                        <input
                          type="number"
                          min="0"
                          value={map.exactA}
                          disabled={disabled}
                          onChange={(event) =>
                            updateMapScore(index, "exactA", event.target.value)
                          }
                        />
                      </label>

                      <strong>:</strong>

                      <label
                        className={
                          teamBWon
                            ? "admin-result-score__team admin-result-score__team--winner"
                            : "admin-result-score__team"
                        }
                      >
                        <span>{match?.team_b}</span>

                        <input
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

        <button className="admin-result-submit" type="submit" disabled={saving}>
          {saving ? "Zapisywanie..." : "Zapisz wynik"}
        </button>
      </form>

      {message && (
        <p
          className={`admin-feedback ${
            message === "Wynik zapisany."
              ? "admin-feedback--success"
              : "admin-feedback--error"
          }`}
        >
          {message}
        </p>
      )}
    </main>
  );
}

export default AdminMatchResultPage;
