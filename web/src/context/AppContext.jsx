import { createContext, useContext, useState } from 'react';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [selectedGuild, setSelectedGuild] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);

  return (
    <AppContext.Provider
      value={{
        selectedGuild,
        setSelectedGuild,

        selectedEvent,
        setSelectedEvent
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}