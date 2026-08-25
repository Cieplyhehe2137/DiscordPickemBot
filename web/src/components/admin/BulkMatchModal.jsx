import { useState } from "react";
import { bulkCreateMatches, describeActionError } from "../../lib/api";

const FAZY = ["PLAY_IN", "SWISS", "PLAYOFFS"];

const PRZYKLAD = `NAVI vs G2
FaZe - MOUZ
Spirit | Vitality
Astralis vs Liquid BO1`;

export default function BulkMatchModal({ guildId, slug, onClose, onCreated }) {
  const [phase, setPhase] = useState("SWISS");
  const [defaultBestOf, setDefaultBestOf] = useState(3);
  const [text, setText] = useState("");
  const [podglad, setPodglad] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Każda zmiana wejścia unieważnia podgląd - inaczej dałoby się obejrzeć
  // jedną listę, podmienić ją i zatwierdzić coś zupełnie innego.
  function zmien(setter) {
    return (wartosc) => {
      setter(wartosc);
      setPodglad(null);
    };
  }

  async function sprawdz() {
    try {
      setBusy(true);
      setError(null);

      const wynik = await bulkCreateMatches(guildId, slug, {
        phase,
        text,
        defaultBestOf: Number(defaultBestOf),
        dryRun: true,
      });

      setPodglad(wynik);
    } catch (err) {
      console.error(err);
      setError(describeActionError(err, "sprawdzić listy meczów"));
    } finally {
      setBusy(false);
    }
  }

  async function utworz() {
    try {
      setBusy(true);
      setError(null);

      const wynik = await bulkCreateMatches(guildId, slug, {
        phase,
        text,
        defaultBestOf: Number(defaultBestOf),
      });

      onCreated?.(wynik.utworzone?.length || 0);
      onClose();
    } catch (err) {
      console.error(err);
      setError(describeActionError(err, "utworzyć meczów"));
    } finally {
      setBusy(false);
    }
  }

  const doUtworzenia = podglad?.doUtworzenia || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-[2rem] border border-white/10 bg-zinc-950 p-8">
        <h2 className="text-3xl font-black">Utwórz mecze hurtem</h2>

        <p className="mt-2 text-white/50">
          Wklej listę par — jedna na linię. Nic nie powstanie, dopóki nie
          zobaczysz podglądu i nie potwierdzisz.
        </p>

        <div className="mt-6 flex flex-wrap gap-4">
          <label className="flex-1">
            <span className="text-xs uppercase tracking-[0.2em] text-white/40">
              Faza
            </span>

            <select
              value={phase}
              onChange={(e) => zmien(setPhase)(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3"
            >
              {FAZY.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>

          <label className="flex-1">
            <span className="text-xs uppercase tracking-[0.2em] text-white/40">
              Domyślne BO
            </span>

            <select
              value={defaultBestOf}
              onChange={(e) => zmien(setDefaultBestOf)(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3"
            >
              {[1, 3, 5].map((b) => (
                <option key={b} value={b}>
                  BO{b}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="mt-5 block">
          <span className="text-xs uppercase tracking-[0.2em] text-white/40">
            Lista meczów
          </span>

          <textarea
            value={text}
            onChange={(e) => zmien(setText)(e.target.value)}
            rows={10}
            placeholder={PRZYKLAD}
            className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 font-mono text-sm"
          />

          <span className="mt-2 block text-xs text-white/40">
            Rozdzielaj <code>vs</code>, <code>-</code>, <code>|</code> albo{" "}
            <code>;</code>. Dopisz <code>BO1</code> na końcu linii, żeby
            nadpisać domyślne. Puste linie i zaczynające się od <code>#</code>{" "}
            są pomijane.
          </span>
        </label>

        {error && (
          <div className="mt-5 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200">
            {error}
          </div>
        )}

        {podglad && (
          <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-5">
            <p className="text-lg font-black">
              Do utworzenia:{" "}
              <span className="text-violet-300">{doUtworzenia}</span>
              {podglad.rozpoznanych !== doUtworzenia && (
                <span className="text-white/40">
                  {" "}
                  z {podglad.rozpoznanych} rozpoznanych
                </span>
              )}
            </p>

            {podglad.nieznaneDruzyny?.length > 0 && (
              <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/10 p-4">
                <p className="text-sm font-black text-amber-200">
                  Nieznane drużyny: {podglad.nieznaneDruzyny.join(", ")}
                </p>

                {podglad.wskazowka && (
                  <p className="mt-2 text-sm text-amber-200/70">
                    {podglad.wskazowka}
                  </p>
                )}
              </div>
            )}

            {podglad.bledy?.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-black text-red-300">
                  Pominięte linie ({podglad.bledy.length}):
                </p>

                <ul className="mt-2 space-y-1 text-sm text-white/60">
                  {podglad.bledy.map((b) => (
                    <li key={b.linia}>
                      <span className="font-mono text-white/40">
                        linia {b.linia}:
                      </span>{" "}
                      „{b.tresc}” — {b.powod}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {podglad.duplikaty?.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-black text-amber-300">
                  Powtórzone pary ({podglad.duplikaty.length}) — zostaną
                  utworzone, bo rewanż jest dozwolony:
                </p>

                <ul className="mt-2 space-y-1 text-sm text-white/60">
                  {podglad.duplikaty.map((d) => (
                    <li key={d.linia}>
                      <span className="font-mono text-white/40">
                        linia {d.linia}:
                      </span>{" "}
                      {d.tresc} (pierwszy raz w linii {d.pierwsza})
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {doUtworzenia > 0 && (
              <div className="mt-4 max-h-48 overflow-auto rounded-xl border border-white/10">
                {podglad.podglad.map((m, i) => (
                  <div
                    key={`${m.linia}-${i}`}
                    className="flex items-center justify-between border-b border-white/5 px-4 py-2 text-sm last:border-b-0"
                  >
                    <span>
                      {m.teamA} <span className="text-white/30">vs</span>{" "}
                      {m.teamB}
                    </span>
                    <span className="font-mono text-white/40">
                      BO{m.bestOf}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 font-black text-white/70 transition hover:bg-white/10"
          >
            Anuluj
          </button>

          <button
            onClick={sprawdz}
            disabled={busy || !text.trim()}
            className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 font-black text-white/80 transition hover:bg-white/10 disabled:opacity-40"
          >
            {busy ? "Sprawdzam..." : "Sprawdź listę"}
          </button>

          <button
            onClick={utworz}
            disabled={busy || !podglad || doUtworzenia === 0}
            className="rounded-xl bg-violet-500 px-5 py-3 font-black transition hover:bg-violet-400 disabled:opacity-40"
          >
            {doUtworzenia > 0
              ? `Utwórz ${doUtworzenia} meczów`
              : "Utwórz mecze"}
          </button>
        </div>
      </div>
    </div>
  );
}
