// Lista druzyn z kolumny tekstowej.
//
// Typy na fazy (swiss_predictions, playin_predictions, playoffs_predictions,
// doubleelim_predictions) trzymaja druzyny jako tekst: raz po przecinku,
// raz jako tablice zapisana JSON-em. Rozdzielanie tego jest jedna decyzja
// i musi byc jedno - bo tym samym podzialem bot PUNKTUJE typy
// (handlers/matches/calculateScores.js) i tym samym trzeba je POKAZAC
// (handlers/matches/showMyPredictions.js). Gdyby te dwa podzialy roznily sie
// choc o przecinek, gracz zobaczylby inne typy, niz zostaly mu policzone.
//
// UWAGA NA server/lib/phasePicks.js. Tamtejszy splitTeams robi to samo dla
// panelu administratora i ma trzymac sie tego pliku co do znaku. Rozni sie
// dzis jednym: po udanym JSON.parse robi .map(String), a ta wersja oddaje
// tablice taka, jaka przyszla. Zostawione swiadomie - to ta wersja punktuje,
// wiec to ona jest wzorcem, a wyrownanie tamtej zmienia zachowanie panelu
// i nalezy do osobnej zmiany.

function parseTeamList(value) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);

    if (Array.isArray(parsed)) return parsed;
  } catch (_) {
    // zwykly tekst po przecinku
  }

  return String(value)
    .replace(/[[\]"]+/g, "")
    .split(/[;,]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

module.exports = {
  parseTeamList,
};
