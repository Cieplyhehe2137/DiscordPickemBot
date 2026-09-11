import { useEffect, useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { useAuth } from "../auth/useAuth.js";

import {
  getPublicMatch,
  getMatch,
  getPublicMatchResult,
  getMatchPrediction,
  saveMatchPrediction,
  getMatchPickStats,
  getMyMatchPoints,
} from "../lib/api.js";
import { getMapLabel } from "../lib/mapLabels.js";
import BackLink from "../components/BackLink.jsx";
import Ladowanie from "../components/Ladowanie.jsx";

function validateCs2Score(a, b) {
  const scoreA = Number(a);
  const scoreB = Number(b);

  if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB)) {
    return false;
  }

  if (scoreA < 0 || scoreB < 0) {
    return false;
  }

  if (scoreA === scoreB) {
    return false;
  }

  const winner = Math.max(scoreA, scoreB);
  const loser = Math.min(scoreA, scoreB);

  // Regulaminowy wynik: 13:x
  if (winner === 13) {
    return loser >= 0 && loser <= 11;
  }

  // Dogrywki: 16:12-14, 19:15-17, 22:18-20 itd.
  if (winner >= 16 && (winner - 16) % 3 === 0) {
    return loser >= winner - 4 && loser <= winner - 2;
  }

  return false;
}

function formatPicksCount(count) {
  const number = Number(count) || 0;

  if (number === 1) {
    return `${number} typ`;
  }

  const lastTwoDigits = number % 100;
  const lastDigit = number % 10;

  if (
    lastDigit >= 2 &&
    lastDigit <= 4 &&
    !(lastTwoDigits >= 12 && lastTwoDigits <= 14)
  ) {
    return `${number} typy`;
  }

  return `${number} typów`;
}

function getMapWinner(scoreA, scoreB) {
  if (!validateCs2Score(scoreA, scoreB)) {
    return null;
  }

  return Number(scoreA) > Number(scoreB) ? "A" : "B";
}

function validateSeries(seriesScore, mapScores, bestOf) {
  if (!seriesScore) {
    return false;
  }

  const expectedScores =
    Number(bestOf) === 3
      ? {
        "2:0": [2, 0],
        "2:1": [2, 1],
        "1:2": [1, 2],
        "0:2": [0, 2],
      }
      : Number(bestOf) === 5
        ? {
          "3:0": [3, 0],
          "3:1": [3, 1],
          "3:2": [3, 2],
          "2:3": [2, 3],
          "1:3": [1, 3],
          "0:3": [0, 3],
        }
        : null;

  if (!expectedScores) {
    return false;
  }

  const expected = expectedScores[seriesScore];

  if (!expected) {
    return false;
  }

  const [expectedA, expectedB] = expected;
  const requiredMaps = expectedA + expectedB;
  const usedMaps = mapScores.slice(0, requiredMaps);

  if (
    usedMaps.length !== requiredMaps ||
    usedMaps.some((map) => !validateCs2Score(map.scoreA, map.scoreB))
  ) {
    return false;
  }

  const winners = usedMaps.map((map) => getMapWinner(map.scoreA, map.scoreB));

  const winsA = winners.filter((mapWinner) => mapWinner === "A").length;

  const winsB = winners.filter((mapWinner) => mapWinner === "B").length;

  if (winsA !== expectedA || winsB !== expectedB) {
    return false;
  }

  // Seria nie może rozstrzygnąć się przed ostatnią wpisaną mapą: przy typie
  // 2:1 mapy A, A, B są niemożliwe, bo po dwóch wygranych A trzeciej się nie
  // gra. Backend odrzuca to przez validateSeriesMapOrder, ale bez tej kontroli
  // gracz dowiadywał się o tym dopiero po kliknięciu "Zapisz typ".
  return !seriesDecidedTooEarly(winners, Number(bestOf));
}

function seriesDecidedTooEarly(winners, bestOf) {
  const winsNeeded = Math.ceil(bestOf / 2);

  let winsA = 0;
  let winsB = 0;

  for (let index = 0; index < winners.length; index += 1) {
    if (winners[index] === "A") winsA += 1;
    else if (winners[index] === "B") winsB += 1;

    const rozstrzygnieta = winsA === winsNeeded || winsB === winsNeeded;

    if (rozstrzygnieta && index !== winners.length - 1) {
      return true;
    }
  }

  return false;
}

