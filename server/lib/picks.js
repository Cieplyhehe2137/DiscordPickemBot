// Typy przychodza z formularzy jako lista nazw po przecinku.
//
// Puste elementy wypadaja, bo "navi,,vitality" i koncowy przecinek to
// normalna rzecz w polu tekstowym, a nie blad wart odrzucenia calego typu.

export function parseCsvPick(value) {
  if (!value) return [];

  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
