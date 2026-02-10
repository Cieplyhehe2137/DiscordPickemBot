import { useGuild } from "./GuildContext";

export function usePermissions() {
  const { isAdmin } = useGuild();

  return {
    isAdmin,
    canEdit: isAdmin,
    canExport: isAdmin,
  };
}
