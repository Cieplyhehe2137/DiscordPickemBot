import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getEventSummary,
  getEventMatches,
  getEventLeaderboard,
  updateEventPhase,
  updateEventStatus,
  recalculateEvent,
  updateMatchLock,
  getMatchStats,
  getTeams,
  createMatch,
  submitMatchResult,
  getMvp,
  saveMvpCandidates,
  setMvpResult as apiSetMvpResult,
  getClassificationExportUrl,
  getPhaseClearPreview,
  clearEventPhase,
  getGuildBackups,
  createGuildBackup,
  restoreGuildBackup,
  getBackupDownloadUrl,
  endTournament,
  describeActionError
} from '../lib/api';
import Breadcrumbs from '../components/layout/Breadcrumbs';
import { useApp } from '../context/AppContext';
import Skeleton from '../components/ui/Skeleton';
import { socket } from '../lib/socket';
import EventStatusButtons from '../components/admin/EventStatusButtons';
import PublicLinkButtons from '../components/admin/PublicLinkButtons';
import SwissResultsPanel from '../components/admin/SwissResultsPanel';
import PlayoffsResultsPanel from '../components/admin/PlayoffsResultsPanel';
import DoubleElimResultsPanel from '../components/admin/DoubleElimResultsPanel';
import PlayInResultsPanel from '../components/admin/PlayInResultsPanel';
import ResultProposalsPanel from '../components/admin/ResultProposalsPanel';
import BulkMatchModal from '../components/admin/BulkMatchModal';
import MatchEditModal from '../components/admin/MatchEditModal';
import ExactScoreModal from '../components/admin/ExactScoreModal';
import EmptyState from '../components/ui/EmptyState';
import { Swords, FilterX, Trophy } from 'lucide-react';
import { translateStatus, translatePhase } from '../lib/labels';

const MATCH_STATUS_FILTER_LABELS = {
  ALL: 'WSZYSTKIE',
  LIVE: 'NA ŻYWO',
  LOCKED: 'ZABLOKOWANE',
  SCHEDULED: 'ZAPLANOWANE'
};

