export function parseCs2LogLine(raw) {
  if (!raw) return null;

  const line = String(raw);

  const roundEnd = parseRoundEnd(line);
  if (roundEnd) return roundEnd;

  return null;
}

function parseRoundEnd(line) {
  // Przykładowe logi CS/CS2 mogą mieć różne formaty.
  // Na start łapiemy kilka popularnych wariantów.
  const patterns = [
    /Team "([^"]+)" triggered "SFUI_Notice_([^"]+)"/i,
    /Team "([^"]+)" triggered "([^"]+)"/i,
    /World triggered "Round_End"/i,
  ];

  for (const pattern of patterns) {
    const match = line.match(pattern);

    if (!match) continue;

    if (pattern.source.includes("World")) {
      return {
        type: "round_end",
        winner: null,
        raw: line,
      };
    }

    return {
      type: "round_end",
      winner: match[1],
      reason: match[2],
      raw: line,
    };
  }

  return null;
}
