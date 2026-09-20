// Słownik angielski.
//
// Zestaw i kolejność kluczy jak w pl.js - to tamten plik jest źródłem prawdy,
// a test porównuje zestawy. Liczba mnoga po angielsku ma dwie formy:
// one / other.

const en = {
  // --- Nagłówek i nawigacja ------------------------------------------------
  "layout.logo": "PickEmBot",
  "layout.nav.home": "Home",
  "layout.nav.events": "Events",
  "layout.nav.teams": "Teams",
  "layout.nav.scoring": "Scoring",
  "layout.nav.stats": "Stats",
  "layout.nav.admin": "Admin",
  "layout.user.loading": "Loading...",
  "layout.user.logout": "Log out",
  "layout.user.login": "Log in",

  // --- Przełącznik motywu --------------------------------------------------
  "theme.toggle.light": "Switch to light theme",
  "theme.toggle.dark": "Switch to dark theme",

  // --- Przełącznik języka --------------------------------------------------
  "language.label": "Language",
  "language.change": "Change site language",

  // --- Napisy wspolne ------------------------------------------------------
  "common.loading": "Loading...",
  "common.cancel": "Cancel",
  "common.backToEvent": "Back to event",
  "common.selected": "Selected",
  // Skrot jednostki, nie cale zdanie. Po polsku "pkt" nie
  // odmienia sie wcale, wiec nie ma tu form liczby mnogiej -
  // ale po niemiecku kropka na koncu jest czescia skrotu.
  "common.points": "{count} pts",
  "common.hits": "{hits}/{total} correct",
  "common.playersCount": {
    one: "{count} player",
    other: "{count} players",
  },
  "common.matchesCount": {
    one: "{count} match",
    other: "{count} matches",
  },
  "common.eventsCount": {
    one: "{count} tournament",
    other: "{count} tournaments",
  },
  "common.loadingEvents": "Loading tournaments",
  "common.eventsError": "Could not load the tournaments.",
  "common.loadingMatches": "Loading matches",
  "common.all": "All",
  "common.save": "Save",
  "common.retry": "Try again",
  "common.searchPlayer": "Search for a player by nick...",
  "common.searchPlayerLabel": "Search for a player",
  "common.picksPercent": "{percent}% of picks",
  "common.pointsValue": "{value} pts",
  "common.mapPick": "pick {a}:{b}",
  "common.mapResult": "result {a}:{b}",
  "common.mapNo": "Map {no}",

  // --- Ekran za logowaniem -------------------------------------------------
  "login.title": "Log in to see this",
  "login.discord": "Log in with Discord",

  // --- Strona 404 ----------------------------------------------------------
  "notFound.kicker": "Error 404",
  "notFound.title": "No such page",
  // Adres jest wstawiany jako <code>, wiec to zdanie renderuje
  // komponent T - patrz i18n/T.jsx.
  "notFound.text": "The address {path} does not exist. It may be out of date or contain a typo.",
  "notFound.events": "Browse tournaments",
  "notFound.home": "Home page",

  // --- Starty w innych turniejach ------------------------------------------
  "history.kicker": "Beyond this tournament",
  "history.title": "Also played in",
  "history.count": {
    one: "{count} other tournament",
    other: "{count} other tournaments",
  },
  "history.hint": " — click to see that profile.",
  "history.unranked": "unranked",
  "history.place": "place {rank} of {total}",
  "history.top": "TOP {percent}%",

  // --- Odznaki -------------------------------------------------------------
  "badges.kicker": "Badges",
  "badges.title": "Achievements in this tournament",
  "badges.earned": {
    one: "{count} badge earned",
    other: "{count} badges earned",
  },
  "badges.emptyTitle": "No badges yet",
  "badges.emptyText": "They show up after the first settled matches — below you can see what is closest.",
  // „Pojawia sie po pierwszych rozliczonych meczach" przeczylo temu,
  // co stalo linijke nizej: liscie odznak w zasiegu, zlozonej z takich,
  // ktore z meczami nie maja nic wspolnego.
  "badges.emptyTextNoMatches": "There are no matches in this tournament, so match badges are out of reach — below you can see what is closest.",
  "badges.near": "Within reach",

  // --- Wybor gracza do porownania ------------------------------------------
  "picker.title": "Compare with whom?",
  "picker.search": "Search for a player by nick...",
  "picker.searchLabel": "Search for a player",
  "picker.loading": "Searching for players...",
  "picker.loadError": "Could not load the list of players.",
  "picker.noMatch": "Nobody matches \"{query}\".",
  "picker.empty": "This tournament has no ranked players yet.",

  // --- Typy druzyn na profilu ----------------------------------------------
  "teamPicks.kicker": "Team picks",
  "teamPicks.title": "Who they picked to advance",
  "teamPicks.unpublished": "Result not announced",

  // --- Fazy turnieju -------------------------------------------------------
  "phase.notStarted": "Not started",
  "phase.finished": "Finished",
  // Nazwy etapow zostaja po angielsku we WSZYSTKICH jezykach.
  // Tak nazywaja je organizatorzy turniejow i tak sa wypisane na
  // drabince, ktora gracz ma przed oczami - "System szwajcarski"
  // bylby tlumaczeniem, ktorego nie ma gdzie porownac.
  // Test zna te klucze z listy TAKIE_SAME_NAPRAWDE.
  "phase.swiss": "Swiss",
  "phase.swissStage1": "Swiss Stage 1",
  "phase.swissStage2": "Swiss Stage 2",
  "phase.swissStage3": "Swiss Stage 3",
  "phase.playoffs": "Playoffs",
  "phase.playin": "Play-In",
  "phase.doubleElim": "Double Elimination",

  // --- Stan turnieju -------------------------------------------------------
  "eventState.live": "Live",
  "eventState.upcoming": "Soon",
  "eventState.finished": "Finished",

  // --- Strona glowna -------------------------------------------------------
  "home.hero.predict": "Predict.",
  "home.hero.compete": "Compete.",
  "home.hero.win": "Win.",
  "home.hero.text": "Predict CS2 matches, call the map scores and earn points together with the PickEmBot community.",
  "home.hero.events": "Browse tournaments",
  "home.hero.rankings": "Browse rankings",
  "home.stats.players": "Players",
  "home.stats.playersHint": "entries across all tournaments",
  "home.stats.events": "Tournaments",
  "home.stats.eventsHint": "played and ongoing",
  "home.stats.matches": "Matches",
  "home.stats.matchesHint": "to predict",
  "home.stats.visits": "Visits",
  "home.stats.visitsToday": "{count} today",
  "home.empty.title": "The first tournament is ahead",
  "home.empty.text": "As soon as predictions open, tournaments will show up here.",
  "home.events.kicker": "Tournaments",
  "home.heading.live": "Where predictions are open now",
  "home.heading.upcoming": "Upcoming tournaments",
  "home.heading.recent": "Recent tournaments",
  "home.allEvents": "All tournaments →",
  "home.servers.kicker": "Where the bot runs",
  "home.servers.title": "Servers",
  "home.servers.open": "{count} ongoing",
  "home.servers.join": "Join on Discord",
  "home.servers.error": "Could not load the servers.",

  // --- Lista turniejow -----------------------------------------------------
  "events.kicker": "Tournaments",
  "events.title": "Events",
  "events.intro": "Pick a tournament to get to match predictions, tournament stages and the ranking. Finished Pick'Ems stay available for browsing.",
  "events.error": "Could not load the tournaments",
  "events.empty.title": "No tournaments yet",
  "events.empty.text": "When the first Pick'Em starts, it will show up on this list.",
  "events.live.kicker": "Now",
  "events.live.title": "Ongoing",
  "events.upcoming.kicker": "Announced",
  "events.upcoming.title": "Soon",
  "events.upcoming.text": "The tournament already exists, but predictions have not opened yet - they start once the stage panel shows up on Discord.",
  "events.finished.kicker": "Archive",
  "events.finished.title": "Finished",
  "events.finished.text": "No Pick'Em is running right now. Below are the tournaments you can browse.",

  // --- Stan meczu ----------------------------------------------------------
  "matchState.open": "Predictions open",
  "matchState.locked": "Predictions closed",
  "matchState.finished": "Finished",

  // --- Lista meczow --------------------------------------------------------
  "matches.title": "Matches",
  "matches.titlePhase": "Matches — {phase}",
  "matches.countFiltered": {
    one: "{shown} of {count} match",
    other: "{shown} of {count} matches",
  },
  "matches.filter.phase": "Stage",
  "matches.filter.team": "Team",
  "matches.filter.state": "State",
  "matches.filter.clear": "Clear filters",
  "matches.progress": "Prediction progress",
  "matches.partial": "Incomplete predictions:",
  "matches.error": "Could not load the matches",
  "matches.empty.title": "No matches",
  "matches.empty.filtered": "No match fits the selected filters.",
  "matches.empty.none": "This tournament has no scheduled matches yet.",
  "matches.status.complete": "Predicted",
  "matches.status.partial": "Prediction incomplete",
  "matches.status.missed": "No prediction",
  "matches.status.empty": "To predict",
  "matches.no": "Match #{no}",
  "matches.foot.final": "Match finished",
  "matches.foot.locked": "Predictions locked",
  "matches.foot.saved": "Prediction saved — you can still edit it",
  "matches.foot.finish": "Finish your prediction",
  "matches.foot.open": "Predictions open",
  "matches.cta.result": "See result",
  "matches.cta.match": "See match",
  "matches.cta.edit": "Edit prediction",
  "matches.cta.finish": "Finish prediction",
  "matches.cta.predict": "Predict",

  // --- Ranking -------------------------------------------------------------
  "leaderboard.kicker": "Ranking",
  "leaderboard.title": "Player ranking",
  "leaderboard.loading": "Loading the ranking",
  "leaderboard.error": "Could not load the ranking",
  "leaderboard.ranked": {
    one: "{count} ranked player",
    other: "{count} ranked players",
  },
  "leaderboard.findMe": "Find me",
  "leaderboard.foundOf": {
    one: "Found {found} of {count} player",
    other: "Found {found} of {count} players",
  },
  "leaderboard.noMatch": "Nobody matches {query}",
  "leaderboard.notStarted.title": "The ranking has not started yet",
  "leaderboard.notStarted.text": {
    one: "This event already has {count} player with predictions in, but nobody has points yet — they show up after the first settled matches and stages.",
    other: "This event already has {count} players with predictions in, but nobody has points yet — they show up after the first settled matches and stages.",
  },
  "leaderboard.nobody.title": "Nobody has predicted yet",
  "leaderboard.nobody.text": "The ranking shows up once the first players submit predictions.",
  "leaderboard.head.player": "Player",
  "leaderboard.head.breakdown": "Breakdown",
  "leaderboard.head.points": "Points",
  "leaderboard.noPoints": "no points",
  // Rozbicie punktow na fazy: nazwy etapow ida z tego samego
  // zrodla co wszedzie (Swiss, Playoffs), a tlumaczenia wymagaja
  // tylko "Mecze" i "MVP" - to drugie jest skrotem i zostaje.
  "leaderboard.split.matches": "Matches",
  "leaderboard.pages": "Ranking pages",
  "leaderboard.prev": "← Previous",
  "leaderboard.next": "Next →",
  "leaderboard.pageOf": "Page {page} of {total}",

  // --- Lista druzyn --------------------------------------------------------
  "teams.kicker": "Teams",
  "teams.title": "Who played in these tournaments",
  "teams.intro": {
    one: "{count} team from all tournaments — with its record and how readily the community picked it.",
    other: "{count} teams from all tournaments — with their records and how readily the community picked them.",
  },
  "teams.loading": "Loading teams...",
  "teams.error": "Could not load the teams",
  "teams.errorText": "Could not load the teams.",
  "teams.search": "Search for a team...",
  "teams.searchLabel": "Search for a team",
  "teams.empty.title": "Nothing matches",
  "teams.empty.text": "No team matches {query}.",
  "teams.record": {
    one: "{wins}–{losses} in {count} match",
    other: "{wins}–{losses} in {count} matches",
  },
  "teams.noResult": {
    one: "{count} match without a result",
    other: "{count} matches without a result",
  },

  // --- Strona druzyny ------------------------------------------------------
  "team.backToTeams": "Back to teams",
  "team.loading": "Loading the team...",
  "team.error": "Could not load the team",
  "team.errorText": "Could not load the team.",
  "team.kicker": "Team",
  "team.played": {
    one: "{count} match in {events}",
    other: "{count} matches in {events}",
  },
  "team.inEvents": {
    one: "{count} tournament",
    other: "{count} tournaments",
  },
  "team.record": "Record",
  "team.noPlayed": "no matches played",
  "team.winRate": "{percent}% wins",
  "team.trust": "Trust",
  "team.trustHint": "of picks backed them",
  "team.trustHit": "Trust paid off",
  "team.trustHitHint": "of those picks came true",
  "team.picksTotal": "Picks in total",
  "team.picksOf": "of {total} in their matches",
  "team.matches": "Matches",
  "team.history": "History",
  "team.historyHint": "The percentage next to a match is the share of picks that backed this team.",
  "team.noMatches": "This team has no scheduled matches yet.",
  "team.noScore": "No result",

  // --- Punktacja -----------------------------------------------------------
  "scoring.page.kicker": "Rules",
  "scoring.page.title": "Scoring",
  "scoring.page.intro": "Every value comes straight from the rules the ranking is computed with — this is not a separately written description.",
  "scoring.page.loading": "Loading the scoring...",
  "scoring.page.error": "Could not load the scoring",
  "scoring.page.errorText": "Could not load the scoring.",
  "scoring.page.noRates": "The server returned no point values. Try refreshing the page.",
  "scoring.match.title": "Matches",
  "scoring.match.lead": "Every match in the tournament. Series points and map points add up - these are two separate things, not an either-or.",
  "scoring.matchWinner.label": "Correct series winner",
  "scoring.matchWinner.hint": "The exact series score gives nothing on top. A 2:0 pick and a 2:1 pick are worth the same, as long as they name the same team.",
  "scoring.maps.title": "Maps",
  "scoring.maps.lead": "Counted separately for EVERY map in the series. Precondition: you have to get the map winner right - without that, a close score gives nothing. Then the total deviation from the score counts, that is the round difference on one side plus the difference on the other.",
  "scoring.mapExact.label": "Exact map score",
  "scoring.mapExact.hint": "Deviation of 0 rounds.",
  "scoring.mapDiff1.label": "Off by 1 round",
  "scoring.mapDiff1.hint": "For example a 13:10 pick when the score was 13:11.",
  "scoring.mapDiff2.label": "Off by 2 rounds",
  "scoring.mapMiss.label": "Bigger deviation or the wrong map winner",
  "scoring.perTeam.lead": "Points are awarded for each correctly picked team separately.",
  "scoring.swiss30.label": "Team with a 3-0 record",
  "scoring.swiss03.label": "Team with a 0-3 record",
  "scoring.advancing.label": "Team that advances",
  "scoring.semifinalist.label": "Semi-finalist",
  "scoring.finalist.label": "Finalist",
  "scoring.winner.label": "Tournament winner",
  "scoring.thirdPlace.label": "Winner of the third-place match",
  "scoring.thirdPlace.hint": "Only in a tournament where the organiser entered an official result for that match.",
  "scoring.doubleElim.lead": "Four picks per stage: Upper Final A, Lower Final A, Upper Final B and Lower Final B.",
  "scoring.anyCorrect.label": "Each correct pick",
  "scoring.mvp.title": "MVP",
  "scoring.mvp.lead": "One pick for the whole tournament.",
  "scoring.mvpCorrect.label": "Correct tournament MVP",

  // --- Format fazy ---------------------------------------------------------
  "phaseFormat.title": "This stage's format",
  "phaseFormat.record30": {
    one: "{count} team with a 3-0 record",
    other: "{count} teams with a 3-0 record",
  },
  "phaseFormat.record03": {
    one: "{count} team with a 0-3 record",
    other: "{count} teams with a 0-3 record",
  },
  "phaseFormat.advancing": {
    one: "{count} team to advance",
    other: "{count} teams to advance",
  },
  "phaseFormat.teams": {
    one: "{count} advancing team",
    other: "{count} advancing teams",
  },
  "phaseFormat.semifinalists": {
    one: "{count} semi-finalist",
    other: "{count} semi-finalists",
  },
  "phaseFormat.finalists": {
    one: "{count} finalist",
    other: "{count} finalists",
  },
  "phaseFormat.winner": {
    one: "{count} winner",
    other: "{count} winners",
  },
  "phaseFormat.third": "{count} in third place",

  // --- Moje typy -----------------------------------------------------------
  "myPicks.kicker": "Your data",
  "myPicks.title": "My predictions",
  "myPicks.titleEvent": "My predictions — {event}",
  "myPicks.intro": "Check your saved match predictions, exact map scores and the points you earned.",
  "myPicks.loading": "Loading predictions",
  "myPicks.loginText": "These are your saved predictions, so first we need to know who is asking.",
  "myPicks.error": "Could not load the predictions",
  "myPicks.errorText": "Could not load the predictions.",
  "myPicks.empty.title": "No matches in this stage",
  "myPicks.empty.text": "The selected stage has no fixtures yet. Try another stage or come back once the schedule fills up.",
  "myPicks.finished": "Finished",
  "myPicks.pending": "Pending",
  "myPicks.noPick": "No prediction saved.",
  "myPicks.yourPick": "Your prediction",
  "myPicks.exactScore": "Exact score",
  "myPicks.noMapPicks": "No map predictions saved.",
  "myPicks.mapPick": "pick {a}:{b}",
  "myPicks.mapResult": "result {a}:{b}",
  "myPicks.mapNoResult": "result: —",
  "myPicks.total": "In total",
  "myPicks.totalHint": "points for the match",
  "myPicks.series": "Series",
  "myPicks.maps": "Maps",
  "myPicks.later": "Points are added once the match is over.",
  "myPicks.cta.predict": "Predict the match",
  "myPicks.pageOf": "Page {page}/{total}",

  // --- Nazwy odznak --------------------------------------------------------
  "badge.unitPoints": " pts",
  "badge.accuracy1": "On target",
  "badge.accuracy2": "Sharp shooter",
  "badge.accuracy3": "Sniper",
  "badge.accuracy.desc": "{count}% correct winners",
  "badge.streak1": "Warmed up",
  "badge.streak2": "Hot hand",
  "badge.streak3": "Unstoppable",
  "badge.streak.desc": {
    one: "{count} correct in a row",
    other: "{count} correct in a row",
  },
  "badge.exactSeries1": "Accurate",
  "badge.exactSeries2": "Precise",
  "badge.exactSeries3": "Watchmaker",
  "badge.exactSeries.desc": {
    one: "{count} exact series score",
    other: "{count} exact series scores",
  },
  "badge.exactMaps1": "Map expert",
  "badge.exactMaps2": "Cartographer",
  "badge.exactMaps3": "Clairvoyant",
  "badge.exactMaps.desc": {
    one: "{count} exact map score",
    other: "{count} exact map scores",
  },
  "badge.points1": "Fifty",
  "badge.points2": "The century",
  "badge.points3": "One hundred fifty",
  "badge.points.desc": {
    one: "{count} point in the tournament",
    other: "{count} points in the tournament",
  },
  "badge.perfect": "Perfect match",
  "badge.perfect.desc": "A match called right down to the maps",
  "badge.bigMatch": "Big match",
  "badge.bigMatch.desc": {
    one: "{count} point from a single match",
    other: "{count} points from a single match",
  },
  // Nazwy odznak sa TLUMACZONE, bo to nie sa terminy esportowe,
  // tylko zarty jezykowe: "Zegarmistrz" o kims, kto trafia
  // dokladne wyniki. Doslowne tlumaczenie takiego zartu nie zawsze
  // dziala, wiec niektore brzmia inaczej niz polski oryginal - i tak
  // ma byc.
  "badge.podium": "Podium",
  "badge.podium.desc": "A place in the top three",
  "badge.regular": "Regular",
  "badge.regular.desc": {
    one: "{count} settled prediction",
    other: "{count} settled predictions",
  },

  // --- Okna i powiadomienia ------------------------------------------------
  "dialog.sure": "Are you sure?",
  "dialog.confirm": "Confirm",
  "toast.close": "Dismiss notification",

  // --- Wykres punktow ------------------------------------------------------
  // Opis wykresu dla czytnika ekranu - to jedyna droga do tych
  // liczb dla kogos, kto nie widzi rysunku.
  "chart.title": "Cumulative points. {series}.",
  "chart.series": {
    one: "{name}: {points} points after {count} match",
    other: "{name}: {points} points after {count} matches",
  },
  "chart.empty": "The chart shows up after the first settled match.",

  // --- Wyniki fazy ---------------------------------------------------------
  "phaseResults.kicker": "Settled",
  "phaseResults.title": "Stage results",
  "phaseResults.noPick": "You have no prediction saved for this stage — below is just the official result.",
  "phaseResults.official": "Official",
  "phaseResults.hitsWithPoints": "{hits}/{total} correct · {points} pts",
  "phaseResults.teams30": "3-0 teams",
  "phaseResults.teams03": "0-3 teams",
  "phaseResults.advancing": "Advancing",
  "phaseResults.semifinalists": "Semi-finalists",
  "phaseResults.finalists": "Finalists",
  "phaseResults.winner": "Winner",
  "phaseResults.thirdPlace": "Third place",
  "phaseResults.mvpCandidate": "MVP candidate",
  "phaseResults.advancingTeams": "Advancing teams",

  // --- Profil gracza -------------------------------------------------------
  "profile.loading": "Loading the profile",
  "profile.backToLeaderboard": "Back to the ranking",
  "profile.error": "Could not load the profile",
  "profile.errorText": "Could not load the player profile.",
  "profile.missing.title": "No such player",
  "profile.missing.text": "Nobody with that identifier made predictions in this event.",
  "profile.compare": "Compare with a player",
  "profile.kicker": "Player profile",
  "profile.career": "Record across tournaments",
  "profile.points": "Points",
  "profile.pointsPerMatch": "{value} pts / match",
  "profile.rank": "Ranking",
  "profile.accuracy": "Accuracy",
  "profile.accuracyHint": {
    one: "{correct} / {count} match",
    other: "{correct} / {count} matches",
  },
  "profile.exactMaps": "Exact maps",
  "profile.exactMapsHint": "{percent}% of predicted maps",
  "profile.correctMaps": "Correct maps",
  "profile.correctMapsHint": "{percent}% accuracy",
  "profile.bestMatch": "Best match",
  "profile.bestMatchHint": "points from a single match",
  "profile.seriesPoints": "Series points",
  "profile.mapPoints": "Map points",
  "profile.progress.kicker": "Progress",
  "profile.progress.title": "Points over time",
  "profile.progress.caption": "Hover a point to see the match and what it gave.",
  "profile.form.kicker": "Streaks",
  "profile.form.title": "Player form",
  "profile.bestStreak": "Best correct streak",
  "profile.currentStreak": "Current correct streak",
  "profile.streakHint": "matches in a row",
  "profile.perfect": "Perfect matches",
  "profile.perfectHint": "predicted exactly",
  "profile.records.kicker": "Records",
  "profile.records.title": "Player records",
  "profile.bestMapScore": "Best map haul",
  "profile.bestMapScoreHint": "The most map points from a single match",
  "profile.avgCorrect": "Average per correct match",
  "profile.avgCorrectHint": "Average points in matches where the winner was called right",
  "profile.comparison.kicker": "Comparison",
  "profile.comparison.title": "Against the event",
  "profile.comparison.hint": "of {total} · TOP {percent}%",
  "profile.history.kicker": "History",
  "profile.history.title": "Recent predictions",
  "profile.pick": "Pick: {a}:{b}",
  "profile.result": " · Result: {a}:{b}",
  "profile.split": "Series +{series} · Maps +{maps}",
  "profile.map.exact": "Exact",
  "profile.map.winner": "Winner",
  "profile.map.miss": "Miss",
  "profile.empty.title": "No predictions",
  "profile.empty.text": "This player has not saved any prediction in this event yet.",

  // --- Moje statystyki -----------------------------------------------------
  "myStats.tab.general": "General",
  "myStats.tab.accuracy": "Accuracy",
  "myStats.tab.form": "Form",
  "myStats.tab.comparison": "Comparison",
  "myStats.tab.analysis": "Analysis",
  "myStats.tab.style": "Style",
  "myStats.tab.trends": "Trends",
  "myStats.loading": "Loading the stats",
  "myStats.loginText": "The stats are computed from your predictions, so we need to know who is asking.",
  "myStats.error": "Could not load the stats",
  "myStats.errorText": "Could not load the stats.",
  "myStats.kicker": "Your data",
  "myStats.title": "My stats",
  "myStats.titleEvent": "My stats — {event}",
  "myStats.intro": "A detailed summary of your predictions in this event.",
  "myStats.empty.title": "Nothing to show yet",
  "myStats.empty.text": "You have no match predictions in this event yet. The stats show up after your first saved prediction.",
  "myStats.rank": "Ranking",
  "myStats.noPointsYet": "no settled points yet",
  "myStats.points": "Points",
  "myStats.pointsPerMatch": "Points / match",
  "myStats.profile": "Profile",
  "myStats.steadyForm": "Steady form",
  "myStats.picks": "Predictions",
  "myStats.settled": "Settled: {count}",
  "myStats.winners": "Winners",
  "myStats.seriesExact": "Series exacts",
  "myStats.maps": "Maps",
  "myStats.mapWinner": "Winner: {hits}/{total}",
  "myStats.mapExact": "Exact: {hits}/{total}",
  "myStats.pointsSplit": "Series: {value} pts",
  "myStats.pointsSplitMaps": "Maps: {value} pts",
  "myStats.matchWinner": "Match winner",
  "myStats.mapWinnerLabel": "Map winner",
  "myStats.mapExactLabel": "Map exact",
  "myStats.recent": "Recent matches",
  "myStats.noData": "No data",
  "myStats.last5": "Last 5",
  "myStats.last10": "Last 10",
  "myStats.currentStreak": "Current streak",
  "myStats.bestStreak": "Best streak",
  "myStats.bestMatch": "Best match",
  "myStats.average": "Average: {value}",
  "myStats.eventAverage": "Event: {value}%",
  "myStats.bestTeam": "Best predicted",
  "myStats.nemesis": "Nemesis",
  "myStats.mostPicked": "Most often picked",
  "myStats.mostOneSided": "Most one-sided",
  "myStats.mostDivided": "Most divided",
  "myStats.popularScore": "Popular score",
  "myStats.mapAccuracy": "Map accuracy",
  "myStats.averageError": "Average error: {value}",
  "myStats.yourProfile": "Your profile",
  "myStats.contrarian": "Against the crowd",
  "myStats.withMajority": "With the crowd",
  "myStats.hits": "Correct: {count}",
  "myStats.rarestHit": "Rarest correct pick",
  "myStats.trends": "Trends",
  "myStats.notEnough": "Not enough data",
  "myStats.settledOf": "Settled matches: {count} / 4",
  "myStats.direction": "Direction",

  // --- Pojedynek dwoch graczy ----------------------------------------------
  "h2h.loading": "Computing the duel...",
  "h2h.error": "Could not load the comparison",
  "h2h.errorText": "Could not load the comparison.",
  "h2h.kicker": "Duel",
  "h2h.title": "{a} versus {b}",
  "h2h.common": {
    one: "{count} shared match in this tournament",
    other: "{count} shared matches in this tournament",
  },
  "h2h.backToProfile": "Back to the profile",
  "h2h.nothingSettled": "No shared match has been settled yet.",
  "h2h.lead": {
    one: "{name} leads by {count} match with {ties} out of {settled}.",
    other: "{name} leads by {count} matches with {ties} out of {settled}.",
  },
  "h2h.ties": {
    one: "{count} draw",
    other: "{count} draws",
  },
  "h2h.settled": {
    one: "{count} shared match",
    other: "{count} shared matches",
  },
  "h2h.draw": {
    one: "A draw after {count} shared match.",
    other: "A draw after {count} shared matches.",
  },
  "h2h.sharedPoints": "Points from shared matches",
  "h2h.sharedPointsHint": "from settled matches only",
  "h2h.tiesLabel": "Draws",
  "h2h.tiesHint": "the same points for a match",
  "h2h.samePick": "Same series pick",
  "h2h.samePickHint": "points can still differ — the maps decide",
  "h2h.pending": "Not played yet",
  "h2h.pendingHint": "picked by both",
  "h2h.progress.kicker": "Progress",
  "h2h.progress.title": "Who pulled ahead when",
  "h2h.progress.text": "Cumulative points, from shared matches only — from the first to the last.",
  "h2h.stats.kicker": "Stats",
  "h2h.stats.title": "The whole tournament",
  "h2h.stats.text": "Everything each of them predicted counts here — including matches the other one did not pick.",
  "h2h.row.points": "Points in the ranking",
  "h2h.row.rank": "Place in the ranking",
  "h2h.row.accuracy": "Accuracy",
  "h2h.row.winners": "Correct winners",
  "h2h.row.exactSeries": "Exact series scores",
  "h2h.row.exactMaps": "Exact maps",
  "h2h.row.correctMaps": "Correct maps",
  "h2h.row.streak": "Longest streak",
  "h2h.row.perfect": "Perfect matches",
  "h2h.row.bestMatch": "Best match",
  "h2h.empty.title": "No shared matches",
  "h2h.empty.text": "These two players did not pick a single same match in this tournament, so there is nothing to compare.",
  "h2h.matches.kicker": "Match by match",
  "h2h.matches.title": "Shared predictions",
  "h2h.samePickShort": "same series pick",

  // --- Strony typowania faz ------------------------------------------------
  "pickem.loading": "Loading the stage",
  "pickem.saved": "Predictions saved ✅",
  "pickem.saveError": "Could not save the predictions.",
  "pickem.saving": "Saving...",
  "pickem.save": "Save predictions",
  "pickem.loginRequired": "Login required",
  "pickem.loginCta": "Log in with Discord to make predictions",
  "pickem.loadError": "Could not load the stage",
  "pickem.lockedNow": "Predictions are currently locked.",
  "pickem.swiss.kicker": "Swiss stage · {stage}",
  "pickem.swiss.stages": "Swiss stage steps",
  "pickem.swiss.loadError": "Could not load the Swiss Pick'Em.",
  "pickem.swiss.group30": "3-0 record",
  "pickem.swiss.group03": "0-3 record",
  "pickem.swiss.groupAdvancing": "Advancing",
  "pickem.swiss.desc30": {
    one: "Pick exactly {count} team with a 3-0 record.",
    other: "Pick exactly {count} teams with a 3-0 record.",
  },
  "pickem.swiss.desc03": {
    one: "Pick exactly {count} team with a 0-3 record.",
    other: "Pick exactly {count} teams with a 0-3 record.",
  },
  "pickem.swiss.descAdvancing": {
    one: "Pick exactly {count} team to advance.",
    other: "Pick exactly {count} teams to advance.",
  },
  "pickem.teamsCount": {
    one: "{count} team",
    other: "{count} teams",
  },
  "pickem.playin.kicker": "Tournament stage",
  "pickem.playin.loadError": "Could not load the Play-In Pick'Em.",
  "pickem.playin.pick": {
    one: "Pick {count} team to advance from this stage",
    other: "Pick {count} teams to advance from this stage",
  },
  "pickem.playoffs.kicker": "Knockout stage",
  "pickem.playoffs.loadError": "Could not load the Playoffs Pick'Em.",
  "pickem.step": "Step {no}",
  "pickem.playoffs.needSemis": "Pick the semi-finalists first.",
  "pickem.playoffs.needFinalists": "Pick the finalists first.",
  "pickem.playoffs.intro": "Predict the bracket step by step: semi-finalists, finalists, the champion and third place. Each step narrows the choice in the next one.",
  "pickem.doubleElim.kicker": "Double elimination bracket",
  "pickem.doubleElim.intro": "Name the participants of the four finals. A team already used does not come back in the later groups.",
  "pickem.doubleElim.loadError": "Could not load the Double Elimination Pick'Em.",

  // --- Strona turnieju -----------------------------------------------------
  "event.backToList": "Back to the tournament list",
  "event.kicker": "Event",
  "event.error": "Error",
  "event.statsError": "Could not load the event stats.",
  "event.statsLoading": "Loading the event stats...",
  "event.phaseLabel": "Stage:",
  "event.statusLabel": "Status:",
  "event.participantsLabel": "Players:",
  "event.none": "none",
  "event.status.open": "Open",
  "event.status.closed": "Closed",
  "event.status.finished": "Finished",
  "event.intro": "The event hub — matches, predictions, ranking and the tournament's current progress.",
  "event.archive": "Download the archive (.xlsx)",
  "event.matchesCount": {
    one: "{count} match",
    other: "{count} matches",
  },
  "event.finishedCount": {
    one: "{count} finished",
    other: "{count} finished",
  },
  "event.scheduledCount": {
    one: "{count} scheduled",
    other: "{count} scheduled",
  },
  "event.picksCount": {
    one: "{count} pick",
    other: "{count} picks",
  },
  "event.stat.matches": "Matches",
  "event.stat.participants": "Players",
  "event.stat.predictions": "Predictions made",
  "event.stat.mapPredictions": "Map predictions",
  "event.stat.averagePoints": "Average points",
  "event.stat.exactMaps": "Exact maps",
  "event.stat.bestScore": "Best score",
  "event.stat.mostExacts": "Most exacts",
  "event.stat.bestAccuracy": "Best accuracy",
  "event.stat.correctOf": "{correct}/{total} correct",
  "event.stat.favoriteTeam": "Crowd favourite",
  "event.summary.kicker": "Your result",
  "event.summary.title": "Your event summary",
  "event.summary.place": "Place",
  "event.summary.split": "Series {series} · Maps {maps}",
  "event.summary.correctMatches": "Correct matches",
  "event.summary.fullProfile": "See the full profile →",
  "event.top.title": "Event leaders",
  "event.top.place": "Place {no}",
  "event.close.kicker": "Closest call",
  "event.close.title": "The match the community was most split on",
  "event.upset.kicker": "Biggest upset",
  "event.upset.title": "The community got it wrong",
  "event.upset.winner": "WINNER",
  "event.upset.won": "won {score}",
  "event.upset.nobody": "Nobody predicted the winner",
  "event.upset.only": "Only {percent} predicted the winner",
  "event.tile.matches": "Matches",
  "event.tile.matchesHint": "Predict BO1 / BO3 / BO5 · {matches} · {finished}",
  "event.tile.teamPicks": "Team predictions",
  "event.tile.myPicks": "My predictions",
  "event.tile.myPicksHint": "See your saved predictions · {picks}",
  "event.tile.myStats": "My stats",
  "event.tile.myStatsHint": "Accuracy · form · analysis · style · trends",
  "event.tile.leaderboard": "Ranking",
  "event.tile.leaderboardHint": "Check the player table · {players}",
  "event.phaseLink.settled": "Stage settled",
  "event.phaseLink.closed": "Stage closed",
  "event.teamPick.saved": "pick saved, you can change it",
  "event.teamPick.open": "open — make your pick",
  "event.teamPick.settled": "settled",
  "event.teamPick.closed": "closed",
  "event.nextMatch": "Next match",
  "event.noNextMatch": "No match scheduled",
  "event.goToMatch": "Go to the match",
  "event.phases.kicker": "Tournament",
  "event.phases.title": "Event stages",
  "event.phases.current": "Current stage",
  "event.phases.none": "No active stage",

  // --- Strona meczu --------------------------------------------------------
  "match.backToList": "Back to the match list",
  "match.loading": "Loading the match",
  "match.error": "Could not load the match",
  "match.notFound": "Match not found.",
  "match.picksCount": {
    one: "{count} pick",
    other: "{count} picks",
  },
  "match.yourPick": "Your prediction",
  "match.seriesTitle": "BO{bo} series score",
  "match.seriesHint": "Pick the series score first, then fill in the scores of the individual maps.",
  "match.locked": "Predictions for this match are locked.",
  "match.loginToSave": "Log in with Discord to save your prediction.",
  "match.savePick": "Save prediction",
  "match.checkingLogin": "Checking your login...",
  "match.saved": "Prediction saved.",
  "match.bo1Title": "Who wins?",
  "match.bo1Hint": "Name the winner and give the round score.",
  "match.needLogin": "Log in with Discord first.",
  "match.needWinner": "Pick the winner of the match.",
  "match.badScore": "Give a valid CS2 score.",
  "match.winnerMismatch": "The winner you picked does not match the score.",
  "match.needSeries": "Pick the series score.",
  "match.badMapScore": "Give a valid CS2 score for every map.",
  "match.seriesTooEarly": "The series ends earlier than the maps you gave suggest.",
  "match.seriesMismatch": "The map scores do not match the series score you picked.",
  "match.finished": "Match finished",
  "match.result.kicker": "Result",
  "match.result.title": "Match result",
  "match.howYouDid": "See how you did",
  "match.loginToSee": "Log in with Discord to see your saved prediction.",
  "match.yourScore": "Your result",
  "match.pointsEarned": "Points earned",
  "match.totalHint": "points for this match",
  "match.seriesHintPoints": "for the match result",
  "match.mapsHintPoints": "for the map results",
  "match.community.kicker": "Community",
  "match.community.title": "How did the community predict?",
  "match.community.emptyTitle": "Nobody predicted this match",
  "match.community.emptyText": "Predictions closed without a single saved pick.",
  "match.community.total": "Picks in total:",
  "match.community.popular": "Most popular score:",
  "match.community.mapsTitle": "How were the maps predicted?",
  "match.whatYouPicked": "What you picked",
  "match.noPick": "You did not predict this match.",

  // --- Komunikaty serwera --------------------------------------------------
  // Serwer odpowiada polskim zdaniem i dokladkiem `code`. Kod
  // prowadzi tutaj, polskie zdanie zostaje zapasem dla klienta,
  // ktory kodu nie zna - patrz lib/apiMessages.js.
  "api.httpError": "API error: {status}",
  "server.dbError": "Database error.",
  "server.mustLogin": "You have to be logged in.",
  "server.notMember": "You are not a member of this server.",
  "server.teamNotFound": "Team not found.",
  "server.eventNotFound": "Tournament not found.",
  "server.matchNotFound": "Match not found.",
  "server.backupNotFound": "Backup file not found.",
  "server.badSwissStage": "Invalid Swiss stage.",
  "server.badStage": "Invalid stage.",
  "server.badStatus": "Invalid status.",
  "server.badLockMode": "Invalid lock mode.",
  "server.badSeriesPick": "Invalid series pick.",
  "server.badCs2Score": "Invalid CS2 score.",
  "server.badWinner": "Invalid winner.",
  "server.badBo": "BO has to be 1, 3 or 5.",
  "server.badDefaultBo": "The default BO has to be 1, 3 or 5.",
  "server.bo1OneMap": "A BO1 has to contain exactly one map.",
  "server.thirdFromSemis": "Third place has to be one of the semi-finalists.",
  "server.thirdNotFinalist": "Third place cannot be a finalist or the winner.",
  "server.finalistsFromSemis": "The finalists have to come from the semi-finalists.",
  "server.winnerIsFinalist": "The winner has to be a finalist.",
  "server.winnerFromFinalists": "The winner has to be one of the finalists.",
  "server.phaseDeadlinePassed": "The prediction deadline for this stage has passed.",
  "server.matchDeadlinePassed": "The deadline for predicting match results in this stage has passed.",
  "server.needTwoPlayers": "A comparison needs two different players.",
  "server.teamExists": "A team with that name already exists on this server.",
  "server.teamsMustDiffer": "The teams have to be different.",
  "server.teamNameRequired": "A team name is required.",
  "server.bothTeamsActive": "Both teams have to exist and be active on this server.",
  "server.matchAlreadyFinished": "The match is already finished.",
  "server.eventAlreadyFinished": "This tournament is already finished.",
  "server.matchPickingClosed": "Predictions for this match are already closed.",
  "server.mapNumbersSequential": "Map numbers have to be consecutive: 1, 2, 3...",
  "server.mapNumbersUnique": "Map numbers cannot repeat.",
  "server.seriesEndsEarly": "The series ends too early for the maps given.",
  "server.winnerMismatch": "The winner you picked does not match the score.",
  "server.mapsMismatch": "The map scores do not match the series score.",
  "server.scoresNonNegative": "Scores have to be non-negative integers.",
  "server.eventChanged": "The tournament state changed in the meantime. Refresh and try again.",
  "server.phaseAndMatchesRequired": "Required: a stage and a list of matches.",
  "server.nothingToCreate": "Nothing to create — no line passed validation.",
  "server.noValidIds": "None of the given identifiers is valid.",
  "server.idsArray": "ids has to be a non-empty array of identifiers.",
  "server.orderedIdsArray": "orderedIds has to be a non-empty array.",
  "server.phasesArray": "fazy has to be a non-empty array.",
  "server.entriesArray": "entries has to be a non-empty array of { nickname, teamName }.",
  "server.permissionCheckFailed": "Could not verify your permissions.",
  "server.visitsFailed": "Could not load the visit counter.",
  "server.matchLoadFailed": "Could not load the match.",
  "server.archiveFailed": "Could not prepare the archive.",
  "server.archiveLoadFailed": "Could not load the archive.",
  "server.matchDeleteFailed": "Could not delete the match.",
  "server.matchesCreateFailed": "Could not create the matches.",
  "server.matchSaveFailed": "Could not save the match changes.",
  "server.myPicksFailed": "Could not load your predictions.",
  "server.teamsLoadFailed": "Could not load the teams.",
  "server.teamLoadFailed": "Could not load the team.",
  "server.h2hFailed": "Could not load the comparison.",
  "server.pointsLoadFailed": "Could not load the points.",
  "server.swissStatsFailed": "Could not load the Swiss stats.",
  "server.pickLoadFailed": "Could not load the prediction.",
  "server.pickSaveFailed": "Could not save the prediction.",
  "server.swissPicksLoadFailed": "Could not load the Swiss predictions.",
  "server.swissPicksSaveFailed": "Could not save the Swiss predictions.",
  "server.playinPicksLoadFailed": "Could not load the Play-In predictions.",
  "server.playinPicksSaveFailed": "Could not save the Play-In predictions.",
  "server.playoffsPicksLoadFailed": "Could not load the Playoffs predictions.",
  "server.playoffsPicksSaveFailed": "Could not save the Playoffs predictions.",
  "server.dePicksLoadFailed": "Could not load the Double Elimination predictions.",
  "server.dePicksSaveFailed": "Could not save the Double Elimination predictions.",
  "server.allTimeFailed": "Could not load the all-time classification.",
  "server.upsetsFailed": "Could not load the upsets.",
  "server.playerNotFound": "Player not found.",
  "server.playerCareerFailed": "Could not load the player profile.",
  "server.mvpVoteFailed": "Could not load the MVP vote.",
  "server.mapsFailed": "Could not load the map statistics.",
  "server.matchMissing": "The match does not exist",
  "server.noSuchEvent": "No such tournament.",
  "server.notFound": "Not found.",
  "server.proposalMissing": "The proposal does not exist",
  "server.needAdmin": "Administrator permission on this server is required.",
  "server.candidateIdRequired": "A candidate identifier is required.",
  "server.teamOneSlot": "A team cannot appear in more than one slot",
  "server.backupFailed": "Backup failed",
  "server.backupListFailed": "Could not list backups",
  "server.endTournamentFailed": "Ending the tournament failed",
  "server.finalistsMustBeSemis": "Finalists must be semi-finalists",
  "server.badBackupName": "Invalid backup file name",
  "server.badThirdPlace": "Invalid third place",
  "server.noTeamsSelected": "No teams selected",
  "server.noValidCandidates": "No valid candidates provided",
  "server.restoreFailed": "Restore failed",

  // --- Komunikaty serwera - blokady i powody -------------------------------
  "server.lock.matchFinished": "The match is finished.",
  "server.lock.matchesClosed": "Match predictions are currently closed.",
  "server.lock.matchLocked": "The match is locked.",
  "server.lock.phaseClosed": "Predictions for this stage are closed.",
  "server.lock.swissClosed": "Swiss predictions are closed.",
  "server.lock.playinClosed": "Play-In predictions are closed.",
  "server.lock.playoffsClosed": "Playoffs predictions are closed.",
  "server.lock.deClosed": "Double Elimination predictions are closed.",
  "server.stale.swiss": "This form belongs to a previous event. Open the current Swiss.",
  "server.stale.playin": "This form belongs to a previous event. Open the current Play-In.",
  "server.stale.playoffs": "This form belongs to a previous event. Open the current Playoffs.",
  "server.stale.de": "This form belongs to a previous event. Open the current Double Elimination panel.",
  "server.frozen.eventOver": "the tournament is over",
  "server.frozen.hasPicks": "there are picks or a result already",
  "server.archiveNotReady": "The archive is created once the tournament ends. This one is still running.",
  "server.noProvider": "The result provider is not configured (RESULT_PROVIDER in server/.env)",
  "server.noActiveTeams": "This server has no active team at all. Add them first on the Teams page (there is a JSON import there).",
  "server.teamsMustExist": "The teams have to exist and be active. Add the missing ones on the Teams page or fix the names in the list.",
  "server.phasesFrozen": "These stages cannot be changed: {phases}",
  "server.noChannel": "It is unclear which channel to publish the panel on. {hint}",
  "server.archivedScoring": "Map scoring rules changed after it ended - recomputing would rewrite a closed ranking. If you really want that, un-archive it first.",
  "server.notStarted": "not started",

  // --- Klasyfikacja wszech czasow ------------------------------------------
  "allTime.nav": "All-time",
  "allTime.kicker": "Across tournaments",
  "allTime.title": "All-time classification",
  "allTime.intro": "Who predicts best over time, not in a single tournament. Position is decided by the average place in the field, not by total points — those are incomparable between tournaments with different numbers of matches.",
  "allTime.loading": "Computing the classification...",
  "allTime.error": "Could not load the classification",
  "allTime.ranked": {
    one: "{count} player with a comparable record",
    other: "{count} players with a comparable record",
  },
  "allTime.head.player": "Player",
  "allTime.head.starts": "Starts",
  "allTime.head.best": "Best start",
  "allTime.head.average": "Average",
  "allTime.starts": {
    one: "{count} start",
    other: "{count} starts",
  },
  // Ta sama liczba, ktora profil gracza pokazuje przy kazdym
  // starcie jako "TOP x%" - i to nie jest przypadek, patrz
  // server/lib/allTime.js.
  "allTime.average": "TOP {percent}%",
  "allTime.bestPlace": "#{rank} / {total}",
  "allTime.empty.title": "Not enough tournaments",
  "allTime.empty.text": {
    one: "The classification covers players with at least {count} start. It shows up once anyone has played two tournaments.",
    other: "The classification covers players with at least {count} starts. It shows up once anyone has played two tournaments.",
  },
  "allTime.note": {
    one: "The table holds players with at least {count} start. One tournament is too few to tell skill from luck — you are one start away.",
    other: "The table holds players with at least {count} starts. One tournament is too few to tell skill from luck — you are one start away.",
  },

  // --- Niespodzianki -------------------------------------------------------
  "upsets.nav": "Upsets",
  "upsets.kicker": "When almost everyone was wrong",
  "upsets.title": "Upsets",
  "upsets.intro": "Matches where fewer than {percent}% of players picked the winner. The rest of the site shows who was right — this page shows the moments when almost nobody was.",
  "upsets.loading": "Looking for upsets...",
  "upsets.error": "Could not load the upsets",
  "upsets.counted": {
    one: "{count} match went against the crowd",
    other: "{count} matches went against the crowd",
  },
  "upsets.head.match": "Match",
  "upsets.head.where": "Where",
  "upsets.head.share": "Correct",
  "upsets.head.player": "Player",
  "upsets.head.hits": "Hits",
  "upsets.head.rate": "Hit rate",
  "upsets.head.team": "Team",
  "upsets.head.judgement": "Judgement",
  "upsets.head.gap": "Gap",
  // Same liczby i ukosnik - czyta sie tak samo we wszystkich
  // pieciu jezykach. Ten sam zabieg, co przy allTime.bestPlace,
  // i z tego samego powodu: .ui-badge robi uppercase, wiec kazdy
  // przyimek w srodku zaczyna krzyczec.
  "upsets.hits": "{hits} / {total}",
  "upsets.share": "{percent}%",
  "upsets.note": {
    one: "Only matches with at least {count} pick count — among three people \"nobody got it right\" means nothing. The line for an upset is {percent}% correct.",
    other: "Only matches with at least {count} picks count — among three people \"nobody got it right\" means nothing. The line for an upset is {percent}% correct.",
  },
  "upsets.empty.title": "The favourites held",
  "upsets.empty.text": "There is no match yet where fewer than {percent}% of players picked the winner. One will show up here the moment it happens.",
  "upsets.people.kicker": "Against the crowd",
  "upsets.people.title": "Who gets them right",
  "upsets.people.intro": "In these matches the average player was right {percent}% of the time. Below are those who did better — and not off a single lucky call.",
  // Zakres "od jednej do trzydziestu trzech" to liczba zmierzona
  // na produkcji, a nie figura retoryczna - patrz naglowek
  // server/lib/upsets.js.
  "upsets.people.note": {
    one: "The table holds players with at least {count} chance, meaning that many matches from this list that they picked. Position is decided by hit rate, not by the number of hits: chances range from one to thirty-three, so a raw count would reward playing often.",
    other: "The table holds players with at least {count} chances, meaning that many matches from this list that they picked. Position is decided by hit rate, not by the number of hits: chances range from one to thirty-three, so a raw count would reward playing often.",
  },
  "upsets.teams.kicker": "Trust versus results",
  "upsets.teams.title": "Overrated and underrated teams",
  "upsets.teams.intro": "Trust is the share of picks placed on a team, the win rate is the share of matches it wins. A positive gap means a team trusted more than it deserves.",
  "upsets.teams.trust": "Trust {percent}%",
  "upsets.teams.wins": "Wins {percent}%",
  "upsets.teams.note": {
    one: "The table holds teams with at least {count} decided match. With a single match trust and win rate are zero or one hundred percent, and the gap between them says nothing about the team.",
    other: "The table holds teams with at least {count} decided matches. With a single match trust and win rate are zero or one hundred percent, and the gap between them says nothing about the team.",
  },

  // --- Profil gracza ponad turniejami --------------------------------------
  "career.kicker": "Across tournaments",
  "career.loading": "Loading the record...",
  "career.error": "Could not load the profile",
  "career.played": {
    one: "{count} start since the site began",
    other: "{count} starts since the site began",
  },
  "career.noStarts": "Not ranked in any tournament yet",
  "common.percentValue": "{percent}%",
  "career.stat.average": "Average",
  "career.stat.averageHint": "place in the field",
  "career.stat.best": "Best start",
  "career.stat.bestValue": "#{rank} / {total}",
  "career.stat.bestHint": "no ranked start yet",
  "career.stat.points": "Points",
  "career.stat.pointsHint": "across every tournament",
  "career.stat.contra": "Against the crowd",
  "career.stat.contraHint": "{hits} of {total} upsets",
  "career.stat.contraNone": "no match here surprised everyone",
  "career.contraShort": {
    one: "{count} more chance - a match where the crowd was wrong - and this record joins the “against the crowd” table.",
    other: "{count} more chances - matches where the crowd was wrong - and this record joins the “against the crowd” table.",
  },
  "career.starts.kicker": "Tournament by tournament",
  "career.starts.title": "Every start",
  "career.starts.count": {
    one: "{count} tournament",
    other: "{count} tournaments",
  },
  // Doklejane do "history.count", dlatego zaczyna sie od myslnika
  // ze spacjami - komponent sklada oba napisy bez separatora.
  "career.starts.hint": " — click to open the profile from that tournament.",
  "career.teams.kicker": "Who they back",
  "career.teams.title": "Teams they back",
  "career.teams.intro": "The teams backed most often, next to how often they won. The most-backed comes first — the win rate only answers whether that trust was earned.",
  "career.teams.head.team": "Team",
  "career.teams.head.record": "Record",
  "career.teams.head.rate": "Won",
  // Same liczby i ukosnik - ten sam zabieg, co przy upsets.hits
  // i allTime.bestPlace, i z tego samego powodu: .ui-badge robi
  // uppercase, wiec kazdy przyimek w srodku zaczyna krzyczec.
  "career.teams.record": "{wins} / {picks}",
  "career.teams.empty": {
    one: "No team has collected {count} pick from this player yet — {picks} match picks in total.",
    other: "No team has collected {count} picks from this player yet — {picks} match picks in total.",
  },

  // --- Glosowanie na MVP ---------------------------------------------------
  "mvp.kicker": "The community's vote",
  "mvp.title": "Who was tipped for MVP",
  "mvp.resolved": "{nickname} won it, and {percent}% of voters called it.",
  "mvp.open": {
    one: "{count} vote cast. The winner has not been named yet.",
    other: "{count} votes cast. The winner has not been named yet.",
  },
  "mvp.head.player": "Candidate",
  "mvp.head.votes": "Votes",
  "mvp.head.share": "Share",
  "mvp.votes": {
    one: "{count} vote",
    other: "{count} votes",
  },
  "mvp.note": {
    one: "Counted from {count} vote cast. The list holds candidates with at least one vote, plus the winner — even with none.",
    other: "Counted from {count} votes cast. The list holds candidates with at least one vote, plus the winner — even with none.",
  },
  "upsets.mvp.kicker": "Not every miss is a match",
  "upsets.mvp.headline": "The MVP vote was {percent}% right — {nickname} won it, backed by {votes} people out of {total}.",

  // --- Czytanie wynikow map ------------------------------------------------
  "maps.nav": "Maps",
  "maps.kicker": "Rounds, not maps",
  "maps.title": "How we read map scores",
  "maps.intro": "Picking a map means picking the round score. Putting those picks next to what actually happened says one specific thing about this community — and it is not the thing anyone would expect.",
  "maps.loading": "Crunching the maps...",
  "maps.error": "Could not load the map statistics",
  "maps.stat.predicted": "Predicted gap",
  "maps.stat.predictedHint": "rounds between the teams",
  "maps.stat.actual": "Actual gap",
  "maps.stat.actualHint": "what actually happens",
  "maps.lead": {
    one: "This community picks maps CLOSER than they turn out: {predicted} rounds of difference on average against {actual} in reality. Counted from {count} settled pick.",
    other: "This community picks maps CLOSER than they turn out: {predicted} rounds of difference on average against {actual} in reality. Counted from {count} settled picks.",
  },
  "maps.dist.kicker": "Pick next to reality",
  "maps.dist.title": "The most common scores",
  "maps.dist.intro": "What people type in most often, set against what actually happens most often. The bars are scaled to the most common score within each set, so the two shapes can be compared.",
  "maps.dist.predicted": "Predicted",
  "maps.dist.actual": "Actual",
  "maps.readers.kicker": "Who reads them best",
  "maps.readers.title": "Map reading",
  "maps.readers.intro": "Position is decided by deviation from the score — the very thing map scoring rests on here. LOWER is better.",
  "maps.readers.head.player": "Player",
  "maps.readers.head.record": "Record",
  "maps.readers.head.deviation": "Deviation",
  "maps.readers.picks": {
    one: "{count} settled pick",
    other: "{count} settled picks",
  },
  "maps.readers.winners": "Winner {percent}%",
  "maps.readers.exact": {
    one: "{count} exact",
    other: "{count} exact",
  },
  "maps.readers.note": {
    one: "The table holds players with at least {count} settled map pick — roughly what one full tournament gives you.",
    other: "The table holds players with at least {count} settled map picks — roughly what one full tournament gives you.",
  },
  "maps.noNames": "There is nothing here about particular maps, because the map name is not in the data — picks and results hold only the map's number in the series. The number says nothing either: accuracy on the first, second and third comes out at 54%, 56% and 55%, so the decider is no harder than the opener.",
  "maps.empty.title": "No settled maps yet",
  "maps.empty.text": "This page is built from map picks that have a result. It shows up as soon as the first maps are settled.",

  // --- Rywale gracza w turnieju --------------------------------------------
  // Rywale gracza w turnieju.
  //
  // Pojedynek dwoch graczy istnial od dawna, ale wchodzilo sie w niego
  // z JEDNEGO miejsca i trzeba bylo wiedziec, czyj profil otworzyc.
  // Ta sekcja odpowiada na pytanie, ktore pada wczesniej: z kim wlasciwie
  // ten gracz sie sciga.
  "rivals.kicker": "Who picks the same",
  "rivals.title": "Rivals",
  "rivals.intro": "Players who picked the same matches. Only what both of them picked — and what has been settled — counts; a match one of them skipped says nothing about who is ahead.",
  "rivals.loading": "Working out the rivals...",
  "rivals.error": "The rivals could not be loaded.",
  "rivals.head.player": "Rival",
  "rivals.head.record": "Record",
  // Remisy maja wlasna liczbe, bo jest ich duzo: zmierzone na produkcji
  // to 48% wspolnych meczow. Za 60% typow nie ma zadnych punktow,
  // a dwa zera to remis - wiec bez tej liczby bilans 34-14 przy stu
  // wspolnych meczach wygladalby na blad.
  "rivals.ties": {
    one: "{count} tie",
    other: "{count} ties",
  },
  "rivals.sharedCount": {
    one: "{count} shared match",
    other: "{count} shared matches",
  },
  // Odznaki, nie osobne kafelki: ten sam czlowiek bywa jednoczesnie
  // najczestszym i najrowniejszym rywalem.
  "rivals.badge.most": "most frequent",
  "rivals.badge.closest": "most even",
  "rivals.badge.best": "biggest lead",
  "rivals.badge.worst": "biggest deficit",
  "rivals.duel": "Duel",
  "rivals.more": {
    one: "…and {count} more rival",
    other: "…and {count} more rivals",
  },
  "rivals.empty.none": "This player has no settled picks in this tournament yet, so there is nothing to compare.",
  "rivals.empty.tooFew": {
    one: "Nobody shares even {count} settled match with this player — too few for a record to mean anything.",
    other: "Nobody shares even {count} settled matches with this player — too few for a record to mean anything.",
  },
  "rivals.note": {
    one: "The record counts matches settled BETWEEN the two players. Ties — the same points for a match — are counted separately, because they make up nearly half of all shared matches. A rival enters the list from {count} such match.",
    other: "The record counts matches settled BETWEEN the two players. Ties — the same points for a match — are counted separately, because they make up nearly half of all shared matches. A rival enters the list from {count} such matches.",
  },

  // --- Wynik turnieju ------------------------------------------------------
  // Wynik turnieju na stronie turnieju.
  //
  // Mistrz lezal w playoffs_results od poczatku, ale pokazywal go
  // wylacznie komponent PhaseResults na stronach TYPOWANIA fazy - mozna
  // bylo otworzyc strone IEM Cologne Major 2026 i nie dowiedziec sie,
  // ze wygraly Falcons.
  "outcome.kicker": "How it ended",
  "outcome.title": "Tournament result",
  "outcome.intro": "Who won — and how many players called it. The percentages come from playoff picks, not from everyone in the tournament.",
  // Etykieta plus nazwa, nigdy zdanie z nazwa w srodku. Nazwy druzyn to
  // wolny tekst z bazy, wiec "Falcons pokonali FURIE" wymagaloby biernika,
  // ktorego nie da sie zbudowac ani po polsku, ani po rosyjsku.
  "outcome.champion": "Champion",
  "outcome.runnerUp": "Runner-up",
  "outcome.semis": {
    one: "Semi-finalist",
    other: "Semi-finalists",
  },
  "outcome.third": "Third place",
  "outcome.called.title": "Who called it",
  "outcome.called.winner": "Champion called",
  "outcome.called.finalists": "Both finalists",
  "outcome.called.semifinalists": "All four semi-finalists",
  "outcome.favourite": "Community favourite",
  // Dopisek przy faworycie, nie osobne zdanie - doklejany po nazwie
  // i procencie, wiec dziala bez odmiany. Zmierzone: Krakow trafil
  // (Vitality 80%), Cologne i Budapeszt nie (Spirit 42%, Furia 57%).
  "outcome.favourite.hit": "and so it was",
  "outcome.favourite.miss": "but someone else won",
  "outcome.note": {
    one: "The base is {count} playoff pick made in this tournament. Anyone who skipped the playoff picks is not in these percentages, even if they picked matches.",
    other: "The base is {count} playoff picks made in this tournament. Anyone who skipped the playoff picks is not in these percentages, even if they picked matches.",
  },

  // --- Typy na fazy Swiss --------------------------------------------------
  // Typy na fazy Swiss zestawione z tym, co sie stalo.
  //
  // teamStats.js mowi wprost, ze liczy WYLACZNIE mecze, bo typy na awans
  // leza w bazie jako listy tekstowe i sa "osobna robota". To jest ta
  // robota: 2 074 wiersze faz daja po rozbiciu 18 803 oceny druzyn,
  // wobec 10 328 typow meczowych.
  //
  // StarLadder Budapest 2025 nie ma ani jednego meczu, wiec bez tej
  // strony nie istnieje w zadnej statystyce druzyn - a ma 837 typow.
  "swissPicks.kicker": "What the community backed",
  "swissPicks.title": "Phase picks",
  "swissPicks.intro": "The team statistics on this site count matches only. This is the other half of what the community thinks about teams — the 3-0, 0-3 and advancing picks, set against what actually happened.",
  "swissPicks.loading": "Loading the phase picks...",
  "swissPicks.errorText": "The phase picks could not be loaded.",
  "swissPicks.back": "Back to the tournament",
  "swissPicks.link": "Swiss phase picks",
  "swissPicks.group.threeZero": "Who goes 3-0",
  "swissPicks.group.zeroThree": "Who goes out 0-3",
  "swissPicks.group.advancing": "Who advances",
  "swissPicks.total": {
    one: "{count} player picking",
    other: "{count} players picking",
  },
  "swissPicks.correct": "correct",
  // Najmocniej obstawiona druzyna, ktora NIE byla poprawna odpowiedzia.
  // Zmierzone: GamerLegion 84% na 3-0, THUNDER dOWNUNDER 76% na 0-3,
  // B8 71% na awans - zadna nie wyszla.
  "swissPicks.overrated": "Safest bet that failed",
  // Druga polowa tej historii: poprawne odpowiedzi, ktorych tlum nie
  // widzial. Lynn Vision Gaming 1% na 0-3, FlyQuest 1% na 3-0,
  // SINNERS 2% na 0-3 - wszystkie trzy trafione.
  "swissPicks.missed": {
    one: "{count} answer nobody saw",
    other: "{count} answers nobody saw",
  },
  "swissPicks.pending": "This stage has no official result yet, so only the split of the votes is shown.",
  "swissPicks.note": {
    one: "An answer counts as missed when fewer than {count}% of the pickers named it. The list shows the top of each group plus EVERY correct answer, including one that fell outside the top — because that is what this page is about.",
    other: "An answer counts as missed when fewer than {count}% of the pickers named it. The list shows the top of each group plus EVERY correct answer, including one that fell outside the top — because that is what this page is about.",
  },
  "swissPicks.empty.title": "This tournament had no Swiss stages",
  "swissPicks.empty.text": "Not every format has a Swiss stage — some run a play-in or a double-elimination bracket instead. This page only appears where Swiss stage picks were made.",

  // --- Odnosniki do wyniku turnieju i rywali -------------------------------
  // Lista turniejow pokazywala same nazwy w kafelkach, wiec zakonczony
  // turniej nie mowil o sobie nic. Mistrz z procentem trafien robi
  // z listy cos, co da sie czytac - i sam prowadzi na strone turnieju.
  //
  // Etykieta obok nazwy, nigdy zdanie z nazwa w srodku: nazwy druzyn to
  // wolny tekst z bazy i nie da sie ich odmienic.
  "events.outcome.champion": "Champion",
  "events.outcome.called": "{percent}% called it",
  // Sekcja rywali siedzi na profilu gracza, czyli dwa klikniecia od
  // rankingu - i nic w rankingu nie mowilo, ze cos takiego istnieje.
  // Odnosnik pokazuje sie tylko zalogowanemu, bo tylko wtedy wiadomo,
  // czyich rywali pokazac.
  "leaderboard.myRivals": "My rivals",

  // --- Strona serwera ------------------------------------------------------
  // Strona pojedynczej spolecznosci.
  //
  // Zmierzone: serwis obsluguje DWIE spolecznosci z turniejami, nie jedna.
  // 848 graczy wylacznie na jednej, 221 wylacznie na drugiej, 41 w obu -
  // a cala strona mieszala ich turnieje w jednej liscie.
  "server.kicker": "Community",
  "server.intro": "This community's tournaments and its own leaderboard. The site serves several Discord servers at once — this page shows only this one.",
  "server.loading": "Loading the server...",
  "server.errorText": "This server could not be loaded.",
  "server.back": "Back to the home page",
  "server.stats.events": "Tournaments",
  "server.stats.participants": "Players picking",
  "server.stats.predictions": "Picks made",
  "server.top.kicker": "Best in this community",
  "server.top.title": "Server leaderboard",
  "server.top.intro": "The order comes from the average finishing position, not from total points — tournaments differ in size and their points are not comparable. LOWER is better.",
  // Prog dopasowany do serwera, nie sztywne dwa starty.
  //
  // Klasyfikacja wszech czasow wymaga dwoch startow i slusznie. Ale serwer
  // z jednym turniejem nie ma nikogo z dwoma - zmierzone, 221 graczy nie
  // moglo tam wejsc i nie zalezalo to od nich, tylko od tego, ile turniejow
  // zrobil ich serwer.
  "server.top.note": {
    one: "The leaderboard lists players with at least {count} start in this community. The threshold is lower than in the all-time classification, because a server that has run one tournament has nobody with two starts yet.",
    other: "The leaderboard lists players with at least {count} starts in this community. The threshold is lower than in the all-time classification, because a server that has run one tournament has nobody with two starts yet.",
  },
  "server.events.title": "This community's tournaments",
  "server.empty.title": "This server has not run a tournament yet",
  "server.empty.text": "The bot is here, but nobody has opened the picking yet. This page fills up with the first tournament.",
  "home.servers.view": "Open the server",

  // --- Termin zamkniecia typowania -----------------------------------------
  // Strona pozwalala typowac i nigdzie nie pisala, do kiedy.
  //
  // Bot wysyla na Discorda <t:unix:F> i <t:unix:R>, czyli date i zywy
  // odliczacz - ale to jest wiadomosc na kanale, ktory mozna wyciszyc,
  // a typ klika sie na stronie. Termin lezal w active_panels.deadline
  // i byl nawet odczytywany przez bramke, ktora brala z niego samo
  // "czy minal" i wyrzucala wartosc.
  //
  // Data jest formatowana w strefie PRZEGLADARKI wraz z nazwa strefy,
  // bo terminy zapisuje sie w Europe/Warsaw, a serwis ma pieciu jezykow
  // i graczy w roznych strefach.
  "deadline.closesAt": "Picks close {date}",
  "deadline.passedAt": "The deadline passed {date}",

  // --- Typy na fazy na stronie druzyny -------------------------------------
  // teamStats.js mowi wprost, ze liczy WYLACZNIE mecze. To jest druga
  // polowa - ta sama wiedza zebrana wokol druzyny.
  //
  // Zmierzone: GamerLegion typowana na awans 484 razy, trafnie 11%;
  // PARIVISION 347 razy, trafnie 87%; Imperial skazywana na 0-3 285 razy
  // i ANI RAZU sluszne, a na awans 76 razy przy 95% trafnosci.
  "team.phase.kicker": "Beyond the matches",
  "team.phase.title": "Phase picks",
  "team.phase.intro": "The statistics above count matches only. This is what the community said about this team in the tournament phases — and how often it was right.",
  "team.phase.advance": "Picked to advance",
  "team.phase.threeZero": "Picked to go 3-0",
  "team.phase.zeroThree": "Written off at 0-3",
  "team.phase.hit": "{percent}% right",
  "team.phase.picks": {
    one: "{count} time",
    other: "{count} times",
  },
  "team.phase.unsettled": "stage not settled",
  "teams.noMatches": "Phase picks only",
  // Siedem druzyn gralo wylacznie w StarLadder Budapest 2025, ktory nie
  // ma w bazie ani jednego meczu - do tej pory nie istnialy na stronie
  // wcale, mimo setek ocen.
  "team.phaseOnly.title": "This team has played no match here",
  "team.phaseOnly.text": "It played in a tournament with no matches recorded here — only the phase picks remain. That is why there are no match statistics or match history.",

  // --- Profil gracza - punkty z faz ----------------------------------------
  // Dymek nad punktem wykresu. Stala tu polska sklejka na sztywno,
  // wiec „Mecz 3" pokazywalo sie tak samo w pieciu jezykach.
  "chart.point.match": "Match {n}",
  // Os moze stac na etapach zamiast na meczach - w turnieju bez ani
  // jednego meczu w bazie „Mecz 3" byloby zwyczajnie nieprawda.
  "chart.point.phase": "Stage {n}",
  "chart.tooltip": "{name}: {points} pts, {total} in total",
  "chart.seriesPhase": {
    one: "{name}: {points} points after {count} stage",
    other: "{name}: {points} points after {count} stages",
  },
  // Klasyfikacja eventu to suma szesciu skladowych, a profil czytal
  // z tego wylacznie match_points.
  //
  // Zmierzone: 708 z 1294 wpisow gracz-turniej nie ma ANI JEDNEGO
  // wiersza w match_points. Pierwsze miejsce StarLadder Budapest 2025
  // ma 47 punktow (stage1 +12, stage2 +16, stage3 +12, playoffs +7)
  // i dostawalo siedem kafelkow z zerem.
  "profile.phase.kicker": "Beyond the matches",
  "profile.phase.title": "Points from phases",
  "profile.phase.intro": "The tournament standings also count phase picks — advances, 3-0 and 0-3. This is what they brought in.",
  "profile.phase.total": "From phases in total",
  "profile.phase.mvp": "MVP",
  // Budapeszt ma 509 sklasyfikowanych graczy i ZERO meczow w bazie.
  // Kolonia 148 takich graczy na 523, Krakow 51 na 262.
  "profile.noMatches.title": "Not a single match went into this result",
  "profile.noMatches.text": "The whole result comes from phase picks. That is why there is no accuracy, no streaks and no match records here — there is nothing to compute them from.",
  "profile.progress.captionPhase": "Hover a point to see the stage and what it brought.",

  // --- Przeceniane i niedoceniane druzyny ----------------------------------
  // Strona druzyny podaje „zaufanie" i „wygrywa" obok siebie i nikt
  // ich od siebie nie odejmuje - a to odejmowanie jest cala trescia.
  //
  // Zmierzone: GamerLegion - stawiano 85%, wygrala 40%. NRG odwrotnie:
  // stawiano 14%, wygrala 44%.
  "bias.kicker": "Where we get it wrong",
  "bias.title": "Overrated and underrated",
  // Prog osmiu meczow nie jest okragla liczba z sufitu. Mediana
  // |roznicy| spada z 30 (5-7 meczow) na 12 (8-11) i 9 (12+) - to szum,
  // ktory znika, a nie wiedza, ktora sie pojawia.
  "bias.intro": "How readily the community backed a team, and how often it actually won. Counted from {count} teams with at least {min} settled matches — below that the gap is noise, not knowledge.",
  "bias.overrated": "Backed too often",
  "bias.underrated": "Backed too rarely",
  "bias.row": "backed {trust}%, won {win}%",
  "bias.sample": {
    one: "{count} match",
    other: "{count} matches",
  },
  "bias.empty": "So far no team stands out enough to call it a crowd error.",

  // --- Punktacja - regulaminy juz nieobowiazujace --------------------------
  // Strona pokazywala JEDNA tabele i przypis o zmianie zasad
  // punktowania MAP. Stawka za SERIE zmienila sie mocniej i nie bylo
  // o niej ani slowa - a strona twierdzila wprost, ze „dokladny wynik
  // serii nie daje nic ponad to".
  //
  // Zmierzone: w IEM Cologne Major 2026 trafiony zwyciezca z dokladnym
  // wynikiem dawal 4 pkt, sam zwyciezca 1 pkt. Kolonia trzyma 12 812
  // punktow za serie; wedlug dzisiejszych stawek byloby 7 988.
  "scoringHistory.title": "What applied before",
  "scoringHistory.lead": "An archived tournament keeps the points it was settled with — we do not recount it, because that would rewrite a ranking players already saw as final. So the table above describes only some of the tournaments.",
  "scoringHistory.applied": "Applied at: {events}",
  "scoringHistory.was": "then",
  "scoringHistory.now": "today",
  "scoringHistory.cologne.seriesWinnerOnly": "correct winner only, without the exact score",
  // Uczciwosc wobec czytajacego: tych stawek nie ma w zadnym commicie
  // ani wpisie. Sa wyprowadzone z bazy, wiec strona ma to powiedziec.
  "scoringHistory.reconstructed": "These rates are reconstructed from the points awarded, not copied from a rulebook of the time — no such record exists. They match to the point on 6378 of 6424 match picks and 6224 of 6274 map picks; the rest are rows later recounted under the new rule.",

  // --- Ranking - ile typow za wynikiem -------------------------------------
  // Tabela pokazywala, SKAD wziely sie punkty (Swiss 40, Playoffs 8,
  // Mecze 268), ale nie z ILU typow. Te liczby przychodzily w odpowiedzi
  // i byly wyrzucane.
  //
  // Zmierzone w IEM Cologne Major 2026: przy 109 okazjach mediana
  // pokrycia to DWA procent, a 81% z 523 sklasyfikowanych oddalo mniej
  // niz co dziesiaty typ. „Miejsce 200 z 523" czytalo sie wiec jak
  // „za mna 323 rywali".
  //
  // Konkret z tabeli: #38 karwix ma 187 pkt z 99 typow przy 54%,
  // a #39 Feran 181 pkt z 60 typow przy 67%. Szesc punktow roznicy,
  // dwie zupelnie rozne historie - i nic tego nie pokazywalo.
  "leaderboard.picks": "{done} of {all} picks",
  "leaderboard.picksHit": "{done} of {all} picks · {percent}% right",

  // --- Tlum jako miara odniesienia -----------------------------------------
  // Tlum jako miara odniesienia. Kazda liczba w serwisie jest
  // bezwzgledna - "69% trafien" nie mowi, czy to duzo. Zmierzone:
  // w Kolonii chodzenie za wiekszoscia dalo by SZOSTE miejsce na 410
  // typujacych, w Krakowie dopiero 28. z 252.
  "crowd.kicker": "The yardstick",
  "crowd.title": "The crowd versus the players",
  "crowd.intro": "Imagine someone who picked whatever the majority picked in every match, with no thoughts of their own. This is how well they would have done.",
  "crowd.stat.correct": "The crowd got right",
  "crowd.stat.place": "Place by correct picks",
  "crowd.stat.beatenBy": "People who beat it",
  "crowd.stat.ofPlayers": "of {count} who picked",
  "crowd.whoBeat": "Sharper eye than everyone put together:",
  // To zdanie musi stac na stronie, bo inaczej ktos slusznie zapyta,
  // skad mial wiedziec przed terminem, co wybierze wiekszosc.
  "crowd.disclaimer": "The majority is counted afterwards, from every pick that was made — nobody could have known it before the deadline. This is not a strategy but a measure of whether your own judgement added anything to the group's.",
  "crowd.player.title": "You versus the crowd",
  "crowd.player.intro": "Everything above says how much this player got right. This says whether their own judgement added anything to the group's. The majority is counted without their vote.",
  "crowd.player.gap": "Against the crowd",
  "crowd.player.gapHint": "correct picks more or fewer across {count} matches",
  "crowd.player.you": "This player got right",
  "crowd.player.crowd": "The crowd would have",
  "crowd.player.ofMatches": "of the same {count} matches",
};

export default en;
