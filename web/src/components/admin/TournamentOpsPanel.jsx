import { useState } from "react";

import {
  createMatchesBulk,
  getClearPhasePreview,
  clearPhase,
  getResultProposals,
  syncResultProposals,
  acceptResultProposal,
  rejectResultProposal,
  listBackups,
  createBackup,
  restoreBackup,
  backupDownloadUrl,
  classificationExportUrl,
  endTournament,
} from "../../lib/api.js";

// Operacje turniejowe, które po przepisaniu frontu zostały wyłącznie
// na Discordzie: hurtowe tworzenie meczów, czyszczenie fazy, propozycje
// wyników z zewnętrznego dostawcy, kopie zapasowe i zamknięcie turnieju.
//
// Wszystkie te endpointy istniały w backendzie bez jednego wywołania z UI.

const FAZY_MECZOWE = [
  { klucz: "swiss_stage1", etykieta: "Swiss Stage 1" },
  { klucz: "swiss_stage2", etykieta: "Swiss Stage 2" },
  { klucz: "swiss_stage3", etykieta: "Swiss Stage 3" },
  { klucz: "playin", etykieta: "Play-In" },
  { klucz: "playoffs", etykieta: "Playoffs" },
  { klucz: "doubleelim", etykieta: "Double Elimination" },
];

function Komunikaty({ ok, blad }) {
  return (
    <>
      {ok && <p className="ui-note ui-note--ok">{ok}</p>}
      {blad && <p className="ui-note ui-note--danger">{blad}</p>}
    </>
  );
}

/* ---------------- Hurtowe tworzenie meczów ---------------- */

function HurtoweMecze({ guildId, slug }) {
  const [faza, setFaza] = useState("swiss_stage1");
  const [tekst, setTekst] = useState("");
  const [bo, setBo] = useState(3);
  const [podglad, setPodglad] = useState(null);
  const [pracuje, setPracuje] = useState(false);
  const [ok, setOk] = useState("");
  const [blad, setBlad] = useState("");

  async function uruchom(dryRun) {
    setPracuje(true);
    setOk("");
    setBlad("");

    try {
      const dane = await createMatchesBulk(guildId, slug, {
        phase: faza,
        text: tekst,
        defaultBestOf: Number(bo),
        dryRun,
      });

      if (dryRun) {
        setPodglad(dane);
      } else {
        setPodglad(null);
        setTekst("");
        setOk(`Utworzono mecze: ${dane.utworzone ?? dane.created ?? "?"}.`);
      }
    } catch (err) {
      setBlad(err.message || "Nie udało się utworzyć meczów.");
    } finally {
      setPracuje(false);
    }
  }

  return (
    <div className="ui-card ui-card--flat ui-stack ui-stack--tight">
      <h4>Hurtowe tworzenie meczów</h4>

      <p className="ui-hint">
        Jeden mecz na linię: <code>Team A vs Team B</code>, opcjonalnie z BO na
        końcu (<code>NAVI vs G2 BO3</code>).
      </p>

      <div className="ui-row ui-row--wrap">
        <select value={faza} onChange={(e) => setFaza(e.target.value)}>
          {FAZY_MECZOWE.map((f) => (
            <option key={f.klucz} value={f.klucz}>
              {f.etykieta}
            </option>
          ))}
        </select>

        <select value={bo} onChange={(e) => setBo(e.target.value)}>
          <option value={1}>Domyślnie BO1</option>
          <option value={3}>Domyślnie BO3</option>
          <option value={5}>Domyślnie BO5</option>
        </select>
      </div>

      <textarea
        rows={6}
        value={tekst}
        onChange={(e) => setTekst(e.target.value)}
        placeholder={"NAVI vs G2 BO3\nVitality vs FaZe"}
      />

      <div className="ui-row ui-row--wrap">
        <button type="button" onClick={() => uruchom(true)} disabled={pracuje}>
          Podgląd
        </button>

        <button
          type="button"
          onClick={() => uruchom(false)}
          disabled={pracuje || !podglad}
          title={!podglad ? "Najpierw zrób podgląd" : ""}
        >
          {pracuje ? "Pracuję..." : "Utwórz mecze"}
        </button>
      </div>

      {podglad && (
        <div className="ui-card ui-card--flat ui-card--tight">
          <strong>Podgląd</strong>

          <pre>{JSON.stringify(podglad, null, 2).slice(0, 1500)}</pre>
        </div>
      )}

      <Komunikaty ok={ok} blad={blad} />
    </div>
  );
}

