import { Fragment } from "react";

import { useT } from "./useLanguage.js";

// Zdanie, w którego środku stoi element, a nie tekst.
//
// PO CO TO W OGÓLE JEST: na stronie 404 adres jest w <code>, w kilku miejscu
// liczba jest w <strong>. Kuszące jest rozbicie takiego zdania na dwa klucze,
// "początek" i "koniec" - ale wtedy kolejność jest zaszyta w kodzie, a nie
// w tłumaczeniu, i język, który stawia tę wstawkę gdzie indziej, nie ma jak
// tego zrobić. Tutaj o miejscu decyduje samo zdanie, czyli tłumacz.
//
// Zwykłe zmienne (napisy i liczby) idą przez `t` jak wszędzie. Elementy
// rozpoznaje się po tym, że nie są napisem ani liczbą - zostają w tekście
// jako "{nazwa}" i dopiero tutaj wskakują na swoje miejsce.
//
// Fragment z kluczem, a nie goła tablica: React inaczej krzyczy o brakujące
// klucze przy każdym takim zdaniu.

export function T({ k, vars = {} }) {
  const t = useT();

  const proste = {};
  const elementy = {};

  for (const [nazwa, wartosc] of Object.entries(vars)) {
    if (typeof wartosc === "string" || typeof wartosc === "number") {
      proste[nazwa] = wartosc;
    } else {
      elementy[nazwa] = wartosc;
    }
  }

  const tekst = t(k, proste);

  // Podział ZACHOWUJE separatory, bo nawias w wyrażeniu jest grupą - dzięki
  // temu w tablicy leżą na przemian kawałki tekstu i same klamry.
  const kawalki = tekst.split(/(\{\w+\})/);

  return (
    <>
      {kawalki.map((kawalek, i) => {
        const nazwa = /^\{(\w+)\}$/.exec(kawalek)?.[1];

        return (
          <Fragment key={i}>
            {nazwa && nazwa in elementy ? elementy[nazwa] : kawalek}
          </Fragment>
        );
      })}
    </>
  );
}
