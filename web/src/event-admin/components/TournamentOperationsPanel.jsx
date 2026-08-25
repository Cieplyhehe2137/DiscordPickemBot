import { getBackupDownloadUrl } from "../../../lib/api";
import useTournamentOperations from "../hooks/useTournamentOperations";

export default function TournamentOperationsPanel({ event, slug, onRefresh }) {
  const operations = useTournamentOperations({
    event,
    slug,
    onRefresh,
  });

  return (
    <section className="mt-10 rounded-[2rem] border border-amber-400/20 bg-amber-500/5 p-8">
      <p className="text-sm uppercase tracking-[0.25em] text-amber-300">
        Operacje turniejowe
      </p>

      <h2 className="mt-2 text-3xl font-black">
        Backup, restore i zakończenie turnieju
      </h2>

      <p className="mt-2 text-white/50">
        To są odpowiedniki operatorskich akcji z Discorda. Restore i cleanup
        mają dodatkowe potwierdzenia.
      </p>

      {operations.message && (
        <div className="mt-5 rounded-2xl border border-green-400/20 bg-green-500/10 px-5 py-4 font-bold text-green-200">
          {operations.message}
        </div>
      )}

      {operations.backupError && (
        <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-500/10 px-5 py-4 font-bold text-red-200">
          {operations.backupError}
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-black">Backup bazy</h3>

              <p className="mt-1 text-sm text-white/50">
                Tworzy SQL tylko dla danych tego serwera tam, gdzie tabela ma
                guild_id. Trzymanych jest 10 najnowszych — starsze kasują się
                same.
              </p>
            </div>

            <button
              type="button"
              onClick={operations.createBackup}
              disabled={operations.backupActionLoading || !event?.guild_id}
              className="rounded-xl bg-amber-500 px-5 py-3 font-black text-black transition hover:bg-amber-400 disabled:opacity-50"
            >
              {operations.backupActionLoading ? "Pracuję..." : "Utwórz backup"}
            </button>
          </div>

          <div className="mt-5 max-h-72 overflow-auto rounded-xl border border-white/10">
            {operations.backupLoading && (
              <p className="p-4 text-white/50">Ładowanie backupów...</p>
            )}

            {!operations.backupLoading && operations.backups.length === 0 && (
              <p className="p-4 text-white/50">
                Brak backupów dla tego serwera.
              </p>
            )}

            {!operations.backupLoading &&
              operations.backups.map((backup) => (
                <div
                  key={backup.fileName}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4 last:border-b-0"
                >
                  <div>
                    <p className="break-all font-bold text-white">
                      {backup.fileName}
                    </p>

                    <p className="mt-1 text-xs text-white/40">
                      {new Date(backup.modifiedAt).toLocaleString("pl-PL")}
                      {" · "}
                      {(Number(backup.sizeBytes || 0) / 1024 / 1024).toFixed(2)}
                      {" MB"}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <a
                      href={getBackupDownloadUrl(
                        event.guild_id,
                        backup.fileName,
                      )}
                      className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-black text-white/80 transition hover:bg-white/10"
                    >
                      Pobierz
                    </a>

                    <button
                      type="button"
                      onClick={() => operations.restoreBackup(backup.fileName)}
                      disabled={operations.backupActionLoading}
                      className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm font-black text-red-200 transition hover:bg-red-500/20 disabled:opacity-50"
                    >
                      Przywróć
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
          <h3 className="text-xl font-black">Zakończ turniej</h3>

          <p className="mt-1 text-sm text-white/50">
            Tworzy XLSX do archiwum, zamyka aktywne panele i oznacza event jako
            zakończony lub archiwalny.
          </p>

          <label className="mt-5 block text-sm font-bold uppercase tracking-[0.2em] text-white/50">
            Nazwa archiwum
          </label>

          <input
            value={operations.archiveName}
            onChange={(eventChange) =>
              operations.setArchiveName(eventChange.target.value)
            }
            placeholder={event?.slug || "nazwa_archiwum"}
            className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-amber-400/50"
          />

          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-red-400/20 bg-red-500/5 p-4 text-sm text-white/70">
            <input
              type="checkbox"
              checked={operations.cleanupAfterArchive}
              onChange={(eventChange) =>
                operations.setCleanupAfterArchive(eventChange.target.checked)
              }
              className="mt-1"
            />

            <span>
              Po archiwizacji wyczyść dane operacyjne tego eventu. Zostaw
              wyłączone, jeśli chcesz tylko zamknąć i zarchiwizować event bez
              kasowania typów oraz meczów.
            </span>
          </label>

          <button
            type="button"
            onClick={operations.finishTournament}
            disabled={operations.endingTournament}
            className="mt-5 w-full rounded-xl border border-amber-400/40 bg-amber-500/20 px-5 py-4 font-black text-amber-100 transition hover:bg-amber-500/30 disabled:opacity-50"
          >
            {operations.endingTournament
              ? "Kończenie turnieju..."
              : "Zakończ i zarchiwizuj"}
          </button>
        </div>
      </div>
    </section>
  );
}
