// Logo drużyny z literą jako zapasem.
//
// Ten sam zabieg co przy awatarach graczy i z tego samego powodu: adres
// prowadzi do cudzego CDN-u, więc gdy obrazek nie dojdzie, `onError` go
// chowa i spod spodu wraca litera - zamiast ikony zepsutego obrazka.
//
// Litera była tu długo stanem normalnym, bo cztery drużyny nie miały
// logotypu w ogóle. Po poprawkach dopasowania u dostawcy (aliasy dla NIP
// i Aurory, rozstrzyganie remisu obrazkiem - patrz server/lib/teamLogos.js)
// logotyp ma każda z 39 nazw w bazie; sprawdzone przebiegiem na żywym API
// 2026-09-16.
//
// Zapas zostaje mimo to, dla dwóch przypadków: drużyny, która trafi do bazy
// przed kolejnym przebiegiem scripts/fetchTeamLogos.mjs, i obrazka, który
// nie dojdzie z cudzego CDN-u.

function TeamCrest({ name, logo, size = "" }) {
  const litera = name?.[0]?.toUpperCase() ?? "?";

  return (
    <span className={`team-crest ${size}`.trim()} aria-hidden="true">
      <span className="team-crest__initial">{litera}</span>

      {logo && (
        <img
          className="team-crest__logo"
          src={logo}
          alt=""
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      )}
    </span>
  );
}

export default TeamCrest;