function getSeriesOptions(bestOf) {
  if (Number(bestOf) === 3) {
    return ["2:0", "2:1", "1:2", "0:2"];
  }

  if (Number(bestOf) === 5) {
    return ["3:0", "3:1", "3:2", "2:3", "1:3", "0:3"];
  }

  return [];
}

function getRequiredMaps(seriesScore) {
  const scores = seriesScore?.split(":").map(Number);

  if (!scores || scores.length !== 2) {
    return 0;
  }

  return scores[0] + scores[1];
}

function SeriesOptions({ bestOf, teamA, teamB, seriesScore, onSelect }) {
  return (
    <div className="bo3-pick__options">
      {getSeriesOptions(bestOf).map((score) => {
        const [scoreA, scoreB] = score.split(":").map(Number);

        const teamLabel =
          scoreA > scoreB
            ? `${teamA} ${score}`
            : `${teamB} ${scoreB}:${scoreA}`;

        return (
          <button
            key={score}
            type="button"
            className={seriesScore === score ? "selected" : ""}
            onClick={() => onSelect(score)}
          >
            {teamLabel}
          </button>
        );
      })}
    </div>
  );
}

function SeriesMapScores({ match, seriesScore, mapScores, setMapScores }) {
  return (
    <div className="bo3-pick__maps">
      {mapScores.slice(0, getRequiredMaps(seriesScore)).map((map, index) => (
        <div className="bo3-map" key={index}>
          <div className="bo3-map__title">
            Mapa {index + 1}
            <span className="bo3-map__pick">
              {getMapLabel(
                index + 1,
                match.best_of,
                match.team_a,
                match.team_b,
              )}
            </span>
          </div>

          <div className="bo3-map__score">
            <input
              type="number"
              min="0"
              placeholder={match.team_a}
              value={map.scoreA}
              onChange={(event) => {
                const value = event.target.value;

                setMapScores((current) =>
                  current.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, scoreA: value } : item,
                  ),
                );
              }}
            />

            <span>:</span>

            <input
              type="number"
              min="0"
              placeholder={match.team_b}
              value={map.scoreB}
              onChange={(event) => {
                const value = event.target.value;

                setMapScores((current) =>
                  current.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, scoreB: value } : item,
                  ),
                );
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function buildSeriesPayload(seriesScore, mapScores) {
  const [predA, predB] = seriesScore.split(":").map(Number);

  const requiredMaps = getRequiredMaps(seriesScore);

  return {
    series: {
      pred_a: predA,
      pred_b: predB,
    },
    maps: mapScores.slice(0, requiredMaps).map((map, index) => ({
      map_no: index + 1,
      pred_exact_a: Number(map.scoreA),
      pred_exact_b: Number(map.scoreB),
    })),
  };
}

function SeriesPick({
  match,
  seriesScore,
  setSeriesScore,
  mapScores,
  setMapScores,
  saving,
  authLoading,
  currentUser,
  validationError,
  saveMessage,
  onSave,
}) {
  return (
    <section className="bo3-pick">
      <h2>Typ serii BO{match.best_of}</h2>

      <SeriesOptions
        bestOf={match.best_of}
        teamA={match.team_a}
        teamB={match.team_b}
        seriesScore={seriesScore}
        onSelect={setSeriesScore}
      />

      {seriesScore && (
        <SeriesMapScores
          match={match}
          seriesScore={seriesScore}
          mapScores={mapScores}
          setMapScores={setMapScores}
        />
      )}

      {match.ui_status !== "FINAL" && match.predictions_allowed === false && (
        <p className="bo1-pick__error">
          🔒 {match.lock_reason ?? "Typowanie tego meczu jest zablokowane."}
        </p>
      )}

      {!currentUser && (
        <p className="bo1-pick__error">
          Zaloguj się przez Discord, żeby zapisać swój typ.{" "}
          <a
            href={`/api/auth/discord?returnTo=${encodeURIComponent(
              window.location.pathname + window.location.search,
            )}`}
          >
            Zaloguj przez Discord
          </a>
        </p>
      )}
      {match.ui_status !== "FINAL" && (
        <button
          type="button"
          className="bo1-pick__save"
          disabled={
            saving ||
            authLoading ||
            !currentUser ||
            match.predictions_allowed === false
          }
          onClick={onSave}
        >
          {saving ? "Zapisywanie..." : "Zapisz typ"}
        </button>
      )}
      {validationError && <p className="bo1-pick__error">{validationError}</p>}

      {saveMessage && <p className="bo1-pick__success">{saveMessage}</p>}
    </section>
  );
}

function createEmptyMapScores() {
  return Array.from({ length: 5 }, () => ({
    scoreA: "",
    scoreB: "",
  }));
}

function mapSavedMapScores(maps = []) {
  return Array.from({ length: 5 }, (_, index) => ({
    scoreA:
      maps[index]?.pred_exact_a != null ? String(maps[index].pred_exact_a) : "",
    scoreB:
      maps[index]?.pred_exact_b != null ? String(maps[index].pred_exact_b) : "",
  }));
}

function getSavedSeriesScore(prediction) {
  if (!prediction?.series) {
    return null;
  }

  const predA = Number(prediction.series.pred_a);
  const predB = Number(prediction.series.pred_b);

  return `${predA}:${predB}`;
}

function isSeriesMatch(bestOf) {
  return Number(bestOf) === 3 || Number(bestOf) === 5;
}

function buildBo1Payload(winner, scoreA, scoreB) {
  return {
    winner: winner === "A" ? "team_a" : "team_b",
    score_a: Number(scoreA),
    score_b: Number(scoreB),
  };
}

function Bo1Pick({
  match,
  winner,
  setWinner,
  scoreA,
  setScoreA,
  scoreB,
  setScoreB,
  saving,
  authLoading,
  currentUser,
  validationError,
  saveMessage,
  onSave,
}) {
  return (
    <section className="bo1-pick">
      <h2>Twój typ</h2>

      <div className="bo1-pick__teams">
        <button
          type="button"
          className={winner === "A" ? "selected" : ""}
          onClick={() => setWinner("A")}
        >
          {match.team_a}
        </button>

        <span>VS</span>

        <button
          type="button"
          className={winner === "B" ? "selected" : ""}
          onClick={() => setWinner("B")}
        >
          {match.team_b}
        </button>
      </div>

      <div className="bo1-pick__score">
        <label>
          {match.team_a}

          <input
            type="number"
            min="0"
            value={scoreA}
            onChange={(event) => setScoreA(event.target.value)}
            placeholder="13"
          />
        </label>

        <span>:</span>

        <label>
          {match.team_b}

          <input
            type="number"
            min="0"
            value={scoreB}
            onChange={(event) => setScoreB(event.target.value)}
            placeholder="8"
          />
        </label>
      </div>

      {validationError && <p className="bo1-pick__error">{validationError}</p>}

      {!authLoading && !currentUser && (
        <a
          className="bo1-pick__login"
          href={`/api/auth/discord?returnTo=${encodeURIComponent(
            window.location.pathname + window.location.search,
          )}`}
        >
          Zaloguj przez Discord
        </a>
      )}

      {match.ui_status !== "FINAL" && match.predictions_allowed === false && (
        <p className="bo1-pick__error">
          🔒 {match.lock_reason ?? "Typowanie tego meczu jest zablokowane."}
        </p>
      )}
      {match.ui_status !== "FINAL" && (
        <button
          className="bo1-pick__save"
          type="button"
          disabled={
            saving ||
            authLoading ||
            !currentUser ||
            match.predictions_allowed === false
          }
          onClick={onSave}
        >
          {authLoading
            ? "Sprawdzanie logowania..."
            : saving
              ? "Zapisywanie..."
              : "Zapisz typ"}
        </button>
      )}

      {saveMessage && <p className="bo1-pick__success">{saveMessage}</p>}
    </section>
  );
}

function validateBo1Prediction(winner, scoreA, scoreB) {
  if (!winner) {
    return "Wybierz zwycięzcę meczu.";
  }

  if (!validateCs2Score(scoreA, scoreB)) {
    return "Podaj prawidłowy wynik CS2.";
  }

  const scoreWinner = Number(scoreA) > Number(scoreB) ? "A" : "B";

  if (winner !== scoreWinner) {
    return "Wybrany zwycięzca nie zgadza się z wynikiem.";
  }

  return null;
}

function validateSeriesPrediction(seriesScore, mapScores, bestOf) {
  if (!seriesScore) {
    return "Wybierz wynik serii.";
  }

  const requiredMaps = getRequiredMaps(seriesScore);
  const usedMaps = mapScores.slice(0, requiredMaps);

  if (usedMaps.some((map) => !validateCs2Score(map.scoreA, map.scoreB))) {
    return "Podaj prawidłowy wynik CS2 dla każdej mapy.";
  }

  const winners = usedMaps.map((map) => getMapWinner(map.scoreA, map.scoreB));

  if (seriesDecidedTooEarly(winners, Number(bestOf))) {
    return "Seria kończy się wcześniej, niż wynika z podanych map.";
  }

  if (!validateSeries(seriesScore, mapScores, bestOf)) {
    return "Wyniki map nie zgadzają się z wybranym wynikiem serii.";
  }

  return null;
}

function MatchPage() {
  const { slug, matchId } = useParams();
  const { realtimeRefresh } = useOutletContext();
  const { user: currentUser, authLoading } = useAuth();

  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [winner, setWinner] = useState(null);
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
  const [validationError, setValidationError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const [seriesScore, setSeriesScore] = useState(null);
  const [mapScores, setMapScores] = useState(createEmptyMapScores());
  const [canAdminMatchStan, setCanAdminMatch] = useState(false);
  const [matchResultStan, setMatchResult] = useState(null);
  const [myPointsStan, setMyPoints] = useState(null);
  const [pickStats, setPickStats] = useState(null);

  // Te trzy rzeczy maja sens tylko dla rozstrzygnietego meczu (a punkty
  // dodatkowo tylko dla zalogowanego). Wyliczamy je przy renderze zamiast
  // zerowac stan w ciele efektu - takie setState powoduje dodatkowy przebieg.
  const finalowy = match?.ui_status === "FINAL";

  const canAdminMatch = match && currentUser ? canAdminMatchStan : false;
  const matchResult = finalowy ? matchResultStan : null;
  const myPoints = finalowy && currentUser ? myPointsStan : null;

  function resetPredictionForm() {
    setWinner(null);
    setScoreA("");
    setScoreB("");
    setSeriesScore(null);
    setMapScores(createEmptyMapScores());
  }

  useEffect(() => {
    if (!realtimeRefresh?.version) {
      return;
    }

    const payload = realtimeRefresh.payload;

    if (payload?.slug && String(payload.slug) !== String(slug)) {
      return;
    }

    if (payload?.matchId && String(payload.matchId) !== String(matchId)) {
      return;
    }

    async function refreshMatchPage() {
      try {
        const data = await getPublicMatch(matchId);

        const foundMatch = data.match;

        if (!foundMatch) {
          return;
        }

        setMatch(foundMatch);

        const stats = await getMatchPickStats(slug, matchId);

        setPickStats(stats);

        if (foundMatch.ui_status === "FINAL") {
          const result = await getPublicMatchResult(matchId);

          setMatchResult(result);

          if (currentUser) {
            const points = await getMyMatchPoints(matchId);

            setMyPoints(points.points ?? null);
          }
        }
      } catch (err) {
        console.error("MATCH REALTIME REFRESH ERROR:", err);
      }
    }

    refreshMatchPage();
  }, [realtimeRefresh, slug, matchId, currentUser]);

  useEffect(() => {
    if (!finalowy || !currentUser) return;

    async function loadMyPoints() {
      try {
        const data = await getMyMatchPoints(match.id);

        setMyPoints(data.points ?? null);
      } catch (err) {
        console.error("MATCH POINTS LOAD ERROR:", err);
        setMyPoints(null);
      }
    }

    loadMyPoints();
  }, [finalowy, match, currentUser]);

  useEffect(() => {
    async function loadMatch() {
      try {
        // Jeden mecz zamiast calej listy turnieju.
        const data = await getPublicMatch(matchId);

        const foundMatch = data.match;

        if (!foundMatch) {
          throw new Error("Nie znaleziono meczu.");
        }

        resetPredictionForm();
        setSaveMessage(null);
        setValidationError(null);

        setMatch(foundMatch);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadMatch();
  }, [slug, matchId]);

  useEffect(() => {
    async function loadPickStats() {
      try {
        const data = await getMatchPickStats(slug, matchId);

        setPickStats(data);
      } catch (err) {
        console.error("MATCH PICK STATS ERROR:", err);
      }
    }

    loadPickStats();
  }, [slug, matchId]);

  useEffect(() => {
    if (!finalowy) return;

    async function loadMatchResult() {
      try {
        const data = await getPublicMatchResult(match.id);

        setMatchResult(data);
      } catch (err) {
        console.error("MATCH RESULT ERROR:", err);
      }
    }

    loadMatchResult();
  }, [finalowy, match]);

  useEffect(() => {
    if (!match || !currentUser) return;

    async function checkAdminAccess() {
      try {
        await getMatch(match.id);
        setCanAdminMatch(true);
      } catch {
        setCanAdminMatch(false);
      }
    }

    checkAdminAccess();
  }, [match, currentUser]);

  useEffect(() => {
    if (!match || !currentUser?.id) {
      return;
    }

    async function loadPrediction() {
      try {
        setValidationError(null);
        setSaveMessage(null);

        const data = await getMatchPrediction(match.id);

        const prediction = data.prediction;

        if (!prediction) {
          resetPredictionForm();
          return;
        }

        if (isSeriesMatch(match.best_of) && prediction.series) {
          setSeriesScore(getSavedSeriesScore(prediction));

          if (Array.isArray(prediction.maps)) {
            setMapScores(mapSavedMapScores(prediction.maps));
          }

          return;
        }

        if (prediction.winner === "team_a") {
          setWinner("A");
        } else if (prediction.winner === "team_b") {
          setWinner("B");
        }

        setScoreA(prediction.score_a != null ? String(prediction.score_a) : "");

        setScoreB(prediction.score_b != null ? String(prediction.score_b) : "");
      } catch (err) {
        console.error("PREDICTION LOAD ERROR:", err);
      }
    }

    loadPrediction();
  }, [match, currentUser]);

  // Po wylogowaniu formularz trzeba wyczyscic, ale nie w efekcie - to
  // zalecany przez Reacta reset stanu przy zmianie wejscia, robiony w trakcie
  // renderu. Reagujemy tylko na przejscie zalogowany -> wylogowany, bo
  // formularz bywa wypelniany zapisanym typem i nie wolno go nadpisac.
  const [bylZalogowany, setBylZalogowany] = useState(false);

  if (!authLoading && Boolean(currentUser) !== bylZalogowany) {
    setBylZalogowany(Boolean(currentUser));

    if (!currentUser) {
      resetPredictionForm();
      setSaveMessage(null);
      setValidationError(null);
    }
  }

  async function handleBo1Save() {
    setValidationError(null);
    setSaveMessage(null);

    if (!currentUser) {
      setValidationError("Najpierw zaloguj się przez Discord.");
      return;
    }

    const validationMessage = validateBo1Prediction(winner, scoreA, scoreB);

    if (validationMessage) {
      setValidationError(validationMessage);
      return;
    }

    try {
      setSaving(true);

      await saveMatchPrediction(
        match.id,
        buildBo1Payload(winner, scoreA, scoreB),
      );

      setSaveMessage("Typ zapisany.");
    } catch (err) {
      setValidationError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSeriesSave(bestOf) {
    setValidationError(null);
    setSaveMessage(null);

    if (!currentUser) {
      setValidationError("Najpierw zaloguj się przez Discord.");
      return;
    }

    const validationMessage = validateSeriesPrediction(
      seriesScore,
      mapScores,
      bestOf,
    );

    if (validationMessage) {
      setValidationError(validationMessage);
      return;
    }

    const payload = buildSeriesPayload(seriesScore, mapScores);

    try {
      setSaving(true);

      await saveMatchPrediction(match.id, payload);

      setSaveMessage("Typ zapisany.");
    } catch (err) {
      console.error(`BO${bestOf} SAVE ERROR:`, err);
      setValidationError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="match-page">
      <BackLink to={`/events/${slug}/matches`}>Wróć do listy meczów</BackLink>
      <section className="match-page__hero">
        <span className="ui-kicker">Pick&apos;Em</span>

        <h1>Typowanie meczu</h1>

        {loading && <Ladowanie>Ładowanie meczu...</Ladowanie>}

        {!loading && error && <p>{error}</p>}

        {!loading && !error && match && (
          <>
            <p>
              {match.team_a} vs {match.team_b} · BO{match.best_of}
            </p>

            {match.ui_status === "FINAL" && matchResult && (
              <section className="match-result">
                <h2>Wynik meczu</h2>

                {Number(match.best_of) === 1 ? (
                  <p className="match-result__score">
                    {match.team_a} {matchResult.maps?.[0]?.exactA}:
                    {matchResult.maps?.[0]?.exactB} {match.team_b}
                  </p>
                ) : (
                  <>
                    <p className="match-result__score">
                      {match.team_a}{" "}
                      {
                        matchResult.maps.filter(
                          (map) =>
                            map.exactA != null &&
                            map.exactB != null &&
                            Number(map.exactA) > Number(map.exactB),
                        ).length
                      }
                      :
                      {
                        matchResult.maps.filter(
                          (map) =>
                            map.exactA != null &&
                            map.exactB != null &&
                            Number(map.exactB) > Number(map.exactA),
                        ).length
                      }{" "}
                      {match.team_b}
                    </p>

                    <div className="match-result__maps">
                      {matchResult.maps
                        .filter(
                          (map) => map.exactA != null && map.exactB != null,
                        )
                        .map((map) => (
                          <p key={map.mapNo}>
                            Mapa {map.mapNo}:{" "}
                            <strong>
                              {match.team_a} {map.exactA}:{map.exactB}{" "}
                              {match.team_b}
                            </strong>
                          </p>
                        ))}
                    </div>
                  </>
                )}
              </section>
            )}

            {canAdminMatch && (
              <Link
                className="match-page__admin-result"
                to={`/admin/matches/${match.id}/result`}
              >
                Ustaw wynik
              </Link>
            )}

            {match.ui_status === "FINAL" && !currentUser && (
              <section className="match-result">
                <h2>Twój typ</h2>
                <p>
                  Zaloguj się przez Discord, żeby zobaczyć swój zapisany typ.
                </p>
              </section>
            )}

            {match.ui_status === "FINAL" && currentUser && myPoints && (
              <section className="match-result">
                <h2>Zdobyte punkty</h2>

                <p className="match-result__score">⭐ {myPoints.total} pkt</p>

                <div className="match-result__maps">
                  <p>
                    Seria: <strong>{myPoints.series} pkt</strong>
                  </p>

                  <p>
                    Mapy: <strong>{myPoints.maps} pkt</strong>
                  </p>
                </div>
              </section>
            )}

            {pickStats?.locked && (
              <section className="match-community-stats">
                <div className="match-community-stats__header">
                  <span className="ui-kicker">Społeczność</span>

                  <h2>Jak typowała społeczność?</h2>
                </div>
                {(pickStats.picks?.total ?? 0) === 0 ? (
                  <p className="match-community-stats__empty">
                    Brak typów dla tego meczu.
                  </p>
                ) : (
                  <>
                    <div className="match-community-stats__teams">
                      <div>
                        <strong>{match.team_a}</strong>
                        <span>{pickStats.picks?.team_a?.percentage ?? 0}%</span>
                      </div>

                      <div>
                        <strong>{match.team_b}</strong>
                        <span>{pickStats.picks?.team_b?.percentage ?? 0}%</span>
                      </div>
                    </div>
                  </>
                )}

                <div className="match-community-stats__teams">
                  <div>
                    <strong>{match.team_a}</strong>
                    <span>{pickStats.picks?.team_a?.percentage ?? 0}%</span>
                  </div>

                  <div>
                    <strong>{match.team_b}</strong>
                    <span>{pickStats.picks?.team_b?.percentage ?? 0}%</span>
                  </div>
                </div>

                <div className="match-community-stats__bar">
                  <div
                    className="match-community-stats__bar-a"
                    style={{
                      width: `${pickStats.picks?.team_a?.percentage ?? 0}%`,
                    }}
                  />

                  <div
                    className="match-community-stats__bar-b"
                    style={{
                      width: `${pickStats.picks?.team_b?.percentage ?? 0}%`,
                    }}
                  />
                </div>

                <div className="match-community-stats__counts">
                  <span>{pickStats.picks?.team_a?.picks ?? 0}</span>

                  <span>{pickStats.picks?.team_b?.picks ?? 0}</span>
                </div>

                <div className="match-community-stats__summary">
                  <span>
                    Łącznie typów:{" "}
                    <strong>{pickStats.picks?.total ?? 0}</strong>
                  </span>

                  {pickStats.popular_score && (
                    <span>
                      Najpopularniejszy wynik:{" "}
                      <strong>
                        {pickStats.popular_score.score_a}:
                        {pickStats.popular_score.score_b}
                      </strong>{" "}
                      ({formatPicksCount(pickStats.popular_score.picks)})
                    </span>
                  )}
                </div>

                {pickStats.maps?.length > 0 && (
                  <div className="match-community-maps">
                    <div className="match-community-maps__header">
                      <span className="ui-kicker">Mapy</span>

                      <h3>Jak typowano mapy?</h3>
                    </div>

                    <div className="match-community-maps__list">
                      {pickStats.maps.map((map) => (
                        <div className="match-community-map" key={map.map_no}>
                          <div className="match-community-map__title">
                            Mapa {map.map_no}
                          </div>

                          <div className="match-community-map__teams">
                            <div>
                              <strong>{match.team_a}</strong>
                              <span>{map.team_a.percentage}%</span>
                            </div>

                            <div>
                              <strong>{match.team_b}</strong>
                              <span>{map.team_b.percentage}%</span>
                            </div>
                          </div>

                          <div className="match-community-map__bar">
                            <div
                              className="match-community-map__bar-a"
                              style={{
                                width: `${map.team_a.percentage}%`,
                              }}
                            />

                            <div
                              className="match-community-map__bar-b"
                              style={{
                                width: `${map.team_b.percentage}%`,
                              }}
                            />
                          </div>

                          <div className="match-community-map__counts">
                            <span>{formatPicksCount(map.team_a.picks)}</span>

                            <span>{formatPicksCount(map.team_b.picks)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {match.ui_status === "FINAL" &&
              Number(match.best_of) === 1 &&
              currentUser && (
                <section className="match-result">
                  <h2>Twój typ</h2>

                  {scoreA !== "" && scoreB !== "" ? (
                    <p className="match-result__score">
                      {match.team_a} {scoreA}:{scoreB} {match.team_b}
                    </p>
                  ) : (
                    <p>Nie typowałeś tego meczu.</p>
                  )}
                </section>
              )}

            {match.ui_status !== "FINAL" && Number(match.best_of) === 1 && (
              <Bo1Pick
                match={match}
                winner={winner}
                setWinner={setWinner}
                scoreA={scoreA}
                setScoreA={setScoreA}
                scoreB={scoreB}
                setScoreB={setScoreB}
                saving={saving}
                authLoading={authLoading}
                currentUser={currentUser}
                validationError={validationError}
                saveMessage={saveMessage}
                onSave={handleBo1Save}
              />
            )}

            {match.ui_status === "FINAL" &&
              isSeriesMatch(match.best_of) &&
              currentUser && (
                <section className="match-result">
                  <h2>Twój typ</h2>

                  {seriesScore ? (
                    <>
                      <p className="match-result__score">
                        {match.team_a} {seriesScore} {match.team_b}
                      </p>

                      <div className="match-result__maps">
                        {mapScores
                          .slice(0, getRequiredMaps(seriesScore))
                          .map((map, index) => (
                            <p key={index}>
                              Mapa {index + 1}:{" "}
                              <strong>
                                {match.team_a} {map.scoreA}:{map.scoreB}{" "}
                                {match.team_b}
                              </strong>
                            </p>
                          ))}
                      </div>
                    </>
                  ) : (
                    <p>Nie typowałeś tego meczu.</p>
                  )}
                </section>
              )}

            {match.ui_status !== "FINAL" && isSeriesMatch(match.best_of) && (
              <SeriesPick
                match={match}
                seriesScore={seriesScore}
                setSeriesScore={setSeriesScore}
                mapScores={mapScores}
                setMapScores={setMapScores}
                saving={saving}
                authLoading={authLoading}
                currentUser={currentUser}
                validationError={validationError}
                saveMessage={saveMessage}
                onSave={() => handleSeriesSave(Number(match.best_of))}
              />
            )}
          </>
        )}
      </section>
    </main>
  );
}

export default MatchPage;