export default function EventDashboard() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { setSelectedEvent } = useApp();

  const [data, setData] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedPhase, setSelectedPhase] = useState('');
  const [phaseLoading, setPhaseLoading] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  const [expandedMatchId, setExpandedMatchId] = useState(null);
  const [matchSortBy, setMatchSortBy] = useState('match_no');
  const [matchSearch, setMatchSearch] = useState('');
  const [matchStatusFilter, setMatchStatusFilter] = useState('ALL');
  const [matchStats, setMatchStats] = useState({});
  const [matchStatsLoading, setMatchStatsLoading] = useState({});

  const [showCreateMatchModal, setShowCreateMatchModal] = useState(false);
  const [showBulkMatchModal, setShowBulkMatchModal] = useState(false);
  const [editMatch, setEditMatch] = useState(null);
  const [activeTeams, setActiveTeams] = useState([]);
  const [matchForm, setMatchForm] = useState({ phase: 'SWISS', teamA: '', teamB: '', bestOf: 3, startTimeUtc: '' });
  const [creatingMatch, setCreatingMatch] = useState(false);
  const [createMatchError, setCreateMatchError] = useState(null);

  const [resultModalMatch, setResultModalMatch] = useState(null);
  const [exactScoreMatch, setExactScoreMatch] = useState(null);
  const [resultForm, setResultForm] = useState({ resA: '', resB: '' });
  const [submittingResult, setSubmittingResult] = useState(false);
  const [resultError, setResultError] = useState(null);

  const [mvpCandidates, setMvpCandidates] = useState([]);
  const [mvpResult, setMvpResult] = useState(null);
  const [mvpTextarea, setMvpTextarea] = useState('');
  const [savingMvpCandidates, setSavingMvpCandidates] = useState(false);
  const [mvpCandidatesError, setMvpCandidatesError] = useState(null);
  const [selectedMvpCandidateId, setSelectedMvpCandidateId] = useState('');
  const [savingMvpResult, setSavingMvpResult] = useState(false);
  const [mvpResultError, setMvpResultError] = useState(null);

  const [showClearModal, setShowClearModal] = useState(false);
  const [clearPhase, setClearPhase] = useState('SWISS');
  const [clearPreview, setClearPreview] = useState(null);
  const [clearPreviewLoading, setClearPreviewLoading] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState('');
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState(null);
  const [backups, setBackups] = useState([]);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupActionLoading, setBackupActionLoading] = useState(false);
  const [backupError, setBackupError] = useState(null);
  const [endingTournament, setEndingTournament] = useState(false);
  const [archiveName, setArchiveName] = useState('');
  const [endTournamentCleanup, setEndTournamentCleanup] = useState(false);
  const [operationsMessage, setOperationsMessage] = useState(null);

  const event = data?.event;
  const stats = data?.stats;
  const matchStatus = data?.match_status;
  const nextMatch = data?.next_match;
  const phaseInfo = data?.phase_info;

  const sortedMatches = [...matches]
    .filter((match) => {
      if (
        matchStatusFilter !== 'ALL' &&
        match.ui_status !== matchStatusFilter
      ) {
        return false;
      }

      const query = matchSearch.toLowerCase();

      return (
        match.team_a?.toLowerCase().includes(query) ||
        match.team_b?.toLowerCase().includes(query) ||
        match.phase?.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      if (matchSortBy === 'match_no') {
        return (a.match_no || 0) - (b.match_no || 0);
      }

      if (matchSortBy === 'start_time') {
        return new Date(a.start_time_utc || 0) - new Date(b.start_time_utc || 0);
      }

      if (matchSortBy === 'phase') {
        return (a.phase || '').localeCompare(b.phase || '');
      }

      if (matchSortBy === 'locked') {
        return Number(b.is_locked || 0) - Number(a.is_locked || 0);
      }

      return 0;
    });

  useEffect(() => {
    const guildId = event?.guild_id;
    if (!guildId) return;

    let cancelled = false;

    async function loadBackups() {
      try {
        setBackupLoading(true);
        setBackupError(null);

        const result = await getGuildBackups(guildId);
        if (!cancelled) setBackups(result.backups || []);
      } catch (err) {
        console.error(err);
        if (!cancelled) setBackupError(describeActionError(err, 'pobrać backupy'));
      } finally {
        if (!cancelled) setBackupLoading(false);
      }
    }

    loadBackups();

    // Bez tego odpowiedź na porzucone żądanie (zmiana turnieju albo wyjście ze
    // strony w trakcie ładowania) nadpisywała listę backupów już innej gildii.
    return () => { cancelled = true; };
  }, [event?.guild_id]);

  async function handleCreateBackup() {
    if (!event?.guild_id) return;

    try {
      setBackupActionLoading(true);
      setBackupError(null);
      setOperationsMessage(null);

      const result = await createGuildBackup(event.guild_id);

      setBackups(result.backups || []);
      setOperationsMessage(`Backup utworzony: ${result.backup?.fileName || 'OK'}`);
    } catch (err) {
      console.error(err);
      setBackupError(describeActionError(err, 'utworzyć backup'));
    } finally {
      setBackupActionLoading(false);
    }
  }

  // useCallback, bo efekt z nasłuchem socketu ma to w zależnościach - bez
  // stabilnej referencji przepinałby handlery przy każdym renderze.
  const refreshEventData = useCallback(async () => {
    const result = await getEventSummary(slug);

    setData(result);
    setSelectedPhase(result?.event?.phase || '');
    setSelectedEvent(result.event);

    const matchesResult = await getEventMatches(slug);
    setMatches(matchesResult.matches || []);

    const leaderboardResult = await getEventLeaderboard(slug);
    setLeaderboard(leaderboardResult.leaderboard || []);

    const mvpData = await getMvp(slug);
    setMvpCandidates(mvpData.candidates || []);
    setMvpResult(mvpData.result || null);
  }, [slug, setSelectedEvent]);

  async function handleRestoreBackup(fileName) {
    if (!event?.guild_id) return;

    const confirmed = window.confirm(
      `Przywrócić backup ${fileName}?\n\nTo nadpisze dane turniejowe tego serwera danymi z backupu.`
    );

    if (!confirmed) return;

    const secondConfirm = window.prompt('Dla bezpieczeństwa wpisz RESTORE');
    if (secondConfirm !== 'RESTORE') return;

    try {
      setBackupActionLoading(true);
      setBackupError(null);
      setOperationsMessage(null);

      await restoreGuildBackup(event.guild_id, fileName);
      await refreshEventData();

      setOperationsMessage(`Backup przywrócony: ${fileName}`);
    } catch (err) {
      console.error(err);
      setBackupError(describeActionError(err, 'przywrócić backup'));
    } finally {
      setBackupActionLoading(false);
    }
  }

  async function handleEndTournament() {
    const name = archiveName.trim() || event?.slug || slug;

    const confirmed = window.confirm(
      `Zakończyć turniej "${event?.name || slug}"?\n\nZostanie utworzony plik archiwum XLSX, event zostanie oznaczony jako zakończony i przeniesiony do archiwum.` +
      (endTournamentCleanup ? '\n\nUWAGA: włączone jest także czyszczenie danych operacyjnych eventu.' : '')
    );

    if (!confirmed) return;

    if (endTournamentCleanup) {
      const typed = window.prompt('Wpisz KONIEC, żeby potwierdzić czyszczenie danych po archiwizacji');
      if (typed !== 'KONIEC') return;
    }

    try {
      setEndingTournament(true);
      setOperationsMessage(null);

      const result = await endTournament(slug, {
        archiveName: name,
        cleanup: endTournamentCleanup
      });

      await refreshEventData();

      setOperationsMessage(`Turniej zakończony. Archiwum: ${result.archive?.filename || `${name}.xlsx`}`);
    } catch (err) {
      console.error(err);
      alert(describeActionError(err, 'zakończyć turniej'));
    } finally {
      setEndingTournament(false);
    }
  }

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);

        const result = await getEventSummary(slug);

        setData(result);
        setSelectedEvent(result.event);
        setSelectedPhase(result?.event?.phase || '');

        const matchesResult = await getEventMatches(slug);
        setMatches(matchesResult.matches || []);

        const leaderboardResult = await getEventLeaderboard(slug);
        setLeaderboard(leaderboardResult.leaderboard || []);

        const mvpData = await getMvp(slug);
        setMvpCandidates(mvpData.candidates || []);
        setMvpResult(mvpData.result || null);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [slug, setSelectedEvent]);

  useEffect(() => {
    function handleDashboardRefresh(payload) {
      if (payload?.slug !== slug) return;

      refreshEventData();
    }

    function handleMatchUpdated(payload) {
      if (payload?.slug !== slug) return;

      setMatches((prev) =>
        prev.map((m) =>
          String(m.id) === String(payload.matchId)
            ? {
              ...m,
              is_locked: payload.locked ? 1 : 0,
              ui_status: payload.locked ? 'LOCKED' : 'OPEN'
            }
            : m
        )
      );
    }

    function handleEventStatusUpdated(payload) {
      if (payload?.slug !== slug) return;

      setData((prev) => ({
        ...prev,
        event: {
          ...prev.event,
          status: payload.status
        },
        phase_info: {
          ...prev.phase_info,
          status: payload.status
        }
      }));
    }

    socket.on('dashboard:refresh', handleDashboardRefresh);
    socket.on('match:updated', handleMatchUpdated);
    socket.on('event:status_updated', handleEventStatusUpdated);

    return () => {
      socket.off('dashboard:refresh', handleDashboardRefresh);
      socket.off('event:status_updated', handleEventStatusUpdated);
      socket.off('match:updated', handleMatchUpdated);
    };
  }, [slug, refreshEventData]);



  async function handlePhaseUpdate() {
    try {
      setPhaseLoading(true);

      await updateEventPhase(slug, selectedPhase);
    } catch (err) {
      console.error(err);
      alert(describeActionError(err, 'zaktualizować fazę'));
    } finally {
      setPhaseLoading(false);
    }
  }

  async function handleStatusUpdate(status) {
    try {
      await updateEventStatus(slug, status);
    } catch (err) {
      console.error(err);
      alert(describeActionError(err, 'zaktualizować status'));
    }
  }

  async function handleCloseEvent() {
    await handleStatusUpdate('CLOSED');
  }

  async function handleArchiveEvent() {
    const confirmed = window.confirm(
      `Zarchiwizować event "${event?.name || slug}"?\n\nUkryje go to z widoków aktywnych eventów, ale nie usunie danych z bazy.`
    );

    if (!confirmed) return;

    await handleStatusUpdate('ARCHIVED');
  }

  async function handleRecalculate() {
    try {
      setRecalculating(true);

      await recalculateEvent(slug);

      alert('Wyniki przeliczone!');
    } catch (err) {
      console.error(err);
      alert(describeActionError(err, 'przeliczyć wyniki'));
    } finally {
      setRecalculating(false);
    }
  }

  async function handleMatchLock(matchId, locked) {
    try {
      await updateMatchLock(matchId, locked);
    } catch (err) {
      console.error(err);
      alert(describeActionError(err, 'zaktualizować blokadę meczu'));
    }
  }

  async function handleBulkMatchLock(locked) {
    const confirmed = window.confirm(
      `${locked ? 'Zablokować' : 'Odblokować'} wszystkie widoczne mecze?`
    );

    if (!confirmed) return;

    try {
      await Promise.all(
        sortedMatches.map((match) => updateMatchLock(match.id, locked))
      );

    } catch (err) {
      console.error(err);
      alert(describeActionError(err, 'zaktualizować blokady meczów'));
    }
  }

  async function openCreateMatchModal() {
    setCreateMatchError(null);
    setMatchForm({ phase: event?.phase || 'SWISS', teamA: '', teamB: '', bestOf: 3, startTimeUtc: '' });
    setShowCreateMatchModal(true);

    try {
      const result = await getTeams(event.guild_id, { includeInactive: false });
      setActiveTeams(result.teams || []);
    } catch (err) {
      console.error(err);
      setActiveTeams([]);
    }
  }

  async function handleCreateMatch() {
    try {
      setCreatingMatch(true);
      setCreateMatchError(null);

      await createMatch(event.guild_id, slug, {
        phase: matchForm.phase,
        teamA: matchForm.teamA,
        teamB: matchForm.teamB,
        bestOf: Number(matchForm.bestOf),
        startTimeUtc: matchForm.startTimeUtc || null
      });

      await refreshEventData();
      setShowCreateMatchModal(false);
    } catch (err) {
      console.error(err);
      setCreateMatchError(err?.status === 400 ? err.message : describeActionError(err, 'utworzyć mecz'));
    } finally {
      setCreatingMatch(false);
    }
  }

  function openResultModal(match) {
    setResultError(null);
    setResultForm({ resA: '', resB: '' });
    setResultModalMatch(match);
  }

  async function handleSubmitResult() {
    try {
      setSubmittingResult(true);
      setResultError(null);

      const resA = Number(resultForm.resA);
      const resB = Number(resultForm.resB);

      await submitMatchResult(resultModalMatch.id, resA, resB);

      await refreshEventData();
      setResultModalMatch(null);
    } catch (err) {
      console.error(err);
      setResultError(err?.status === 400 ? err.message : describeActionError(err, 'zapisać wynik'));
    } finally {
      setSubmittingResult(false);
    }
  }

  function parseMvpTextarea(raw) {
    return String(raw)
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [nickname, teamName] = line.split('|').map((v) => v?.trim());
        return { nickname, teamName: teamName || null };
      })
      .filter((e) => e.nickname);
  }

  async function handleSaveMvpCandidates() {
    try {
      setSavingMvpCandidates(true);
      setMvpCandidatesError(null);

      const entries = parseMvpTextarea(mvpTextarea);

      if (!entries.length) {
        setMvpCandidatesError('Wpisz przynajmniej jednego kandydata (format: nick | drużyna).');
        return;
      }

      await saveMvpCandidates(slug, entries);
      await refreshEventData();
      setMvpTextarea('');
    } catch (err) {
      console.error(err);
      setMvpCandidatesError(err?.status === 400 ? err.message : describeActionError(err, 'zapisać kandydatów MVP'));
    } finally {
      setSavingMvpCandidates(false);
    }
  }

  async function handleSetMvpResult() {
    try {
      setSavingMvpResult(true);
      setMvpResultError(null);

      await apiSetMvpResult(slug, Number(selectedMvpCandidateId));
      await refreshEventData();
    } catch (err) {
      console.error(err);
      setMvpResultError(describeActionError(err, 'ustawić oficjalnego MVP'));
    } finally {
      setSavingMvpResult(false);
    }
  }

  async function openClearModal() {
    setClearError(null);
    setClearConfirmText('');
    setShowClearModal(true);
    await loadClearPreview(clearPhase);
  }

  async function loadClearPreview(phase) {
    try {
      setClearPreviewLoading(true);
      setClearPreview(null);

      const result = await getPhaseClearPreview(slug, phase);
      setClearPreview(result);
    } catch (err) {
      console.error(err);
      setClearError(describeActionError(err, 'wczytać podgląd czyszczenia'));
    } finally {
      setClearPreviewLoading(false);
    }
  }

  async function handleConfirmClear() {
    try {
      setClearing(true);
      setClearError(null);

      const result = await clearEventPhase(slug, clearPhase);

      await refreshEventData();
      setShowClearModal(false);

      alert(
        `Wyczyszczono ${clearPhase}: ${result.deleted.matches} meczów, ` +
        `${result.deleted.predictions} typów, ${result.deleted.results} wyników, ` +
        `${result.deleted.points} punktów.`
      );
    } catch (err) {
      console.error(err);
      setClearError(describeActionError(err, 'wyczyścić fazę'));
    } finally {
      setClearing(false);
    }
  }

  async function handleToggleMatchDetails(matchId) {
    if (expandedMatchId === matchId) {
      setExpandedMatchId(null);
      return;
    }

    setExpandedMatchId(matchId);

    try {
      setMatchStatsLoading((prev) => ({
        ...prev,
        [matchId]: true
      }));

      const result = await getMatchStats(matchId);

      setMatchStats((prev) => ({
        ...prev,
        [matchId]: result.stats
      }));
    } catch (err) {
      console.error(err);
    } finally {
      setMatchStatsLoading((prev) => ({
        ...prev,
        [matchId]: false
      }));
    }
  }

  return (
    <div>
      <main className="mx-auto max-w-7xl px-6 py-8">
        <Breadcrumbs
          items={[
            {
              label: 'Serwery',
              to: '/app/guilds'
            },
            {
              label: 'Serwer',
              to: `/app/guilds/${event?.guild_id || ''}`
            },
            {
              label: event?.name || slug
            }
          ]}
        />

        <div className="mb-10">
          <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
            Panel eventu
          </p>

          <h1 className="mt-2 text-5xl font-black">
            {event?.name || slug}
          </h1>

          <div className="mt-4">
            <span
              className={`inline-flex rounded-2xl px-5 py-3 text-sm font-black uppercase tracking-[0.2em] ${event?.status === 'OPEN'
                ? 'bg-green-500/15 text-green-300'
                : event?.status === 'CLOSED'
                  ? 'bg-red-500/15 text-red-300'
                  : 'bg-zinc-500/15 text-zinc-300'
                }`}
            >
              {event?.status ? translateStatus(event.status) : 'NIEZNANY'}
            </span>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-5">
            <InfoPill label="Faza" value={event?.phase ? translatePhase(event.phase) : '-'} />
            <InfoPill label="Status" value={event?.status ? translateStatus(event.status) : '-'} />
            <InfoPill label="Uczestnicy" value={stats?.participants ?? 0} />
            <InfoPill label="Mecze" value={stats?.matches ?? 0} />
            <InfoPill label="Typy" value={stats?.predictions ?? 0} />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <PublicLinkButtons eventSlug={slug} size="sm" />

            <EventStatusButtons
              status={event?.status}
              onOpen={() => handleStatusUpdate('OPEN')}
              onClose={() => handleStatusUpdate('CLOSED')}
              onArchive={handleArchiveEvent}
              size="md"
            />

            <button
              onClick={() => navigate(-1)}
              className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-black text-white/70 transition hover:bg-white/10"
            >
              Wstecz
            </button>
          </div>
        </div>

        {loading && (
          <div className="grid gap-6">
            <div className="grid gap-6 lg:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-40" />
              ))}
            </div>

            <Skeleton className="h-64" />
            <Skeleton className="h-96" />
          </div>
        )}

        {!loading && data && (
          <>
            <div className="grid gap-6 lg:grid-cols-4">
              <Panel title="Uczestnicy" value={stats?.participants ?? 0} />
              <Panel title="Typy" value={stats?.predictions ?? 0} />
              <Panel title="Mecze" value={stats?.matches ?? 0} />
              <Panel title="Aktualna faza" value={event?.phase ? translatePhase(event.phase) : '-'} />
            </div>

            <div className="mt-10 grid gap-6 lg:grid-cols-3">
              <StatusCard title="NA ŻYWO" value={matchStatus?.live ?? 0} />
              <StatusCard title="ZABLOKOWANE" value={matchStatus?.locked ?? 0} />
              <StatusCard title="ZAPLANOWANE" value={matchStatus?.scheduled ?? 0} />
            </div>

            {nextMatch && (
              <div className="mt-10 rounded-[2rem] border border-violet-400/20 bg-violet-500/10 p-8">
                <p className="text-sm font-bold uppercase tracking-[0.25em] text-violet-300">
                  Następny mecz
                </p>

                <h2 className="mt-3 text-4xl font-black">
                  {nextMatch.team_a} vs {nextMatch.team_b}
                </h2>

                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <InfoMini label="Faza" value={nextMatch.phase ? translatePhase(nextMatch.phase) : '-'} />
                  <InfoMini label="BO" value={`BO${nextMatch.best_of || 3}`} />
                  <InfoMini label="Start UTC" value={nextMatch.start_time_utc || '-'} />
                </div>
              </div>
            )}

            <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/5 p-8">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                    Postęp turnieju
                  </p>

                  <h2 className="mt-2 text-4xl font-black">
                    {phaseInfo?.current ? translatePhase(phaseInfo.current) : 'NIEZNANA'}
                  </h2>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/30 px-6 py-3">
                  <p className="text-sm font-bold uppercase tracking-[0.2em] text-white/50">
                    Status
                  </p>

                  <p className="mt-1 text-xl font-black text-green-300">
                    {phaseInfo?.status ? translateStatus(phaseInfo.status) : 'NIEZNANY'}
                  </p>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-4">
                <PhaseStep active={phaseInfo?.current === 'PLAY_IN'} label="Play-In" />
                <PhaseStep active={phaseInfo?.current === 'SWISS'} label="Swiss" />
                <PhaseStep active={phaseInfo?.current === 'PLAYOFFS'} label="Playoffs" />
                <PhaseStep active={phaseInfo?.current === 'FINISHED'} label="Zakończona" />
              </div>
            </div>

            <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/5 p-8">
              <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                Panel administracyjny
              </p>

              <h2 className="mt-2 text-3xl font-black">
                Zarządzanie eventem
              </h2>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <button
                  onClick={handleRecalculate}
                  disabled={recalculating}
                  className="rounded-2xl bg-violet-500 px-6 py-4 font-black transition hover:bg-violet-400 disabled:opacity-50"
                >
                  {recalculating ? 'Przeliczanie...' : 'Przelicz wyniki'}
                </button>

                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-white/50">
                    Zmień fazę
                  </p>

                  <select
                    value={selectedPhase}
                    onChange={(e) => setSelectedPhase(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-zinc-900 px-4 py-3 text-white outline-none"
                  >
                    <option value="NOT_STARTED">Nierozpoczęta</option>
                    <option value="PLAY_IN">Play-In</option>
                    <option value="SWISS">Swiss</option>
                    <option value="PLAYOFFS">Playoffs</option>
                    <option value="FINISHED">Zakończona</option>
                  </select>

                  <button
                    onClick={handlePhaseUpdate}
                    disabled={phaseLoading}
                    className="mt-4 w-full rounded-xl bg-violet-500 px-4 py-3 font-black transition hover:bg-violet-400 disabled:opacity-50"
                  >
                    {phaseLoading ? 'Zapisywanie...' : 'Zapisz fazę'}
                  </button>
                </div>

                <button
                  onClick={handleCloseEvent}
                  disabled={event?.status === 'CLOSED'}
                  className="rounded-2xl border border-red-400/20 bg-red-500/10 px-6 py-4 font-black text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Zamknij event
                </button>

                <button
                  onClick={() => window.open(getClassificationExportUrl(slug), '_blank')}
                  className="rounded-2xl border border-violet-400/20 bg-violet-500/10 px-6 py-4 font-black text-violet-200 transition hover:bg-violet-500/20"
                >
                  Eksportuj klasyfikację
                </button>
              </div>
            </div>

            <div className="mt-10 rounded-[2rem] border border-amber-400/20 bg-amber-500/5 p-8">
              <p className="text-sm uppercase tracking-[0.25em] text-amber-300">
                Operacje turniejowe
              </p>

              <h2 className="mt-2 text-3xl font-black">
                Backup, restore i zakończenie turnieju
              </h2>

              <p className="mt-2 text-white/50">
                To są odpowiedniki operatorskich akcji z Discorda. Restore i cleanup mają dodatkowe potwierdzenia.
              </p>

              {operationsMessage && (
                <div className="mt-5 rounded-2xl border border-green-400/20 bg-green-500/10 px-5 py-4 font-bold text-green-200">
                  {operationsMessage}
                </div>
              )}

              {backupError && (
                <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-500/10 px-5 py-4 font-bold text-red-200">
                  {backupError}
                </div>
              )}

              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-black">Backup bazy</h3>
                      <p className="mt-1 text-sm text-white/50">
                        Tworzy SQL tylko dla danych tego serwera tam, gdzie tabela ma guild_id.
                        Trzymanych jest 10 najnowszych — starsze kasują się same.
                      </p>
                    </div>

                    <button
                      onClick={handleCreateBackup}
                      disabled={backupActionLoading || !event?.guild_id}
                      className="rounded-xl bg-amber-500 px-5 py-3 font-black text-black transition hover:bg-amber-400 disabled:opacity-50"
                    >
                      {backupActionLoading ? 'Pracuję...' : 'Utwórz backup'}
                    </button>
                  </div>

                  <div className="mt-5 max-h-72 overflow-auto rounded-xl border border-white/10">
                    {backupLoading && <p className="p-4 text-white/50">Ładowanie backupów...</p>}

                    {!backupLoading && backups.length === 0 && (
                      <p className="p-4 text-white/50">Brak backupów dla tego serwera.</p>
                    )}

                    {!backupLoading && backups.map((backup) => (
                      <div
                        key={backup.fileName}
                        className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4 last:border-b-0"
                      >
                        <div>
                          <p className="break-all font-bold text-white">{backup.fileName}</p>
                          <p className="mt-1 text-xs text-white/40">
                            {new Date(backup.modifiedAt).toLocaleString('pl-PL')} · {(Number(backup.sizeBytes || 0) / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>

                        <div className="flex gap-2">
                          {/* Zwykła kotwica, nie Link: to pobranie pliku z API,
                              a nie trasa aplikacji. */}
                          <a
                            href={getBackupDownloadUrl(event.guild_id, backup.fileName)}
                            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-black text-white/80 transition hover:bg-white/10"
                          >
                            Pobierz
                          </a>

                          <button
                            onClick={() => handleRestoreBackup(backup.fileName)}
                            disabled={backupActionLoading}
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
                    Tworzy XLSX do archiwum, zamyka aktywne panele i oznacza event jako zakończony/archiwalny.
                  </p>

                  <label className="mt-5 block text-sm font-bold uppercase tracking-[0.2em] text-white/50">
                    Nazwa archiwum
                  </label>

                  <input
                    value={archiveName}
                    onChange={(e) => setArchiveName(e.target.value)}
                    placeholder={event?.slug || 'nazwa_archiwum'}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-amber-400/50"
                  />

                  <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-red-400/20 bg-red-500/5 p-4 text-sm text-white/70">
                    <input
                      type="checkbox"
                      checked={endTournamentCleanup}
                      onChange={(e) => setEndTournamentCleanup(e.target.checked)}
                      className="mt-1"
                    />

                    <span>
                      Po archiwizacji wyczyść dane operacyjne tego eventu. Zostaw wyłączone, jeśli chcesz tylko zamknąć i zarchiwizować event bez kasowania typów/meczów.
                    </span>
                  </label>

                  <button
                    onClick={handleEndTournament}
                    disabled={endingTournament}
                    className="mt-5 w-full rounded-xl border border-amber-400/40 bg-amber-500/20 px-5 py-4 font-black text-amber-100 transition hover:bg-amber-500/30 disabled:opacity-50"
                  >
                    {endingTournament ? 'Kończenie turnieju...' : 'Zakończ i zarchiwizuj'}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-10">
              <ResultProposalsPanel slug={slug} onResultApplied={refreshEventData} />
            </div>

            <SwissResultsPanel slug={slug} guildId={event?.guild_id} />

            <PlayoffsResultsPanel slug={slug} guildId={event?.guild_id} />

            <DoubleElimResultsPanel slug={slug} guildId={event?.guild_id} />

            <PlayInResultsPanel slug={slug} guildId={event?.guild_id} />

            <div className="mt-10 rounded-[2rem] border border-red-500/30 bg-red-500/5 p-8">
              <p className="text-sm uppercase tracking-[0.25em] text-red-300">
                Strefa zagrożenia
              </p>

              <h2 className="mt-2 text-3xl font-black">
                Wyczyść fazę
              </h2>

              <p className="mt-2 text-white/50">
                Trwale usuwa wszystkie mecze, typy, wyniki i punkty tylko dla jednej fazy tego eventu.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-4">
                <select
                  value={clearPhase}
                  onChange={(e) => setClearPhase(e.target.value)}
                  className="rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none focus:border-red-400/40"
                >
                  <option value="PLAY_IN">Play-In</option>
                  <option value="SWISS">Swiss</option>
                  <option value="PLAYOFFS">Playoffs</option>
                </select>

                <button
                  onClick={openClearModal}
                  className="rounded-2xl border border-red-400/40 bg-red-500/20 px-6 py-4 font-black text-red-200 transition hover:bg-red-500/30"
                >
                  Wyczyść fazę...
                </button>
              </div>
            </div>

            <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/5 p-8">
              <h2 className="text-3xl font-black">
                Przegląd meczów
              </h2>

              <p className="mt-4 text-white/60">
                ID eventu: {event?.id}
              </p>
            </div>

            <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/5 p-8">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-3xl font-black">
                  Mecze
                </h2>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => setShowBulkMatchModal(true)}
                    className="rounded-2xl border border-violet-400/30 bg-violet-500/10 px-6 py-4 font-black text-violet-200 transition hover:bg-violet-500/20"
                  >
                    Utwórz hurtem
                  </button>

                  <button
                    onClick={openCreateMatchModal}
                    className="rounded-2xl bg-violet-500 px-6 py-4 font-black transition hover:bg-violet-400"
                  >
                    Utwórz mecz
                  </button>
                </div>
              </div>

              <div className="sticky top-4 z-20 mt-6 rounded-[2rem] border border-white/10 bg-zinc-950/80 p-5 backdrop-blur-xl">
                <div className="grid gap-4 md:grid-cols-[1fr_260px]">
                  <input
                    value={matchSearch}
                    onChange={(e) => setMatchSearch(e.target.value)}
                    placeholder="Szukaj meczów..."
                    className="w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none transition focus:border-violet-400/40"
                  />

                  <select
                    value={matchSortBy}
                    onChange={(e) => setMatchSortBy(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none transition focus:border-violet-400/40"
                  >
                    <option value="match_no">Sortuj wg numeru meczu</option>
                    <option value="start_time">Sortuj wg czasu rozpoczęcia</option>
                    <option value="phase">Sortuj wg fazy</option>
                    <option value="locked">Najpierw zablokowane</option>
                  </select>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  {['ALL', 'LIVE', 'LOCKED', 'SCHEDULED'].map((status) => (
                    <button
                      key={status}
                      onClick={() => setMatchStatusFilter(status)}
                      className={`rounded-2xl px-5 py-3 text-sm font-black transition ${matchStatusFilter === status
                        ? 'bg-violet-500 text-white'
                        : 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                        }`}
                    >
                      {MATCH_STATUS_FILTER_LABELS[status]}
                    </button>
                  ))}
                </div>

                <div className="mt-4 text-sm font-bold text-white/40">
                  Pokazano {sortedMatches.length} z {matches.length} meczów
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    onClick={() => handleBulkMatchLock(true)}
                    disabled={sortedMatches.length === 0}
                    className="rounded-2xl border border-red-400/20 bg-red-500/10 px-5 py-3 text-sm font-black text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Zablokuj widoczne
                  </button>

                  <button
                    onClick={() => handleBulkMatchLock(false)}
                    disabled={sortedMatches.length === 0}
                    className="rounded-2xl border border-green-400/20 bg-green-500/10 px-5 py-3 text-sm font-black text-green-300 transition hover:bg-green-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Odblokuj widoczne
                  </button>

                  <button
                    onClick={() => {
                      setMatchSearch('');
                      setMatchSortBy('match_no');
                      setMatchStatusFilter('ALL');
                    }}
                    className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-white/70 transition hover:bg-white/10"
                  >
                    Wyczyść filtry
                  </button>
                </div>
              </div>

              <div className="mt-6 grid gap-4">
                {sortedMatches.length === 0 && (
                  matches.length === 0 ? (
                    <EmptyState
                      icon={Swords}
                      title="Brak meczów dla tego eventu"
                      description="Użyj przycisku Utwórz mecz powyżej, aby dodać pierwszy."
                    />
                  ) : (
                    <EmptyState
                      icon={FilterX}
                      title="Żaden mecz nie pasuje do wybranych filtrów"
                      description="Spróbuj innego filtra statusu lub je wyczyść."
                    />
                  )
                )}

                {sortedMatches.map((match, matchIndex) => {
                  const predictions = matchStats[match.id]?.predictions || 0;
                  const teamAPicks = matchStats[match.id]?.team_a_picks || 0;
                  const teamBPicks = matchStats[match.id]?.team_b_picks || 0;

                  const teamAPercent = predictions
                    ? Math.round((teamAPicks / predictions) * 100)
                    : 0;

                  const teamBPercent = predictions
                    ? Math.round((teamBPicks / predictions) * 100)
                    : 0;

                  return (
                    <div
                      key={match.id}
                      style={{ animationDelay: `${Math.min(matchIndex, 10) * 40}ms` }}
                      className="animate-fade-in-up rounded-2xl border border-white/10 bg-black/30 p-5 transition hover:border-violet-400/20"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-6">
                        <div>
                          <p className="text-sm font-bold uppercase tracking-[0.2em] text-violet-300">
                            {match.phase ? translatePhase(match.phase) : 'Mecz'}
                          </p>

                          <h3 className="mt-2 text-2xl font-black">
                            {match.team_a} vs {match.team_b}
                          </h3>
                        </div>

                        <div className="text-right">
                          <div
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.15em] ${match.ui_status === 'LIVE'
                              ? 'bg-green-500/20 text-green-300'
                              : match.ui_status === 'LOCKED'
                                ? 'bg-red-500/20 text-red-300'
                                : 'bg-yellow-500/20 text-yellow-300'
                              }`}
                          >
                            {translateStatus(match.ui_status)}
                          </div>

                          <p className="mt-2 text-sm text-white/40">
                            {match.start_time_utc
                              ? new Date(match.start_time_utc).toLocaleString()
                              : 'Brak daty'}
                          </p>

                          <div className="mt-4 flex gap-2">
                            <button
                              onClick={() => handleToggleMatchDetails(match.id)}
                              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-white/70 transition hover:bg-white/10"
                            >
                              {expandedMatchId === match.id ? 'Ukryj' : 'Otwórz'}
                            </button>

                            <button
                              onClick={() => handleMatchLock(match.id, match.ui_status !== 'LOCKED')}
                              className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-black text-red-300 transition hover:bg-red-500/20"
                            >
                              {match.ui_status === 'LOCKED' ? 'Odblokuj' : 'Zablokuj'}
                            </button>

                            <button
                              onClick={() => openResultModal(match)}
                              className="rounded-xl border border-violet-400/20 bg-violet-500/10 px-3 py-2 text-xs font-black text-violet-200 transition hover:bg-violet-500/20"
                            >
                              Wpisz wynik
                            </button>

                            <button
                              onClick={() => setExactScoreMatch(match)}
                              className="rounded-xl border border-violet-400/20 bg-violet-500/10 px-3 py-2 text-xs font-black text-violet-200 transition hover:bg-violet-500/20"
                            >
                              Dokładne wyniki
                            </button>

                            <button
                              onClick={() => setEditMatch(match)}
                              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-black text-white/70 transition hover:bg-white/10"
                            >
                              Edytuj
                            </button>
                          </div>
                        </div>
                      </div>

                      {expandedMatchId === match.id && (
                        <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-5">
                          <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
                            Szczegóły meczu
                          </p>

                          {matchStatsLoading[match.id] && (
                            <p className="mt-4 text-sm font-bold text-white/40">
                              Ładowanie statystyk meczu...
                            </p>
                          )}

                          <div className="mt-4 grid gap-4 md:grid-cols-9">
                            <InfoMini label="ID meczu" value={match.id} />
                            <InfoMini label="Faza" value={match.phase ? translatePhase(match.phase) : '-'} />
                            <InfoMini label="BO" value={`BO${match.best_of || 3}`} />
                            <InfoMini
                              label="Zablokowany"
                              value={match.is_locked ? 'TAK' : 'NIE'}
                            />
                            <InfoMini label="Typy" value={predictions} />
                            <InfoMini label={match.team_a} value={teamAPicks} />
                            <InfoMini label={match.team_b} value={teamBPicks} />
                            <InfoMini label={`${match.team_a} %`} value={`${teamAPercent}%`} />
                            <InfoMini label={`${match.team_b} %`} value={`${teamBPercent}%`} />
                          </div>

                          {predictions > 0 && (
                            <div className="mt-6">
                              <div className="flex items-center justify-between text-sm font-bold text-white/50">
                                <span>
                                  {match.team_a} — {teamAPercent}%
                                </span>

                                <span>
                                  {match.team_b} — {teamBPercent}%
                                </span>
                              </div>

                              <div className="mt-3 flex h-4 overflow-hidden rounded-full bg-white/10">
                                <div
                                  className="bg-violet-500"
                                  style={{
                                    width: `${teamAPercent}%`
                                  }}
                                />

                                <div
                                  className="bg-red-500"
                                  style={{
                                    width: `${teamBPercent}%`
                                  }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/5 p-8">
              <h2 className="text-3xl font-black">
                Ranking
              </h2>

              <div className="mt-6 grid gap-4">
                {leaderboard.length === 0 && (
                  <EmptyState
                    icon={Trophy}
                    title="Brak danych rankingu"
                    description="Wyniki pojawią się, gdy typy zostaną zablokowane i napłyną wyniki."
                  />
                )}

                {leaderboard.map((user, index) => (
                  <div
                    key={user.user_id}
                    style={{ animationDelay: `${Math.min(index, 10) * 40}ms` }}
                    className="card-hover animate-fade-in-up flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 p-5 transition hover:border-violet-400/20"
                  >
                    <div className="flex items-center gap-5">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/20 text-xl font-black">
                        #{index + 1}
                      </div>

                      <div>
                        <h3 className="text-2xl font-black">
                          {user.username || user.user_id}
                        </h3>

                        <p className="text-sm text-white/40">
                          Gracz Pick&apos;Em
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-3xl font-black text-green-300">
                        {user.total_points}
                      </p>

                      <p className="text-sm text-white/40">
                        punktów
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/5 p-8">
              <h2 className="text-3xl font-black">
                MVP
              </h2>

              <p className="mt-2 text-white/50">
                Oficjalny MVP:{' '}
                <strong className="text-white">
                  {mvpResult
                    ? (mvpCandidates.find((c) => c.id === mvpResult.candidate_id)?.nickname || `#${mvpResult.candidate_id}`)
                    : 'Nie ustawiono'}
                </strong>
              </p>

              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.2em] text-white/50">
                    Dodaj / zastąp kandydatów
                  </p>

                  <p className="mt-2 text-sm text-white/40">
                    Jeden na linię, format: nick | drużyna (drużyna opcjonalna). Zastępuje obecną listę kandydatów.
                  </p>

                  <textarea
                    value={mvpTextarea}
                    onChange={(e) => setMvpTextarea(e.target.value)}
                    rows={6}
                    placeholder={'s1mple | Team A\nZywOo | Team B'}
                    className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none transition focus:border-violet-400/40"
                  />

                  {mvpCandidatesError && (
                    <div className="mt-3 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm font-bold text-red-300">
                      {mvpCandidatesError}
                    </div>
                  )}

                  <button
                    onClick={handleSaveMvpCandidates}
                    disabled={savingMvpCandidates || !mvpTextarea.trim()}
                    className="mt-4 rounded-2xl bg-violet-500 px-6 py-4 font-black transition hover:bg-violet-400 disabled:opacity-50"
                  >
                    {savingMvpCandidates ? 'Zapisywanie...' : 'Zapisz kandydatów'}
                  </button>
                </div>

                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.2em] text-white/50">
                    Ustaw oficjalnego MVP
                  </p>

                  <p className="mt-2 text-sm text-white/40">
                    {mvpCandidates.filter((c) => c.is_active).length} aktywnych kandydatów
                  </p>

                  <select
                    value={selectedMvpCandidateId}
                    onChange={(e) => setSelectedMvpCandidateId(e.target.value)}
                    className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none transition focus:border-violet-400/40"
                  >
                    <option value="">Wybierz kandydata...</option>
                    {mvpCandidates.filter((c) => c.is_active).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nickname}{c.team_name ? ` (${c.team_name})` : ''}
                      </option>
                    ))}
                  </select>

                  {mvpResultError && (
                    <div className="mt-3 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm font-bold text-red-300">
                      {mvpResultError}
                    </div>
                  )}

                  <button
                    onClick={handleSetMvpResult}
                    disabled={savingMvpResult || !selectedMvpCandidateId}
                    className="mt-4 rounded-2xl bg-violet-500 px-6 py-4 font-black transition hover:bg-violet-400 disabled:opacity-50"
                  >
                    {savingMvpResult ? 'Zapisywanie...' : 'Ustaw oficjalnego MVP'}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      {editMatch && (
        <MatchEditModal
          guildId={event?.guild_id}
          match={editMatch}
          onClose={() => setEditMatch(null)}
          onSaved={(w) => {
            refreshEventData();
            if (w?.przeliczonoPunkty) alert('Zapisano. Punkty tego meczu przeliczone.');
          }}
          onDeleted={() => {
            alert('Mecz usunięty.');
            refreshEventData();
          }}
        />
      )}

      {showBulkMatchModal && (
        <BulkMatchModal
          guildId={event?.guild_id}
          slug={slug}
          onClose={() => setShowBulkMatchModal(false)}
          onCreated={(ile) => {
            alert(`Utworzono ${ile} meczów.`);
            refreshEventData();
          }}
        />
      )}

      {showCreateMatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-zinc-950 p-8 text-white shadow-2xl">
            <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
              Utwórz mecz
            </p>

            <h2 className="mt-2 text-3xl font-black">
              Nowy mecz
            </h2>

            <div className="mt-8 grid gap-5">
              <div>
                <label className="text-sm font-bold text-white/60">Faza</label>
                <select
                  value={matchForm.phase}
                  onChange={(e) => setMatchForm((f) => ({ ...f, phase: e.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none focus:border-violet-400/50"
                >
                  <option value="PLAY_IN">Play-In</option>
                  <option value="SWISS">Swiss</option>
                  <option value="PLAYOFFS">Playoffs</option>
                </select>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-bold text-white/60">Drużyna A</label>
                  <select
                    value={matchForm.teamA}
                    onChange={(e) => setMatchForm((f) => ({ ...f, teamA: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none focus:border-violet-400/50"
                  >
                    <option value="">Wybierz drużynę...</option>
                    {activeTeams.map((t) => (
                      <option key={t.id} value={t.name}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-bold text-white/60">Drużyna B</label>
                  <select
                    value={matchForm.teamB}
                    onChange={(e) => setMatchForm((f) => ({ ...f, teamB: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none focus:border-violet-400/50"
                  >
                    <option value="">Wybierz drużynę...</option>
                    {activeTeams.map((t) => (
                      <option key={t.id} value={t.name}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-bold text-white/60">Do ilu wygranych (BO)</label>
                  <select
                    value={matchForm.bestOf}
                    onChange={(e) => setMatchForm((f) => ({ ...f, bestOf: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none focus:border-violet-400/50"
                  >
                    <option value={1}>BO1</option>
                    <option value={3}>BO3</option>
                    <option value={5}>BO5</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-bold text-white/60">Czas rozpoczęcia (opcjonalnie)</label>
                  <input
                    type="datetime-local"
                    value={matchForm.startTimeUtc}
                    onChange={(e) => setMatchForm((f) => ({ ...f, startTimeUtc: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none focus:border-violet-400/50"
                  />
                </div>
              </div>
            </div>

            {createMatchError && (
              <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm font-bold text-red-300">
                {createMatchError}
              </div>
            )}

            <div className="mt-8 flex justify-end gap-4">
              <button
                onClick={() => setShowCreateMatchModal(false)}
                className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 font-black text-white/70 transition hover:bg-white/10"
              >
                Anuluj
              </button>

              <button
                onClick={handleCreateMatch}
                disabled={creatingMatch || !matchForm.teamA || !matchForm.teamB || matchForm.teamA === matchForm.teamB}
                className="rounded-2xl bg-violet-500 px-6 py-4 font-black transition hover:bg-violet-400 disabled:opacity-50"
              >
                {creatingMatch ? 'Tworzenie...' : 'Utwórz mecz'}
              </button>
            </div>
          </div>
        </div>
      )}

      {resultModalMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-zinc-950 p-8 text-white shadow-2xl">
            <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
              Wpisz wynik
            </p>

            <h2 className="mt-2 text-3xl font-black">
              {resultModalMatch.team_a} vs {resultModalMatch.team_b}
            </h2>

            <div className="mt-8 grid grid-cols-2 gap-5">
              <div>
                <label className="text-sm font-bold text-white/60">{resultModalMatch.team_a}</label>
                <input
                  type="number"
                  min="0"
                  value={resultForm.resA}
                  onChange={(e) => setResultForm((f) => ({ ...f, resA: e.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none focus:border-violet-400/50"
                />
              </div>

              <div>
                <label className="text-sm font-bold text-white/60">{resultModalMatch.team_b}</label>
                <input
                  type="number"
                  min="0"
                  value={resultForm.resB}
                  onChange={(e) => setResultForm((f) => ({ ...f, resB: e.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none focus:border-violet-400/50"
                />
              </div>
            </div>

            <p className="mt-4 text-sm text-white/40">
              Zapis przelicza punkty dla wszystkich typów tego meczu.
            </p>

            {resultError && (
              <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm font-bold text-red-300">
                {resultError}
              </div>
            )}

            <div className="mt-8 flex justify-end gap-4">
              <button
                onClick={() => setResultModalMatch(null)}
                className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 font-black text-white/70 transition hover:bg-white/10"
              >
                Anuluj
              </button>

              <button
                onClick={handleSubmitResult}
                disabled={submittingResult || resultForm.resA === '' || resultForm.resB === ''}
                className="rounded-2xl bg-violet-500 px-6 py-4 font-black transition hover:bg-violet-400 disabled:opacity-50"
              >
                {submittingResult ? 'Zapisywanie...' : 'Zapisz wynik'}
              </button>
            </div>
          </div>
        </div>
      )}

      {exactScoreMatch && (
        <ExactScoreModal
          match={exactScoreMatch}
          onClose={() => setExactScoreMatch(null)}
          onSaved={async () => {
            await refreshEventData();
            setExactScoreMatch(null);
          }}
        />
      )}

      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[2rem] border border-red-500/40 bg-zinc-950 p-8 text-white shadow-2xl">
            <p className="text-sm uppercase tracking-[0.25em] text-red-300">
              Strefa zagrożenia
            </p>

            <h2 className="mt-2 text-3xl font-black">
              Wyczyść {clearPhase}
            </h2>

            <p className="mt-4 text-white/60">
              To trwale usuwa poniższe dane wyłącznie dla fazy <strong>{clearPhase}</strong> tego eventu:
            </p>

            {clearPreviewLoading && (
              <div className="mt-4 text-sm font-bold text-white/40">
                Ładowanie podglądu...
              </div>
            )}

            {!clearPreviewLoading && clearPreview && (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-center">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/40">Mecze</p>
                  <p className="mt-2 text-2xl font-black">{clearPreview.matches}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-center">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/40">Typy</p>
                  <p className="mt-2 text-2xl font-black">{clearPreview.predictions}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-center">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/40">Wyniki</p>
                  <p className="mt-2 text-2xl font-black">{clearPreview.results}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-center">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/40">Punkty</p>
                  <p className="mt-2 text-2xl font-black">{clearPreview.points}</p>
                </div>
              </div>
            )}

            <p className="mt-6 text-sm font-bold text-white/60">
              Wpisz <span className="text-red-300">{clearPhase}</span>, aby potwierdzić:
            </p>

            <input
              value={clearConfirmText}
              onChange={(e) => setClearConfirmText(e.target.value)}
              placeholder={clearPhase}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none focus:border-red-400/50"
            />

            {clearError && (
              <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm font-bold text-red-300">
                {clearError}
              </div>
            )}

            <div className="mt-8 flex justify-end gap-4">
              <button
                onClick={() => setShowClearModal(false)}
                className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 font-black text-white/70 transition hover:bg-white/10"
              >
                Anuluj
              </button>

              <button
                onClick={handleConfirmClear}
                disabled={clearing || clearConfirmText !== clearPhase}
                className="rounded-2xl bg-red-500 px-6 py-4 font-black transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {clearing ? 'Czyszczenie...' : 'Wyczyść fazę'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Panel({ title, value }) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
      <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
        {title}
      </p>

      <h2 className="mt-4 text-4xl font-black">
        {value}
      </h2>
    </div>
  );
}

function StatusCard({ title, value }) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
      <p className="text-sm uppercase tracking-[0.2em] text-white/50">
        {title}
      </p>

      <h2 className="mt-4 text-5xl font-black">
        {value}
      </h2>
    </div>
  );
}

function InfoMini({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-white/40">
        {label}
      </p>

      <p className="mt-2 text-lg font-black">
        {value}
      </p>
    </div>
  );
}

function PhaseStep({ label, active }) {
  return (
    <div
      className={`rounded-2xl border px-5 py-3 text-sm font-black uppercase tracking-[0.2em] transition ${active
        ? 'border-violet-400 bg-violet-500/20 text-violet-200'
        : 'border-white/10 bg-black/20 text-white/40'
        }`}
    >
      {label}
    </div>
  );
}

function InfoPill({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
      <p className="text-xs uppercase tracking-[0.2em] text-white/40">
        {label}
      </p>

      <h3 className="mt-2 text-2xl font-black">
        {value}
      </h3>
    </div>
  );
}
