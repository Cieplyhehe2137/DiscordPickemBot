import { LANGUAGES, NAZWY } from "../lib/language.js";
import { useLanguage } from "../i18n/useLanguage.js";

// Wybór języka.
//
// Zwykły <select>, a nie własna rozwijana lista: pięć pozycji, jedna decyzja,
// a przeglądarka i czytnik ekranu obsługują go bez ani jednej linii naszego
// kodu - z klawiaturą, z wyszukiwaniem po pierwszej literze i z natywnym
// kołem wyboru na telefonie.
//
// Etykieta jest ukryta wzrokowo, ale zostaje dla czytnika ekranu: w nagłówku
// nie ma miejsca na słowo "Język" obok pola, a samo pole bez podpisu jest
// dla czytnika listą bez tytułu.

function LanguageToggle() {
  const { jezyk, setJezyk, t } = useLanguage();

  return (
    <label className="language-toggle">
      <span className="visually-hidden">{t("language.label")}</span>

      <select
        className="language-toggle__select"
        value={jezyk}
        onChange={(event) => setJezyk(event.target.value)}
        title={t("language.change")}
      >
        {LANGUAGES.map((kod) => (
          <option key={kod} value={kod}>
            {/* Nazwa w JEGO języku, nie w naszym - patrz NAZWY. */}
            {NAZWY[kod]}
          </option>
        ))}
      </select>
    </label>
  );
}

export default LanguageToggle;
