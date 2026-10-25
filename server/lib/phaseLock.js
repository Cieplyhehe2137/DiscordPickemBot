// Odpowiedz na ZAMKNIETE typowanie fazy: zdanie i kod tlumaczenia.
//
// Kazdy z czterech formularzy faz odrzucal zapis tym samym blokiem pieciu
// linii, roznym tylko nazwa fazy - wiec stal on w czterech kopiach, a piata
// odmiane mial formularz Swiss przy odczycie. Kod tlumaczenia musi sie przy
// tym zgadzac ze zdaniem zapasowym, a przy osobnych kopiach nie bylo niczego,
// co by tego pilnowalo.
//
// Kod idzie do odpowiedzi obok zdania i prowadzi do tlumaczenia - ale TYLKO
// wtedy, gdy na ekran idzie NASZE zdanie, a nie wlasny powod wpisany przez
// administratora serwera. Tym rozroznieniem zajmuje sie codeForDefault;
// patrz server/lib/messageCode.js.

import { codeForDefault } from "./messageCode.js";

const CLOSED = {
  phase: ["Typowanie tej fazy jest zamknięte.", "server.lock.phaseClosed"],
  playin: ["Typowanie Play-In jest zamknięte.", "server.lock.playinClosed"],
  playoffs: ["Typowanie Playoffs jest zamknięte.", "server.lock.playoffsClosed"],
  doubleelim: [
    "Typowanie Double Elimination jest zamknięte.",
    "server.lock.deClosed",
  ],
};

/**
 * Zdanie o zamknietym typowaniu razem z jego kodem.
 *
 * Zwraca { message, code } - pod tymi samymi nazwami oba pola trafiaja do
 * pola `lock` w formularzu fazy, wiec nie ma miejsca na przestawienie ich
 * po drodze.
 */
export function phaseLockNotice(gate, toWebMessage, kind) {
  const [fallback, code] = CLOSED[kind];

  const message = toWebMessage(gate.message, fallback);

  return { message, code: codeForDefault(message, fallback, code) };
}

/**
 * Cialo odpowiedzi 403 na probe zapisu do zamknietej fazy.
 *
 * Pole nazywa sie `error`, a nie `message`, bo tak nazywa je front we
 * wszystkich odpowiedziach bledow - inaczej niz pole `lock` w formularzu.
 * Dlatego sa to dwie funkcje, a nie jedna: ten sam tekst, dwa kontrakty.
 */
export function phaseLockResponse(gate, toWebMessage, kind) {
  const { message, code } = phaseLockNotice(gate, toWebMessage, kind);

  return { error: message, code };
}
