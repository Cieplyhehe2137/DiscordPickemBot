import { useEffect, useState } from "react";
import {
  createGuildBackup,
  describeActionError,
  endTournament,
  getGuildBackups,
  restoreGuildBackup,
} from "../../../lib/api";

export default function useTournamentOperations({ event, slug, onRefresh }) {
  const [backups, setBackups] = useState([]);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupActionLoading, setBackupActionLoading] = useState(false);
  const [backupError, setBackupError] = useState(null);

  const [endingTournament, setEndingTournament] = useState(false);
  const [archiveName, setArchiveName] = useState("");
  const [cleanupAfterArchive, setCleanupAfterArchive] = useState(false);

  const [message, setMessage] = useState(null);

  useEffect(() => {
    const guildId = event?.guild_id;

    if (!guildId) {
      setBackups([]);
      return undefined;
    }

    let cancelled = false;

    async function loadBackups() {
      try {
        setBackupLoading(true);
        setBackupError(null);

        const result = await getGuildBackups(guildId);

        if (!cancelled) {
          setBackups(result.backups || []);
        }
      } catch (error) {
        console.error(error);

        if (!cancelled) {
          setBackupError(describeActionError(error, "pobrać backupy"));
        }
      } finally {
        if (!cancelled) {
          setBackupLoading(false);
        }
      }
    }

    loadBackups();

    return () => {
      cancelled = true;
    };
  }, [event?.guild_id]);

  async function createBackup() {
    if (!event?.guild_id) return;

    try {
      setBackupActionLoading(true);
      setBackupError(null);
      setMessage(null);

      const result = await createGuildBackup(event.guild_id);

      setBackups(result.backups || []);

      setMessage(`Backup utworzony: ${result.backup?.fileName || "OK"}`);
    } catch (error) {
      console.error(error);

      setBackupError(describeActionError(error, "utworzyć backup"));
    } finally {
      setBackupActionLoading(false);
    }
  }

  async function restoreBackup(fileName) {
    if (!event?.guild_id) return;

    const confirmed = window.confirm(
      `Przywrócić backup ${fileName}?\n\n` +
        "To nadpisze dane turniejowe tego serwera danymi z backupu.",
    );

    if (!confirmed) return;

    const secondConfirm = window.prompt("Dla bezpieczeństwa wpisz RESTORE");

    if (secondConfirm !== "RESTORE") return;

    try {
      setBackupActionLoading(true);
      setBackupError(null);
      setMessage(null);

      await restoreGuildBackup(event.guild_id, fileName);

      await onRefresh?.();

      setMessage(`Backup przywrócony: ${fileName}`);
    } catch (error) {
      console.error(error);

      setBackupError(describeActionError(error, "przywrócić backup"));
    } finally {
      setBackupActionLoading(false);
    }
  }

  async function finishTournament() {
    const name = archiveName.trim() || event?.slug || slug;

    const confirmed = window.confirm(
      `Zakończyć turniej "${event?.name || slug}"?\n\n` +
        "Zostanie utworzony plik archiwum XLSX, event zostanie " +
        "oznaczony jako zakończony i przeniesiony do archiwum." +
        (cleanupAfterArchive
          ? "\n\nUWAGA: włączone jest także czyszczenie danych operacyjnych eventu."
          : ""),
    );

    if (!confirmed) return;

    if (cleanupAfterArchive) {
      const typed = window.prompt(
        "Wpisz KONIEC, żeby potwierdzić czyszczenie danych po archiwizacji",
      );

      if (typed !== "KONIEC") return;
    }

    try {
      setEndingTournament(true);
      setMessage(null);

      const result = await endTournament(slug, {
        archiveName: name,
        cleanup: cleanupAfterArchive,
      });

      await onRefresh?.();

      setMessage(
        `Turniej zakończony. Archiwum: ${
          result.archive?.filename || `${name}.xlsx`
        }`,
      );
    } catch (error) {
      console.error(error);

      window.alert(describeActionError(error, "zakończyć turniej"));
    } finally {
      setEndingTournament(false);
    }
  }

  return {
    archiveName,
    backupActionLoading,
    backupError,
    backupLoading,
    backups,
    cleanupAfterArchive,
    createBackup,
    endingTournament,
    finishTournament,
    message,
    restoreBackup,
    setArchiveName,
    setCleanupAfterArchive,
  };
}
