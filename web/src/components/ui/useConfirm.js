import { useContext } from "react";

import { ConfirmContext } from "./confirmContext.js";

/**
 * Zwraca funkcję `confirm(opcje)` - obietnicę rozwiązywaną wartością `true`,
 * gdy użytkownik potwierdzi, i `false` w każdym innym przypadku.
 *
 * Zamiennik `window.confirm` w miejscach wywołania: dochodzi jedno `await`.
 */
export function useConfirm() {
  const context = useContext(ConfirmContext);

  if (!context) {
    throw new Error("useConfirm must be used inside ConfirmProvider");
  }

  return context;
}
