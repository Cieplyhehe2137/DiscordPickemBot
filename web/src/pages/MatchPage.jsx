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
import ScoreLine from "../components/ScoreLine.jsx";

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
    <div className="ui-choice">
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
            className="ui-choice__option"
            aria-pressed={seriesScore === score}
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
    <div className="ui-stack">
      {mapScores.slice(0, getRequiredMaps(seriesScore)).map((map, index) => (
        <div
          className="ui-card ui-card--tight ui-stack ui-stack--tight"
          key={index}
        >
          <div className="ui-row ui-row--between">
            <strong>Mapa {index + 1}</strong>

            <span className="ui-badge">
              {getMapLabel(
                index + 1,
                match.best_of,
                match.team_a,
                match.team_b,
              )}
            </span>
          </div>

          {/* Nazwa drużyny była wcześniej placeholderem, więc znikała w chwili
              wpisania wyniku - dokładnie wtedy, gdy trzeba wiedzieć, czyj to
              wynik. Teraz jest etykietą i zostaje na ekranie. */}
          <div className="ui-score">
            <label className="ui-field">
              <span className="ui-field__label">{match.team_a}</span>

              <input
                className="ui-field__input"
                type="number"
                min="0"
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
            </label>

            <span className="ui-score__separator">:</span>

            <label className="ui-field">
              <span className="ui-field__label">{match.team_b}</span>

              <input
                className="ui-field__input"
                type="number"
                min="0"
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
            </label>
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
    <section className="ui-card ui-stack">
      <div className="ui-section-head">
        <div>
          <span className="ui-kicker">Twój typ</span>

          <h2>Wynik serii BO{match.best_of}</h2>

          <p>
            Najpierw wybierz wynik serii, potem uzupełnij wyniki kolejnych map.
          </p>
        </div>
      </div>

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
        <p className="ui-note ui-note--warn">
          🔒 {match.lock_reason ?? "Typowanie tego meczu jest zablokowane."}
        </p>
      )}

      {!currentUser && (
        <p className="ui-note">
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

      {validationError && (
        <p className="ui-note ui-note--danger">{validationError}</p>
      )}

      {saveMessage && <p className="ui-note ui-note--ok">✅ {saveMessage}</p>}

      {match.ui_status !== "FINAL" && (
        <button
          type="button"
          className="ui-btn ui-btn--primary"
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
    <section className="ui-card ui-stack">
      <div className="ui-section-head">
        <div>
          <span className="ui-kicker">Twój typ</span>

          <h2>Kto wygra?</h2>

          <p>Wskaż zwycięzcę i podaj wynik rund.</p>
        </div>
      </div>

      <div className="ui-choice ui-choice--versus">
        <button
          type="button"
          className="ui-choice__option"
          aria-pressed={winner === "A"}
          onClick={() => setWinner("A")}
        >
          {match.team_a}
        </button>

        <span className="ui-choice__vs">VS</span>

        <button
          type="button"
          className="ui-choice__option"
          aria-pressed={winner === "B"}
          onClick={() => setWinner("B")}
        >
          {match.team_b}
        </button>
      </div>

      <div className="ui-score">
        <label className="ui-field">
          <span className="ui-field__label">{match.team_a}</span>

          <input
            className="ui-field__input"
            type="number"
            min="0"
            value={scoreA}
            onChange={(event) => setScoreA(event.target.value)}
            placeholder="13"
          />
        </label>

        <span className="ui-score__separator">:</span>

        <label className="ui-field">
          <span className="ui-field__label">{match.team_b}</span>

          <input
            className="ui-field__input"
            type="number"
            min="0"
            value={scoreB}
            onChange={(event) => setScoreB(event.target.value)}
            placeholder="8"
          />
        </label>
      </div>

      {match.ui_status !== "FINAL" && match.predictions_allowed === false && (
        <p className="ui-note ui-note--warn">
          🔒 {match.lock_reason ?? "Typowanie tego meczu jest zablokowane."}
        </p>
      )}

      {validationError && (
        <p className="ui-note ui-note--danger">{validationError}</p>
      )}

      {saveMessage && <p className="ui-note ui-note--ok">✅ {saveMessage}</p>}

      {!authLoading && !currentUser && (
        <a
          className="ui-btn"
          href={`/api/auth/discord?returnTo=${encodeURIComponent(
            window.location.pathname + window.location.search,
          )}`}
        >
          Zaloguj przez Discord
        </a>
      )}

      {match.ui_status !== "FINAL" && (
        <button
          className="ui-btn ui-btn--primary"
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

function countMapWins(maps = [], side) {
  return maps.filter((map) => {
    if (map.exactA == null || map.exactB == null) {
      return false;
    }

    return side === "A"
      ? Number(map.exactA) > Number(map.exactB)
      : Number(map.exactB) > Number(map.exactA);
  }).length;
}

function MapBreakdown({ teamA, teamB, maps }) {
  if (maps.length === 0) {
    return null;
  }

  return (
    <div className="ui-card ui-card--flat ui-card--tight ui-stack ui-stack--tight">
      {maps.map((map) => (
        <div className="ui-map-row" key={map.no}>
          <span className="ui-map-row__label">Mapa {map.no}</span>

          <ScoreLine
            compact
            teamA={teamA}
            teamB={teamB}
            scoreA={map.scoreA}
            scoreB={map.scoreB}
          />
        </div>
      ))}
    </div>
  );
}

function CommunitySplit({ teamA, teamB, sideA, sideB }) {
  const percentageA = sideA?.percentage ?? 0;
  const percentageB = sideB?.percentage ?? 0;

  return (
    <div className="ui-stack ui-stack--tight">
      <div className="ui-row ui-row--between ui-row--full">
        <span className="ui-split-side">
          <strong>{teamA}</strong>

          <span>{percentageA}%</span>
        </span>

        <span className="ui-split-side ui-split-side--b">
          <strong>{teamB}</strong>

          <span>{percentageB}%</span>
        </span>
      </div>

      <div className="ui-split">
        <div className="ui-split__a" style={{ width: `${percentageA}%` }} />

        <div className="ui-split__b" style={{ width: `${percentageB}%` }} />
      </div>

      <div className="ui-row ui-row--between ui-row--full">
        <span className="ui-stat__hint">
          {formatPicksCount(sideA?.picks ?? 0)}
        </span>

        <span className="ui-stat__hint">
          {formatPicksCount(sideB?.picks ?? 0)}
        </span>
      </div>
    </div>
  );
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
    <main className="ui-page">
      <BackLink to={`/events/${slug}/matches`}>Wróć do listy meczów</BackLink>

      {loading && (
        <div className="ui-stack" aria-busy="true" aria-label="Ładowanie meczu">
          <div className="ui-skeleton ui-skeleton--row" />

          <div className="ui-skeleton ui-skeleton--row" />
        </div>
      )}

      {!loading && error && (
        <div className="ui-error" role="alert">
          <span className="ui-error__icon" aria-hidden="true">
            ⚠️
          </span>

          <strong className="ui-error__title">
            Nie udało się wczytać meczu
          </strong>

          <p className="ui-error__text">{error}</p>
        </div>
      )}

      {!loading && !error && match && (
        <>
          <section className="ui-card ui-stack">
            <div className="ui-row ui-row--between ui-row--wrap ui-row--full">
              <span className="ui-kicker">
                Pick&apos;Em · BO{match.best_of}
              </span>

              {match.ui_status === "FINAL" ? (
                <span className="ui-badge">Mecz zakończony</span>
              ) : match.predictions_allowed === false ? (
                <span className="ui-badge ui-badge--warn">
                  Typowanie zamknięte
                </span>
              ) : (
                <span className="ui-badge ui-badge--ok">Typowanie otwarte</span>
              )}
            </div>

            <div className="ui-match">
              <div className="ui-match__team">
                <span className="ui-match__side">A</span>

                <strong className="ui-match__name">{match.team_a}</strong>
              </div>

              <span className="ui-match__vs">VS</span>

              <div className="ui-match__team ui-match__team--b">
                <span className="ui-match__side">B</span>

                <strong className="ui-match__name">{match.team_b}</strong>
              </div>
            </div>

            {canAdminMatch && (
              <Link
                className="ui-btn ui-btn--ghost ui-btn--sm"
                to={`/admin/matches/${match.id}/result`}
              >
                Ustaw wynik
              </Link>
            )}
          </section>

          {match.ui_status === "FINAL" && matchResult && (
            <section className="ui-card ui-stack">
              <div className="ui-section-head">
                <div>
                  <span className="ui-kicker">Rezultat</span>

                  <h2>Wynik meczu</h2>
                </div>
              </div>

              {Number(match.best_of) === 1 ? (
                <ScoreLine
                  teamA={match.team_a}
                  teamB={match.team_b}
                  scoreA={matchResult.maps?.[0]?.exactA}
                  scoreB={matchResult.maps?.[0]?.exactB}
                />
              ) : (
                <>
                  <ScoreLine
                    teamA={match.team_a}
                    teamB={match.team_b}
                    scoreA={countMapWins(matchResult.maps, "A")}
                    scoreB={countMapWins(matchResult.maps, "B")}
                  />

                  <MapBreakdown
                    teamA={match.team_a}
                    teamB={match.team_b}
                    maps={matchResult.maps
                      .filter((map) => map.exactA != null && map.exactB != null)
                      .map((map) => ({
                        no: map.mapNo,
                        scoreA: map.exactA,
                        scoreB: map.exactB,
                      }))}
                  />
                </>
              )}
            </section>
          )}

          {match.ui_status === "FINAL" && !currentUser && (
            <section className="ui-card ui-stack">
              <div className="ui-section-head">
                <div>
                  <span className="ui-kicker">Twój typ</span>

                  <h2>Zobacz, jak Ci poszło</h2>
                </div>
              </div>

              <p className="ui-note">
                Zaloguj się przez Discord, żeby zobaczyć swój zapisany typ.
              </p>

              <a
                className="ui-btn"
                href={`/api/auth/discord?returnTo=${encodeURIComponent(
                  window.location.pathname + window.location.search,
                )}`}
              >
                Zaloguj przez Discord
              </a>
            </section>
          )}

          {match.ui_status === "FINAL" && currentUser && myPoints && (
            <section className="ui-card ui-card--accent ui-stack">
              <div className="ui-section-head">
                <div>
                  <span className="ui-kicker">Twój wynik</span>

                  <h2>Zdobyte punkty</h2>
                </div>
              </div>

              <div className="ui-stats">
                <div className="ui-stat ui-stat--featured">
                  <span>Łącznie</span>

                  <strong>⭐ {myPoints.total}</strong>

                  <small>punktów za ten mecz</small>
                </div>

                <div className="ui-stat">
                  <span>Seria</span>

                  <strong>{myPoints.series}</strong>

                  <small>za wynik meczu</small>
                </div>

                <div className="ui-stat">
                  <span>Mapy</span>

                  <strong>{myPoints.maps}</strong>

                  <small>za wyniki map</small>
                </div>
              </div>
            </section>
          )}

          {pickStats?.locked && (
            <section className="ui-card ui-stack">
              <div className="ui-section-head">
                <div>
                  <span className="ui-kicker">Społeczność</span>

                  <h2>Jak typowała społeczność?</h2>
                </div>
              </div>

              {(pickStats.picks?.total ?? 0) === 0 ? (
                <div className="ui-empty">
                  <span className="ui-empty__icon" aria-hidden="true">
                    🤷
                  </span>

                  <strong className="ui-empty__title">
                    Nikt nie typował tego meczu
                  </strong>

                  <p className="ui-empty__text">
                    Typowanie zamknęło się bez ani jednego zapisanego typu.
                  </p>
                </div>
              ) : (
                <>
                  {/* Podpisy, pasek i liczby to jeden blok - wcześniej ten sam
                      podpis renderował się dwa razy, raz warunkowo i raz na
                      stałe, więc przy zerze typów widać było komunikat "brak"
                      i zaraz pod nim 0% dla obu drużyn. */}
                  <CommunitySplit
                    teamA={match.team_a}
                    teamB={match.team_b}
                    sideA={pickStats.picks?.team_a}
                    sideB={pickStats.picks?.team_b}
                  />

                  <div className="ui-row ui-row--between ui-row--wrap ui-row--full">
                    <span className="ui-stat__hint">
                      Łącznie typów:{" "}
                      <strong>{pickStats.picks?.total ?? 0}</strong>
                    </span>

                    {pickStats.popular_score && (
                      <span className="ui-stat__hint">
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
                    <div className="ui-stack">
                      <div className="ui-section-head">
                        <div>
                          <span className="ui-kicker">Mapy</span>

                          <h3>Jak typowano mapy?</h3>
                        </div>
                      </div>

                      {pickStats.maps.map((map) => (
                        <div
                          className="ui-card ui-card--flat ui-card--tight ui-stack ui-stack--tight"
                          key={map.map_no}
                        >
                          <span className="ui-kicker">Mapa {map.map_no}</span>

                          <CommunitySplit
                            teamA={match.team_a}
                            teamB={match.team_b}
                            sideA={map.team_a}
                            sideB={map.team_b}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          {match.ui_status === "FINAL" &&
            Number(match.best_of) === 1 &&
            currentUser && (
              <section className="ui-card ui-stack">
                <div className="ui-section-head">
                  <div>
                    <span className="ui-kicker">Twój typ</span>

                    <h2>Co obstawiłeś</h2>
                  </div>
                </div>

                {scoreA !== "" && scoreB !== "" ? (
                  <ScoreLine
                    teamA={match.team_a}
                    teamB={match.team_b}
                    scoreA={scoreA}
                    scoreB={scoreB}
                  />
                ) : (
                  <p className="ui-note">Nie typowałeś tego meczu.</p>
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
              <section className="ui-card ui-stack">
                <div className="ui-section-head">
                  <div>
                    <span className="ui-kicker">Twój typ</span>

                    <h2>Co obstawiłeś</h2>
                  </div>
                </div>

                {seriesScore ? (
                  <>
                    <ScoreLine
                      teamA={match.team_a}
                      teamB={match.team_b}
                      scoreA={seriesScore.split(":")[0]}
                      scoreB={seriesScore.split(":")[1]}
                    />

                    <MapBreakdown
                      teamA={match.team_a}
                      teamB={match.team_b}
                      maps={mapScores
                        .slice(0, getRequiredMaps(seriesScore))
                        .map((map, index) => ({
                          no: index + 1,
                          scoreA: map.scoreA,
                          scoreB: map.scoreB,
                        }))}
                    />
                  </>
                ) : (
                  <p className="ui-note">Nie typowałeś tego meczu.</p>
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
    </main>
  );
}

export default MatchPage;
