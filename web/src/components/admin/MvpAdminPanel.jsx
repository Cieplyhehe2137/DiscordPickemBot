import { useCallback, useEffect, useState } from "react";

import {
  deleteMvpCandidate,
  getMvp,
  saveMvpCandidates,
  saveMvpResult,
} from "../../lib/api.js";
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

  // Kasowanie potwierdzane w miejscu, a nie przez window.confirm: ten sam
  // wzorzec co przy kasowaniu meczu w panelu. Trzyma id kandydata, dla
  // którego pokazany jest pytający wiersz, i osobno id kandydata, którego
  // żądanie właśnie leci - żeby zablokować tylko ten jeden przycisk.
  const [potwierdzanyId, setPotwierdzanyId] = useState(null);
  const [usuwanyId, setUsuwanyId] = useState(null);

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

  async function usunKandydata(candidateId) {
    setBlad("");
    setKomunikat("");
    setUsuwanyId(candidateId);

    try {
      await deleteMvpCandidate(slug, candidateId);
      setPotwierdzanyId(null);
      setKomunikat("Kandydat usunięty.");
      await wczytaj();
    } catch (err) {
      // Serwer odmawia, gdy ktoś już wytypował tego kandydata albo gdy jest
      // zapisany jako zwycięzca - i mówi wprost, co go trzyma. Pokazujemy tę
      // wiadomość, zamiast zastępować ją własną, ogólną.
      setBlad(err.message || "Nie udało się usunąć kandydata.");
    } finally {
      setUsuwanyId(null);
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
          // Lista pionowa, nie siatka: każdy kandydat ma teraz własną akcję,
          // a przycisku kasowania nie da się włożyć do środka przycisku
          // wyboru - zagnieżdżone elementy interaktywne to nieprawidłowy HTML
          // i klawiatura nie umie się po nich poruszać.
          <div className="ui-stack ui-stack--tight">
            {kandydaci.map((kandydat) => {
              const zwyciezca = Number(wynik) === Number(kandydat.id);
              const nieaktywny = !Number(kandydat.is_active);

              return (
                <div
                  key={kandydat.id}
                  className="ui-card ui-card--flat ui-card--tight ui-stack ui-stack--tight"
                >
                  <div className="ui-row ui-row--between ui-row--wrap">
                    <button
                      type="button"
                      className="ui-choice__option ui-choice__option--stacked"
                      aria-pressed={zwyciezca}
                      onClick={() => ustawWynik(kandydat.id)}
                      title="Kliknij, aby ustawić jako zwycięzcę MVP"
                    >
                      <strong>{kandydat.nickname}</strong>

                      {kandydat.team_name && <span>{kandydat.team_name}</span>}
                    </button>

                    <div className="ui-row ui-row--wrap">
                      {zwyciezca && (
                        <span className="ui-badge ui-badge--warn">MVP</span>
                      )}

                      {/* Zapis listy nie kasuje starych wpisów, tylko je
                          wyłącza - bez tej plakietki nie było widać, którzy
                          kandydaci pochodzą z poprzedniego zapisu. */}
                      {nieaktywny && (
                        <span className="ui-badge">poza listą</span>
                      )}

                      <button
                        type="button"
                        className="ui-btn ui-btn--sm ui-btn--danger"
                        disabled={usuwanyId === kandydat.id}
                        onClick={() => {
                          setBlad("");
                          setKomunikat("");
                          setPotwierdzanyId(
                            potwierdzanyId === kandydat.id ? null : kandydat.id,
                          );
                        }}
                      >
                        🗑️ Usuń
                      </button>
                    </div>
                  </div>

                  {potwierdzanyId === kandydat.id && (
                    <div className="ui-note ui-note--danger ui-stack ui-stack--tight">
                      <span>
                        Usunąć <strong>{kandydat.nickname}</strong> z listy
                        kandydatów?
                      </span>

                      <div className="ui-row ui-row--wrap">
                        <button
                          type="button"
                          className="ui-btn ui-btn--sm ui-btn--danger"
                          disabled={usuwanyId === kandydat.id}
                          onClick={() => usunKandydata(kandydat.id)}
                        >
                          {usuwanyId === kandydat.id
                            ? "Usuwanie..."
                            : "🗑️ Tak, usuń"}
                        </button>

                        <button
                          type="button"
                          className="ui-btn ui-btn--sm ui-btn--ghost"
                          disabled={usuwanyId === kandydat.id}
                          onClick={() => setPotwierdzanyId(null)}
                        >
                          Anuluj
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="ui-card ui-card--flat ui-stack ui-stack--tight">
        <h4>Dodaj kandydatów</h4>

        <p className="ui-hint">
          Jeden na linię: <code>nick</code> albo <code>nick, drużyna</code>
        </p>

        <textarea
          className="ui-input"
          rows={6}
          value={tekst}
          onChange={(event) => setTekst(event.target.value)}
          placeholder={"donk, Team Spirit\nm0NESY, G2"}
        />

        <div className="ui-actions">
          <button
            type="button"
            className="ui-btn ui-btn--sm ui-btn--primary"
            onClick={zapiszKandydatow}
            disabled={zapisywanie}
          >
            {zapisywanie ? "Zapisywanie..." : "Zapisz kandydatów"}
          </button>
        </div>
      </div>

      {komunikat && <p className="ui-note ui-note--ok">{komunikat}</p>}

      {blad && <p className="ui-note ui-note--danger">{blad}</p>}
    </div>
  );
}

export default MvpAdminPanel;
