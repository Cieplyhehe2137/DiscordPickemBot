import { useSyncExternalStore } from "react";

import { useT } from "../i18n/useLanguage.js";

import {
  UKLAD,
  UKLAD_WASKI,
  obszar,
  podzialka,
  wspolrzedne,
  sciezka,
  sciezkaPola,
} from "../lib/chartGeometry.js";

// Punkty narastająco, mecz po meczu.
//
// Gołe SVG, bez biblioteki wykresów. Jedna linia i podziałka to kilkadziesiąt
// linijek, a najlżejsza biblioteka to kilkadziesiąt kilobajtów do pakietu,
// który i tak ma już czterysta osiemdziesiąt.
//
// Dymki robi natywny `<title>` w środku kształtu - przeglądarka pokazuje go
// sama, bez ani jednej linijki obsługi zdarzeń i bez stanu w komponencie.

// Klasy kolorów stron trzymane w tablicy, a nie sklejane z identyfikatora.
// Sklejanie sprawia, że nazwa nie występuje w kodzie dosłownie i narzędzie
// do usuwania martwego CSS kasuje te reguły jako nieużywane.
const KOLOR_KLASA = {
  a: "points-chart__line--a",
  b: "points-chart__line--b",
};

const KROPKA_KLASA = {
  a: "points-chart__dot--a",
  b: "points-chart__dot--b",
};

// Powyżej tylu meczów widoczne kropki zlewają się w grubą linię. Punkty
// do najechania zostają zawsze - tylko przestają być rysowane.
const MAX_WIDOCZNYCH_KROPEK = 25;

// Poniżej tej szerokości wykres dostaje własny, węższy i wyższy układ.
// Ta sama liczba co w regułach CSS dla kart - tam też 560px jest granicą,
// od której kolumny składają się w pion.
const WASKI = "(max-width: 560px)";

// Zapytanie medialne jako źródło zewnętrzne - viewBox jest atrybutem,
// a nie stylem, więc samo CSS go nie zmieni. useSyncExternalStore zamiast
// useState z useEffect: nie ma tu kroku, w którym komponent jest już
// widoczny, a jeszcze nie wie, na jakim ekranie stoi.
function useChartLayout() {
  const wask = useSyncExternalStore(
    (powiadom) => {
      const zapytanie = window.matchMedia(WASKI);

      zapytanie.addEventListener("change", powiadom);

      return () => zapytanie.removeEventListener("change", powiadom);
    },
    () => window.matchMedia(WASKI).matches,

    // Gdyby strona kiedykolwiek renderowała się po stronie serwera:
    // szeroki układ jako domyślny, bo tam nie ma żadnego okna.
    () => false,
  );

  return wask ? UKLAD_WASKI : UKLAD;
}

function PointsChart({ series, caption }) {
  const t = useT();

  const uklad = useChartLayout();

  const serie = (series || []).filter((s) => s?.points?.length);

  if (serie.length === 0) {
    return (
      <p className="ui-hint">{t("chart.empty")}</p>
    );
  }

  // Jedna skala dla wszystkich serii. Liczona osobno dla każdej, obie linie
  // kończyłyby na tej samej wysokości i wykres kłamałby dokładnie w tym,
  // po co powstał.
  const najwyzszy = Math.max(
    ...serie.map((s) => s.points[s.points.length - 1]?.total ?? 0),
  );

  const { wartosci, gora } = podzialka(najwyzszy);

  const o = obszar(uklad);

  const policzone = serie.map((s) => ({
    ...s,
    wsp: wspolrzedne(s.points, gora, uklad),
  }));

  const pojedyncza = policzone.length === 1;

  const opis = policzone
    .map((s) =>
      t("chart.series", {
        name: s.name,
        points: s.points[s.points.length - 1]?.total ?? 0,
        count: s.points.length,
      }),
    )
    .join(", ");

  return (
    <figure className="points-chart">
      <svg
        className="points-chart__svg"
        viewBox={`0 0 ${uklad.width} ${uklad.height}`}
        // Bez preserveAspectRatio="none" - rozciąganie w jednej osi robi
        // z kropek elipsy, a z grubości linii dwie różne grubości.
        role="img"
        aria-label={t("chart.title", { series: opis })}
      >
        {/* Podziałka pod danymi, nigdy nad nimi. */}
        {wartosci.map((v) => {
          const y = o.bottom - (v / (gora || 1)) * o.wysokosc;

          return (
            <g key={v}>
              <line
                className="points-chart__grid"
                x1={o.left}
                x2={o.right}
                y1={y}
                y2={y}
              />

              <text
                className="points-chart__tick"
                x={o.left - 8}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
              >
                {v}
              </text>
            </g>
          );
        })}

        {/* Wypełnienie tylko przy jednej serii - przy dwóch zasłaniałoby
            tę niżej i utrudniało odczytanie, gdzie się przecinają. */}
        {pojedyncza && (
          <path
            className="points-chart__area"
            d={sciezkaPola(policzone[0].wsp, uklad)}
          />
        )}

        {policzone.map((s) => (
          <path
            key={`linia-${s.side}`}
            className={`points-chart__line ${KOLOR_KLASA[s.side]}`}
            d={sciezka(s.wsp)}
          />
        ))}

        {policzone.map((s) =>
          s.wsp.map((p) => (
            <g key={`${s.side}-${p.n}`}>
              {s.wsp.length <= MAX_WIDOCZNYCH_KROPEK && (
                <circle
                  className={`points-chart__dot ${KROPKA_KLASA[s.side]}`}
                  cx={p.x}
                  cy={p.y}
                  r="3"
                />
              )}

              {/* Cel do najechania, zawsze szerszy niż kropka. Bez tego
                  trafienie w punkt o promieniu trzech pikseli jest
                  zadaniem na zręczność. */}
              <circle
                className="points-chart__hit"
                cx={p.x}
                cy={p.y}
                r="10"
              >
                <title>
                  {`Mecz ${p.n}${p.label ? ` — ${p.label}` : ""}\n${s.name}: ${p.points >= 0 ? "+" : ""}${p.points} pkt, razem ${p.total}`}
                </title>
              </circle>
            </g>
          )),
        )}

        {/* Oś X: tylko pierwszy i ostatni mecz. Numery co któryś i tak nie
            mówią nic więcej, a zabierają miejsce pod wykresem. */}
        <text
          className="points-chart__tick"
          x={o.left}
          y={uklad.height - 8}
          textAnchor="start"
        >
          1
        </text>

        <text
          className="points-chart__tick"
          x={o.right}
          y={uklad.height - 8}
          textAnchor="end"
        >
          {Math.max(...policzone.map((s) => s.wsp.length))}
        </text>
      </svg>

      {policzone.length > 1 && (
        <figcaption className="points-chart__legend">
          {policzone.map((s) => (
            <span className="points-chart__legend-item" key={s.side}>
              <span
                className={`points-chart__swatch ${KROPKA_KLASA[s.side]}`}
                aria-hidden="true"
              />

              {s.name}
            </span>
          ))}
        </figcaption>
      )}

      {caption && policzone.length === 1 && (
        <figcaption className="ui-stat__hint">{caption}</figcaption>
      )}
    </figure>
  );
}

export default PointsChart;