/* ---------------- Czyszczenie fazy ---------------- */

function CzyszczenieFazy({ slug }) {
  const [faza, setFaza] = useState("swiss_stage1");
  const [podglad, setPodglad] = useState(null);
  const [pracuje, setPracuje] = useState(false);
  const [ok, setOk] = useState("");
  const [blad, setBlad] = useState("");

  async function pobierzPodglad() {
    setPracuje(true);
    setOk("");
    setBlad("");

    try {
      setPodglad(await getClearPhasePreview(slug, faza));
    } catch (err) {
      setBlad(err.message || "Nie udało się pobrać podglądu.");
    } finally {
      setPracuje(false);
    }
  }

  async function wyczysc() {
    // Operacja nieodwracalna - podgląd jest obowiązkowy, a potwierdzenie
    // wymaga zobaczenia liczb, które zniknią.
    if (
      !window.confirm(
        `Usunąć wszystkie dane fazy ${faza}? Meczów: ${podglad?.matches ?? "?"}, typów: ${podglad?.predictions ?? "?"}. Tego nie da się cofnąć.`,
      )
    ) {
      return;
    }

    setPracuje(true);
    setOk("");
    setBlad("");

    try {
      await clearPhase(slug, faza);
      setPodglad(null);
      setOk(`Wyczyszczono fazę ${faza}.`);
    } catch (err) {
      setBlad(err.message || "Nie udało się wyczyścić fazy.");
    } finally {
      setPracuje(false);
    }
  }

  return (
    <div className="ui-card ui-card--flat ui-stack ui-stack--tight ui-card--danger">
      <h4>Wyczyść fazę</h4>

      <p className="ui-hint">
        Usuwa mecze, typy, wyniki i punkty wybranej fazy. Nieodwracalne.
      </p>

      <div className="ui-row ui-row--wrap">
        <select value={faza} onChange={(e) => setFaza(e.target.value)}>
          {FAZY_MECZOWE.map((f) => (
            <option key={f.klucz} value={f.klucz}>
              {f.etykieta}
            </option>
          ))}
        </select>

        <button type="button" onClick={pobierzPodglad} disabled={pracuje}>
          Sprawdź, co zniknie
        </button>
      </div>

      {podglad && (
        <div className="ui-card ui-card--flat ui-card--tight">
          <strong>Do usunięcia:</strong> mecze {podglad.matches} · typy{" "}
          {podglad.predictions} · wyniki {podglad.results} · punkty{" "}
          {podglad.points}
          <button
            type="button"
            className="ui-btn ui-btn--danger"
            onClick={wyczysc}
            disabled={pracuje}
          >
            Usuń dane fazy
          </button>
        </div>
      )}

      <Komunikaty ok={ok} blad={blad} />
    </div>
  );
}

/* ---------------- Propozycje wyników ---------------- */

