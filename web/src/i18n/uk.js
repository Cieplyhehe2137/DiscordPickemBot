// Słownik ukraiński.
//
// Zestaw i kolejność kluczy jak w pl.js - to tamten plik jest źródłem prawdy,
// a test porównuje zestawy. Liczba mnoga po ukraińsku ma trzy formy:
// one / few / many, tak samo jak po polsku.

const uk = {
  // --- Nagłówek i nawigacja ------------------------------------------------
  "layout.logo": "PickEmBot",
  "layout.nav.home": "Головна",
  "layout.nav.events": "Турніри",
  "layout.nav.teams": "Команди",
  "layout.nav.scoring": "Бали",
  "layout.nav.stats": "Статистика",
  "layout.nav.admin": "Панель",
  "layout.user.loading": "Завантаження...",
  "layout.user.logout": "Вийти",
  "layout.user.login": "Увійти",

  // --- Przełącznik motywu --------------------------------------------------
  "theme.toggle.light": "Перемкнути на світлу тему",
  "theme.toggle.dark": "Перемкнути на темну тему",

  // --- Przełącznik języka --------------------------------------------------
  "language.label": "Мова",
  "language.change": "Змінити мову сайту",

  // --- Napisy wspolne ------------------------------------------------------
  "common.loading": "Завантаження...",
  "common.cancel": "Скасувати",
  "common.backToEvent": "Назад до турніру",
  "common.selected": "Обрано",
  // Skrot jednostki, nie cale zdanie. Po polsku "pkt" nie
  // odmienia sie wcale, wiec nie ma tu form liczby mnogiej -
  // ale po niemiecku kropka na koncu jest czescia skrotu.
  "common.points": "{count} оч.",
  "common.hits": "{hits}/{total} вгадано",
  "common.playersCount": {
    one: "{count} гравець",
    few: "{count} гравці",
    many: "{count} гравців",
  },
  "common.matchesCount": {
    one: "{count} матч",
    few: "{count} матчі",
    many: "{count} матчів",
  },
  "common.eventsCount": {
    one: "{count} турнір",
    few: "{count} турніри",
    many: "{count} турнірів",
  },
  "common.loadingEvents": "Завантаження турнірів",
  "common.eventsError": "Не вдалося завантажити турніри.",
  "common.loadingMatches": "Завантаження матчів",
  "common.all": "Усі",
  "common.save": "Зберегти",
  "common.retry": "Спробувати ще раз",
  "common.searchPlayer": "Шукати гравця за ніком...",
  "common.searchPlayerLabel": "Шукати гравця",
  "common.picksPercent": "{percent}% прогнозів",
  "common.pointsValue": "{value} оч.",
  "common.mapPick": "прогноз {a}:{b}",
  "common.mapResult": "результат {a}:{b}",
  "common.mapNo": "Карта {no}",

  // --- Ekran za logowaniem -------------------------------------------------
  "login.title": "Увійдіть, щоб побачити",
  "login.discord": "Увійти через Discord",

  // --- Strona 404 ----------------------------------------------------------
  "notFound.kicker": "Помилка 404",
  "notFound.title": "Такої сторінки немає",
  // Adres jest wstawiany jako <code>, wiec to zdanie renderuje
  // komponent T - patrz i18n/T.jsx.
  "notFound.text": "Адреса {path} не існує. Можливо, вона застаріла або містить одруківку.",
  "notFound.events": "Переглянути турніри",
  "notFound.home": "Головна сторінка",

  // --- Starty w innych turniejach ------------------------------------------
  "history.kicker": "Крім цього турніру",
  "history.title": "Також грав у",
  "history.count": {
    one: "{count} інший турнір",
    few: "{count} інші турніри",
    many: "{count} інших турнірів",
  },
  "history.hint": " — натисніть, щоб побачити той профіль.",
  "history.unranked": "без місця в таблиці",
  "history.place": "місце {rank} з {total}",
  "history.top": "ТОП {percent}%",

  // --- Odznaki -------------------------------------------------------------
  "badges.kicker": "Значки",
  "badges.title": "Досягнення на цьому турнірі",
  "badges.earned": {
    one: "{count} значок отримано",
    few: "{count} значки отримано",
    many: "{count} значків отримано",
  },
  "badges.emptyTitle": "Поки жодного значка",
  "badges.emptyText": "Вони з'являться після перших зарахованих матчів — нижче видно, що найближче.",
  // „Pojawia sie po pierwszych rozliczonych meczach" przeczylo temu,
  // co stalo linijke nizej: liscie odznak w zasiegu, zlozonej z takich,
  // ktore z meczami nie maja nic wspolnego.
  "badges.emptyTextNoMatches": "У цьому турнірі немає матчів, тож матчеві значки недоступні — нижче видно, що найближче.",
  "badges.near": "Близько",

  // --- Wybor gracza do porownania ------------------------------------------
  "picker.title": "З ким порівняти?",
  "picker.search": "Шукати гравця за ніком...",
  "picker.searchLabel": "Шукати гравця",
  "picker.loading": "Шукаю гравців...",
  "picker.loadError": "Не вдалося завантажити список гравців.",
  "picker.noMatch": "Ніхто не відповідає \"{query}\".",
  "picker.empty": "На цьому турнірі поки немає гравців у таблиці.",

  // --- Typy druzyn na profilu ----------------------------------------------
  "teamPicks.kicker": "Ставки на команди",
  "teamPicks.title": "Кого поставив на вихід далі",
  "teamPicks.unpublished": "Результат не оголошено",

  // --- Fazy turnieju -------------------------------------------------------
  "phase.notStarted": "Не розпочався",
  "phase.finished": "Завершений",
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
  "eventState.live": "Триває",
  "eventState.upcoming": "Незабаром",
  "eventState.finished": "Завершений",

  // --- Strona glowna -------------------------------------------------------
  "home.hero.predict": "Прогнозуй.",
  "home.hero.compete": "Змагайся.",
  "home.hero.win": "Перемагай.",
  "home.hero.text": "Прогнозуй матчі CS2, вгадуй рахунок на картах і набирай бали разом зі спільнотою PickEmBot.",
  "home.hero.events": "Переглянути турніри",
  "home.hero.rankings": "Переглянути рейтинги",
  "home.stats.players": "Учасників",
  "home.stats.playersHint": "усього заявок на всіх турнірах",
  "home.stats.events": "Турніри",
  "home.stats.eventsHint": "зіграні та поточні",
  "home.stats.matches": "Матчі",
  "home.stats.matchesHint": "для прогнозів",
  "home.stats.visits": "Відвідувань",
  "home.stats.visitsToday": "{count} сьогодні",
  "home.empty.title": "Перший турнір попереду",
  "home.empty.text": "Щойно відкриються прогнози, турніри з'являться тут.",
  "home.events.kicker": "Турніри",
  "home.heading.live": "Де зараз роблять прогнози",
  "home.heading.upcoming": "Найближчі турніри",
  "home.heading.recent": "Останні турніри",
  "home.allEvents": "Усі турніри →",
  "home.servers.kicker": "Де працює бот",
  "home.servers.title": "Сервери",
  "home.servers.open": "{count} триває",
  "home.servers.join": "Приєднатися в Discord",
  "home.servers.error": "Не вдалося завантажити сервери.",

  // --- Lista turniejow -----------------------------------------------------
  "events.kicker": "Турніри",
  "events.title": "Турніри",
  "events.intro": "Обери турнір, щоб перейти до прогнозів на матчі, стадій турніру та рейтингу. Завершені Pick'Em лишаються доступними для перегляду.",
  "events.error": "Не вдалося завантажити турніри",
  "events.empty.title": "Турнірів поки немає",
  "events.empty.text": "Коли стартує перший Pick'Em, він з'явиться в цьому списку.",
  "events.live.kicker": "Зараз",
  "events.live.title": "Поточні",
  "events.upcoming.kicker": "Анонс",
  "events.upcoming.title": "Незабаром",
  "events.upcoming.text": "Турнір уже створено, але прогнози ще не відкрилися - вони почнуться, коли в Discord з'явиться панель стадії.",
  "events.finished.kicker": "Архів",
  "events.finished.title": "Завершені",
  "events.finished.text": "Зараз не триває жоден Pick'Em. Нижче турніри, які можна переглянути.",

  // --- Stan meczu ----------------------------------------------------------
  "matchState.open": "Прогнози відкриті",
  "matchState.locked": "Прогнози закриті",
  "matchState.finished": "Завершені",

  // --- Lista meczow --------------------------------------------------------
  "matches.title": "Матчі",
  "matches.titlePhase": "Матчі — {phase}",
  "matches.countFiltered": {
    one: "{shown} з {count} матчу",
    few: "{shown} з {count} матчів",
    many: "{shown} з {count} матчів",
  },
  "matches.filter.phase": "Стадія",
  "matches.filter.team": "Команда",
  "matches.filter.state": "Статус",
  "matches.filter.clear": "Скинути фільтри",
  "matches.progress": "Прогрес прогнозів",
  "matches.partial": "Незавершені прогнози:",
  "matches.error": "Не вдалося завантажити матчі",
  "matches.empty.title": "Матчів немає",
  "matches.empty.filtered": "Жоден матч не підходить під обрані фільтри.",
  "matches.empty.none": "На цьому турнірі поки немає запланованих матчів.",
  "matches.status.complete": "Прогноз є",
  "matches.status.partial": "Прогноз неповний",
  "matches.status.missed": "Без прогнозу",
  "matches.status.empty": "Можна прогнозувати",
  "matches.no": "Матч #{no}",
  "matches.foot.final": "Матч завершено",
  "matches.foot.locked": "Прогнози заблоковані",
  "matches.foot.saved": "Прогноз збережено — його ще можна змінити",
  "matches.foot.finish": "Заверши свій прогноз",
  "matches.foot.open": "Прогнози відкриті",
  "matches.cta.result": "Дивитися результат",
  "matches.cta.match": "Дивитися матч",
  "matches.cta.edit": "Змінити прогноз",
  "matches.cta.finish": "Завершити прогноз",
  "matches.cta.predict": "Прогноз",

  // --- Ranking -------------------------------------------------------------
  "leaderboard.kicker": "Рейтинг",
  "leaderboard.title": "Рейтинг гравців",
  "leaderboard.loading": "Завантаження рейтингу",
  "leaderboard.error": "Не вдалося завантажити рейтинг",
  "leaderboard.ranked": {
    one: "{count} гравець у таблиці",
    few: "{count} гравці у таблиці",
    many: "{count} гравців у таблиці",
  },
  "leaderboard.findMe": "Знайти мене",
  "leaderboard.foundOf": {
    one: "Знайдено {found} з {count} гравця",
    few: "Знайдено {found} з {count} гравців",
    many: "Знайдено {found} з {count} гравців",
  },
  "leaderboard.noMatch": "Ніхто не відповідає {query}",
  "leaderboard.notStarted.title": "Рейтинг ще не почався",
  "leaderboard.notStarted.text": {
    one: "На цьому турнірі вже {count} гравець із прогнозами, але балів поки немає ні в кого — вони з'являться після перших зарахованих матчів і стадій.",
    few: "На цьому турнірі вже {count} гравці із прогнозами, але балів поки немає ні в кого — вони з'являться після перших зарахованих матчів і стадій.",
    many: "На цьому турнірі вже {count} гравців із прогнозами, але балів поки немає ні в кого — вони з'являться після перших зарахованих матчів і стадій.",
  },
  "leaderboard.nobody.title": "Ще ніхто не робив прогнозів",
  "leaderboard.nobody.text": "Рейтинг з'явиться, коли перші гравці зроблять прогнози.",
  "leaderboard.head.player": "Гравець",
  "leaderboard.head.breakdown": "Розбивка",
  "leaderboard.head.points": "Бали",
  "leaderboard.noPoints": "немає балів",
  // Rozbicie punktow na fazy: nazwy etapow ida z tego samego
  // zrodla co wszedzie (Swiss, Playoffs), a tlumaczenia wymagaja
  // tylko "Mecze" i "MVP" - to drugie jest skrotem i zostaje.
  "leaderboard.split.matches": "Матчі",
  "leaderboard.pages": "Сторінки рейтингу",
  "leaderboard.prev": "← Назад",
  "leaderboard.next": "Вперед →",
  "leaderboard.pageOf": "Сторінка {page} з {total}",

  // --- Lista druzyn --------------------------------------------------------
  "teams.kicker": "Команди",
  "teams.title": "Хто грав на цих турнірах",
  "teams.intro": {
    one: "{count} команда з усіх турнірів — з балансом і тим, як охоче на неї ставила спільнота.",
    few: "{count} команди з усіх турнірів — з балансом і тим, як охоче на них ставила спільнота.",
    many: "{count} команд з усіх турнірів — з балансом і тим, як охоче на них ставила спільнота.",
  },
  "teams.loading": "Завантажую команди...",
  "teams.error": "Не вдалося завантажити команди",
  "teams.errorText": "Не вдалося завантажити команди.",
  "teams.search": "Шукати команду...",
  "teams.searchLabel": "Шукати команду",
  "teams.empty.title": "Нічого не підходить",
  "teams.empty.text": "Жодна команда не відповідає {query}.",
  "teams.record": {
    one: "{wins}–{losses} у {count} матчі",
    few: "{wins}–{losses} у {count} матчах",
    many: "{wins}–{losses} у {count} матчах",
  },
  "teams.noResult": {
    one: "{count} матч без результату",
    few: "{count} матчі без результату",
    many: "{count} матчів без результату",
  },

  // --- Strona druzyny ------------------------------------------------------
  "team.backToTeams": "Назад до команд",
  "team.loading": "Завантажую команду...",
  "team.error": "Не вдалося завантажити команду",
  "team.errorText": "Не вдалося завантажити команду.",
  "team.kicker": "Команда",
  "team.played": {
    one: "{count} матч у {events}",
    few: "{count} матчі у {events}",
    many: "{count} матчів у {events}",
  },
  "team.inEvents": {
    one: "{count} турнірі",
    few: "{count} турнірах",
    many: "{count} турнірах",
  },
  "team.record": "Баланс",
  "team.noPlayed": "немає зіграних матчів",
  "team.winRate": "{percent}% перемог",
  "team.trust": "Довіра",
  "team.trustHint": "прогнозів ставили на неї",
  "team.trustHit": "Довіра виправдалася",
  "team.trustHitHint": "цих прогнозів справдилися",
  "team.picksTotal": "Прогнозів усього",
  "team.picksOf": "з {total} у її матчах",
  "team.matches": "Матчі",
  "team.history": "Історія",
  "team.historyHint": "Відсоток біля матчу — частка прогнозів, що ставили на цю команду.",
  "team.noMatches": "У цієї команди поки немає запланованих матчів.",
  "team.noScore": "Без результату",

  // --- Punktacja -----------------------------------------------------------
  "scoring.page.kicker": "Правила",
  "scoring.page.title": "Нарахування балів",
  "scoring.page.intro": "Усі значення взяті прямо з правил, за якими рахується рейтинг, — це не окремо написаний опис.",
  "scoring.page.loading": "Завантажую правила нарахування...",
  "scoring.page.error": "Не вдалося завантажити правила нарахування",
  "scoring.page.errorText": "Не вдалося завантажити правила нарахування.",
  "scoring.page.noRates": "Сервер не повернув значення балів. Спробуйте оновити сторінку.",
  "scoring.match.title": "Матчі",
  "scoring.match.lead": "Кожен матч турніру. Бали за серію і бали за карти додаються — це дві різні речі, а не альтернатива.",
  "scoring.matchWinner.label": "Вгаданий переможець серії",
  "scoring.matchWinner.hint": "Точний рахунок серії нічого не додає. Прогноз 2:0 і прогноз 2:1 коштують однаково, якщо називають ту саму команду.",
  "scoring.maps.title": "Карти",
  "scoring.maps.lead": "Рахується окремо для КОЖНОЇ карти серії. Умова: треба вгадати переможця карти — без цього близький рахунок нічого не дає. Далі рахується сумарне відхилення від рахунку, тобто різниця раундів з одного боку плюс різниця з іншого.",
  "scoring.mapExact.label": "Точний рахунок карти",
  "scoring.mapExact.hint": "Відхилення 0 раундів.",
  "scoring.mapDiff1.label": "Відхилення на 1 раунд",
  "scoring.mapDiff1.hint": "Наприклад, прогноз 13:10 за рахунку 13:11.",
  "scoring.mapDiff2.label": "Відхилення на 2 раунди",
  "scoring.mapMiss.label": "Більше відхилення або неправильний переможець карти",
  "scoring.perTeam.lead": "Бали нараховуються за кожну вгадану команду окремо.",
  "scoring.swiss30.label": "Команда з балансом 3-0",
  "scoring.swiss03.label": "Команда з балансом 0-3",
  "scoring.advancing.label": "Команда, яка проходить далі",
  "scoring.semifinalist.label": "Півфіналіст",
  "scoring.finalist.label": "Фіналіст",
  "scoring.winner.label": "Переможець турніру",
  "scoring.thirdPlace.label": "Переможець матчу за 3-тє місце",
  "scoring.thirdPlace.hint": "Лише на турнірі, де організатор вніс офіційний результат цього матчу.",
  "scoring.doubleElim.lead": "Чотири прогнози на стадію: Upper Final A, Lower Final A, Upper Final B і Lower Final B.",
  "scoring.anyCorrect.label": "Кожен вгаданий прогноз",
  "scoring.mvp.title": "MVP",
  "scoring.mvp.lead": "Один прогноз на весь турнір.",
  "scoring.mvpCorrect.label": "Вгаданий MVP турніру",

  // --- Format fazy ---------------------------------------------------------
  "phaseFormat.title": "Формат цієї стадії",
  "phaseFormat.record30": {
    one: "{count} команда з балансом 3-0",
    few: "{count} команди з балансом 3-0",
    many: "{count} команд з балансом 3-0",
  },
  "phaseFormat.record03": {
    one: "{count} команда з балансом 0-3",
    few: "{count} команди з балансом 0-3",
    many: "{count} команд з балансом 0-3",
  },
  "phaseFormat.advancing": {
    one: "{count} команда проходить далі",
    few: "{count} команди проходять далі",
    many: "{count} команд проходять далі",
  },
  "phaseFormat.teams": {
    one: "{count} команда, що проходить",
    few: "{count} команди, що проходять",
    many: "{count} команд, що проходять",
  },
  "phaseFormat.semifinalists": {
    one: "{count} півфіналіст",
    few: "{count} півфіналісти",
    many: "{count} півфіналістів",
  },
  "phaseFormat.finalists": {
    one: "{count} фіналіст",
    few: "{count} фіналісти",
    many: "{count} фіналістів",
  },
  "phaseFormat.winner": {
    one: "{count} переможець",
    few: "{count} переможці",
    many: "{count} переможців",
  },
  "phaseFormat.third": "{count} на 3-му місці",

  // --- Moje typy -----------------------------------------------------------
  "myPicks.kicker": "Твої дані",
  "myPicks.title": "Мої прогнози",
  "myPicks.titleEvent": "Мої прогнози — {event}",
  "myPicks.intro": "Переглянь збережені прогнози на матчі, точні рахунки карт і набрані бали.",
  "myPicks.loading": "Завантаження прогнозів",
  "myPicks.loginText": "Це твої збережені прогнози, тож спершу треба знати, хто запитує.",
  "myPicks.error": "Не вдалося завантажити прогнози",
  "myPicks.errorText": "Не вдалося завантажити прогнози.",
  "myPicks.empty.title": "У цій стадії немає матчів",
  "myPicks.empty.text": "У обраної стадії поки немає зустрічей. Зазирни в іншу стадію або повернися, коли розклад заповниться.",
  "myPicks.finished": "Завершений",
  "myPicks.pending": "Очікує",
  "myPicks.noPick": "Прогноз не збережено.",
  "myPicks.yourPick": "Твій прогноз",
  "myPicks.exactScore": "Точний рахунок",
  "myPicks.noMapPicks": "Прогнози на карти не збережено.",
  "myPicks.mapPick": "прогноз {a}:{b}",
  "myPicks.mapResult": "результат {a}:{b}",
  "myPicks.mapNoResult": "результат: —",
  "myPicks.total": "Усього",
  "myPicks.totalHint": "балів за матч",
  "myPicks.series": "Серія",
  "myPicks.maps": "Карти",
  "myPicks.later": "Бали нарахуються після завершення матчу.",
  "myPicks.cta.predict": "Прогноз на матч",
  "myPicks.pageOf": "Сторінка {page}/{total}",

  // --- Nazwy odznak --------------------------------------------------------
  "badge.unitPoints": " оч.",
  "badge.accuracy1": "Влучний",
  "badge.accuracy2": "Дуже влучний",
  "badge.accuracy3": "Снайпер",
  "badge.accuracy.desc": "{count}% вгаданих переможців",
  "badge.streak1": "Розігрівся",
  "badge.streak2": "Гаряча рука",
  "badge.streak3": "Не спинити",
  "badge.streak.desc": {
    one: "{count} влучання поспіль",
    few: "{count} влучання поспіль",
    many: "{count} влучань поспіль",
  },
  "badge.exactSeries1": "Точний",
  "badge.exactSeries2": "Педантичний",
  "badge.exactSeries3": "Годинникар",
  "badge.exactSeries.desc": {
    one: "{count} точний рахунок серії",
    few: "{count} точні рахунки серії",
    many: "{count} точних рахунків серії",
  },
  "badge.exactMaps1": "Знавець карт",
  "badge.exactMaps2": "Картограф",
  "badge.exactMaps3": "Ясновидець",
  "badge.exactMaps.desc": {
    one: "{count} точний рахунок карти",
    few: "{count} точні рахунки карт",
    many: "{count} точних рахунків карт",
  },
  "badge.points1": "Півсотня",
  "badge.points2": "Сотня",
  "badge.points3": "Сто п'ятдесят",
  "badge.points.desc": {
    one: "{count} бал на турнірі",
    few: "{count} бали на турнірі",
    many: "{count} балів на турнірі",
  },
  "badge.perfect": "Повне влучання",
  "badge.perfect.desc": "Матч вгадано аж до карт",
  "badge.bigMatch": "Великий матч",
  "badge.bigMatch.desc": {
    one: "{count} бал за один матч",
    few: "{count} бали за один матч",
    many: "{count} балів за один матч",
  },
  // Nazwy odznak sa TLUMACZONE, bo to nie sa terminy esportowe,
  // tylko zarty jezykowe: "Zegarmistrz" o kims, kto trafia
  // dokladne wyniki. Doslowne tlumaczenie takiego zartu nie zawsze
  // dziala, wiec niektore brzmia inaczej niz polski oryginal - i tak
  // ma byc.
  "badge.podium": "Подіум",
  "badge.podium.desc": "Місце в першій трійці",
  "badge.regular": "Завсідник",
  "badge.regular.desc": {
    one: "{count} зарахований прогноз",
    few: "{count} зараховані прогнози",
    many: "{count} зарахованих прогнозів",
  },

  // --- Okna i powiadomienia ------------------------------------------------
  "dialog.sure": "Ви впевнені?",
  "dialog.confirm": "Підтвердити",
  "toast.close": "Закрити сповіщення",

  // --- Wykres punktow ------------------------------------------------------
  // Opis wykresu dla czytnika ekranu - to jedyna droga do tych
  // liczb dla kogos, kto nie widzi rysunku.
  "chart.title": "Бали наростаючим підсумком. {series}.",
  "chart.series": {
    one: "{name}: {points} балів після {count} матчу",
    few: "{name}: {points} балів після {count} матчів",
    many: "{name}: {points} балів після {count} матчів",
  },
  "chart.empty": "Графік з'явиться після першого зарахованого матчу.",

  // --- Wyniki fazy ---------------------------------------------------------
  "phaseResults.kicker": "Підсумок",
  "phaseResults.title": "Результати стадії",
  "phaseResults.noPick": "У тебе немає збереженого прогнозу на цю стадію — нижче лише офіційний результат.",
  "phaseResults.official": "Офіційно",
  "phaseResults.hitsWithPoints": "{hits}/{total} вгадано · {points} оч.",
  "phaseResults.teams30": "Команди 3-0",
  "phaseResults.teams03": "Команди 0-3",
  "phaseResults.advancing": "Ті, що проходять далі",
  "phaseResults.semifinalists": "Півфіналісти",
  "phaseResults.finalists": "Фіналісти",
  "phaseResults.winner": "Переможець",
  "phaseResults.thirdPlace": "3-тє місце",
  "phaseResults.mvpCandidate": "Кандидат у MVP",
  "phaseResults.advancingTeams": "Команди, що проходять далі",

  // --- Profil gracza -------------------------------------------------------
  "profile.loading": "Завантаження профілю",
  "profile.backToLeaderboard": "Назад до рейтингу",
  "profile.error": "Не вдалося завантажити профіль",
  "profile.errorText": "Не вдалося завантажити профіль гравця.",
  "profile.missing.title": "Такого гравця немає",
  "profile.missing.text": "Ніхто з таким ідентифікатором не робив прогнозів на цьому турнірі.",
  "profile.compare": "Порівняти з гравцем",
  "profile.kicker": "Профіль гравця",
  "profile.career": "Доробок понад турнірами",
  "profile.points": "Бали",
  "profile.pointsPerMatch": "{value} оч. / матч",
  "profile.rank": "Рейтинг",
  "profile.accuracy": "Точність",
  "profile.accuracyHint": {
    one: "{correct} / {count} матчу",
    few: "{correct} / {count} матчів",
    many: "{correct} / {count} матчів",
  },
  "profile.exactMaps": "Точні карти",
  "profile.exactMapsHint": "{percent}% спрогнозованих карт",
  "profile.correctMaps": "Вгадані карти",
  "profile.correctMapsHint": "{percent}% точності",
  "profile.bestMatch": "Найкращий матч",
  "profile.bestMatchHint": "балів за один матч",
  "profile.seriesPoints": "Бали за серії",
  "profile.mapPoints": "Бали за карти",
  "profile.progress.kicker": "Хід турніру",
  "profile.progress.title": "Бали в часі",
  "profile.progress.caption": "Наведи на точку, щоб побачити матч і здобуток.",
  "profile.form.kicker": "Серії",
  "profile.form.title": "Форма гравця",
  "profile.bestStreak": "Найкраща серія влучань",
  "profile.currentStreak": "Поточна серія влучань",
  "profile.streakHint": "матчів поспіль",
  "profile.perfect": "Ідеальні матчі",
  "profile.perfectHint": "вгаданих повністю",
  "profile.records.kicker": "Рекорди",
  "profile.records.title": "Рекорди гравця",
  "profile.bestMapScore": "Найкращий результат за картами",
  "profile.bestMapScoreHint": "Найбільше балів за карти в одному матчі",
  "profile.avgCorrect": "Середнє за вгаданий матч",
  "profile.avgCorrectHint": "Середня кількість балів у матчах із вгаданим переможцем",
  "profile.comparison.kicker": "Порівняння",
  "profile.comparison.title": "На тлі турніру",
  "profile.comparison.hint": "з {total} · ТОП {percent}%",
  "profile.history.kicker": "Історія",
  "profile.history.title": "Останні прогнози",
  "profile.pick": "Прогноз: {a}:{b}",
  "profile.result": " · Результат: {a}:{b}",
  "profile.split": "Серія +{series} · Карти +{maps}",
  "profile.map.exact": "Точно",
  "profile.map.winner": "Переможець",
  "profile.map.miss": "Мимо",
  "profile.empty.title": "Прогнозів немає",
  "profile.empty.text": "Цей гравець ще не зберіг жодного прогнозу на цьому турнірі.",

  // --- Moje statystyki -----------------------------------------------------
  "myStats.tab.general": "Загальне",
  "myStats.tab.accuracy": "Точність",
  "myStats.tab.form": "Форма",
  "myStats.tab.comparison": "Порівняння",
  "myStats.tab.analysis": "Аналіз",
  "myStats.tab.style": "Стиль",
  "myStats.tab.trends": "Тренди",
  "myStats.loading": "Завантаження статистики",
  "myStats.loginText": "Статистика рахується з твоїх прогнозів, тож треба знати, хто запитує.",
  "myStats.error": "Не вдалося завантажити статистику",
  "myStats.errorText": "Не вдалося завантажити статистику.",
  "myStats.kicker": "Твої дані",
  "myStats.title": "Моя статистика",
  "myStats.titleEvent": "Моя статистика — {event}",
  "myStats.intro": "Детальний підсумок твоїх прогнозів на цьому турнірі.",
  "myStats.empty.title": "Нічого показати",
  "myStats.empty.text": "У тебе поки немає прогнозів на матчі цього турніру. Статистика з'явиться після першого збереженого прогнозу.",
  "myStats.rank": "Рейтинг",
  "myStats.noPointsYet": "зарахованих балів поки немає",
  "myStats.points": "Бали",
  "myStats.pointsPerMatch": "Бали / матч",
  "myStats.profile": "Профіль",
  "myStats.steadyForm": "Стабільна форма",
  "myStats.picks": "Прогнози",
  "myStats.settled": "Зараховано: {count}",
  "myStats.winners": "Переможці",
  "myStats.seriesExact": "Точний рахунок серій",
  "myStats.maps": "Карти",
  "myStats.mapWinner": "Переможець: {hits}/{total}",
  "myStats.mapExact": "Точно: {hits}/{total}",
  "myStats.pointsSplit": "Серії: {value} оч.",
  "myStats.pointsSplitMaps": "Карти: {value} оч.",
  "myStats.matchWinner": "Переможець матчу",
  "myStats.mapWinnerLabel": "Переможець карти",
  "myStats.mapExactLabel": "Точний рахунок карти",
  "myStats.recent": "Останні матчі",
  "myStats.noData": "Немає даних",
  "myStats.last5": "Останні 5",
  "myStats.last10": "Останні 10",
  "myStats.currentStreak": "Поточна серія",
  "myStats.bestStreak": "Рекордна серія",
  "myStats.bestMatch": "Найкращий матч",
  "myStats.average": "Середнє: {value}",
  "myStats.eventAverage": "Турнір: {value}%",
  "myStats.bestTeam": "Найкраще вгадана",
  "myStats.nemesis": "Немезида",
  "myStats.mostPicked": "Найчастіше обирали",
  "myStats.mostOneSided": "Найбільш односторонній",
  "myStats.mostDivided": "Найбільш спірний",
  "myStats.popularScore": "Популярний рахунок",
  "myStats.mapAccuracy": "Точність за картами",
  "myStats.averageError": "Середня похибка: {value}",
  "myStats.yourProfile": "Твій профіль",
  "myStats.contrarian": "Проти більшості",
  "myStats.withMajority": "З більшістю",
  "myStats.hits": "Вгадано: {count}",
  "myStats.rarestHit": "Найрідкісніший вгаданий прогноз",
  "myStats.trends": "Тренди",
  "myStats.notEnough": "Замало даних",
  "myStats.settledOf": "Зарахованих матчів: {count} / 4",
  "myStats.direction": "Напрямок",

  // --- Pojedynek dwoch graczy ----------------------------------------------
  "h2h.loading": "Рахую дуель...",
  "h2h.error": "Не вдалося завантажити порівняння",
  "h2h.errorText": "Не вдалося завантажити порівняння.",
  "h2h.kicker": "Дуель",
  "h2h.title": "{a} проти {b}",
  "h2h.common": {
    one: "{count} спільний матч на цьому турнірі",
    few: "{count} спільні матчі на цьому турнірі",
    many: "{count} спільних матчів на цьому турнірі",
  },
  "h2h.backToProfile": "Назад до профілю",
  "h2h.nothingSettled": "Жоден спільний матч ще не зараховано.",
  "h2h.lead": {
    one: "{name} веде на {count} матч за {ties} із {settled}.",
    few: "{name} веде на {count} матчі за {ties} із {settled}.",
    many: "{name} веде на {count} матчів за {ties} із {settled}.",
  },
  "h2h.ties": {
    one: "{count} нічиї",
    few: "{count} нічиїх",
    many: "{count} нічиїх",
  },
  "h2h.settled": {
    one: "{count} спільного матчу",
    few: "{count} спільних матчів",
    many: "{count} спільних матчів",
  },
  "h2h.draw": {
    one: "Нічия після {count} спільного матчу.",
    few: "Нічия після {count} спільних матчів.",
    many: "Нічия після {count} спільних матчів.",
  },
  "h2h.sharedPoints": "Бали за спільні матчі",
  "h2h.sharedPointsHint": "лише із зарахованих матчів",
  "h2h.tiesLabel": "Нічиї",
  "h2h.tiesHint": "однакові бали за матч",
  "h2h.samePick": "Той самий прогноз на серію",
  "h2h.samePickHint": "бали все одно можуть відрізнятися — вирішують карти",
  "h2h.pending": "Ще не зіграні",
  "h2h.pendingHint": "обрані обома",
  "h2h.progress.kicker": "Хід дуелі",
  "h2h.progress.title": "Хто і коли відірвався",
  "h2h.progress.text": "Бали наростаючим підсумком, лише зі спільних матчів — від першого до останнього.",
  "h2h.stats.kicker": "Статистика",
  "h2h.stats.title": "Весь турнір",
  "h2h.stats.text": "Тут рахується все, що кожен із них прогнозував — включно з матчами, які інший не обирав.",
  "h2h.row.points": "Бали в таблиці",
  "h2h.row.rank": "Місце в рейтингу",
  "h2h.row.accuracy": "Точність",
  "h2h.row.winners": "Вгадані переможці",
  "h2h.row.exactSeries": "Точні рахунки серій",
  "h2h.row.exactMaps": "Точні карти",
  "h2h.row.correctMaps": "Вгадані карти",
  "h2h.row.streak": "Найдовша серія",
  "h2h.row.perfect": "Повні влучання",
  "h2h.row.bestMatch": "Найкращий матч",
  "h2h.empty.title": "Спільних матчів немає",
  "h2h.empty.text": "Ці двоє не обрали жодного спільного матчу на цьому турнірі, тож порівнювати нічого.",
  "h2h.matches.kicker": "Матч за матчем",
  "h2h.matches.title": "Спільні прогнози",
  "h2h.samePickShort": "той самий прогноз на серію",

  // --- Strony typowania faz ------------------------------------------------
  "pickem.loading": "Завантаження стадії",
  "pickem.saved": "Прогнози збережено ✅",
  "pickem.saveError": "Не вдалося зберегти прогнози.",
  "pickem.saving": "Зберігаю...",
  "pickem.save": "Зберегти прогнози",
  "pickem.loginRequired": "Потрібен вхід",
  "pickem.loginCta": "Увійди через Discord, щоб робити прогнози",
  "pickem.loadError": "Не вдалося завантажити стадію",
  "pickem.lockedNow": "Прогнози наразі заблоковані.",
  "pickem.swiss.kicker": "Швейцарська стадія · {stage}",
  "pickem.swiss.stages": "Етапи швейцарської стадії",
  "pickem.swiss.loadError": "Не вдалося завантажити Swiss Pick'Em.",
  "pickem.swiss.group30": "Баланс 3-0",
  "pickem.swiss.group03": "Баланс 0-3",
  "pickem.swiss.groupAdvancing": "Вихід далі",
  "pickem.swiss.desc30": {
    one: "Обери рівно {count} команду з балансом 3-0.",
    few: "Обери рівно {count} команди з балансом 3-0.",
    many: "Обери рівно {count} команд з балансом 3-0.",
  },
  "pickem.swiss.desc03": {
    one: "Обери рівно {count} команду з балансом 0-3.",
    few: "Обери рівно {count} команди з балансом 0-3.",
    many: "Обери рівно {count} команд з балансом 0-3.",
  },
  "pickem.swiss.descAdvancing": {
    one: "Обери рівно {count} команду, яка пройде далі.",
    few: "Обери рівно {count} команди, які пройдуть далі.",
    many: "Обери рівно {count} команд, які пройдуть далі.",
  },
  "pickem.teamsCount": {
    one: "{count} команда",
    few: "{count} команди",
    many: "{count} команд",
  },
  "pickem.playin.kicker": "Стадія турніру",
  "pickem.playin.loadError": "Не вдалося завантажити Play-In Pick'Em.",
  "pickem.playin.pick": {
    one: "Обери {count} команду, яка пройде з цієї стадії",
    few: "Обери {count} команди, які пройдуть з цієї стадії",
    many: "Обери {count} команд, які пройдуть з цієї стадії",
  },
  "pickem.playoffs.kicker": "Плей-оф",
  "pickem.playoffs.loadError": "Не вдалося завантажити Playoffs Pick'Em.",
  "pickem.step": "Крок {no}",
  "pickem.playoffs.needSemis": "Спершу обери півфіналістів.",
  "pickem.playoffs.needFinalists": "Спершу обери фіналістів.",
  "pickem.playoffs.intro": "Прогнозуй сітку по черзі: півфіналістів, фіналістів, чемпіона і третє місце. Кожен крок звужує вибір у наступному.",
  "pickem.doubleElim.kicker": "Сітка подвійного вибування",
  "pickem.doubleElim.intro": "Вкажи учасників чотирьох фіналів. Уже використана команда не повертається в наступних групах.",
  "pickem.doubleElim.loadError": "Не вдалося завантажити Double Elimination Pick'Em.",

  // --- Strona turnieju -----------------------------------------------------
  "event.backToList": "Назад до списку турнірів",
  "event.kicker": "Турнір",
  "event.error": "Помилка",
  "event.statsError": "Не вдалося завантажити статистику турніру.",
  "event.statsLoading": "Завантаження статистики турніру...",
  "event.phaseLabel": "Стадія:",
  "event.statusLabel": "Статус:",
  "event.participantsLabel": "Учасники:",
  "event.none": "немає",
  "event.status.open": "Відкрито",
  "event.status.closed": "Закрито",
  "event.status.finished": "Завершено",
  "event.intro": "Центр турніру — матчі, прогнози, рейтинг і поточний хід турніру.",
  "event.archive": "Завантажити архів (.xlsx)",
  "event.matchesCount": {
    one: "{count} матч",
    few: "{count} матчі",
    many: "{count} матчів",
  },
  "event.finishedCount": {
    one: "{count} завершено",
    few: "{count} завершено",
    many: "{count} завершено",
  },
  "event.scheduledCount": {
    one: "{count} заплановано",
    few: "{count} заплановано",
    many: "{count} заплановано",
  },
  "event.picksCount": {
    one: "{count} прогноз",
    few: "{count} прогнози",
    many: "{count} прогнозів",
  },
  "event.stat.matches": "Матчі",
  "event.stat.participants": "Учасники",
  "event.stat.predictions": "Зроблено прогнозів",
  "event.stat.mapPredictions": "Прогнози на карти",
  "event.stat.averagePoints": "Середня кількість балів",
  "event.stat.exactMaps": "Точні карти",
  "event.stat.bestScore": "Найкращий результат",
  "event.stat.mostExacts": "Найбільше точних",
  "event.stat.bestAccuracy": "Найкраща точність",
  "event.stat.correctOf": "{correct}/{total} вгадано",
  "event.stat.favoriteTeam": "Улюбленець гравців",
  "event.summary.kicker": "Твій результат",
  "event.summary.title": "Твій підсумок турніру",
  "event.summary.place": "Місце",
  "event.summary.split": "Серія {series} · Карти {maps}",
  "event.summary.correctMatches": "Вгадані матчі",
  "event.summary.fullProfile": "Дивитися повний профіль →",
  "event.top.title": "Лідери турніру",
  "event.top.place": "Місце {no}",
  "event.close.kicker": "Найрівніший",
  "event.close.title": "Матч, щодо якого спільнота розділилася найсильніше",
  "event.upset.kicker": "Головна сенсація",
  "event.upset.title": "Спільнота прорахувалася",
  "event.upset.winner": "ПЕРЕМОЖЕЦЬ",
  "event.upset.won": "виграв {score}",
  "event.upset.nobody": "Ніхто не передбачив переможця",
  "event.upset.only": "Лише {percent} передбачили переможця",
  "event.tile.matches": "Матчі",
  "event.tile.matchesHint": "Прогнози BO1 / BO3 / BO5 · {matches} · {finished}",
  "event.tile.teamPicks": "Прогнози на команди",
  "event.tile.myPicks": "Мої прогнози",
  "event.tile.myPicksHint": "Переглянь свої збережені прогнози · {picks}",
  "event.tile.myStats": "Моя статистика",
  "event.tile.myStatsHint": "Точність · форма · аналіз · стиль · тренди",
  "event.tile.leaderboard": "Рейтинг",
  "event.tile.leaderboardHint": "Переглянь таблицю гравців · {players}",
  "event.phaseLink.settled": "Стадія зарахована",
  "event.phaseLink.closed": "Стадія закрита",
  "event.teamPick.saved": "прогноз збережено, можна змінити",
  "event.teamPick.open": "відкрито — зроби прогноз",
  "event.teamPick.settled": "зараховано",
  "event.teamPick.closed": "закрито",
  "event.nextMatch": "Наступний матч",
  "event.noNextMatch": "Матчів не заплановано",
  "event.goToMatch": "Перейти до матчу",
  "event.phases.kicker": "Турнір",
  "event.phases.title": "Стадії турніру",
  "event.phases.current": "Поточна стадія",
  "event.phases.none": "Активної стадії немає",

  // --- Strona meczu --------------------------------------------------------
  "match.backToList": "Назад до списку матчів",
  "match.loading": "Завантаження матчу",
  "match.error": "Не вдалося завантажити матч",
  "match.notFound": "Матч не знайдено.",
  "match.picksCount": {
    one: "{count} прогноз",
    few: "{count} прогнози",
    many: "{count} прогнозів",
  },
  "match.yourPick": "Твій прогноз",
  "match.seriesTitle": "Рахунок серії BO{bo}",
  "match.seriesHint": "Спершу обери рахунок серії, потім впиши результати окремих карт.",
  "match.locked": "Прогнози на цей матч заблоковані.",
  "match.loginToSave": "Увійди через Discord, щоб зберегти свій прогноз.",
  "match.savePick": "Зберегти прогноз",
  "match.checkingLogin": "Перевіряю вхід...",
  "match.saved": "Прогноз збережено.",
  "match.bo1Title": "Хто переможе?",
  "match.bo1Hint": "Вкажи переможця і рахунок по раундах.",
  "match.needLogin": "Спершу увійди через Discord.",
  "match.needWinner": "Обери переможця матчу.",
  "match.badScore": "Вкажи коректний рахунок CS2.",
  "match.winnerMismatch": "Обраний переможець не збігається з рахунком.",
  "match.needSeries": "Обери рахунок серії.",
  "match.badMapScore": "Вкажи коректний рахунок CS2 для кожної карти.",
  "match.seriesTooEarly": "Серія закінчується раніше, ніж випливає із вказаних карт.",
  "match.seriesMismatch": "Рахунки карт не збігаються з обраним рахунком серії.",
  "match.finished": "Матч завершено",
  "match.result.kicker": "Результат",
  "match.result.title": "Результат матчу",
  "match.howYouDid": "Подивись, як ти впорався",
  "match.loginToSee": "Увійди через Discord, щоб побачити свій збережений прогноз.",
  "match.yourScore": "Твій результат",
  "match.pointsEarned": "Набрані бали",
  "match.totalHint": "балів за цей матч",
  "match.seriesHintPoints": "за результат матчу",
  "match.mapsHintPoints": "за результати карт",
  "match.community.kicker": "Спільнота",
  "match.community.title": "Як прогнозувала спільнота?",
  "match.community.emptyTitle": "Ніхто не прогнозував цей матч",
  "match.community.emptyText": "Прогнози закрилися без жодного збереженого прогнозу.",
  "match.community.total": "Прогнозів усього:",
  "match.community.popular": "Найпопулярніший рахунок:",
  "match.community.mapsTitle": "Як прогнозували карти?",
  "match.whatYouPicked": "Що ти обрав",
  "match.noPick": "Ти не прогнозував цей матч.",

  // --- Komunikaty serwera --------------------------------------------------
  // Serwer odpowiada polskim zdaniem i dokladkiem `code`. Kod
  // prowadzi tutaj, polskie zdanie zostaje zapasem dla klienta,
  // ktory kodu nie zna - patrz lib/apiMessages.js.
  "api.httpError": "Помилка API: {status}",
  "server.dbError": "Помилка бази даних.",
  "server.mustLogin": "Потрібно увійти в акаунт.",
  "server.notMember": "Ти не перебуваєш на цьому сервері.",
  "server.teamNotFound": "Команду не знайдено.",
  "server.eventNotFound": "Турнір не знайдено.",
  "server.matchNotFound": "Матч не знайдено.",
  "server.backupNotFound": "Файл резервної копії не знайдено.",
  "server.badSwissStage": "Невірний етап Swiss.",
  "server.badStage": "Невірний етап.",
  "server.badStatus": "Невірний статус.",
  "server.badLockMode": "Невірний режим блокування.",
  "server.badSeriesPick": "Невірний прогноз на серію.",
  "server.badCs2Score": "Некоректний рахунок CS2.",
  "server.badWinner": "Невірний переможець.",
  "server.badBo": "BO має бути 1, 3 або 5.",
  "server.badDefaultBo": "BO за замовчуванням має бути 1, 3 або 5.",
  "server.bo1OneMap": "BO1 має містити рівно одну карту.",
  "server.thirdFromSemis": "3-тє місце має бути одним із півфіналістів.",
  "server.thirdNotFinalist": "3-тє місце не може бути фіналістом чи переможцем.",
  "server.finalistsFromSemis": "Фіналісти мають бути з числа півфіналістів.",
  "server.winnerIsFinalist": "Переможець має бути фіналістом.",
  "server.winnerFromFinalists": "Переможець має бути одним із фіналістів.",
  "server.phaseDeadlinePassed": "Дедлайн прогнозів для цієї стадії минув.",
  "server.matchDeadlinePassed": "Дедлайн прогнозів на результати матчів цієї стадії минув.",
  "server.needTwoPlayers": "Для порівняння потрібні два різні гравці.",
  "server.teamExists": "Команда з такою назвою вже є на цьому сервері.",
  "server.teamsMustDiffer": "Команди мають бути різними.",
  "server.teamNameRequired": "Назва команди обов'язкова.",
  "server.bothTeamsActive": "Обидві команди мають існувати й бути активними на цьому сервері.",
  "server.matchAlreadyFinished": "Матч уже завершено.",
  "server.eventAlreadyFinished": "Цей турнір уже завершено.",
  "server.matchPickingClosed": "Прогнози на цей матч уже закриті.",
  "server.mapNumbersSequential": "Номери карт мають іти поспіль: 1, 2, 3...",
  "server.mapNumbersUnique": "Номери карт не можуть повторюватися.",
  "server.seriesEndsEarly": "Серія закінчується надто рано для вказаних карт.",
  "server.winnerMismatch": "Обраний переможець не збігається з рахунком.",
  "server.mapsMismatch": "Рахунки карт не збігаються з рахунком серії.",
  "server.scoresNonNegative": "Рахунки мають бути невід'ємними цілими числами.",
  "server.eventChanged": "Стан турніру змінився. Онови сторінку і спробуй ще раз.",
  "server.phaseAndMatchesRequired": "Потрібні: стадія і список матчів.",
  "server.nothingToCreate": "Нема чого створювати — жоден рядок не пройшов перевірку.",
  "server.noValidIds": "Жоден із указаних ідентифікаторів не є коректним.",
  "server.idsArray": "ids має бути непорожнім масивом ідентифікаторів.",
  "server.orderedIdsArray": "orderedIds має бути непорожнім масивом.",
  "server.phasesArray": "fazy має бути непорожнім масивом.",
  "server.entriesArray": "entries має бути непорожнім масивом { nickname, teamName }.",
  "server.permissionCheckFailed": "Не вдалося перевірити права.",
  "server.visitsFailed": "Не вдалося завантажити лічильник відвідувань.",
  "server.matchLoadFailed": "Не вдалося завантажити матч.",
  "server.archiveFailed": "Не вдалося підготувати архів.",
  "server.archiveLoadFailed": "Не вдалося завантажити архів.",
  "server.matchDeleteFailed": "Не вдалося видалити матч.",
  "server.matchesCreateFailed": "Не вдалося створити матчі.",
  "server.matchSaveFailed": "Не вдалося зберегти зміни в матчі.",
  "server.myPicksFailed": "Не вдалося завантажити твої прогнози.",
  "server.teamsLoadFailed": "Не вдалося завантажити команди.",
  "server.teamLoadFailed": "Не вдалося завантажити команду.",
  "server.h2hFailed": "Не вдалося завантажити порівняння.",
  "server.pointsLoadFailed": "Не вдалося завантажити бали.",
  "server.swissStatsFailed": "Не вдалося завантажити статистику Swiss.",
  "server.pickLoadFailed": "Не вдалося завантажити прогноз.",
  "server.pickSaveFailed": "Не вдалося зберегти прогноз.",
  "server.swissPicksLoadFailed": "Не вдалося завантажити прогнози Swiss.",
  "server.swissPicksSaveFailed": "Не вдалося зберегти прогнози Swiss.",
  "server.playinPicksLoadFailed": "Не вдалося завантажити прогнози Play-In.",
  "server.playinPicksSaveFailed": "Не вдалося зберегти прогнози Play-In.",
  "server.playoffsPicksLoadFailed": "Не вдалося завантажити прогнози Playoffs.",
  "server.playoffsPicksSaveFailed": "Не вдалося зберегти прогнози Playoffs.",
  "server.dePicksLoadFailed": "Не вдалося завантажити прогнози Double Elimination.",
  "server.dePicksSaveFailed": "Не вдалося зберегти прогнози Double Elimination.",
  "server.allTimeFailed": "Не вдалося завантажити загальний залік.",
  "server.upsetsFailed": "Не вдалося завантажити сенсації.",
  "server.playerNotFound": "Гравця не знайдено.",
  "server.playerCareerFailed": "Не вдалося завантажити профіль гравця.",
  "server.mvpVoteFailed": "Не вдалося завантажити голосування за MVP.",
  "server.mapsFailed": "Не вдалося завантажити статистику карт.",
  "server.matchMissing": "Матчу не існує",
  "server.noSuchEvent": "Такого турніру немає.",
  "server.notFound": "Не знайдено.",
  "server.proposalMissing": "Пропозиції не існує",
  "server.needAdmin": "Потрібні права адміністратора на цьому сервері.",
  "server.candidateIdRequired": "Потрібен ідентифікатор кандидата.",
  "server.teamOneSlot": "Команда не може займати більше одного місця",
  "server.backupFailed": "Не вдалося створити копію",
  "server.backupListFailed": "Не вдалося отримати список копій",
  "server.endTournamentFailed": "Не вдалося завершити турнір",
  "server.finalistsMustBeSemis": "Фіналісти мають бути півфіналістами",
  "server.badBackupName": "Невірне ім'я файлу копії",
  "server.badThirdPlace": "Невірне третє місце",
  "server.noTeamsSelected": "Команди не обрані",
  "server.noValidCandidates": "Не передано жодного коректного кандидата",
  "server.restoreFailed": "Не вдалося відновити",

  // --- Komunikaty serwera - blokady i powody -------------------------------
  "server.lock.matchFinished": "Матч завершено.",
  "server.lock.matchesClosed": "Прогнози на матчі наразі закриті.",
  "server.lock.matchLocked": "Матч заблоковано.",
  "server.lock.phaseClosed": "Прогнози на цю стадію закриті.",
  "server.lock.swissClosed": "Прогнози Swiss закриті.",
  "server.lock.playinClosed": "Прогнози Play-In закриті.",
  "server.lock.playoffsClosed": "Прогнози Playoffs закриті.",
  "server.lock.deClosed": "Прогнози Double Elimination закриті.",
  "server.stale.swiss": "Ця форма стосується попереднього турніру. Відкрий актуальний Swiss.",
  "server.stale.playin": "Ця форма стосується попереднього турніру. Відкрий актуальний Play-In.",
  "server.stale.playoffs": "Ця форма стосується попереднього турніру. Відкрий актуальний Playoffs.",
  "server.stale.de": "Ця форма стосується попереднього турніру. Відкрий актуальну панель Double Elimination.",
  "server.frozen.eventOver": "турнір завершено",
  "server.frozen.hasPicks": "уже є прогнози або результат",
  "server.archiveNotReady": "Архів створюється після завершення турніру. Цей ще триває.",
  "server.noProvider": "Постачальника результатів не налаштовано (RESULT_PROVIDER у server/.env)",
  "server.noActiveTeams": "На цьому сервері немає жодної активної команди. Спершу додай їх на сторінці Команди (там є імпорт із JSON).",
  "server.teamsMustExist": "Команди мають існувати й бути активними. Додай відсутні на сторінці Команди або виправ назви у списку.",
  "server.phasesFrozen": "Ці стадії не можна змінити: {phases}",
  "server.noChannel": "Незрозуміло, у якому каналі опублікувати панель. {hint}",
  "server.archivedScoring": "Правила нарахування за карти змінилися після його завершення — перерахунок переписав би закритий рейтинг. Якщо справді цього хочеш, спершу скасуй архівацію.",
  "server.notStarted": "не розпочато",

  // --- Klasyfikacja wszech czasow ------------------------------------------
  "allTime.nav": "Загальний залік",
  "allTime.kicker": "Понад турнірами",
  "allTime.title": "Загальний залік",
  "allTime.intro": "Хто прогнозує найкраще за весь час, а не на одному турнірі. Місце визначається середньою позицією серед усіх, а не сумою балів — вони незіставні між турнірами з різною кількістю матчів.",
  "allTime.loading": "Рахую залік...",
  "allTime.error": "Не вдалося завантажити залік",
  "allTime.ranked": {
    one: "{count} гравець із зіставним доробком",
    few: "{count} гравці із зіставним доробком",
    many: "{count} гравців із зіставним доробком",
  },
  "allTime.head.player": "Гравець",
  "allTime.head.starts": "Старти",
  "allTime.head.best": "Найкращий старт",
  "allTime.head.average": "У середньому",
  "allTime.starts": {
    one: "{count} старт",
    few: "{count} старти",
    many: "{count} стартів",
  },
  // Ta sama liczba, ktora profil gracza pokazuje przy kazdym
  // starcie jako "TOP x%" - i to nie jest przypadek, patrz
  // server/lib/allTime.js.
  "allTime.average": "ТОП {percent}%",
  "allTime.bestPlace": "#{rank} / {total}",
  "allTime.empty.title": "Замало турнірів",
  "allTime.empty.text": {
    one: "Залік охоплює гравців щонайменше з {count} стартом. Він з'явиться, коли хтось зіграє на двох турнірах.",
    few: "Залік охоплює гравців щонайменше з {count} стартами. Він з'явиться, коли хтось зіграє на двох турнірах.",
    many: "Залік охоплює гравців щонайменше з {count} стартами. Він з'явиться, коли хтось зіграє на двох турнірах.",
  },
  "allTime.note": {
    one: "У таблиці гравці щонайменше з {count} стартом. Одного турніру замало, щоб відрізнити майстерність від везіння — тобі бракує одного старту.",
    few: "У таблиці гравці щонайменше з {count} стартами. Одного турніру замало, щоб відрізнити майстерність від везіння — тобі бракує одного старту.",
    many: "У таблиці гравці щонайменше з {count} стартами. Одного турніру замало, щоб відрізнити майстерність від везіння — тобі бракує одного старту.",
  },

  // --- Niespodzianki -------------------------------------------------------
  "upsets.nav": "Сенсації",
  "upsets.kicker": "Коли помилялися майже всі",
  "upsets.title": "Сенсації",
  "upsets.intro": "Матчі, у яких переможця обрали менше ніж {percent}% учасників. Решта сайту показує, хто мав рацію, — тут видно моменти, коли її не мав майже ніхто.",
  "upsets.loading": "Шукаю сенсації...",
  "upsets.error": "Не вдалося завантажити сенсації",
  "upsets.counted": {
    one: "{count} матч пройшов усупереч більшості",
    few: "{count} матчі пройшли всупереч більшості",
    many: "{count} матчів пройшли всупереч більшості",
  },
  "upsets.head.match": "Матч",
  "upsets.head.where": "Де",
  "upsets.head.share": "Вгадали",
  "upsets.head.player": "Гравець",
  "upsets.head.hits": "Влучання",
  "upsets.head.rate": "Влучність",
  "upsets.head.team": "Команда",
  "upsets.head.judgement": "Оцінка",
  "upsets.head.gap": "Різниця",
  // Same liczby i ukosnik - czyta sie tak samo we wszystkich
  // pieciu jezykach. Ten sam zabieg, co przy allTime.bestPlace,
  // i z tego samego powodu: .ui-badge robi uppercase, wiec kazdy
  // przyimek w srodku zaczyna krzyczec.
  "upsets.hits": "{hits} / {total}",
  "upsets.share": "{percent}%",
  "upsets.note": {
    one: "Враховуються матчі щонайменше з {count} прогнозом — серед трьох осіб «ніхто не вгадав» не означає нічого. Межа сенсації — {percent}% влучань.",
    few: "Враховуються матчі щонайменше з {count} прогнозами — серед трьох осіб «ніхто не вгадав» не означає нічого. Межа сенсації — {percent}% влучань.",
    many: "Враховуються матчі щонайменше з {count} прогнозами — серед трьох осіб «ніхто не вгадав» не означає нічого. Межа сенсації — {percent}% влучань.",
  },
  "upsets.empty.title": "Фаворити не підвели",
  "upsets.empty.text": "Поки немає матчу, у якому переможця обрали б менше ніж {percent}% учасників. Він з'явиться тут сам, щойно станеться.",
  "upsets.people.kicker": "Проти течії",
  "upsets.people.title": "Хто вгадує всупереч усім",
  "upsets.people.intro": "У цих матчах пересічний учасник вгадував у {percent}% випадків. Нижче ті, кому вдавалося частіше — і не через одне вдале рішення.",
  // Zakres "od jednej do trzydziestu trzech" to liczba zmierzona
  // na produkcji, a nie figura retoryczna - patrz naglowek
  // server/lib/upsets.js.
  "upsets.people.note": {
    one: "У таблиці гравці щонайменше з {count} нагодою, тобто з такою кількістю матчів із цього списку, які вони прогнозували. Місце визначає влучність, а не кількість влучань: нагод буває від однієї до тридцяти трьох, тож сама лише кількість винагороджувала б часту гру.",
    few: "У таблиці гравці щонайменше з {count} нагодами, тобто з такою кількістю матчів із цього списку, які вони прогнозували. Місце визначає влучність, а не кількість влучань: нагод буває від однієї до тридцяти трьох, тож сама лише кількість винагороджувала б часту гру.",
    many: "У таблиці гравці щонайменше з {count} нагодами, тобто з такою кількістю матчів із цього списку, які вони прогнозували. Місце визначає влучність, а не кількість влучань: нагод буває від однієї до тридцяти трьох, тож сама лише кількість винагороджувала б часту гру.",
  },
  "upsets.teams.kicker": "Довіра і результат",
  "upsets.teams.title": "Переоцінені та недооцінені команди",
  "upsets.teams.intro": "Довіра — це частка прогнозів на команду, а влучність — частка виграних нею матчів. Додатна різниця означає команду, якій довіряють більше, ніж вона заслуговує.",
  "upsets.teams.trust": "Довіра {percent}%",
  "upsets.teams.wins": "Виграє {percent}%",
  "upsets.teams.note": {
    one: "У таблиці команди щонайменше з {count} зіграним матчем. За одного матчу довіра і влучність дорівнюють нулю або ста відсоткам, а різниця між ними не говорить про команду нічого.",
    few: "У таблиці команди щонайменше з {count} зіграними матчами. За одного матчу довіра і влучність дорівнюють нулю або ста відсоткам, а різниця між ними не говорить про команду нічого.",
    many: "У таблиці команди щонайменше з {count} зіграними матчами. За одного матчу довіра і влучність дорівнюють нулю або ста відсоткам, а різниця між ними не говорить про команду нічого.",
  },

  // --- Profil gracza ponad turniejami --------------------------------------
  "career.kicker": "Понад турнірами",
  "career.loading": "Завантажую доробок...",
  "career.error": "Не вдалося завантажити профіль",
  "career.played": {
    one: "{count} старт за історію сайту",
    few: "{count} старти за історію сайту",
    many: "{count} стартів за історію сайту",
  },
  "career.noStarts": "Поки без місця в жодному заліку",
  "common.percentValue": "{percent}%",
  "career.stat.average": "У середньому",
  "career.stat.averageHint": "місце серед усіх",
  "career.stat.best": "Найкращий старт",
  "career.stat.bestValue": "#{rank} / {total}",
  "career.stat.bestHint": "немає залікового старту",
  "career.stat.points": "Бали",
  "career.stat.pointsHint": "за всі турніри разом",
  "career.stat.contra": "Усупереч усім",
  "career.stat.contraHint": "{hits} із {total} сенсацій",
  "career.stat.contraNone": "жоден матч не здивував усіх",
  "career.contraShort": {
    one: "До таблиці «хто вгадує всупереч усім» бракує ще {count} нагоди - матчу, у якому помилилася більшість.",
    few: "До таблиці «хто вгадує всупереч усім» бракує ще {count} нагод - матчів, у яких помилилася більшість.",
    many: "До таблиці «хто вгадує всупереч усім» бракує ще {count} нагод - матчів, у яких помилилася більшість.",
  },
  "career.starts.kicker": "Турнір за турніром",
  "career.starts.title": "Усі старти",
  "career.starts.count": {
    one: "{count} турнір",
    few: "{count} турніри",
    many: "{count} турнірів",
  },
  // Doklejane do "history.count", dlatego zaczyna sie od myslnika
  // ze spacjami - komponent sklada oba napisy bez separatora.
  "career.starts.hint": " — натисни, щоб відкрити профіль із того турніру.",
  "career.teams.kicker": "Кому довіряє",
  "career.teams.title": "На кого ставить",
  "career.teams.intro": "Команди, на які ставлять найчастіше, і поряд те, як часто вони вигравали. Спершу та, на яку ставлять охочіше за все, — влучність лише відповідає, чи заслужено.",
  "career.teams.head.team": "Команда",
  "career.teams.head.record": "Баланс",
  "career.teams.head.rate": "Перемог",
  // Same liczby i ukosnik - ten sam zabieg, co przy upsets.hits
  // i allTime.bestPlace, i z tego samego powodu: .ui-badge robi
  // uppercase, wiec kazdy przyimek w srodku zaczyna krzyczec.
  "career.teams.record": "{wins} / {picks}",
  "career.teams.empty": {
    one: "Жодна команда поки не зібрала {count} прогнозу від цього гравця — усіх прогнозів на матчі {picks}.",
    few: "Жодна команда поки не зібрала {count} прогнозів від цього гравця — усіх прогнозів на матчі {picks}.",
    many: "Жодна команда поки не зібрала {count} прогнозів від цього гравця — усіх прогнозів на матчі {picks}.",
  },

  // --- Glosowanie na MVP ---------------------------------------------------
  "mvp.kicker": "Голос спільноти",
  "mvp.title": "Кого прочили в MVP",
  "mvp.resolved": "Переміг {nickname}, вгадали {percent}% тих, хто голосував.",
  "mvp.open": {
    one: "Віддано {count} голос. Переможця ще не названо.",
    few: "Віддано {count} голоси. Переможця ще не названо.",
    many: "Віддано {count} голосів. Переможця ще не названо.",
  },
  "mvp.head.player": "Кандидат",
  "mvp.head.votes": "Голоси",
  "mvp.head.share": "Частка",
  "mvp.votes": {
    one: "{count} голос",
    few: "{count} голоси",
    many: "{count} голосів",
  },
  "mvp.note": {
    one: "Пораховано з {count} відданого голосу. У списку кандидати щонайменше з одним голосом і переможець — навіть без жодного.",
    few: "Пораховано з {count} відданих голосів. У списку кандидати щонайменше з одним голосом і переможець — навіть без жодного.",
    many: "Пораховано з {count} відданих голосів. У списку кандидати щонайменше з одним голосом і переможець — навіть без жодного.",
  },
  "upsets.mvp.kicker": "Не всяка помилка — це матч",
  "upsets.mvp.headline": "У голосуванні за MVP вгадали {percent}% — переміг {nickname}, за нього було {votes} із {total} осіб.",

  // --- Czytanie wynikow map ------------------------------------------------
  "maps.nav": "Карти",
  "maps.kicker": "Раунди, а не карти",
  "maps.title": "Як ми читаємо рахунок карт",
  "maps.intro": "Прогнозуючи карту, називаєш рахунок у раундах. Зіставлення цих прогнозів із тим, що сталося насправді, говорить про спільноту одну конкретну річ — і не ту, якої можна було б очікувати.",
  "maps.loading": "Рахую карти...",
  "maps.error": "Не вдалося завантажити статистику карт",
  "maps.stat.predicted": "Прогнозований розрив",
  "maps.stat.predictedHint": "раундів між командами",
  "maps.stat.actual": "Фактичний розрив",
  "maps.stat.actualHint": "стільки виходить насправді",
  "maps.lead": {
    one: "Спільнота прогнозує карти ЩІЛЬНІШЕ, ніж вони виходять: у середньому {predicted} раунди різниці проти {actual} насправді. Пораховано з {count} розрахованого прогнозу.",
    few: "Спільнота прогнозує карти ЩІЛЬНІШЕ, ніж вони виходять: у середньому {predicted} раунди різниці проти {actual} насправді. Пораховано з {count} розрахованих прогнозів.",
    many: "Спільнота прогнозує карти ЩІЛЬНІШЕ, ніж вони виходять: у середньому {predicted} раунди різниці проти {actual} насправді. Пораховано з {count} розрахованих прогнозів.",
  },
  "maps.dist.kicker": "Прогноз поряд із реальністю",
  "maps.dist.title": "Найчастіші рахунки",
  "maps.dist.intro": "Те, що вписують найчастіше, поряд із тим, що найчастіше стається. Смуги масштабовані до найчастішого рахунку у своєму наборі, щоб можна було порівняти форму обох.",
  "maps.dist.predicted": "Прогнози",
  "maps.dist.actual": "Фактично",
  "maps.readers.kicker": "Хто читає найточніше",
  "maps.readers.title": "Читання карт",
  "maps.readers.intro": "Місце визначає відхилення від рахунку — саме те, на чому тримається підрахунок очок за карти. МЕНШЕ означає краще.",
  "maps.readers.head.player": "Гравець",
  "maps.readers.head.record": "Баланс",
  "maps.readers.head.deviation": "Відхилення",
  "maps.readers.picks": {
    one: "{count} розрахований прогноз",
    few: "{count} розраховані прогнози",
    many: "{count} розрахованих прогнозів",
  },
  "maps.readers.winners": "Переможець {percent}%",
  "maps.readers.exact": {
    one: "{count} точний",
    few: "{count} точні",
    many: "{count} точних",
  },
  "maps.readers.note": {
    one: "У таблиці гравці щонайменше з {count} розрахованим прогнозом на карту — приблизно стільки дає один турнір цілком.",
    few: "У таблиці гравці щонайменше з {count} розрахованими прогнозами на карти — приблизно стільки дає один турнір цілком.",
    many: "У таблиці гравці щонайменше з {count} розрахованими прогнозами на карти — приблизно стільки дає один турнір цілком.",
  },
  "maps.noNames": "Тут немає нічого про конкретні карти, бо назви карти в даних немає — прогнози й результати зберігають лише номер карти в серії. Номер теж нічого не говорить: влучність на першій, другій і третій виходить 54%, 56% і 55%, тож вирішальна карта не складніша за стартову.",
  "maps.empty.title": "Немає розрахованих карт",
  "maps.empty.text": "Сторінка будується з прогнозів на карти, які мають результат. Вона з'явиться, щойно перші карти буде розраховано.",

  // --- Rywale gracza w turnieju --------------------------------------------
  // Rywale gracza w turnieju.
  //
  // Pojedynek dwoch graczy istnial od dawna, ale wchodzilo sie w niego
  // z JEDNEGO miejsca i trzeba bylo wiedziec, czyj profil otworzyc.
  // Ta sekcja odpowiada na pytanie, ktore pada wczesniej: z kim wlasciwie
  // ten gracz sie sciga.
  "rivals.kicker": "Хто прогнозує те саме",
  "rivals.title": "Суперники",
  "rivals.intro": "Гравці, які прогнозували ті самі матчі. Враховується лише те, що прогнозували обидва і що вже розраховано — матч, який один із них пропустив, нічого не каже про перевагу.",
  "rivals.loading": "Обчислення суперників...",
  "rivals.error": "Не вдалося завантажити суперників.",
  "rivals.head.player": "Суперник",
  "rivals.head.record": "Баланс",
  // Remisy maja wlasna liczbe, bo jest ich duzo: zmierzone na produkcji
  // to 48% wspolnych meczow. Za 60% typow nie ma zadnych punktow,
  // a dwa zera to remis - wiec bez tej liczby bilans 34-14 przy stu
  // wspolnych meczach wygladalby na blad.
  "rivals.ties": {
    one: "{count} нічия",
    few: "{count} нічиї",
    many: "{count} нічиїх",
  },
  "rivals.sharedCount": {
    one: "{count} спільний матч",
    few: "{count} спільні матчі",
    many: "{count} спільних матчів",
  },
  // Odznaki, nie osobne kafelki: ten sam czlowiek bywa jednoczesnie
  // najczestszym i najrowniejszym rywalem.
  "rivals.badge.most": "найчастіший",
  "rivals.badge.closest": "найрівніший",
  "rivals.badge.best": "найбільша перевага",
  "rivals.badge.worst": "найбільше відставання",
  "rivals.duel": "Дуель",
  "rivals.more": {
    one: "…і ще {count} суперник",
    few: "…і ще {count} суперники",
    many: "…і ще {count} суперників",
  },
  "rivals.empty.none": "У цього гравця ще немає розрахованих прогнозів у цьому турнірі, тож порівнювати немає з чим.",
  "rivals.empty.tooFew": {
    one: "Ні в кого немає з цим гравцем навіть {count} розрахованого спільного матчу — замало, щоб баланс щось означав.",
    few: "Ні в кого немає з цим гравцем навіть {count} розрахованих спільних матчів — замало, щоб баланс щось означав.",
    many: "Ні в кого немає з цим гравцем навіть {count} розрахованих спільних матчів — замало, щоб баланс щось означав.",
  },
  "rivals.note": {
    one: "Баланс рахується з матчів, розрахованих МІЖ двома гравцями. Нічиї — однакова кількість очок за матч — рахуються окремо, бо їх майже половина від усіх спільних матчів. Суперник потрапляє до списку від {count} такого матчу.",
    few: "Баланс рахується з матчів, розрахованих МІЖ двома гравцями. Нічиї — однакова кількість очок за матч — рахуються окремо, бо їх майже половина від усіх спільних матчів. Суперник потрапляє до списку від {count} таких матчів.",
    many: "Баланс рахується з матчів, розрахованих МІЖ двома гравцями. Нічиї — однакова кількість очок за матч — рахуються окремо, бо їх майже половина від усіх спільних матчів. Суперник потрапляє до списку від {count} таких матчів.",
  },

  // --- Wynik turnieju ------------------------------------------------------
  // Wynik turnieju na stronie turnieju.
  //
  // Mistrz lezal w playoffs_results od poczatku, ale pokazywal go
  // wylacznie komponent PhaseResults na stronach TYPOWANIA fazy - mozna
  // bylo otworzyc strone IEM Cologne Major 2026 i nie dowiedziec sie,
  // ze wygraly Falcons.
  "outcome.kicker": "Чим усе скінчилося",
  "outcome.title": "Підсумок турніру",
  "outcome.intro": "Хто переміг — і скільки гравців це передбачило. Відсотки рахуються від прогнозів на плей-оф, а не від усіх учасників турніру.",
  // Etykieta plus nazwa, nigdy zdanie z nazwa w srodku. Nazwy druzyn to
  // wolny tekst z bazy, wiec "Falcons pokonali FURIE" wymagaloby biernika,
  // ktorego nie da sie zbudowac ani po polsku, ani po rosyjsku.
  "outcome.champion": "Чемпіон",
  "outcome.runnerUp": "Фіналіст",
  "outcome.semis": {
    one: "Півфіналіст",
    few: "Півфіналісти",
    many: "Півфіналісти",
  },
  "outcome.third": "Третє місце",
  "outcome.called.title": "Хто це передбачив",
  "outcome.called.winner": "Вгаданий чемпіон",
  "outcome.called.finalists": "Обидва фіналісти",
  "outcome.called.semifinalists": "Усі чотири півфіналісти",
  "outcome.favourite": "Фаворит спільноти",
  // Dopisek przy faworycie, nie osobne zdanie - doklejany po nazwie
  // i procencie, wiec dziala bez odmiany. Zmierzone: Krakow trafil
  // (Vitality 80%), Cologne i Budapeszt nie (Spirit 42%, Furia 57%).
  "outcome.favourite.hit": "так і сталося",
  "outcome.favourite.miss": "але переміг інший",
  "outcome.note": {
    one: "Основа — {count} прогноз на плей-оф у цьому турнірі. Той, хто плей-оф не прогнозував, у ці відсотки не потрапляє, навіть якщо прогнозував матчі.",
    few: "Основа — {count} прогнози на плей-оф у цьому турнірі. Той, хто плей-оф не прогнозував, у ці відсотки не потрапляє, навіть якщо прогнозував матчі.",
    many: "Основа — {count} прогнозів на плей-оф у цьому турнірі. Той, хто плей-оф не прогнозував, у ці відсотки не потрапляє, навіть якщо прогнозував матчі.",
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
  "swissPicks.kicker": "На що ставила спільнота",
  "swissPicks.title": "Прогнози на етапи",
  "swissPicks.intro": "Статистика команд на цьому сайті рахує лише матчі. Це друга половина того, що спільнота думає про команди — прогнози на 3-0, на 0-3 і на вихід, зіставлені з тим, що сталося насправді.",
  "swissPicks.loading": "Завантаження прогнозів на етапи...",
  "swissPicks.errorText": "Не вдалося завантажити прогнози на етапи.",
  "swissPicks.back": "Назад до турніру",
  "swissPicks.link": "Прогнози на етапи Swiss",
  "swissPicks.group.threeZero": "Хто пройде 3-0",
  "swissPicks.group.zeroThree": "Хто вилетить 0-3",
  "swissPicks.group.advancing": "Хто вийде далі",
  "swissPicks.total": {
    one: "{count} прогнозист",
    few: "{count} прогнозисти",
    many: "{count} прогнозистів",
  },
  "swissPicks.correct": "правильно",
  // Najmocniej obstawiona druzyna, ktora NIE byla poprawna odpowiedzia.
  // Zmierzone: GamerLegion 84% na 3-0, THUNDER dOWNUNDER 76% na 0-3,
  // B8 71% na awans - zadna nie wyszla.
  "swissPicks.overrated": "Певна ставка, яка не зіграла",
  // Druga polowa tej historii: poprawne odpowiedzi, ktorych tlum nie
  // widzial. Lynn Vision Gaming 1% na 0-3, FlyQuest 1% na 3-0,
  // SINNERS 2% na 0-3 - wszystkie trzy trafione.
  "swissPicks.missed": {
    one: "{count} непомічена відповідь",
    few: "{count} непомічені відповіді",
    many: "{count} непомічених відповідей",
  },
  "swissPicks.pending": "У цього етапу ще немає офіційного результату, тому видно лише розклад голосів.",
  "swissPicks.note": {
    one: "Непоміченою вважається правильна відповідь, яку вказали менше ніж {count}% прогнозистів. У списку стоїть верхівка кожної групи і КОЖНА правильна відповідь, зокрема та, що випала за верхівку — саме про неї ця сторінка.",
    few: "Непоміченою вважається правильна відповідь, яку вказали менше ніж {count}% прогнозистів. У списку стоїть верхівка кожної групи і КОЖНА правильна відповідь, зокрема та, що випала за верхівку — саме про неї ця сторінка.",
    many: "Непоміченою вважається правильна відповідь, яку вказали менше ніж {count}% прогнозистів. У списку стоїть верхівка кожної групи і КОЖНА правильна відповідь, зокрема та, що випала за верхівку — саме про неї ця сторінка.",
  },
  "swissPicks.empty.title": "У цьому турнірі не було етапів Swiss",
  "swissPicks.empty.text": "Не в кожному форматі є етап Swiss — буває плей-ін або сітка з подвійним вибуванням. Ця сторінка з'являється лише там, де були прогнози на етапи Swiss.",

  // --- Odnosniki do wyniku turnieju i rywali -------------------------------
  // Lista turniejow pokazywala same nazwy w kafelkach, wiec zakonczony
  // turniej nie mowil o sobie nic. Mistrz z procentem trafien robi
  // z listy cos, co da sie czytac - i sam prowadzi na strone turnieju.
  //
  // Etykieta obok nazwy, nigdy zdanie z nazwa w srodku: nazwy druzyn to
  // wolny tekst z bazy i nie da sie ich odmienic.
  "events.outcome.champion": "Чемпіон",
  "events.outcome.called": "вгадали {percent}%",
  // Sekcja rywali siedzi na profilu gracza, czyli dwa klikniecia od
  // rankingu - i nic w rankingu nie mowilo, ze cos takiego istnieje.
  // Odnosnik pokazuje sie tylko zalogowanemu, bo tylko wtedy wiadomo,
  // czyich rywali pokazac.
  "leaderboard.myRivals": "Мої суперники",

  // --- Strona serwera ------------------------------------------------------
  // Strona pojedynczej spolecznosci.
  //
  // Zmierzone: serwis obsluguje DWIE spolecznosci z turniejami, nie jedna.
  // 848 graczy wylacznie na jednej, 221 wylacznie na drugiej, 41 w obu -
  // a cala strona mieszala ich turnieje w jednej liscie.
  "server.kicker": "Спільнота",
  "server.intro": "Турніри цієї спільноти та її власна верхівка. Сайт обслуговує кілька серверів Discord одразу — тут лише дані одного.",
  "server.loading": "Завантаження сервера...",
  "server.errorText": "Не вдалося завантажити цей сервер.",
  "server.back": "На головну",
  "server.stats.events": "Турніри",
  "server.stats.participants": "Прогнозисти",
  "server.stats.predictions": "Зроблено прогнозів",
  "server.top.kicker": "Найкращі в цій спільноті",
  "server.top.title": "Верхівка сервера",
  "server.top.intro": "Порядок визначає середнє місце в загальному заліку, а не сума очок — турніри бувають різного розміру, і очки з них незіставні. МЕНШЕ означає краще.",
  // Prog dopasowany do serwera, nie sztywne dwa starty.
  //
  // Klasyfikacja wszech czasow wymaga dwoch startow i slusznie. Ale serwer
  // z jednym turniejem nie ma nikogo z dwoma - zmierzone, 221 graczy nie
  // moglo tam wejsc i nie zalezalo to od nich, tylko od tego, ile turniejow
  // zrobil ich serwer.
  "server.top.note": {
    one: "У верхівці гравці щонайменше з {count} стартом у цій спільноті. Поріг нижчий, ніж у заліку всіх часів, бо сервер з одним турніром ще не має нікого з двома стартами.",
    few: "У верхівці гравці щонайменше з {count} стартами в цій спільноті. Поріг нижчий, ніж у заліку всіх часів, бо сервер з одним турніром ще не має нікого з двома стартами.",
    many: "У верхівці гравці щонайменше з {count} стартами в цій спільноті. Поріг нижчий, ніж у заліку всіх часів, бо сервер з одним турніром ще не має нікого з двома стартами.",
  },
  "server.events.title": "Турніри цієї спільноти",
  "server.empty.title": "На цьому сервері ще не було турніру",
  "server.empty.text": "Бот тут є, але прогнози ще ніхто не відкрив. Сторінка заповниться з першим турніром.",
  "home.servers.view": "Відкрити сервер",

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
  "deadline.closesAt": "Прийом прогнозів закривається {date}",
  "deadline.passedAt": "Термін минув {date}",

  // --- Typy na fazy na stronie druzyny -------------------------------------
  // teamStats.js mowi wprost, ze liczy WYLACZNIE mecze. To jest druga
  // polowa - ta sama wiedza zebrana wokol druzyny.
  //
  // Zmierzone: GamerLegion typowana na awans 484 razy, trafnie 11%;
  // PARIVISION 347 razy, trafnie 87%; Imperial skazywana na 0-3 285 razy
  // i ANI RAZU sluszne, a na awans 76 razy przy 95% trafnosci.
  "team.phase.kicker": "Поза матчами",
  "team.phase.title": "Прогнози на етапи",
  "team.phase.intro": "Статистика вище рахує лише матчі. Тут те, що спільнота казала про цю команду на етапах турніру — і як часто мала рацію.",
  "team.phase.advance": "Прогнозували вихід",
  "team.phase.threeZero": "Прогнозували 3-0",
  "team.phase.zeroThree": "Списували на 0-3",
  "team.phase.hit": "правильно {percent}%",
  "team.phase.picks": {
    one: "{count} раз",
    few: "{count} рази",
    many: "{count} разів",
  },
  "team.phase.unsettled": "етап без результату",
  "teams.noMatches": "Лише прогнози на етапи",
  // Siedem druzyn gralo wylacznie w StarLadder Budapest 2025, ktory nie
  // ma w bazie ani jednego meczu - do tej pory nie istnialy na stronie
  // wcale, mimo setek ocen.
  "team.phaseOnly.title": "Ця команда не зіграла в нас жодного матчу",
  "team.phaseOnly.text": "Вона грала на турнірі, від якого в базі немає жодного матчу — залишилися тільки прогнози на етапи. Тому тут немає ні статистики матчів, ні їхньої історії.",

  // --- Profil gracza - punkty z faz ----------------------------------------
  // Dymek nad punktem wykresu. Stala tu polska sklejka na sztywno,
  // wiec „Mecz 3" pokazywalo sie tak samo w pieciu jezykach.
  "chart.point.match": "Матч {n}",
  // Os moze stac na etapach zamiast na meczach - w turnieju bez ani
  // jednego meczu w bazie „Mecz 3" byloby zwyczajnie nieprawda.
  "chart.point.phase": "Етап {n}",
  "chart.tooltip": "{name}: {points} бал., разом {total}",
  "chart.seriesPhase": {
    one: "{name}: {points} балів після {count} етапу",
    few: "{name}: {points} балів після {count} етапів",
    many: "{name}: {points} балів після {count} етапів",
  },
  // Klasyfikacja eventu to suma szesciu skladowych, a profil czytal
  // z tego wylacznie match_points.
  //
  // Zmierzone: 708 z 1294 wpisow gracz-turniej nie ma ANI JEDNEGO
  // wiersza w match_points. Pierwsze miejsce StarLadder Budapest 2025
  // ma 47 punktow (stage1 +12, stage2 +16, stage3 +12, playoffs +7)
  // i dostawalo siedem kafelkow z zerem.
  "profile.phase.kicker": "Поза матчами",
  "profile.phase.title": "Бали за етапи",
  "profile.phase.intro": "Турнірна таблиця враховує й прогнози на етапи — виходи, 3-0 і 0-3. Ось скільки балів вони принесли.",
  "profile.phase.total": "За етапи разом",
  "profile.phase.mvp": "MVP",
  // Budapeszt ma 509 sklasyfikowanych graczy i ZERO meczow w bazie.
  // Kolonia 148 takich graczy na 523, Krakow 51 na 262.
  "profile.noMatches.title": "У цьому результаті немає жодного матчу",
  "profile.noMatches.text": "Увесь результат склався з прогнозів на етапи. Тому тут немає ні влучності, ні серій, ні рекордів за матчами — їх немає з чого рахувати.",
  "profile.progress.captionPhase": "Наведіть на точку, щоб побачити етап і здобуток.",

  // --- Przeceniane i niedoceniane druzyny ----------------------------------
  // Strona druzyny podaje „zaufanie" i „wygrywa" obok siebie i nikt
  // ich od siebie nie odejmuje - a to odejmowanie jest cala trescia.
  //
  // Zmierzone: GamerLegion - stawiano 85%, wygrala 40%. NRG odwrotnie:
  // stawiano 14%, wygrala 44%.
  "bias.kicker": "Де ми помиляємося",
  "bias.title": "Переоцінені й недооцінені",
  // Prog osmiu meczow nie jest okragla liczba z sufitu. Mediana
  // |roznicy| spada z 30 (5-7 meczow) na 12 (8-11) i 9 (12+) - to szum,
  // ktory znika, a nie wiedza, ktora sie pojawia.
  "bias.intro": "Як охоче на команду ставили і як часто вона справді вигравала. Рахується з {count} команд щонайменше з {min} зіграними матчами — за меншої кількості різниця це шум, а не знання.",
  "bias.overrated": "Ставили надто часто",
  "bias.underrated": "Ставили надто рідко",
  "bias.row": "ставили {trust}%, виграла {win}%",
  "bias.sample": {
    one: "{count} матч",
    few: "{count} матчі",
    many: "{count} матчів",
  },
  "bias.empty": "Поки жодна команда не вирізняється настільки, щоб назвати це помилкою загалу.",

  // --- Punktacja - regulaminy juz nieobowiazujace --------------------------
  // Strona pokazywala JEDNA tabele i przypis o zmianie zasad
  // punktowania MAP. Stawka za SERIE zmienila sie mocniej i nie bylo
  // o niej ani slowa - a strona twierdzila wprost, ze „dokladny wynik
  // serii nie daje nic ponad to".
  //
  // Zmierzone: w IEM Cologne Major 2026 trafiony zwyciezca z dokladnym
  // wynikiem dawal 4 pkt, sam zwyciezca 1 pkt. Kolonia trzyma 12 812
  // punktow za serie; wedlug dzisiejszych stawek byloby 7 988.
  "scoringHistory.title": "Що діяло раніше",
  "scoringHistory.lead": "Архівний турнір зберігає бали з моменту підрахунку — ми його не перераховуємо, бо це переписало б таблицю, яку гравці вже побачили як остаточну. Отже, таблиця вище описує лише частину турнірів.",
  "scoringHistory.applied": "Діяло на: {events}",
  "scoringHistory.was": "тоді",
  "scoringHistory.now": "сьогодні",
  "scoringHistory.cologne.seriesWinnerOnly": "лише вгаданий переможець, без точного рахунку",
  // Uczciwosc wobec czytajacego: tych stawek nie ma w zadnym commicie
  // ani wpisie. Sa wyprowadzone z bazy, wiec strona ma to powiedziec.
  "scoringHistory.reconstructed": "Ці ставки відтворено з нарахованих балів, а не переписано з тодішнього регламенту — такого запису немає. Вони сходяться до бала на 6378 з 6424 прогнозів на матчі та 6224 з 6274 прогнозів на карти; решта — рядки, перераховані пізніше вже за новим правилом.",

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
  "leaderboard.picks": "{done} з {all} прогнозів",
  "leaderboard.picksHit": "{done} з {all} прогнозів · {percent}% влучних",

  // --- Tlum jako miara odniesienia -----------------------------------------
  // Tlum jako miara odniesienia. Kazda liczba w serwisie jest
  // bezwzgledna - "69% trafien" nie mowi, czy to duzo. Zmierzone:
  // w Kolonii chodzenie za wiekszoscia dalo by SZOSTE miejsce na 410
  // typujacych, w Krakowie dopiero 28. z 252.
  "crowd.kicker": "Планка",
  "crowd.title": "Натовп проти гравців",
  "crowd.intro": "Уявіть людину, яка в кожному матчі обирала просто те, що обрала більшість, без жодної власної думки. Ось скільки б вона вгадала.",
  "crowd.stat.correct": "Натовп вгадав",
  "crowd.stat.place": "Місце за влучністю",
  "crowd.stat.beatenBy": "Гравців обійшли його",
  "crowd.stat.ofPlayers": "з {count} у заліку",
  "crowd.whoBeat": "Око гостріше, ніж у всіх разом узятих:",
  // To zdanie musi stac na stronie, bo inaczej ktos slusznie zapyta,
  // skad mial wiedziec przed terminem, co wybierze wiekszosc.
  "crowd.disclaimer": "Більшість рахується постфактум, з усіх зроблених прогнозів, — до дедлайну її ніхто не міг знати. Це не стратегія, а міра того, чи додало власне судження щось до судження групи.",
  "crowd.player.title": "Ви проти натовпу",
  "crowd.player.intro": "Усе вище каже, скільки цей гравець вгадав. Це каже, чи додало його власне судження щось до судження групи. Більшість рахується без його голосу.",
  "crowd.player.gap": "Проти натовпу",
  "crowd.player.gapHint": "вгаданих більше або менше на {count} матчах",
  "crowd.player.you": "Цей гравець вгадав",
  "crowd.player.crowd": "Натовп вгадав би",
  "crowd.player.ofMatches": "з тих самих {count} матчів",

  // --- Ranking ze skutecznosci ---------------------------------------------
  "leaderboard.order.label": "Як упорядкувати таблицю",
  "leaderboard.order.points": "Очки",
  "leaderboard.order.accuracy": "Влучність",
  "leaderboard.head.accuracy": "Влучність",
  // Zmierzone w IEM Cologne: mediana typujacego pominela 103 ze 106
  // meczow, a 163 osoby z 409 oddaly dokladnie jeden typ. Suma punktow
  // mierzy wiec w duzej mierze obecnosc - i dlatego ta tabela istnieje.
  "leaderboard.accuracy.intro": "Ті самі люди, але за часткою вгаданих переможців. Очки зростають з кожним зробленим прогнозом, тож таблиця очок здебільшого вимірює присутність — ця вимірює чуття.",
  "leaderboard.accuracy.field": {
    one: "У заліку {count} людина — ті, хто дав прогноз щонайменше на {threshold} з {all} матчів.",
    few: "У заліку {count} людини — ті, хто дав прогноз щонайменше на {threshold} з {all} матчів.",
    many: "У заліку {count} людей — ті, хто дав прогноз щонайменше на {threshold} з {all} матчів.",
  },
  "leaderboard.accuracy.empty": "Замало зіграних матчів, щоб порівнювати влучність.",
  "leaderboard.accuracy.outside": "Вас немає в цій таблиці — не вистачає прогнозів до порога. Перемкніться на очки, щоб побачити своє місце.",
  "leaderboard.pointsRank": "#{rank} за очками",
  // Stalo tu wczesniej „#6 z 410” - miejsce w liczbie TRAFIEN
  // wsrod wszystkich, ktorzy oddali choc jeden typ. Prawdziwe i mylace
  // naraz: tlum typuje kazdy mecz, wiec duza czesc tej przewagi to byla
  // sama obecnosc.
  "crowd.field": "До заліку входять ті, хто дав прогноз щонайменше на {threshold} з {all} матчів. Натовп прогнозував кожен, тож порівняння з тим, хто зробив один прогноз, нічого не означало б.",
};

export default uk;
