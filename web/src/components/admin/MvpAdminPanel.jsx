import { useCallback, useEffect, useState } from "react";

import { getMvp, saveMvpCandidates, saveMvpResult } from "../../lib/api.js";
import Ladowanie from "../../components/Ladowanie.jsx";

// MVP turnieju: lista kandydatów i wskazanie zwycięzcy.
//
// Trafiony MVP daje 5 pkt (rules/scoring.js -> MVP.CORRECT) i wchodzi do
// tabeli `leaderboard`, więc bez tego panelu WWW nie było w stanie domknąć
// punktacji turnieju - operacja istniała tylko na Discordzie.
//
// Kandydatów wpisuje się tekstem, po jednym w linii: "nick" albo
// "nick, drużyna" - ten sam format co modal na Discordzie.

function parsujKandydatow(tekst) {
  return String(tekst || "")
    .split("\n")
    .map((linia) => linia.trim())
    .filter(Boolean)
    .map((linia) => {
      const [nickname, teamName] = linia.split(",").map((x) => x.trim());
      return { nickname, teamName: teamName || null };
    })
    .filter((wpis) => wpis.nickname);
}

function MvpAdminPanel({ slug }) {
  const [kandydaci, setKandydaci] = useState([]);
  const [wynik, setWynik] = useState(null);
  const [tekst, setTekst] = useState("");
  // jak wyżej: stan ładowania wyliczany, nie ustawiany w efekcie
  const [zaladowane, setZaladowane] = useState(false);
  const ladowanie = !zaladowane;
  const [zapisywanie, setZapisywanie] = useState(false);
  const [komunikat, setKomunikat] = useState("");
  const [blad, setBlad] = useState("");

  // Wywoływane też ręcznie po zapisaniu kandydatów - stąd useCallback.
  const wczytaj = useCallback(async () => {
    try {
      const dane = await getMvp(slug);

      setKandydaci(dane.candidates ?? []);
      setWynik(dane.result?.candidate_id ?? null);
      setBlad("");
    } catch (err) {
      console.error("MVP LOAD:", err);
      setBlad(err.message || "Nie udało się wczytać danych MVP.");
    } finally {
      setZaladowane(true);
    }
  }, [slug]);

  // Efekt trzyma własną kopię pobrania, żeby nie zawierał żadnego
  // synchronicznego setState (react-hooks/set-state-in-effect).
  useEffect(() => {
    let anulowane = false;

    (async () => {
      try {
        const dane = await getMvp(slug);

        if (anulowane) return;

        setKandydaci(dane.candidates ?? []);
        setWynik(dane.result?.candidate_id ?? null);
        setBlad("");
      } catch (err) {
        console.error("MVP LOAD:", err);

        if (!anulowane) {
          setBlad(err.message || "Nie udało się wczytać danych MVP.");
        }
      } finally {
        if (!anulowane) setZaladowane(true);
      }
    })();

    return () => {
      anulowane = true;
    };
  }, [slug]);

  async function zapiszKandydatow() {
    const wpisy = parsujKandydatow(tekst);

    if (!wpisy.length) {
      setBlad("Wpisz co najmniej jednego kandydata.");
      return;
    }

    setZapisywanie(true);
    setBlad("");
    setKomunikat("");

    try {
      await saveMvpCandidates(slug, wpisy);
      setTekst("");
      setKomunikat(`Zapisano kandydatów: ${wpisy.length}.`);
      await wczytaj();
    } catch (err) {
      setBlad(err.message || "Nie udało się zapisać kandydatów.");
    } finally {
      setZapisywanie(false);
    }
  }

  async function ustawWynik(candidateId) {
    setBlad("");
    setKomunikat("");

    try {
      await saveMvpResult(slug, candidateId);
      setWynik(candidateId);
      setKomunikat(
        "Zapisano zwycięzcę MVP. Przelicz punkty, żeby go rozliczyć.",
      );
    } catch (err) {
      setBlad(err.message || "Nie udało się zapisać wyniku MVP.");
    }
  }

  return (
    <div className="ui-stack">
      <div className="ui-card ui-card--flat ui-stack ui-stack--tight">
        <h4>Kandydaci</h4>

        {ladowanie && <Ladowanie>Wczytywanie...</Ladowanie>}

        {!ladowanie && kandydaci.length === 0 && (
          <p className="ui-hint">Brak kandydatów.</p>
        )}

        {!ladowanie && kandydaci.length > 0 && (
          <div className="ui-row ui-row--wrap">
            {kandydaci.map((kandydat) => (
              <button
                key={kandydat.id}
                type="button"
                className={
                  Number(wynik) === Number(kandydat.id)
                    ? "ui-stack__candidate ui-stack__candidate--winner"
                    : "ui-stack__candidate"
                }
                onClick={() => ustawWynik(kandydat.id)}
                title="Kliknij, aby ustawić jako zwycięzcę MVP"
              >
                <strong>{kandydat.nickname}</strong>

                {kandydat.team_name && <span>{kandydat.team_name}</span>}

                {Number(wynik) === Number(kandydat.id) && (
                  <span className="ui-badge ui-badge--warn">MVP</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="ui-card ui-card--flat ui-stack ui-stack--tight">
        <h4>Dodaj kandydatów</h4>

        <p className="ui-hint">
          Jeden na linię: <code>nick</code> albo <code>nick, drużyna</code>
        </p>

        <textarea
          rows={6}
          value={tekst}
          onChange={(event) => setTekst(event.target.value)}
          placeholder={"donk, Team Spirit\nm0NESY, G2"}
        />

        <button type="button" onClick={zapiszKandydatow} disabled={zapisywanie}>
          {zapisywanie ? "Zapisywanie..." : "Zapisz kandydatów"}
        </button>
      </div>

      {komunikat && <p className="ui-note ui-note--ok">{komunikat}</p>}

      {blad && <p className="ui-note ui-note--danger">{blad}</p>}
    </div>
  );
}

export default MvpAdminPanel;
