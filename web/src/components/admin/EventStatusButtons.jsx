export default function EventStatusButtons({
  status,
  onOpen,
  onClose,
  onArchive,
  size = "md",
}) {
  const sizeClass = size === "sm" ? "px-4 py-3 text-sm" : "px-5 py-3";

  return (
    <>
      <button
        onClick={onOpen}
        disabled={status === "OPEN"}
        className={`rounded-2xl border border-green-400/20 bg-green-500/10 ${sizeClass} font-black text-green-300 transition hover:bg-green-500/20 disabled:cursor-not-allowed disabled:opacity-40`}
      >
        Otwórz
      </button>

      <button
        onClick={onClose}
        disabled={status === "CLOSED"}
        className={`rounded-2xl border border-red-400/20 bg-red-500/10 ${sizeClass} font-black text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40`}
      >
        Zamknij
      </button>

      <button
        onClick={onArchive}
        disabled={status === "ARCHIVED"}
        className={`rounded-2xl border border-zinc-400/20 bg-zinc-500/10 ${sizeClass} font-black text-zinc-300 transition hover:bg-zinc-500/20 disabled:cursor-not-allowed disabled:opacity-40`}
      >
        Archiwizuj
      </button>
    </>
  );
}