function PropozycjeWynikow({ slug }) {
  const [dane, setDane] = useState(null);
  const [pracuje, setPracuje] = useState(false);
  const [ok, setOk] = useState("");
  const [blad, setBlad] = useState("");

  async function wczytaj() {
    setPracuje(true);
    setBlad("");

    try {
      setDane(await getResultProposals(slug));
    } catch (err) {
      setBlad(err.message || "Nie udało się pobrać propozycji.");
    } finally {
      setPracuje(false);
    }
  }

  async function pobierzZDostawcy() {
    setPracuje(true);
    setOk("");
    setBlad("");

    try {
      const wynik = await syncResultProposals(slug);
      setOk(
        `Pobrano z dostawcy. Nowych propozycji: ${wynik.utworzone ?? wynik.created ?? 0}.`,
      );
      await wczytaj();
    } catch (err) {
      setBlad(err.message || "Nie udało się pobrać wyników od dostawcy.");
    } finally {
      setPracuje(false);
    }
  }

  async function rozstrzygnij(id, akcja) {
    setBlad("");
    setOk("");

    try {
      if (akcja === "accept") await acceptResultProposal(id);
      else await rejectResultProposal(id);

      setOk(
        akcja === "accept" ? "Wynik zatwierdzony." : "Propozycja odrzucona.",
      );
      await wczytaj();
    } catch (err) {
      setBlad(err.message || "Nie udało się rozstrzygnąć propozycji.");
    }
  }

  const propozycje = dane?.proposals ?? [];

  return (
    <div className="ui-card ui-card--flat ui-stack ui-stack--tight">
      <h4>Propozycje wyników</h4>

      <p className="ui-hint">
        Wyniki pobrane automatycznie od dostawcy — zatwierdzasz albo odrzucasz.
        {dane && !dane.providerConfigured && " (Dostawca nieskonfigurowany.)"}
      </p>

      <div className="ui-row ui-row--wrap">
        <button type="button" onClick={wczytaj} disabled={pracuje}>
          Pokaż propozycje
        </button>

        <button type="button" onClick={pobierzZDostawcy} disabled={pracuje}>
          {pracuje ? "Pracuję..." : "Pobierz od dostawcy"}
        </button>
      </div>

      {dane && propozycje.length === 0 && (
        <p className="ui-hint">Brak oczekujących propozycji.</p>
      )}

      {propozycje.map((p) => (
        <div className="ui-card ui-card--flat ui-card--tight" key={p.id}>
          <span>
            #{p.match_id} {p.team_a} {p.res_a}:{p.res_b} {p.team_b}
          </span>

          <div className="ui-row ui-row--wrap">
            <button type="button" onClick={() => rozstrzygnij(p.id, "accept")}>
              Zatwierdź
            </button>

            <button type="button" onClick={() => rozstrzygnij(p.id, "reject")}>
              Odrzuć
            </button>
          </div>
        </div>
      ))}

      <Komunikaty ok={ok} blad={blad} />
    </div>
  );
}

/* ---------------- Kopie zapasowe ---------------- */

function Backupy({ guildId }) {
  const [lista, setLista] = useState(null);
  const [pracuje, setPracuje] = useState(false);
  const [ok, setOk] = useState("");
  const [blad, setBlad] = useState("");

  async function wczytaj() {
    setPracuje(true);
    setBlad("");

    try {
      const dane = await listBackups(guildId);
      setLista(dane.backups ?? []);
    } catch (err) {
      setBlad(err.message || "Nie udało się pobrać listy kopii.");
    } finally {
      setPracuje(false);
    }
  }

  async function utworz() {
    setPracuje(true);
    setOk("");
    setBlad("");

    try {
      await createBackup(guildId);
      setOk("Kopia zapasowa utworzona.");
      await wczytaj();
    } catch (err) {
      setBlad(err.message || "Nie udało się utworzyć kopii.");
    } finally {
      setPracuje(false);
    }
  }

  async function przywroc(nazwa) {
    if (
      !window.confirm(
        `Przywrócić kopię ${nazwa}? Bieżące dane tego serwera zostaną zastąpione.`,
      )
    ) {
      return;
    }

    setPracuje(true);
    setOk("");
    setBlad("");

    try {
      await restoreBackup(guildId, nazwa);
      setOk(`Przywrócono kopię ${nazwa}.`);
    } catch (err) {
      setBlad(err.message || "Nie udało się przywrócić kopii.");
    } finally {
      setPracuje(false);
    }
  }

  return (
    <div className="ui-card ui-card--flat ui-stack ui-stack--tight">
      <h4>Kopie zapasowe</h4>

      <div className="ui-row ui-row--wrap">
        <button type="button" onClick={wczytaj} disabled={pracuje}>
          Pokaż kopie
        </button>

        <button type="button" onClick={utworz} disabled={pracuje}>
          {pracuje ? "Pracuję..." : "Utwórz kopię"}
        </button>
      </div>

      {lista && lista.length === 0 && (
        <p className="ui-hint">Brak kopii zapasowych.</p>
      )}

      {(lista ?? []).map((kopia) => {
        const nazwa = kopia.fileName ?? kopia.name ?? kopia;

        return (
          <div
            className="ui-row ui-row--between ui-row--wrap ui-row--full"
            key={nazwa}
          >
            <span>{nazwa}</span>

            <div className="ui-row ui-row--wrap">
              <a href={backupDownloadUrl(guildId, nazwa)}>Pobierz</a>

              <button type="button" onClick={() => przywroc(nazwa)}>
                Przywróć
              </button>
            </div>
          </div>
        );
      })}

      <Komunikaty ok={ok} blad={blad} />
    </div>
  );
}

