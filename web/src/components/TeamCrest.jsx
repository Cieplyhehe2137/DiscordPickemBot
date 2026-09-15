// Logo drużyny z literą jako zapasem.
//
// Ten sam zabieg co przy awatarach graczy i z tego samego powodu: adres
// prowadzi do cudzego CDN-u, więc gdy obrazek nie dojdzie, `onError` go
// chowa i spod spodu wraca litera - zamiast ikony zepsutego obrazka.
//
// Cztery drużyny nie mają dziś logotypu w ogóle (Aurora, Imperial, Legacy
// i Ninjas in Pyjamas), więc litera jest tu stanem normalnym, nie awarią.

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
