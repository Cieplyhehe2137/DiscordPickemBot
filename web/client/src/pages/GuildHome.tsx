import { useParams, Link } from "react-router-dom";

export default function GuildHome() {
  const { guildId } = useParams();

  return (
    <div>
      <h1>Panel serwera</h1>
      <p>Guild ID: {guildId}</p>

      <Link to="pickem">➡ Pick'Em</Link>
    </div>
  );
}