/* ---------------- Zamknięcie turnieju ---------------- */

function ZamknijTurniej({ slug }) {
  const [nazwa, setNazwa] = useState("");
  const [cleanup, setCleanup] = useState(false);
  const [pracuje, setPracuje] = useState(false);
  const [ok, setOk] = useState("");
  const [blad, setBlad] = useState("");

  async function zakoncz() {
    if (
      !window.confirm(
        cleanup
          ? "Zakończyć turniej i USUNĄĆ dane robocze? Zostanie tylko klasyfikacja końcowa i plik archiwum."
          : "Zakończyć turniej? Zostanie zarchiwizowany i zamknięty na typowanie.",
      )
    ) {
      return;
    }

    setPracuje(true);
    setOk("");
    setBlad("");

    try {
      await endTournament(slug, { archiveName: nazwa || null, cleanup });
      setOk("Turniej zakończony i zarchiwizowany.");
    } catch (err) {
      setBlad(err.message || "Nie udało się zakończyć turnieju.");
    } finally {
      setPracuje(false);
    }
  }

  return (
    <div className="ui-card ui-card--flat ui-stack ui-stack--tight ui-card--danger">
      <h4>Zakończ turniej</h4>

      <p className="ui-hint">
        Generuje archiwum XLSX i zamyka turniej. Z opcją czyszczenia usuwa dane
        robocze — klasyfikacja końcowa zostaje.
      </p>

      <div className="ui-row ui-row--wrap">
        <input
          type="text"
          value={nazwa}
          onChange={(e) => setNazwa(e.target.value)}
          placeholder="Nazwa archiwum (opcjonalnie)"
        />

        <a href={classificationExportUrl(slug)}>Pobierz klasyfikację</a>
      </div>

      <label className="ui-row">
        <input
          type="checkbox"
          checked={cleanup}
          onChange={(e) => setCleanup(e.target.checked)}
        />
        Usuń dane robocze (typy, mecze, wyniki faz)
      </label>

      <button
        type="button"
        className="ui-btn ui-btn--danger"
        onClick={zakoncz}
        disabled={pracuje}
      >
        {pracuje ? "Kończenie..." : "Zakończ turniej"}
      </button>

      <Komunikaty ok={ok} blad={blad} />
    </div>
  );
}

function TournamentOpsPanel({ guildId, slug }) {
  return (
    <div className="ui-stack">
      <HurtoweMecze guildId={guildId} slug={slug} />
      <PropozycjeWynikow slug={slug} />
      <Backupy guildId={guildId} />
      <CzyszczenieFazy slug={slug} />
      <ZamknijTurniej slug={slug} />
    </div>
  );
}

export default TournamentOpsPanel;
