import { useApi } from "../api/useApi";

export function usePickemActions() {
  const api = useApi();

  function lockPickem() {
    return api.post("/pickem/lock");
  }

  function recalculatePickem() {
    return api.post("/pickem/recalculate");
  }

  function exportPickem() {
    return api.getRaw("/pickem/export");
  }

  return {
    lockPickem,
    recalculatePickem,
    exportPickem,
  };
}
