export function usePublicPickemOverview() {
  const dataFromApi = null; // tutaj normalnie byłby fetch

  if (!dataFromApi) {
    return {
      loading: false,
      data: {
        event: { name: "IEM Kraków 2026 (DEV)" },
        participants: 0,
        deadline: new Date().toISOString(),
        status: "COMING_SOON",
      },
    };
  }

  return {
    loading: false,
    data: dataFromApi,
  };
}
