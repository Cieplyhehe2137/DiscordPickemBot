export default function PublicLinkButtons({
  eventSlug,
  size = "lg",
  stacked = false,
}) {
  const url = `${window.location.origin}/public/event/${eventSlug}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      alert("Link publiczny skopiowany!");
    } catch (err) {
      console.error(err);
    }
  }

  const sizeClass = size === "sm" ? "px-5 py-3" : "px-6 py-4";
  const widthClass = stacked ? "mt-3 w-full" : "";

  return (
    <>
      <button
        onClick={() => window.open(url, "_blank")}
        className={`${widthClass} rounded-2xl border border-white/10 bg-white/5 ${sizeClass} font-black text-white/80 transition hover:bg-white/10`}
      >
        Otwórz stronę publiczną
      </button>

      <button
        onClick={handleCopy}
        className={`${widthClass} rounded-2xl border border-violet-400/20 bg-violet-500/10 ${sizeClass} font-black text-violet-200 transition hover:bg-violet-500/20`}
      >
        Kopiuj link publiczny
      </button>
    </>
  );
}
