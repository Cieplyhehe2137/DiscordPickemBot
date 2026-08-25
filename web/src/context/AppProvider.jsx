import { useState } from "react";
import { AppContext } from "./AppContext";

export function AppProvider({ children }) {
  const [selectedGuild, setSelectedGuild] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);

  return (
    <AppContext.Provider
      value={{
        selectedGuild,
        setSelectedGuild,

        selectedEvent,
        setSelectedEvent,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
