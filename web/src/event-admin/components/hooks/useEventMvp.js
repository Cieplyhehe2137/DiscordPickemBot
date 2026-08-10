import { useCallback, useState } from 'react';
import {
  describeActionError,
  getMvp,
  saveMvpCandidates,
  setMvpResult
} from '../../../lib/api';

function parseMvpTextarea(raw) {
  return String(raw || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [nickname, teamName] = line
        .split('|')
        .map((value) => value?.trim());

      return {
        nickname,
        teamName: teamName || null
      };
    })
    .filter((entry) => entry.nickname);
}

export default function useEventMvp({
  slug,
  onRefresh
}) {
  const [candidates, setCandidates] = useState([]);
  const [result, setResult] = useState(null);
  const [textarea, setTextarea] = useState('');

  const [savingCandidates, setSavingCandidates] = useState(false);
  const [candidatesError, setCandidatesError] = useState(null);

  const [selectedCandidateId, setSelectedCandidateId] = useState('');
  const [savingResult, setSavingResult] = useState(false);
  const [resultError, setResultError] = useState(null);

  const loadMvp = useCallback(async () => {
    if (!slug) {
      setCandidates([]);
      setResult(null);
      return;
    }

    try {
      const data = await getMvp(slug);

      setCandidates(data.candidates || []);
      setResult(data.result || null);
    } catch (error) {
      console.error(error);

      setCandidates([]);
      setResult(null);
    }
  }, [slug]);

  async function saveCandidates() {
    try {
      setSavingCandidates(true);
      setCandidatesError(null);

      const entries = parseMvpTextarea(textarea);

      if (!entries.length) {
        setCandidatesError(
          'Wpisz przynajmniej jednego kandydata w formacie: nick | drużyna.'
        );

        return;
      }

      await saveMvpCandidates(slug, entries);

      setTextarea('');

      await loadMvp();
      await onRefresh?.();
    } catch (error) {
      console.error(error);

      setCandidatesError(
        error?.status === 400
          ? error.message
          : describeActionError(
              error,
              'zapisać kandydatów MVP'
            )
      );
    } finally {
      setSavingCandidates(false);
    }
  }

  async function saveResult() {
    if (!selectedCandidateId) return;

    try {
      setSavingResult(true);
      setResultError(null);

      await setMvpResult(
        slug,
        Number(selectedCandidateId)
      );

      await loadMvp();
      await onRefresh?.();
    } catch (error) {
      console.error(error);

      setResultError(
        describeActionError(
          error,
          'ustawić oficjalnego MVP'
        )
      );
    } finally {
      setSavingResult(false);
    }
  }

  return {
    candidates,
    candidatesError,
    loadMvp,
    result,
    resultError,
    saveCandidates,
    saveResult,
    savingCandidates,
    savingResult,
    selectedCandidateId,
    setSelectedCandidateId,
    setTextarea,
    textarea
  };
}