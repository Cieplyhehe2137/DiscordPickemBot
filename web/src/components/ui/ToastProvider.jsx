import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

import {
  TOAST_DURATION_MS,
  TOAST_TONE_CLASS,
  createToastId,
  toastReducer,
} from "../../lib/toastQueue.js";
import { ToastContext } from "./toastContext.js";
import { useT } from "../../i18n/useLanguage.js";

// Powiadomienie w rogu ekranu - potwierdzenie akcji, które widać niezależnie
// od tego, gdzie strona jest przewinięta.
//
// Do potwierdzeń, nie do błędów. Błąd musi zostać na ekranie, dopóki gracz go
// nie przeczyta i nie poprawi danych, więc te dalej renderują się w miejscu
// jako `ui-note ui-note--danger`, obok formularza, którego dotyczą.

export function ToastProvider({ children }) {
  const t = useT();

  const [toasts, dispatch] = useReducer(toastReducer, []);

  // Liczniki czasu trzymane poza stanem: ich zmiana nie ma nic renderować,
  // a przy schowaniu ręcznym trzeba je odwołać, żeby nie zostały wiszące.
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    const timer = timers.current.get(id);

    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }

    dispatch({ type: "dismiss", id });
  }, []);

  const show = useCallback(
    (text, tone = "ok", duration = TOAST_DURATION_MS) => {
      if (!text) return null;

      const id = createToastId();

      dispatch({ type: "show", toast: { id, text, tone } });

      timers.current.set(
        id,
        setTimeout(() => {
          timers.current.delete(id);
          dispatch({ type: "dismiss", id });
        }, duration),
      );

      return id;
    },
    [],
  );

  // Odmontowanie przy otwartym powiadomieniu zostawiłoby licznik, który
  // sięga po dispatch nieistniejącego już komponentu.
  useEffect(() => {
    const pending = timers.current;

    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  const value = useMemo(
    () => ({
      show,
      dismiss,
      success: (text) => show(text, "ok"),
      warn: (text) => show(text, "warn"),
    }),
    [show, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Pojemnik stoi w drzewie ZAWSZE, także pusty. Czytnik ekranu ogłasza
          tylko zmiany wewnątrz obszaru, który istniał wcześniej - obszar
          tworzony razem z pierwszym komunikatem zostaje przemilczany. */}
      <div className="ui-toasts" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`ui-toast ${TOAST_TONE_CLASS[toast.tone] ?? ""}`}
          >
            <span className="ui-toast__text">{toast.text}</span>

            <button
              type="button"
              className="ui-toast__close"
              onClick={() => dismiss(toast.id)}
              aria-label={t("toast.close")}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
