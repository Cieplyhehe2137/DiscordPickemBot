// Słownik rosyjski.
//
// Zestaw i kolejność kluczy jak w pl.js - to tamten plik jest źródłem prawdy,
// a test porównuje zestawy. Liczba mnoga po rosyjsku ma trzy formy:
// one / few / many, tak samo jak po polsku.

const ru = {
  // --- Nagłówek i nawigacja ------------------------------------------------
  "layout.logo": "PickEmBot",
  "layout.nav.home": "Главная",
  "layout.nav.events": "Турниры",
  "layout.nav.teams": "Команды",
  "layout.nav.scoring": "Очки",
  "layout.nav.stats": "Статистика",
  "layout.nav.admin": "Панель",
  "layout.user.loading": "Загрузка...",
  "layout.user.logout": "Выйти",
  "layout.user.login": "Войти",

  // --- Przełącznik motywu --------------------------------------------------
  "theme.toggle.light": "Переключить на светлую тему",
  "theme.toggle.dark": "Переключить на тёмную тему",

  // --- Przełącznik języka --------------------------------------------------
  "language.label": "Язык",
  "language.change": "Изменить язык сайта",

  // --- Napisy wspolne ------------------------------------------------------
  "common.loading": "Загрузка...",
  "common.cancel": "Отмена",
  "common.backToEvent": "Назад к турниру",
  "common.selected": "Выбрано",
  // Skrot jednostki, nie cale zdanie. Po polsku "pkt" nie
  // odmienia sie wcale, wiec nie ma tu form liczby mnogiej -
  // ale po niemiecku kropka na koncu jest czescia skrotu.
  "common.points": "{count} очк.",
  "common.hits": "{hits}/{total} угадано",
  "common.playersCount": {
    one: "{count} игрок",
    few: "{count} игрока",
    many: "{count} игроков",
  },
  "common.matchesCount": {
    one: "{count} матч",
    few: "{count} матча",
    many: "{count} матчей",
  },
  "common.eventsCount": {
    one: "{count} турнир",
    few: "{count} турнира",
    many: "{count} турниров",
  },
  "common.loadingEvents": "Загрузка турниров",
  "common.eventsError": "Не удалось загрузить турниры.",
  "common.loadingMatches": "Загрузка матчей",
  "common.all": "Все",
  "common.save": "Сохранить",
  "common.retry": "Попробовать снова",
  "common.searchPlayer": "Искать игрока по нику...",
  "common.searchPlayerLabel": "Искать игрока",
  "common.picksPercent": "{percent}% прогнозов",
  "common.pointsValue": "{value} очк.",
  "common.mapPick": "прогноз {a}:{b}",
  "common.mapResult": "результат {a}:{b}",
  "common.mapNo": "Карта {no}",

  // --- Ekran za logowaniem -------------------------------------------------
  "login.title": "Войдите, чтобы увидеть",
  "login.discord": "Войти через Discord",

  // --- Strona 404 ----------------------------------------------------------
  "notFound.kicker": "Ошибка 404",
  "notFound.title": "Такой страницы нет",
  // Adres jest wstawiany jako <code>, wiec to zdanie renderuje
  // komponent T - patrz i18n/T.jsx.
  "notFound.text": "Адрес {path} не существует. Возможно, он устарел или содержит опечатку.",
  "notFound.events": "Смотреть турниры",
  "notFound.home": "Главная страница",

  // --- Starty w innych turniejach ------------------------------------------
  "history.kicker": "Помимо этого турнира",
  "history.title": "Также играл в",
  "history.count": {
    one: "{count} другой турнир",
    few: "{count} других турнира",
    many: "{count} других турниров",
  },
  "history.hint": " — нажмите, чтобы увидеть тот профиль.",
  "history.unranked": "без места в таблице",
  "history.place": "место {rank} из {total}",
  "history.top": "ТОП {percent}%",

  // --- Odznaki -------------------------------------------------------------
  "badges.kicker": "Значки",
  "badges.title": "Достижения на этом турнире",
  "badges.earned": {
    one: "{count} значок получен",
    few: "{count} значка получено",
    many: "{count} значков получено",
  },
  "badges.emptyTitle": "Пока ни одного значка",
  "badges.emptyText": "Они появятся после первых подсчитанных матчей — ниже видно, что ближе всего.",
  // „Pojawia sie po pierwszych rozliczonych meczach" przeczylo temu,
  // co stalo linijke nizej: liscie odznak w zasiegu, zlozonej z takich,
  // ktore z meczami nie maja nic wspolnego.
  "badges.emptyTextNoMatches": "В этом турнире нет матчей, поэтому матчевые значки недоступны — ниже видно, что ближе всего.",
  "badges.near": "Близко",

  // --- Wybor gracza do porownania ------------------------------------------
  "picker.title": "С кем сравнить?",
  "picker.search": "Искать игрока по нику...",
  "picker.searchLabel": "Искать игрока",
  "picker.loading": "Ищу игроков...",
  "picker.loadError": "Не удалось загрузить список игроков.",
  "picker.noMatch": "Никто не подходит под \"{query}\".",
  "picker.empty": "На этом турнире пока нет игроков в таблице.",

  // --- Typy druzyn na profilu ----------------------------------------------
  "teamPicks.kicker": "Ставки на команды",
  "teamPicks.title": "Кого поставил на выход дальше",
  "teamPicks.unpublished": "Результат не объявлен",

  // --- Fazy turnieju -------------------------------------------------------
  "phase.notStarted": "Не начался",
  "phase.finished": "Завершён",
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
  "eventState.live": "Идёт",
  "eventState.upcoming": "Скоро",
  "eventState.finished": "Завершён",

  // --- Strona glowna -------------------------------------------------------
  "home.hero.predict": "Предсказывай.",
  "home.hero.compete": "Соревнуйся.",
  "home.hero.win": "Побеждай.",
  "home.hero.text": "Предсказывай матчи CS2, угадывай счёт на картах и набирай очки вместе с сообществом PickEmBot.",
  "home.hero.events": "Смотреть турниры",
  "home.hero.rankings": "Смотреть рейтинги",
  "home.stats.players": "Участников",
  "home.stats.playersHint": "всего заявок по всем турнирам",
  "home.stats.events": "Турниры",
  "home.stats.eventsHint": "сыгранные и текущие",
  "home.stats.matches": "Матчи",
  "home.stats.matchesHint": "для прогнозов",
  "home.stats.visits": "Посещений",
  "home.stats.visitsToday": "{count} сегодня",
  "home.empty.title": "Первый турнир впереди",
  "home.empty.text": "Как только откроются прогнозы, турниры появятся здесь.",
  "home.events.kicker": "Турниры",
  "home.heading.live": "Где сейчас делают прогнозы",
  "home.heading.upcoming": "Ближайшие турниры",
  "home.heading.recent": "Последние турниры",
  "home.allEvents": "Все турниры →",
  "home.servers.kicker": "Где работает бот",
  "home.servers.title": "Серверы",
  "home.servers.open": "{count} идёт",
  "home.servers.join": "Зайти в Discord",
  "home.servers.error": "Не удалось загрузить серверы.",

  // --- Lista turniejow -----------------------------------------------------
  "events.kicker": "Турниры",
  "events.title": "Турниры",
  "events.intro": "Выбери турнир, чтобы перейти к прогнозам на матчи, стадиям турнира и рейтингу. Завершённые Pick'Em остаются доступными для просмотра.",
  "events.error": "Не удалось загрузить турниры",
  "events.empty.title": "Турниров пока нет",
  "events.empty.text": "Когда стартует первый Pick'Em, он появится в этом списке.",
  "events.live.kicker": "Сейчас",
  "events.live.title": "Идущие",
  "events.upcoming.kicker": "Анонс",
  "events.upcoming.title": "Скоро",
  "events.upcoming.text": "Турнир уже создан, но прогнозы ещё не открылись - они начнутся, когда в Discord появится панель стадии.",
  "events.finished.kicker": "Архив",
  "events.finished.title": "Завершённые",
  "events.finished.text": "Сейчас не идёт ни один Pick'Em. Ниже турниры, которые можно посмотреть.",

  // --- Stan meczu ----------------------------------------------------------
  "matchState.open": "Прогнозы открыты",
  "matchState.locked": "Прогнозы закрыты",
  "matchState.finished": "Завершены",

  // --- Lista meczow --------------------------------------------------------
  "matches.title": "Матчи",
  "matches.titlePhase": "Матчи — {phase}",
  "matches.countFiltered": {
    one: "{shown} из {count} матча",
    few: "{shown} из {count} матчей",
    many: "{shown} из {count} матчей",
  },
  "matches.filter.phase": "Стадия",
  "matches.filter.team": "Команда",
  "matches.filter.state": "Статус",
  "matches.filter.clear": "Сбросить фильтры",
  "matches.progress": "Прогресс прогнозов",
  "matches.partial": "Незавершённые прогнозы:",
  "matches.error": "Не удалось загрузить матчи",
  "matches.empty.title": "Матчей нет",
  "matches.empty.filtered": "Ни один матч не подходит под выбранные фильтры.",
  "matches.empty.none": "На этом турнире пока нет запланированных матчей.",
  "matches.status.complete": "Прогноз есть",
  "matches.status.partial": "Прогноз неполный",
  "matches.status.missed": "Без прогноза",
  "matches.status.empty": "Можно прогнозировать",
  "matches.no": "Матч #{no}",
  "matches.foot.final": "Матч завершён",
  "matches.foot.locked": "Прогнозы заблокированы",
  "matches.foot.saved": "Прогноз сохранён — его ещё можно изменить",
  "matches.foot.finish": "Заверши свой прогноз",
  "matches.foot.open": "Прогнозы открыты",
  "matches.cta.result": "Смотреть результат",
  "matches.cta.match": "Смотреть матч",
  "matches.cta.edit": "Изменить прогноз",
  "matches.cta.finish": "Завершить прогноз",
  "matches.cta.predict": "Прогноз",

  // --- Ranking -------------------------------------------------------------
  "leaderboard.kicker": "Рейтинг",
  "leaderboard.title": "Рейтинг игроков",
  "leaderboard.loading": "Загрузка рейтинга",
  "leaderboard.error": "Не удалось загрузить рейтинг",
  "leaderboard.ranked": {
    one: "{count} игрок в таблице",
    few: "{count} игрока в таблице",
    many: "{count} игроков в таблице",
  },
  "leaderboard.findMe": "Найти меня",
  "leaderboard.foundOf": {
    one: "Найдено {found} из {count} игрока",
    few: "Найдено {found} из {count} игроков",
    many: "Найдено {found} из {count} игроков",
  },
  "leaderboard.noMatch": "Никто не подходит под {query}",
  "leaderboard.notStarted.title": "Рейтинг ещё не начался",
  "leaderboard.notStarted.text": {
    one: "На этом турнире уже {count} игрок с прогнозами, но очков пока нет ни у кого — они появятся после первых подсчитанных матчей и стадий.",
    few: "На этом турнире уже {count} игрока с прогнозами, но очков пока нет ни у кого — они появятся после первых подсчитанных матчей и стадий.",
    many: "На этом турнире уже {count} игроков с прогнозами, но очков пока нет ни у кого — они появятся после первых подсчитанных матчей и стадий.",
  },
  "leaderboard.nobody.title": "Ещё никто не делал прогнозов",
  "leaderboard.nobody.text": "Рейтинг появится, когда первые игроки сделают прогнозы.",
  "leaderboard.head.player": "Игрок",
  "leaderboard.head.breakdown": "Разбивка",
  "leaderboard.head.points": "Очки",
  "leaderboard.noPoints": "нет очков",
  // Rozbicie punktow na fazy: nazwy etapow ida z tego samego
  // zrodla co wszedzie (Swiss, Playoffs), a tlumaczenia wymagaja
  // tylko "Mecze" i "MVP" - to drugie jest skrotem i zostaje.
  "leaderboard.split.matches": "Матчи",
  "leaderboard.pages": "Страницы рейтинга",
  "leaderboard.prev": "← Назад",
  "leaderboard.next": "Вперёд →",
  "leaderboard.pageOf": "Страница {page} из {total}",

  // --- Lista druzyn --------------------------------------------------------
  "teams.kicker": "Команды",
  "teams.title": "Кто играл на этих турнирах",
  "teams.intro": {
    one: "{count} команда со всех турниров — с балансом и тем, как охотно на неё ставило сообщество.",
    few: "{count} команды со всех турниров — с балансом и тем, как охотно на них ставило сообщество.",
    many: "{count} команд со всех турниров — с балансом и тем, как охотно на них ставило сообщество.",
  },
  "teams.loading": "Загружаю команды...",
  "teams.error": "Не удалось загрузить команды",
  "teams.errorText": "Не удалось загрузить команды.",
  "teams.search": "Искать команду...",
  "teams.searchLabel": "Искать команду",
  "teams.empty.title": "Ничего не подходит",
  "teams.empty.text": "Ни одна команда не подходит под {query}.",
  "teams.record": {
    one: "{wins}–{losses} в {count} матче",
    few: "{wins}–{losses} в {count} матчах",
    many: "{wins}–{losses} в {count} матчах",
  },
  "teams.noResult": {
    one: "{count} матч без результата",
    few: "{count} матча без результата",
    many: "{count} матчей без результата",
  },

  // --- Strona druzyny ------------------------------------------------------
  "team.backToTeams": "Назад к командам",
  "team.loading": "Загружаю команду...",
  "team.error": "Не удалось загрузить команду",
  "team.errorText": "Не удалось загрузить команду.",
  "team.kicker": "Команда",
  "team.played": {
    one: "{count} матч в {events}",
    few: "{count} матча в {events}",
    many: "{count} матчей в {events}",
  },
  "team.inEvents": {
    one: "{count} турнире",
    few: "{count} турнирах",
    many: "{count} турнирах",
  },
  "team.record": "Баланс",
  "team.noPlayed": "нет сыгранных матчей",
  "team.winRate": "{percent}% побед",
  "team.trust": "Доверие",
  "team.trustHint": "прогнозов ставили на неё",
  "team.trustHit": "Доверие оправдалось",
  "team.trustHitHint": "этих прогнозов сбылись",
  "team.picksTotal": "Прогнозов всего",
  "team.picksOf": "из {total} в её матчах",
  "team.matches": "Матчи",
  "team.history": "История",
  "team.historyHint": "Процент рядом с матчем — доля прогнозов, ставивших на эту команду.",
  "team.noMatches": "У этой команды пока нет запланированных матчей.",
  "team.noScore": "Без результата",

  // --- Punktacja -----------------------------------------------------------
  "scoring.page.kicker": "Правила",
  "scoring.page.title": "Начисление очков",
  "scoring.page.intro": "Все значения взяты прямо из правил, по которым считается рейтинг, — это не отдельно написанное описание.",
  "scoring.page.loading": "Загружаю правила начисления...",
  "scoring.page.error": "Не удалось загрузить правила начисления",
  "scoring.page.errorText": "Не удалось загрузить правила начисления.",
  "scoring.page.noRates": "Сервер не вернул значения очков. Попробуйте обновить страницу.",
  "scoring.match.title": "Матчи",
  "scoring.match.lead": "Каждый матч турнира. Очки за серию и очки за карты складываются — это две разные вещи, а не альтернатива.",
  "scoring.matchWinner.label": "Угаданный победитель серии",
  "scoring.matchWinner.hint": "Точный счёт серии ничего не добавляет. Прогноз 2:0 и прогноз 2:1 стоят одинаково, если называют ту же команду.",
  "scoring.maps.title": "Карты",
  "scoring.maps.lead": "Считается отдельно для КАЖДОЙ карты серии. Условие: нужно угадать победителя карты — без этого близкий счёт ничего не даёт. Дальше считается суммарное отклонение от счёта, то есть разница раундов с одной стороны плюс разница с другой.",
  "scoring.mapExact.label": "Точный счёт карты",
  "scoring.mapExact.hint": "Отклонение 0 раундов.",
  "scoring.mapDiff1.label": "Отклонение на 1 раунд",
  "scoring.mapDiff1.hint": "Например, прогноз 13:10 при счёте 13:11.",
  "scoring.mapDiff2.label": "Отклонение на 2 раунда",
  "scoring.mapMiss.label": "Большее отклонение или неверный победитель карты",
  "scoring.perTeam.lead": "Очки начисляются за каждую угаданную команду отдельно.",
  "scoring.swiss30.label": "Команда с балансом 3-0",
  "scoring.swiss03.label": "Команда с балансом 0-3",
  "scoring.advancing.label": "Команда, которая проходит дальше",
  "scoring.semifinalist.label": "Полуфиналист",
  "scoring.finalist.label": "Финалист",
  "scoring.winner.label": "Победитель турнира",
  "scoring.thirdPlace.label": "Победитель матча за 3-е место",
  "scoring.thirdPlace.hint": "Только на турнире, где организатор внёс официальный результат этого матча.",
  "scoring.doubleElim.lead": "Четыре прогноза на стадию: Upper Final A, Lower Final A, Upper Final B и Lower Final B.",
  "scoring.anyCorrect.label": "Каждый угаданный прогноз",
  "scoring.mvp.title": "MVP",
  "scoring.mvp.lead": "Один прогноз на весь турнир.",
  "scoring.mvpCorrect.label": "Угаданный MVP турнира",

  // --- Format fazy ---------------------------------------------------------
  "phaseFormat.title": "Формат этой стадии",
  "phaseFormat.record30": {
    one: "{count} команда с балансом 3-0",
    few: "{count} команды с балансом 3-0",
    many: "{count} команд с балансом 3-0",
  },
  "phaseFormat.record03": {
    one: "{count} команда с балансом 0-3",
    few: "{count} команды с балансом 0-3",
    many: "{count} команд с балансом 0-3",
  },
  "phaseFormat.advancing": {
    one: "{count} команда проходит дальше",
    few: "{count} команды проходят дальше",
    many: "{count} команд проходят дальше",
  },
  "phaseFormat.teams": {
    one: "{count} проходящая команда",
    few: "{count} проходящие команды",
    many: "{count} проходящих команд",
  },
  "phaseFormat.semifinalists": {
    one: "{count} полуфиналист",
    few: "{count} полуфиналиста",
    many: "{count} полуфиналистов",
  },
  "phaseFormat.finalists": {
    one: "{count} финалист",
    few: "{count} финалиста",
    many: "{count} финалистов",
  },
  "phaseFormat.winner": {
    one: "{count} победитель",
    few: "{count} победителя",
    many: "{count} победителей",
  },
  "phaseFormat.third": "{count} на 3-м месте",

  // --- Moje typy -----------------------------------------------------------
  "myPicks.kicker": "Твои данные",
  "myPicks.title": "Мои прогнозы",
  "myPicks.titleEvent": "Мои прогнозы — {event}",
  "myPicks.intro": "Проверь сохранённые прогнозы на матчи, точные счёта карт и набранные очки.",
  "myPicks.loading": "Загрузка прогнозов",
  "myPicks.loginText": "Это твои сохранённые прогнозы, поэтому сначала нужно знать, кто спрашивает.",
  "myPicks.error": "Не удалось загрузить прогнозы",
  "myPicks.errorText": "Не удалось загрузить прогнозы.",
  "myPicks.empty.title": "В этой стадии нет матчей",
  "myPicks.empty.text": "У выбранной стадии пока нет встреч. Загляни в другую стадию или вернись, когда расписание заполнится.",
  "myPicks.finished": "Завершён",
  "myPicks.pending": "Ожидает",
  "myPicks.noPick": "Прогноз не сохранён.",
  "myPicks.yourPick": "Твой прогноз",
  "myPicks.exactScore": "Точный счёт",
  "myPicks.noMapPicks": "Прогнозы на карты не сохранены.",
  "myPicks.mapPick": "прогноз {a}:{b}",
  "myPicks.mapResult": "результат {a}:{b}",
  "myPicks.mapNoResult": "результат: —",
  "myPicks.total": "Всего",
  "myPicks.totalHint": "очков за матч",
  "myPicks.series": "Серия",
  "myPicks.maps": "Карты",
  "myPicks.later": "Очки начислятся после окончания матча.",
  "myPicks.cta.predict": "Прогноз на матч",
  "myPicks.pageOf": "Страница {page}/{total}",

  // --- Nazwy odznak --------------------------------------------------------
  "badge.unitPoints": " очк.",
  "badge.accuracy1": "Меткий",
  "badge.accuracy2": "Очень меткий",
  "badge.accuracy3": "Снайпер",
  "badge.accuracy.desc": "{count}% угаданных победителей",
  "badge.streak1": "Разогрелся",
  "badge.streak2": "Горячая рука",
  "badge.streak3": "Не остановить",
  "badge.streak.desc": {
    one: "{count} попадание подряд",
    few: "{count} попадания подряд",
    many: "{count} попаданий подряд",
  },
  "badge.exactSeries1": "Точный",
  "badge.exactSeries2": "Педантичный",
  "badge.exactSeries3": "Часовщик",
  "badge.exactSeries.desc": {
    one: "{count} точный счёт серии",
    few: "{count} точных счёта серии",
    many: "{count} точных счетов серии",
  },
  "badge.exactMaps1": "Знаток карт",
  "badge.exactMaps2": "Картограф",
  "badge.exactMaps3": "Ясновидящий",
  "badge.exactMaps.desc": {
    one: "{count} точный счёт карты",
    few: "{count} точных счёта карт",
    many: "{count} точных счетов карт",
  },
  "badge.points1": "Полтинник",
  "badge.points2": "Сотня",
  "badge.points3": "Сто пятьдесят",
  "badge.points.desc": {
    one: "{count} очко на турнире",
    few: "{count} очка на турнире",
    many: "{count} очков на турнире",
  },
  "badge.perfect": "Полное попадание",
  "badge.perfect.desc": "Матч угадан вплоть до карт",
  "badge.bigMatch": "Большой матч",
  "badge.bigMatch.desc": {
    one: "{count} очко за один матч",
    few: "{count} очка за один матч",
    many: "{count} очков за один матч",
  },
  // Nazwy odznak sa TLUMACZONE, bo to nie sa terminy esportowe,
  // tylko zarty jezykowe: "Zegarmistrz" o kims, kto trafia
  // dokladne wyniki. Doslowne tlumaczenie takiego zartu nie zawsze
  // dziala, wiec niektore brzmia inaczej niz polski oryginal - i tak
  // ma byc.
  "badge.podium": "Подиум",
  "badge.podium.desc": "Место в первой тройке",
  "badge.regular": "Завсегдатай",
  "badge.regular.desc": {
    one: "{count} подсчитанный прогноз",
    few: "{count} подсчитанных прогноза",
    many: "{count} подсчитанных прогнозов",
  },

  // --- Okna i powiadomienia ------------------------------------------------
  "dialog.sure": "Вы уверены?",
  "dialog.confirm": "Подтвердить",
  "toast.close": "Закрыть уведомление",

  // --- Wykres punktow ------------------------------------------------------
  // Opis wykresu dla czytnika ekranu - to jedyna droga do tych
  // liczb dla kogos, kto nie widzi rysunku.
  "chart.title": "Очки нарастающим итогом. {series}.",
  "chart.series": {
    one: "{name}: {points} очков после {count} матча",
    few: "{name}: {points} очков после {count} матчей",
    many: "{name}: {points} очков после {count} матчей",
  },
  "chart.empty": "График появится после первого подсчитанного матча.",

  // --- Wyniki fazy ---------------------------------------------------------
  "phaseResults.kicker": "Итог",
  "phaseResults.title": "Результаты стадии",
  "phaseResults.noPick": "У тебя нет сохранённого прогноза на эту стадию — ниже только официальный результат.",
  "phaseResults.official": "Официально",
  "phaseResults.hitsWithPoints": "{hits}/{total} угадано · {points} очк.",
  "phaseResults.teams30": "Команды 3-0",
  "phaseResults.teams03": "Команды 0-3",
  "phaseResults.advancing": "Проходящие дальше",
  "phaseResults.semifinalists": "Полуфиналисты",
  "phaseResults.finalists": "Финалисты",
  "phaseResults.winner": "Победитель",
  "phaseResults.thirdPlace": "3-е место",
  "phaseResults.mvpCandidate": "Кандидат в MVP",
  "phaseResults.advancingTeams": "Проходящие команды",

  // --- Profil gracza -------------------------------------------------------
  "profile.loading": "Загрузка профиля",
  "profile.backToLeaderboard": "Назад к рейтингу",
  "profile.error": "Не удалось загрузить профиль",
  "profile.errorText": "Не удалось загрузить профиль игрока.",
  "profile.missing.title": "Такого игрока нет",
  "profile.missing.text": "Никто с таким идентификатором не делал прогнозов на этом турнире.",
  "profile.compare": "Сравнить с игроком",
  "profile.kicker": "Профиль игрока",
  "profile.career": "Достижения поверх турниров",
  "profile.points": "Очки",
  "profile.pointsPerMatch": "{value} очк. / матч",
  "profile.rank": "Рейтинг",
  "profile.accuracy": "Точность",
  "profile.accuracyHint": {
    one: "{correct} / {count} матча",
    few: "{correct} / {count} матчей",
    many: "{correct} / {count} матчей",
  },
  "profile.exactMaps": "Точные карты",
  "profile.exactMapsHint": "{percent}% спрогнозированных карт",
  "profile.correctMaps": "Угаданные карты",
  "profile.correctMapsHint": "{percent}% точности",
  "profile.bestMatch": "Лучший матч",
  "profile.bestMatchHint": "очков за один матч",
  "profile.seriesPoints": "Очки за серии",
  "profile.mapPoints": "Очки за карты",
  "profile.progress.kicker": "Ход турнира",
  "profile.progress.title": "Очки во времени",
  "profile.progress.caption": "Наведи на точку, чтобы увидеть матч и добычу.",
  "profile.form.kicker": "Серии",
  "profile.form.title": "Форма игрока",
  "profile.bestStreak": "Лучшая серия попаданий",
  "profile.currentStreak": "Текущая серия попаданий",
  "profile.streakHint": "матчей подряд",
  "profile.perfect": "Идеальные матчи",
  "profile.perfectHint": "угаданных полностью",
  "profile.records.kicker": "Рекорды",
  "profile.records.title": "Рекорды игрока",
  "profile.bestMapScore": "Лучший результат по картам",
  "profile.bestMapScoreHint": "Больше всего очков за карты в одном матче",
  "profile.avgCorrect": "Среднее за угаданный матч",
  "profile.avgCorrectHint": "Среднее число очков в матчах с угаданным победителем",
  "profile.comparison.kicker": "Сравнение",
  "profile.comparison.title": "На фоне турнира",
  "profile.comparison.hint": "из {total} · ТОП {percent}%",
  "profile.history.kicker": "История",
  "profile.history.title": "Последние прогнозы",
  "profile.pick": "Прогноз: {a}:{b}",
  "profile.result": " · Результат: {a}:{b}",
  "profile.split": "Серия +{series} · Карты +{maps}",
  "profile.map.exact": "Точно",
  "profile.map.winner": "Победитель",
  "profile.map.miss": "Мимо",
  "profile.empty.title": "Прогнозов нет",
  "profile.empty.text": "Этот игрок ещё не сохранил ни одного прогноза на этом турнире.",

  // --- Moje statystyki -----------------------------------------------------
  "myStats.tab.general": "Общее",
  "myStats.tab.accuracy": "Точность",
  "myStats.tab.form": "Форма",
  "myStats.tab.comparison": "Сравнение",
  "myStats.tab.analysis": "Анализ",
  "myStats.tab.style": "Стиль",
  "myStats.tab.trends": "Тренды",
  "myStats.loading": "Загрузка статистики",
  "myStats.loginText": "Статистика считается по твоим прогнозам, поэтому нужно знать, кто спрашивает.",
  "myStats.error": "Не удалось загрузить статистику",
  "myStats.errorText": "Не удалось загрузить статистику.",
  "myStats.kicker": "Твои данные",
  "myStats.title": "Моя статистика",
  "myStats.titleEvent": "Моя статистика — {event}",
  "myStats.intro": "Подробная сводка твоих прогнозов на этом турнире.",
  "myStats.empty.title": "Нечего показать",
  "myStats.empty.text": "У тебя пока нет прогнозов на матчи этого турнира. Статистика появится после первого сохранённого прогноза.",
  "myStats.rank": "Рейтинг",
  "myStats.noPointsYet": "подсчитанных очков пока нет",
  "myStats.points": "Очки",
  "myStats.pointsPerMatch": "Очки / матч",
  "myStats.profile": "Профиль",
  "myStats.steadyForm": "Стабильная форма",
  "myStats.picks": "Прогнозы",
  "myStats.settled": "Подсчитано: {count}",
  "myStats.winners": "Победители",
  "myStats.seriesExact": "Точный счёт серий",
  "myStats.maps": "Карты",
  "myStats.mapWinner": "Победитель: {hits}/{total}",
  "myStats.mapExact": "Точно: {hits}/{total}",
  "myStats.pointsSplit": "Серии: {value} очк.",
  "myStats.pointsSplitMaps": "Карты: {value} очк.",
  "myStats.matchWinner": "Победитель матча",
  "myStats.mapWinnerLabel": "Победитель карты",
  "myStats.mapExactLabel": "Точный счёт карты",
  "myStats.recent": "Последние матчи",
  "myStats.noData": "Нет данных",
  "myStats.last5": "Последние 5",
  "myStats.last10": "Последние 10",
  "myStats.currentStreak": "Текущая серия",
  "myStats.bestStreak": "Рекордная серия",
  "myStats.bestMatch": "Лучший матч",
  "myStats.average": "Среднее: {value}",
  "myStats.eventAverage": "Турнир: {value}%",
  "myStats.bestTeam": "Лучше всего угадана",
  "myStats.nemesis": "Немезида",
  "myStats.mostPicked": "Чаще всего выбирали",
  "myStats.mostOneSided": "Самый односторонний",
  "myStats.mostDivided": "Самый спорный",
  "myStats.popularScore": "Популярный счёт",
  "myStats.mapAccuracy": "Точность по картам",
  "myStats.averageError": "Средняя ошибка: {value}",
  "myStats.yourProfile": "Твой профиль",
  "myStats.contrarian": "Против большинства",
  "myStats.withMajority": "С большинством",
  "myStats.hits": "Угадано: {count}",
  "myStats.rarestHit": "Самый редкий угаданный прогноз",
  "myStats.trends": "Тренды",
  "myStats.notEnough": "Недостаточно данных",
  "myStats.settledOf": "Подсчитанных матчей: {count} / 4",
  "myStats.direction": "Направление",

  // --- Pojedynek dwoch graczy ----------------------------------------------
  "h2h.loading": "Считаю дуэль...",
  "h2h.error": "Не удалось загрузить сравнение",
  "h2h.errorText": "Не удалось загрузить сравнение.",
  "h2h.kicker": "Дуэль",
  "h2h.title": "{a} против {b}",
  "h2h.common": {
    one: "{count} общий матч на этом турнире",
    few: "{count} общих матча на этом турнире",
    many: "{count} общих матчей на этом турнире",
  },
  "h2h.backToProfile": "Назад к профилю",
  "h2h.nothingSettled": "Ни один общий матч ещё не подсчитан.",
  "h2h.lead": {
    one: "{name} ведёт на {count} матч при {ties} из {settled}.",
    few: "{name} ведёт на {count} матча при {ties} из {settled}.",
    many: "{name} ведёт на {count} матчей при {ties} из {settled}.",
  },
  "h2h.ties": {
    one: "{count} ничьей",
    few: "{count} ничьих",
    many: "{count} ничьих",
  },
  "h2h.settled": {
    one: "{count} общего матча",
    few: "{count} общих матчей",
    many: "{count} общих матчей",
  },
  "h2h.draw": {
    one: "Ничья после {count} общего матча.",
    few: "Ничья после {count} общих матчей.",
    many: "Ничья после {count} общих матчей.",
  },
  "h2h.sharedPoints": "Очки за общие матчи",
  "h2h.sharedPointsHint": "только из подсчитанных матчей",
  "h2h.tiesLabel": "Ничьи",
  "h2h.tiesHint": "одинаковые очки за матч",
  "h2h.samePick": "Тот же прогноз на серию",
  "h2h.samePickHint": "очки всё равно могут отличаться — решают карты",
  "h2h.pending": "Ещё не сыграны",
  "h2h.pendingHint": "выбраны обоими",
  "h2h.progress.kicker": "Ход дуэли",
  "h2h.progress.title": "Кто и когда оторвался",
  "h2h.progress.text": "Очки нарастающим итогом, только из общих матчей — от первого до последнего.",
  "h2h.stats.kicker": "Статистика",
  "h2h.stats.title": "Весь турнир",
  "h2h.stats.text": "Здесь считается всё, что каждый из них прогнозировал — включая матчи, которые другой не выбирал.",
  "h2h.row.points": "Очки в таблице",
  "h2h.row.rank": "Место в рейтинге",
  "h2h.row.accuracy": "Точность",
  "h2h.row.winners": "Угаданные победители",
  "h2h.row.exactSeries": "Точные счета серий",
  "h2h.row.exactMaps": "Точные карты",
  "h2h.row.correctMaps": "Угаданные карты",
  "h2h.row.streak": "Самая длинная серия",
  "h2h.row.perfect": "Полные попадания",
  "h2h.row.bestMatch": "Лучший матч",
  "h2h.empty.title": "Общих матчей нет",
  "h2h.empty.text": "Эти двое не выбрали ни одного общего матча на этом турнире, так что сравнивать нечего.",
  "h2h.matches.kicker": "Матч за матчем",
  "h2h.matches.title": "Общие прогнозы",
  "h2h.samePickShort": "тот же прогноз на серию",

  // --- Strony typowania faz ------------------------------------------------
  "pickem.loading": "Загрузка стадии",
  "pickem.saved": "Прогнозы сохранены ✅",
  "pickem.saveError": "Не удалось сохранить прогнозы.",
  "pickem.saving": "Сохраняю...",
  "pickem.save": "Сохранить прогнозы",
  "pickem.loginRequired": "Нужен вход",
  "pickem.loginCta": "Войди через Discord, чтобы делать прогнозы",
  "pickem.loadError": "Не удалось загрузить стадию",
  "pickem.lockedNow": "Прогнозы сейчас заблокированы.",
  "pickem.swiss.kicker": "Швейцарская стадия · {stage}",
  "pickem.swiss.stages": "Этапы швейцарской стадии",
  "pickem.swiss.loadError": "Не удалось загрузить Swiss Pick'Em.",
  "pickem.swiss.group30": "Баланс 3-0",
  "pickem.swiss.group03": "Баланс 0-3",
  "pickem.swiss.groupAdvancing": "Выход дальше",
  "pickem.swiss.desc30": {
    one: "Выбери ровно {count} команду с балансом 3-0.",
    few: "Выбери ровно {count} команды с балансом 3-0.",
    many: "Выбери ровно {count} команд с балансом 3-0.",
  },
  "pickem.swiss.desc03": {
    one: "Выбери ровно {count} команду с балансом 0-3.",
    few: "Выбери ровно {count} команды с балансом 0-3.",
    many: "Выбери ровно {count} команд с балансом 0-3.",
  },
  "pickem.swiss.descAdvancing": {
    one: "Выбери ровно {count} команду, которая пройдёт дальше.",
    few: "Выбери ровно {count} команды, которые пройдут дальше.",
    many: "Выбери ровно {count} команд, которые пройдут дальше.",
  },
  "pickem.teamsCount": {
    one: "{count} команда",
    few: "{count} команды",
    many: "{count} команд",
  },
  "pickem.playin.kicker": "Стадия турнира",
  "pickem.playin.loadError": "Не удалось загрузить Play-In Pick'Em.",
  "pickem.playin.pick": {
    one: "Выбери {count} команду, которая пройдёт из этой стадии",
    few: "Выбери {count} команды, которые пройдут из этой стадии",
    many: "Выбери {count} команд, которые пройдут из этой стадии",
  },
  "pickem.playoffs.kicker": "Плей-офф",
  "pickem.playoffs.loadError": "Не удалось загрузить Playoffs Pick'Em.",
  "pickem.step": "Шаг {no}",
  "pickem.playoffs.needSemis": "Сначала выбери полуфиналистов.",
  "pickem.playoffs.needFinalists": "Сначала выбери финалистов.",
  "pickem.playoffs.intro": "Прогнозируй сетку по порядку: полуфиналистов, финалистов, чемпиона и третье место. Каждый шаг сужает выбор в следующем.",
  "pickem.doubleElim.kicker": "Сетка двойного выбывания",
  "pickem.doubleElim.intro": "Укажи участников четырёх финалов. Уже использованная команда не возвращается в следующих группах.",
  "pickem.doubleElim.loadError": "Не удалось загрузить Double Elimination Pick'Em.",

  // --- Strona turnieju -----------------------------------------------------
  "event.backToList": "Назад к списку турниров",
  "event.kicker": "Турнир",
  "event.error": "Ошибка",
  "event.statsError": "Не удалось загрузить статистику турнира.",
  "event.statsLoading": "Загрузка статистики турнира...",
  "event.phaseLabel": "Стадия:",
  "event.statusLabel": "Статус:",
  "event.participantsLabel": "Участники:",
  "event.none": "нет",
  "event.status.open": "Открыто",
  "event.status.closed": "Закрыто",
  "event.status.finished": "Завершено",
  "event.intro": "Центр турнира — матчи, прогнозы, рейтинг и текущий ход турнира.",
  "event.archive": "Скачать архив (.xlsx)",
  "event.matchesCount": {
    one: "{count} матч",
    few: "{count} матча",
    many: "{count} матчей",
  },
  "event.finishedCount": {
    one: "{count} завершён",
    few: "{count} завершено",
    many: "{count} завершено",
  },
  "event.scheduledCount": {
    one: "{count} запланирован",
    few: "{count} запланировано",
    many: "{count} запланировано",
  },
  "event.picksCount": {
    one: "{count} прогноз",
    few: "{count} прогноза",
    many: "{count} прогнозов",
  },
  "event.stat.matches": "Матчи",
  "event.stat.participants": "Участники",
  "event.stat.predictions": "Сделано прогнозов",
  "event.stat.mapPredictions": "Прогнозы на карты",
  "event.stat.averagePoints": "Среднее число очков",
  "event.stat.exactMaps": "Точные карты",
  "event.stat.bestScore": "Лучший результат",
  "event.stat.mostExacts": "Больше всего точных",
  "event.stat.bestAccuracy": "Лучшая точность",
  "event.stat.correctOf": "{correct}/{total} угадано",
  "event.stat.favoriteTeam": "Любимец игроков",
  "event.summary.kicker": "Твой результат",
  "event.summary.title": "Твоя сводка по турниру",
  "event.summary.place": "Место",
  "event.summary.split": "Серия {series} · Карты {maps}",
  "event.summary.correctMatches": "Угаданные матчи",
  "event.summary.fullProfile": "Смотреть полный профиль →",
  "event.top.title": "Лидеры турнира",
  "event.top.place": "Место {no}",
  "event.close.kicker": "Самый равный",
  "event.close.title": "Матч, по которому сообщество разделилось сильнее всего",
  "event.upset.kicker": "Главная сенсация",
  "event.upset.title": "Сообщество просчиталось",
  "event.upset.winner": "ПОБЕДИТЕЛЬ",
  "event.upset.won": "выиграл {score}",
  "event.upset.nobody": "Никто не предсказал победителя",
  "event.upset.only": "Только {percent} предсказали победителя",
  "event.tile.matches": "Матчи",
  "event.tile.matchesHint": "Прогнозы BO1 / BO3 / BO5 · {matches} · {finished}",
  "event.tile.teamPicks": "Прогнозы на команды",
  "event.tile.myPicks": "Мои прогнозы",
  "event.tile.myPicksHint": "Посмотри свои сохранённые прогнозы · {picks}",
  "event.tile.myStats": "Моя статистика",
  "event.tile.myStatsHint": "Точность · форма · анализ · стиль · тренды",
  "event.tile.leaderboard": "Рейтинг",
  "event.tile.leaderboardHint": "Посмотри таблицу игроков · {players}",
  "event.phaseLink.settled": "Стадия подсчитана",
  "event.phaseLink.closed": "Стадия закрыта",
  "event.teamPick.saved": "прогноз сохранён, можно изменить",
  "event.teamPick.open": "открыто — сделай прогноз",
  "event.teamPick.settled": "подсчитано",
  "event.teamPick.closed": "закрыто",
  "event.nextMatch": "Следующий матч",
  "event.noNextMatch": "Матчей не запланировано",
  "event.goToMatch": "Перейти к матчу",
  "event.phases.kicker": "Турнир",
  "event.phases.title": "Стадии турнира",
  "event.phases.current": "Текущая стадия",
  "event.phases.none": "Активной стадии нет",

  // --- Strona meczu --------------------------------------------------------
  "match.backToList": "Назад к списку матчей",
  "match.loading": "Загрузка матча",
  "match.error": "Не удалось загрузить матч",
  "match.notFound": "Матч не найден.",
  "match.picksCount": {
    one: "{count} прогноз",
    few: "{count} прогноза",
    many: "{count} прогнозов",
  },
  "match.yourPick": "Твой прогноз",
  "match.seriesTitle": "Счёт серии BO{bo}",
  "match.seriesHint": "Сначала выбери счёт серии, затем впиши результаты отдельных карт.",
  "match.locked": "Прогнозы на этот матч заблокированы.",
  "match.loginToSave": "Войди через Discord, чтобы сохранить свой прогноз.",
  "match.savePick": "Сохранить прогноз",
  "match.checkingLogin": "Проверяю вход...",
  "match.saved": "Прогноз сохранён.",
  "match.bo1Title": "Кто победит?",
  "match.bo1Hint": "Укажи победителя и счёт по раундам.",
  "match.needLogin": "Сначала войди через Discord.",
  "match.needWinner": "Выбери победителя матча.",
  "match.badScore": "Укажи корректный счёт CS2.",
  "match.winnerMismatch": "Выбранный победитель не совпадает со счётом.",
  "match.needSeries": "Выбери счёт серии.",
  "match.badMapScore": "Укажи корректный счёт CS2 для каждой карты.",
  "match.seriesTooEarly": "Серия заканчивается раньше, чем следует из указанных карт.",
  "match.seriesMismatch": "Счета карт не совпадают с выбранным счётом серии.",
  "match.finished": "Матч завершён",
  "match.result.kicker": "Результат",
  "match.result.title": "Результат матча",
  "match.howYouDid": "Посмотри, как ты справился",
  "match.loginToSee": "Войди через Discord, чтобы увидеть свой сохранённый прогноз.",
  "match.yourScore": "Твой результат",
  "match.pointsEarned": "Набранные очки",
  "match.totalHint": "очков за этот матч",
  "match.seriesHintPoints": "за результат матча",
  "match.mapsHintPoints": "за результаты карт",
  "match.community.kicker": "Сообщество",
  "match.community.title": "Как прогнозировало сообщество?",
  "match.community.emptyTitle": "Никто не прогнозировал этот матч",
  "match.community.emptyText": "Прогнозы закрылись без единого сохранённого прогноза.",
  "match.community.total": "Прогнозов всего:",
  "match.community.popular": "Самый популярный счёт:",
  "match.community.mapsTitle": "Как прогнозировали карты?",
  "match.whatYouPicked": "Что ты выбрал",
  "match.noPick": "Ты не прогнозировал этот матч.",

  // --- Komunikaty serwera --------------------------------------------------
  // Serwer odpowiada polskim zdaniem i dokladkiem `code`. Kod
  // prowadzi tutaj, polskie zdanie zostaje zapasem dla klienta,
  // ktory kodu nie zna - patrz lib/apiMessages.js.
  "api.httpError": "Ошибка API: {status}",
  "server.dbError": "Ошибка базы данных.",
  "server.mustLogin": "Нужно войти в аккаунт.",
  "server.notMember": "Ты не состоишь на этом сервере.",
  "server.teamNotFound": "Команда не найдена.",
  "server.eventNotFound": "Турнир не найден.",
  "server.matchNotFound": "Матч не найден.",
  "server.backupNotFound": "Файл резервной копии не найден.",
  "server.badSwissStage": "Неверный этап Swiss.",
  "server.badStage": "Неверный этап.",
  "server.badStatus": "Неверный статус.",
  "server.badLockMode": "Неверный режим блокировки.",
  "server.badSeriesPick": "Неверный прогноз на серию.",
  "server.badCs2Score": "Некорректный счёт CS2.",
  "server.badWinner": "Неверный победитель.",
  "server.badBo": "BO должно быть 1, 3 или 5.",
  "server.badDefaultBo": "BO по умолчанию должно быть 1, 3 или 5.",
  "server.bo1OneMap": "BO1 должен содержать ровно одну карту.",
  "server.thirdFromSemis": "3-е место должно быть одним из полуфиналистов.",
  "server.thirdNotFinalist": "3-е место не может быть финалистом или победителем.",
  "server.finalistsFromSemis": "Финалисты должны быть из числа полуфиналистов.",
  "server.winnerIsFinalist": "Победитель должен быть финалистом.",
  "server.winnerFromFinalists": "Победитель должен быть одним из финалистов.",
  "server.phaseDeadlinePassed": "Дедлайн прогнозов для этой стадии прошёл.",
  "server.matchDeadlinePassed": "Дедлайн прогнозов на результаты матчей этой стадии прошёл.",
  "server.needTwoPlayers": "Для сравнения нужны два разных игрока.",
  "server.teamExists": "Команда с таким названием уже есть на этом сервере.",
  "server.teamsMustDiffer": "Команды должны быть разными.",
  "server.teamNameRequired": "Название команды обязательно.",
  "server.bothTeamsActive": "Обе команды должны существовать и быть активны на этом сервере.",
  "server.matchAlreadyFinished": "Матч уже завершён.",
  "server.eventAlreadyFinished": "Этот турнир уже завершён.",
  "server.matchPickingClosed": "Прогнозы на этот матч уже закрыты.",
  "server.mapNumbersSequential": "Номера карт должны идти подряд: 1, 2, 3...",
  "server.mapNumbersUnique": "Номера карт не могут повторяться.",
  "server.seriesEndsEarly": "Серия заканчивается слишком рано для указанных карт.",
  "server.winnerMismatch": "Выбранный победитель не совпадает со счётом.",
  "server.mapsMismatch": "Счета карт не совпадают со счётом серии.",
  "server.scoresNonNegative": "Счета должны быть неотрицательными целыми числами.",
  "server.eventChanged": "Состояние турнира изменилось. Обнови страницу и попробуй снова.",
  "server.phaseAndMatchesRequired": "Требуются: стадия и список матчей.",
  "server.nothingToCreate": "Нечего создавать — ни одна строка не прошла проверку.",
  "server.noValidIds": "Ни один из указанных идентификаторов не корректен.",
  "server.idsArray": "ids должен быть непустым массивом идентификаторов.",
  "server.orderedIdsArray": "orderedIds должен быть непустым массивом.",
  "server.phasesArray": "fazy должен быть непустым массивом.",
  "server.entriesArray": "entries должен быть непустым массивом { nickname, teamName }.",
  "server.permissionCheckFailed": "Не удалось проверить права.",
  "server.visitsFailed": "Не удалось загрузить счётчик посещений.",
  "server.matchLoadFailed": "Не удалось загрузить матч.",
  "server.archiveFailed": "Не удалось подготовить архив.",
  "server.archiveLoadFailed": "Не удалось загрузить архив.",
  "server.matchDeleteFailed": "Не удалось удалить матч.",
  "server.matchesCreateFailed": "Не удалось создать матчи.",
  "server.matchSaveFailed": "Не удалось сохранить изменения в матче.",
  "server.myPicksFailed": "Не удалось загрузить твои прогнозы.",
  "server.teamsLoadFailed": "Не удалось загрузить команды.",
  "server.teamLoadFailed": "Не удалось загрузить команду.",
  "server.h2hFailed": "Не удалось загрузить сравнение.",
  "server.pointsLoadFailed": "Не удалось загрузить очки.",
  "server.swissStatsFailed": "Не удалось загрузить статистику Swiss.",
  "server.pickLoadFailed": "Не удалось загрузить прогноз.",
  "server.pickSaveFailed": "Не удалось сохранить прогноз.",
  "server.swissPicksLoadFailed": "Не удалось загрузить прогнозы Swiss.",
  "server.swissPicksSaveFailed": "Не удалось сохранить прогнозы Swiss.",
  "server.playinPicksLoadFailed": "Не удалось загрузить прогнозы Play-In.",
  "server.playinPicksSaveFailed": "Не удалось сохранить прогнозы Play-In.",
  "server.playoffsPicksLoadFailed": "Не удалось загрузить прогнозы Playoffs.",
  "server.playoffsPicksSaveFailed": "Не удалось сохранить прогнозы Playoffs.",
  "server.dePicksLoadFailed": "Не удалось загрузить прогнозы Double Elimination.",
  "server.dePicksSaveFailed": "Не удалось сохранить прогнозы Double Elimination.",
  "server.allTimeFailed": "Не удалось загрузить общий зачёт.",
  "server.upsetsFailed": "Не удалось загрузить сенсации.",
  "server.playerNotFound": "Игрок не найден.",
  "server.playerCareerFailed": "Не удалось загрузить профиль игрока.",
  "server.mvpVoteFailed": "Не удалось загрузить голосование за MVP.",
  "server.mapsFailed": "Не удалось загрузить статистику карт.",
  "server.matchMissing": "Матча не существует",
  "server.noSuchEvent": "Такого турнира нет.",
  "server.notFound": "Не найдено.",
  "server.proposalMissing": "Предложения не существует",
  "server.needAdmin": "Нужны права администратора на этом сервере.",
  "server.candidateIdRequired": "Требуется идентификатор кандидата.",
  "server.teamOneSlot": "Команда не может занимать больше одного места",
  "server.backupFailed": "Не удалось создать копию",
  "server.backupListFailed": "Не удалось получить список копий",
  "server.endTournamentFailed": "Не удалось завершить турнир",
  "server.finalistsMustBeSemis": "Финалисты должны быть полуфиналистами",
  "server.badBackupName": "Неверное имя файла копии",
  "server.badThirdPlace": "Неверное третье место",
  "server.noTeamsSelected": "Команды не выбраны",
  "server.noValidCandidates": "Не передано ни одного корректного кандидата",
  "server.restoreFailed": "Не удалось восстановить",

  // --- Komunikaty serwera - blokady i powody -------------------------------
  "server.lock.matchFinished": "Матч завершён.",
  "server.lock.matchesClosed": "Прогнозы на матчи сейчас закрыты.",
  "server.lock.matchLocked": "Матч заблокирован.",
  "server.lock.phaseClosed": "Прогнозы на эту стадию закрыты.",
  "server.lock.swissClosed": "Прогнозы Swiss закрыты.",
  "server.lock.playinClosed": "Прогнозы Play-In закрыты.",
  "server.lock.playoffsClosed": "Прогнозы Playoffs закрыты.",
  "server.lock.deClosed": "Прогнозы Double Elimination закрыты.",
  "server.stale.swiss": "Эта форма относится к прошлому турниру. Открой актуальный Swiss.",
  "server.stale.playin": "Эта форма относится к прошлому турниру. Открой актуальный Play-In.",
  "server.stale.playoffs": "Эта форма относится к прошлому турниру. Открой актуальный Playoffs.",
  "server.stale.de": "Эта форма относится к прошлому турниру. Открой актуальную панель Double Elimination.",
  "server.frozen.eventOver": "турнир завершён",
  "server.frozen.hasPicks": "уже есть прогнозы или результат",
  "server.archiveNotReady": "Архив создаётся после окончания турнира. Этот ещё идёт.",
  "server.noProvider": "Поставщик результатов не настроен (RESULT_PROVIDER в server/.env)",
  "server.noActiveTeams": "На этом сервере нет ни одной активной команды. Сначала добавь их на странице Команды (там есть импорт из JSON).",
  "server.teamsMustExist": "Команды должны существовать и быть активными. Добавь недостающие на странице Команды или поправь названия в списке.",
  "server.phasesFrozen": "Эти стадии нельзя изменить: {phases}",
  "server.noChannel": "Непонятно, в каком канале опубликовать панель. {hint}",
  "server.archivedScoring": "Правила начисления за карты изменились после его окончания — пересчёт переписал бы закрытый рейтинг. Если действительно этого хочешь, сначала отмени архивацию.",
  "server.notStarted": "не начат",

  // --- Klasyfikacja wszech czasow ------------------------------------------
  "allTime.nav": "Общий зачёт",
  "allTime.kicker": "Поверх турниров",
  "allTime.title": "Общий зачёт",
  "allTime.intro": "Кто прогнозирует лучше всех за всё время, а не на одном турнире. Место определяется средней позицией в общей массе, а не суммой очков — они несопоставимы между турнирами с разным числом матчей.",
  "allTime.loading": "Считаю зачёт...",
  "allTime.error": "Не удалось загрузить зачёт",
  "allTime.ranked": {
    one: "{count} игрок с сопоставимым результатом",
    few: "{count} игрока с сопоставимым результатом",
    many: "{count} игроков с сопоставимым результатом",
  },
  "allTime.head.player": "Игрок",
  "allTime.head.starts": "Старты",
  "allTime.head.best": "Лучший старт",
  "allTime.head.average": "В среднем",
  "allTime.starts": {
    one: "{count} старт",
    few: "{count} старта",
    many: "{count} стартов",
  },
  // Ta sama liczba, ktora profil gracza pokazuje przy kazdym
  // starcie jako "TOP x%" - i to nie jest przypadek, patrz
  // server/lib/allTime.js.
  "allTime.average": "ТОП {percent}%",
  "allTime.bestPlace": "#{rank} / {total}",
  "allTime.empty.title": "Слишком мало турниров",
  "allTime.empty.text": {
    one: "Зачёт охватывает игроков минимум с {count} стартом. Он появится, когда кто-нибудь сыграет на двух турнирах.",
    few: "Зачёт охватывает игроков минимум с {count} стартами. Он появится, когда кто-нибудь сыграет на двух турнирах.",
    many: "Зачёт охватывает игроков минимум с {count} стартами. Он появится, когда кто-нибудь сыграет на двух турнирах.",
  },
  "allTime.note": {
    one: "В таблице игроки минимум с {count} стартом. Одного турнира мало, чтобы отличить мастерство от везения — тебе не хватает одного старта.",
    few: "В таблице игроки минимум с {count} стартами. Одного турнира мало, чтобы отличить мастерство от везения — тебе не хватает одного старта.",
    many: "В таблице игроки минимум с {count} стартами. Одного турнира мало, чтобы отличить мастерство от везения — тебе не хватает одного старта.",
  },

  // --- Niespodzianki -------------------------------------------------------
  "upsets.nav": "Сенсации",
  "upsets.kicker": "Когда ошибались почти все",
  "upsets.title": "Сенсации",
  "upsets.intro": "Матчи, в которых победителя выбрали меньше {percent}% участников. Остальной сайт показывает, кто был прав, — здесь видно моменты, когда прав не был почти никто.",
  "upsets.loading": "Ищу сенсации...",
  "upsets.error": "Не удалось загрузить сенсации",
  "upsets.counted": {
    one: "{count} матч прошёл вопреки большинству",
    few: "{count} матча прошли вопреки большинству",
    many: "{count} матчей прошли вопреки большинству",
  },
  "upsets.head.match": "Матч",
  "upsets.head.where": "Где",
  "upsets.head.share": "Угадали",
  "upsets.head.player": "Игрок",
  "upsets.head.hits": "Попадания",
  "upsets.head.rate": "Точность",
  "upsets.head.team": "Команда",
  "upsets.head.judgement": "Оценка",
  "upsets.head.gap": "Разница",
  // Same liczby i ukosnik - czyta sie tak samo we wszystkich
  // pieciu jezykach. Ten sam zabieg, co przy allTime.bestPlace,
  // i z tego samego powodu: .ui-badge robi uppercase, wiec kazdy
  // przyimek w srodku zaczyna krzyczec.
  "upsets.hits": "{hits} / {total}",
  "upsets.share": "{percent}%",
  "upsets.note": {
    one: "Учитываются матчи минимум с {count} прогнозом — среди трёх человек «никто не угадал» не значит ничего. Граница сенсации — {percent}% попаданий.",
    few: "Учитываются матчи минимум с {count} прогнозами — среди трёх человек «никто не угадал» не значит ничего. Граница сенсации — {percent}% попаданий.",
    many: "Учитываются матчи минимум с {count} прогнозами — среди трёх человек «никто не угадал» не значит ничего. Граница сенсации — {percent}% попаданий.",
  },
  "upsets.empty.title": "Фавориты не подвели",
  "upsets.empty.text": "Пока нет матча, в котором победителя выбрали бы меньше {percent}% участников. Он появится здесь сам, как только случится.",
  "upsets.people.kicker": "Против течения",
  "upsets.people.title": "Кто угадывает вопреки всем",
  "upsets.people.intro": "В этих матчах средний участник угадывал в {percent}% случаев. Ниже те, кому удавалось чаще — и не за счёт одного удачного решения.",
  // Zakres "od jednej do trzydziestu trzech" to liczba zmierzona
  // na produkcji, a nie figura retoryczna - patrz naglowek
  // server/lib/upsets.js.
  "upsets.people.note": {
    one: "В таблице игроки минимум с {count} возможностью, то есть с таким числом матчей из этого списка, которые они прогнозировали. Место определяет точность, а не число попаданий: возможностей бывает от одной до тридцати трёх, поэтому одно лишь число награждало бы частую игру.",
    few: "В таблице игроки минимум с {count} возможностями, то есть с таким числом матчей из этого списка, которые они прогнозировали. Место определяет точность, а не число попаданий: возможностей бывает от одной до тридцати трёх, поэтому одно лишь число награждало бы частую игру.",
    many: "В таблице игроки минимум с {count} возможностями, то есть с таким числом матчей из этого списка, которые они прогнозировали. Место определяет точность, а не число попаданий: возможностей бывает от одной до тридцати трёх, поэтому одно лишь число награждало бы частую игру.",
  },
  "upsets.teams.kicker": "Доверие и результат",
  "upsets.teams.title": "Переоценённые и недооценённые команды",
  "upsets.teams.intro": "Доверие — это доля прогнозов на команду, а точность — доля выигранных ею матчей. Положительная разница означает команду, которой доверяют больше, чем она заслуживает.",
  "upsets.teams.trust": "Доверие {percent}%",
  "upsets.teams.wins": "Выигрывает {percent}%",
  "upsets.teams.note": {
    one: "В таблице команды минимум с {count} сыгранным матчем. При одном матче доверие и точность равны нулю или ста процентам, а разница между ними не говорит о команде ничего.",
    few: "В таблице команды минимум с {count} сыгранными матчами. При одном матче доверие и точность равны нулю или ста процентам, а разница между ними не говорит о команде ничего.",
    many: "В таблице команды минимум с {count} сыгранными матчами. При одном матче доверие и точность равны нулю или ста процентам, а разница между ними не говорит о команде ничего.",
  },

  // --- Profil gracza ponad turniejami --------------------------------------
  "career.kicker": "Поверх турниров",
  "career.loading": "Загружаю достижения...",
  "career.error": "Не удалось загрузить профиль",
  "career.played": {
    one: "{count} старт за историю сайта",
    few: "{count} старта за историю сайта",
    many: "{count} стартов за историю сайта",
  },
  "career.noStarts": "Пока без места ни в одном зачёте",
  "common.percentValue": "{percent}%",
  "career.stat.average": "В среднем",
  "career.stat.averageHint": "место в общей массе",
  "career.stat.best": "Лучший старт",
  "career.stat.bestValue": "#{rank} / {total}",
  "career.stat.bestHint": "нет зачётного старта",
  "career.stat.points": "Очки",
  "career.stat.pointsHint": "за все турниры вместе",
  "career.stat.contra": "Против всех",
  "career.stat.contraHint": "{hits} из {total} сенсаций",
  "career.stat.contraNone": "ни один матч не удивил всех",
  "career.contraShort": {
    one: "До таблицы «кто угадывает вопреки всем» не хватает ещё {count} возможности - матча, в котором ошиблось большинство.",
    few: "До таблицы «кто угадывает вопреки всем» не хватает ещё {count} возможностей - матчей, в которых ошиблось большинство.",
    many: "До таблицы «кто угадывает вопреки всем» не хватает ещё {count} возможностей - матчей, в которых ошиблось большинство.",
  },
  "career.starts.kicker": "Турнир за турниром",
  "career.starts.title": "Все старты",
  "career.starts.count": {
    one: "{count} турнир",
    few: "{count} турнира",
    many: "{count} турниров",
  },
  // Doklejane do "history.count", dlatego zaczyna sie od myslnika
  // ze spacjami - komponent sklada oba napisy bez separatora.
  "career.starts.hint": " — нажми, чтобы открыть профиль с того турнира.",
  "career.teams.kicker": "Кому доверяет",
  "career.teams.title": "На кого ставит",
  "career.teams.intro": "Команды, на которые ставят чаще всего, и рядом то, как часто они выигрывали. Сначала та, на которую ставят охотнее всего, — точность лишь отвечает, заслуженно ли.",
  "career.teams.head.team": "Команда",
  "career.teams.head.record": "Баланс",
  "career.teams.head.rate": "Побед",
  // Same liczby i ukosnik - ten sam zabieg, co przy upsets.hits
  // i allTime.bestPlace, i z tego samego powodu: .ui-badge robi
  // uppercase, wiec kazdy przyimek w srodku zaczyna krzyczec.
  "career.teams.record": "{wins} / {picks}",
  "career.teams.empty": {
    one: "Ни одна команда пока не набрала {count} прогноза от этого игрока — всего прогнозов на матчи {picks}.",
    few: "Ни одна команда пока не набрала {count} прогнозов от этого игрока — всего прогнозов на матчи {picks}.",
    many: "Ни одна команда пока не набрала {count} прогнозов от этого игрока — всего прогнозов на матчи {picks}.",
  },

  // --- Glosowanie na MVP ---------------------------------------------------
  "mvp.kicker": "Голос сообщества",
  "mvp.title": "Кого прочили в MVP",
  "mvp.resolved": "Победил {nickname}, угадали {percent}% голосовавших.",
  "mvp.open": {
    one: "Отдан {count} голос. Победитель ещё не назван.",
    few: "Отдано {count} голоса. Победитель ещё не назван.",
    many: "Отдано {count} голосов. Победитель ещё не назван.",
  },
  "mvp.head.player": "Кандидат",
  "mvp.head.votes": "Голоса",
  "mvp.head.share": "Доля",
  "mvp.votes": {
    one: "{count} голос",
    few: "{count} голоса",
    many: "{count} голосов",
  },
  "mvp.note": {
    one: "Посчитано с {count} отданного голоса. В списке кандидаты хотя бы с одним голосом и победитель — даже без единого.",
    few: "Посчитано с {count} отданных голосов. В списке кандидаты хотя бы с одним голосом и победитель — даже без единого.",
    many: "Посчитано с {count} отданных голосов. В списке кандидаты хотя бы с одним голосом и победитель — даже без единого.",
  },
  "upsets.mvp.kicker": "Не всякая ошибка — это матч",
  "upsets.mvp.headline": "В голосовании за MVP угадали {percent}% — победил {nickname}, за него было {votes} из {total} человек.",

  // --- Czytanie wynikow map ------------------------------------------------
  "maps.nav": "Карты",
  "maps.kicker": "Раунды, а не карты",
  "maps.title": "Как мы читаем счёт карт",
  "maps.intro": "Прогнозируя карту, называешь счёт в раундах. Сопоставление этих прогнозов с тем, что произошло на деле, говорит о сообществе одну конкретную вещь — и не ту, которую можно было бы ожидать.",
  "maps.loading": "Считаю карты...",
  "maps.error": "Не удалось загрузить статистику карт",
  "maps.stat.predicted": "Прогнозируемый разрыв",
  "maps.stat.predictedHint": "раундов между командами",
  "maps.stat.actual": "Фактический разрыв",
  "maps.stat.actualHint": "столько выходит на деле",
  "maps.lead": {
    one: "Сообщество прогнозирует карты ПЛОТНЕЕ, чем они выходят: в среднем {predicted} раунда разницы против {actual} на деле. Посчитано с {count} рассчитанного прогноза.",
    few: "Сообщество прогнозирует карты ПЛОТНЕЕ, чем они выходят: в среднем {predicted} раунда разницы против {actual} на деле. Посчитано с {count} рассчитанных прогнозов.",
    many: "Сообщество прогнозирует карты ПЛОТНЕЕ, чем они выходят: в среднем {predicted} раунда разницы против {actual} на деле. Посчитано с {count} рассчитанных прогнозов.",
  },
  "maps.dist.kicker": "Прогноз рядом с реальностью",
  "maps.dist.title": "Самые частые счета",
  "maps.dist.intro": "То, что вписывают чаще всего, рядом с тем, что чаще всего происходит. Полосы масштабированы к самому частому счёту в своём наборе, чтобы можно было сравнить форму обоих.",
  "maps.dist.predicted": "Прогнозы",
  "maps.dist.actual": "Фактически",
  "maps.readers.kicker": "Кто читает точнее всех",
  "maps.readers.title": "Чтение карт",
  "maps.readers.intro": "Место определяет отклонение от счёта — то самое, на чём держится подсчёт очков за карты. МЕНЬШЕ значит лучше.",
  "maps.readers.head.player": "Игрок",
  "maps.readers.head.record": "Баланс",
  "maps.readers.head.deviation": "Отклонение",
  "maps.readers.picks": {
    one: "{count} рассчитанный прогноз",
    few: "{count} рассчитанных прогноза",
    many: "{count} рассчитанных прогнозов",
  },
  "maps.readers.winners": "Победитель {percent}%",
  "maps.readers.exact": {
    one: "{count} точный",
    few: "{count} точных",
    many: "{count} точных",
  },
  "maps.readers.note": {
    one: "В таблице игроки минимум с {count} рассчитанным прогнозом на карту — примерно столько даёт один турнир целиком.",
    few: "В таблице игроки минимум с {count} рассчитанными прогнозами на карты — примерно столько даёт один турнир целиком.",
    many: "В таблице игроки минимум с {count} рассчитанными прогнозами на карты — примерно столько даёт один турнир целиком.",
  },
  "maps.noNames": "Здесь ничего нет о конкретных картах, потому что названия карты в данных нет — прогнозы и результаты хранят только номер карты в серии. Номер тоже ничего не говорит: точность на первой, второй и третьей выходит 54%, 56% и 55%, так что решающая карта не сложнее стартовой.",
  "maps.empty.title": "Нет рассчитанных карт",
  "maps.empty.text": "Страница строится из прогнозов на карты, у которых есть результат. Она появится, как только первые карты будут рассчитаны.",

  // --- Rywale gracza w turnieju --------------------------------------------
  // Rywale gracza w turnieju.
  //
  // Pojedynek dwoch graczy istnial od dawna, ale wchodzilo sie w niego
  // z JEDNEGO miejsca i trzeba bylo wiedziec, czyj profil otworzyc.
  // Ta sekcja odpowiada na pytanie, ktore pada wczesniej: z kim wlasciwie
  // ten gracz sie sciga.
  "rivals.kicker": "Кто прогнозирует то же самое",
  "rivals.title": "Соперники",
  "rivals.intro": "Игроки, которые прогнозировали те же матчи. Учитывается только то, что прогнозировали оба и что уже рассчитано — матч, пропущенный одним из них, ничего не говорит о преимуществе.",
  "rivals.loading": "Расчёт соперников...",
  "rivals.error": "Не удалось загрузить соперников.",
  "rivals.head.player": "Соперник",
  "rivals.head.record": "Баланс",
  // Remisy maja wlasna liczbe, bo jest ich duzo: zmierzone na produkcji
  // to 48% wspolnych meczow. Za 60% typow nie ma zadnych punktow,
  // a dwa zera to remis - wiec bez tej liczby bilans 34-14 przy stu
  // wspolnych meczach wygladalby na blad.
  "rivals.ties": {
    one: "{count} ничья",
    few: "{count} ничьи",
    many: "{count} ничьих",
  },
  "rivals.sharedCount": {
    one: "{count} общий матч",
    few: "{count} общих матча",
    many: "{count} общих матчей",
  },
  // Odznaki, nie osobne kafelki: ten sam czlowiek bywa jednoczesnie
  // najczestszym i najrowniejszym rywalem.
  "rivals.badge.most": "самый частый",
  "rivals.badge.closest": "самый ровный",
  "rivals.badge.best": "наибольшее преимущество",
  "rivals.badge.worst": "наибольшее отставание",
  "rivals.duel": "Дуэль",
  "rivals.more": {
    one: "…и ещё {count} соперник",
    few: "…и ещё {count} соперника",
    many: "…и ещё {count} соперников",
  },
  "rivals.empty.none": "У этого игрока пока нет рассчитанных прогнозов в этом турнире, поэтому сравнивать не с чем.",
  "rivals.empty.tooFew": {
    one: "Ни у кого нет с этим игроком даже {count} рассчитанного общего матча — этого мало, чтобы баланс что-то значил.",
    few: "Ни у кого нет с этим игроком даже {count} рассчитанных общих матчей — этого мало, чтобы баланс что-то значил.",
    many: "Ни у кого нет с этим игроком даже {count} рассчитанных общих матчей — этого мало, чтобы баланс что-то значил.",
  },
  "rivals.note": {
    one: "Баланс считается по матчам, рассчитанным МЕЖДУ двумя игроками. Ничьи — одинаковое число очков за матч — считаются отдельно, потому что их почти половина от всех общих матчей. Соперник попадает в список от {count} такого матча.",
    few: "Баланс считается по матчам, рассчитанным МЕЖДУ двумя игроками. Ничьи — одинаковое число очков за матч — считаются отдельно, потому что их почти половина от всех общих матчей. Соперник попадает в список от {count} таких матчей.",
    many: "Баланс считается по матчам, рассчитанным МЕЖДУ двумя игроками. Ничьи — одинаковое число очков за матч — считаются отдельно, потому что их почти половина от всех общих матчей. Соперник попадает в список от {count} таких матчей.",
  },

  // --- Wynik turnieju ------------------------------------------------------
  // Wynik turnieju na stronie turnieju.
  //
  // Mistrz lezal w playoffs_results od poczatku, ale pokazywal go
  // wylacznie komponent PhaseResults na stronach TYPOWANIA fazy - mozna
  // bylo otworzyc strone IEM Cologne Major 2026 i nie dowiedziec sie,
  // ze wygraly Falcons.
  "outcome.kicker": "Чем всё закончилось",
  "outcome.title": "Итог турнира",
  "outcome.intro": "Кто победил — и сколько игроков это предсказало. Проценты считаются от прогнозов на плей-офф, а не от всех участников турнира.",
  // Etykieta plus nazwa, nigdy zdanie z nazwa w srodku. Nazwy druzyn to
  // wolny tekst z bazy, wiec "Falcons pokonali FURIE" wymagaloby biernika,
  // ktorego nie da sie zbudowac ani po polsku, ani po rosyjsku.
  "outcome.champion": "Чемпион",
  "outcome.runnerUp": "Финалист",
  "outcome.semis": {
    one: "Полуфиналист",
    few: "Полуфиналисты",
    many: "Полуфиналисты",
  },
  "outcome.third": "Третье место",
  "outcome.called.title": "Кто это предсказал",
  "outcome.called.winner": "Угадан чемпион",
  "outcome.called.finalists": "Оба финалиста",
  "outcome.called.semifinalists": "Все четыре полуфиналиста",
  "outcome.favourite": "Фаворит сообщества",
  // Dopisek przy faworycie, nie osobne zdanie - doklejany po nazwie
  // i procencie, wiec dziala bez odmiany. Zmierzone: Krakow trafil
  // (Vitality 80%), Cologne i Budapeszt nie (Spirit 42%, Furia 57%).
  "outcome.favourite.hit": "так и вышло",
  "outcome.favourite.miss": "но победил другой",
  "outcome.note": {
    one: "Основа — {count} прогноз на плей-офф в этом турнире. Тот, кто плей-офф не прогнозировал, в эти проценты не попадает, даже если прогнозировал матчи.",
    few: "Основа — {count} прогноза на плей-офф в этом турнире. Тот, кто плей-офф не прогнозировал, в эти проценты не попадает, даже если прогнозировал матчи.",
    many: "Основа — {count} прогнозов на плей-офф в этом турнире. Тот, кто плей-офф не прогнозировал, в эти проценты не попадает, даже если прогнозировал матчи.",
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
  "swissPicks.kicker": "На что ставило сообщество",
  "swissPicks.title": "Прогнозы на этапы",
  "swissPicks.intro": "Статистика команд на этом сайте считает только матчи. Это вторая половина того, что сообщество думает о командах — прогнозы на 3-0, на 0-3 и на выход, сопоставленные с тем, что произошло на самом деле.",
  "swissPicks.loading": "Загрузка прогнозов на этапы...",
  "swissPicks.errorText": "Не удалось загрузить прогнозы на этапы.",
  "swissPicks.back": "Назад к турниру",
  "swissPicks.link": "Прогнозы на этапы Swiss",
  "swissPicks.group.threeZero": "Кто пройдёт 3-0",
  "swissPicks.group.zeroThree": "Кто вылетит 0-3",
  "swissPicks.group.advancing": "Кто выйдет дальше",
  "swissPicks.total": {
    one: "{count} прогнозист",
    few: "{count} прогнозиста",
    many: "{count} прогнозистов",
  },
  "swissPicks.correct": "верно",
  // Najmocniej obstawiona druzyna, ktora NIE byla poprawna odpowiedzia.
  // Zmierzone: GamerLegion 84% na 3-0, THUNDER dOWNUNDER 76% na 0-3,
  // B8 71% na awans - zadna nie wyszla.
  "swissPicks.overrated": "Верная ставка, которая не сыграла",
  // Druga polowa tej historii: poprawne odpowiedzi, ktorych tlum nie
  // widzial. Lynn Vision Gaming 1% na 0-3, FlyQuest 1% na 3-0,
  // SINNERS 2% na 0-3 - wszystkie trzy trafione.
  "swissPicks.missed": {
    one: "{count} незамеченный ответ",
    few: "{count} незамеченных ответа",
    many: "{count} незамеченных ответов",
  },
  "swissPicks.pending": "У этого этапа ещё нет официального результата, поэтому виден только расклад голосов.",
  "swissPicks.note": {
    one: "Незамеченным считается верный ответ, который указали менее {count}% прогнозистов. В списке стоит верхушка каждой группы и КАЖДЫЙ верный ответ, в том числе выпавший за верхушку — именно о нём эта страница.",
    few: "Незамеченным считается верный ответ, который указали менее {count}% прогнозистов. В списке стоит верхушка каждой группы и КАЖДЫЙ верный ответ, в том числе выпавший за верхушку — именно о нём эта страница.",
    many: "Незамеченным считается верный ответ, который указали менее {count}% прогнозистов. В списке стоит верхушка каждой группы и КАЖДЫЙ верный ответ, в том числе выпавший за верхушку — именно о нём эта страница.",
  },
  "swissPicks.empty.title": "В этом турнире не было этапов Swiss",
  "swissPicks.empty.text": "Не в каждом формате есть этап Swiss — бывает плей-ин или сетка с двойным выбыванием. Эта страница появляется только там, где были прогнозы на этапы Swiss.",

  // --- Odnosniki do wyniku turnieju i rywali -------------------------------
  // Lista turniejow pokazywala same nazwy w kafelkach, wiec zakonczony
  // turniej nie mowil o sobie nic. Mistrz z procentem trafien robi
  // z listy cos, co da sie czytac - i sam prowadzi na strone turnieju.
  //
  // Etykieta obok nazwy, nigdy zdanie z nazwa w srodku: nazwy druzyn to
  // wolny tekst z bazy i nie da sie ich odmienic.
  "events.outcome.champion": "Чемпион",
  "events.outcome.called": "угадали {percent}%",
  // Sekcja rywali siedzi na profilu gracza, czyli dwa klikniecia od
  // rankingu - i nic w rankingu nie mowilo, ze cos takiego istnieje.
  // Odnosnik pokazuje sie tylko zalogowanemu, bo tylko wtedy wiadomo,
  // czyich rywali pokazac.
  "leaderboard.myRivals": "Мои соперники",

  // --- Strona serwera ------------------------------------------------------
  // Strona pojedynczej spolecznosci.
  //
  // Zmierzone: serwis obsluguje DWIE spolecznosci z turniejami, nie jedna.
  // 848 graczy wylacznie na jednej, 221 wylacznie na drugiej, 41 w obu -
  // a cala strona mieszala ich turnieje w jednej liscie.
  "server.kicker": "Сообщество",
  "server.intro": "Турниры этого сообщества и его собственная верхушка. Сайт обслуживает несколько серверов Discord сразу — здесь только данные одного.",
  "server.loading": "Загрузка сервера...",
  "server.errorText": "Не удалось загрузить этот сервер.",
  "server.back": "На главную",
  "server.stats.events": "Турниры",
  "server.stats.participants": "Прогнозисты",
  "server.stats.predictions": "Сделано прогнозов",
  "server.top.kicker": "Лучшие в этом сообществе",
  "server.top.title": "Верхушка сервера",
  "server.top.intro": "Порядок определяет среднее место в общем зачёте, а не сумма очков — турниры бывают разного размера, и очки из них несопоставимы. МЕНЬШЕ значит лучше.",
  // Prog dopasowany do serwera, nie sztywne dwa starty.
  //
  // Klasyfikacja wszech czasow wymaga dwoch startow i slusznie. Ale serwer
  // z jednym turniejem nie ma nikogo z dwoma - zmierzone, 221 graczy nie
  // moglo tam wejsc i nie zalezalo to od nich, tylko od tego, ile turniejow
  // zrobil ich serwer.
  "server.top.note": {
    one: "В верхушке игроки минимум с {count} стартом в этом сообществе. Порог ниже, чем в зачёте всех времён, потому что у сервера с одним турниром ещё нет никого с двумя стартами.",
    few: "В верхушке игроки минимум с {count} стартами в этом сообществе. Порог ниже, чем в зачёте всех времён, потому что у сервера с одним турниром ещё нет никого с двумя стартами.",
    many: "В верхушке игроки минимум с {count} стартами в этом сообществе. Порог ниже, чем в зачёте всех времён, потому что у сервера с одним турниром ещё нет никого с двумя стартами.",
  },
  "server.events.title": "Турниры этого сообщества",
  "server.empty.title": "На этом сервере ещё не было турнира",
  "server.empty.text": "Бот здесь есть, но прогнозы ещё никто не открыл. Страница заполнится с первым турниром.",
  "home.servers.view": "Открыть сервер",

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
  "deadline.closesAt": "Приём прогнозов закрывается {date}",
  "deadline.passedAt": "Срок истёк {date}",

  // --- Typy na fazy na stronie druzyny -------------------------------------
  // teamStats.js mowi wprost, ze liczy WYLACZNIE mecze. To jest druga
  // polowa - ta sama wiedza zebrana wokol druzyny.
  //
  // Zmierzone: GamerLegion typowana na awans 484 razy, trafnie 11%;
  // PARIVISION 347 razy, trafnie 87%; Imperial skazywana na 0-3 285 razy
  // i ANI RAZU sluszne, a na awans 76 razy przy 95% trafnosci.
  "team.phase.kicker": "Помимо матчей",
  "team.phase.title": "Прогнозы на этапы",
  "team.phase.intro": "Статистика выше считает только матчи. Здесь то, что сообщество говорило об этой команде на этапах турнира — и как часто оказывалось право.",
  "team.phase.advance": "Прогнозировали выход",
  "team.phase.threeZero": "Прогнозировали 3-0",
  "team.phase.zeroThree": "Списывали на 0-3",
  "team.phase.hit": "верно {percent}%",
  "team.phase.picks": {
    one: "{count} раз",
    few: "{count} раза",
    many: "{count} раз",
  },
  "team.phase.unsettled": "этап без результата",
  "teams.noMatches": "Только прогнозы на этапы",
  // Siedem druzyn gralo wylacznie w StarLadder Budapest 2025, ktory nie
  // ma w bazie ani jednego meczu - do tej pory nie istnialy na stronie
  // wcale, mimo setek ocen.
  "team.phaseOnly.title": "Эта команда не сыграла у нас ни одного матча",
  "team.phaseOnly.text": "Она играла на турнире, от которого в базе нет ни одного матча — остались только прогнозы на этапы. Поэтому здесь нет ни статистики матчей, ни их истории.",

  // --- Profil gracza - punkty z faz ----------------------------------------
  // Dymek nad punktem wykresu. Stala tu polska sklejka na sztywno,
  // wiec „Mecz 3" pokazywalo sie tak samo w pieciu jezykach.
  "chart.point.match": "Матч {n}",
  // Os moze stac na etapach zamiast na meczach - w turnieju bez ani
  // jednego meczu w bazie „Mecz 3" byloby zwyczajnie nieprawda.
  "chart.point.phase": "Этап {n}",
  "chart.tooltip": "{name}: {points} очк., всего {total}",
  "chart.seriesPhase": {
    one: "{name}: {points} очков после {count} этапа",
    few: "{name}: {points} очков после {count} этапов",
    many: "{name}: {points} очков после {count} этапов",
  },
  // Klasyfikacja eventu to suma szesciu skladowych, a profil czytal
  // z tego wylacznie match_points.
  //
  // Zmierzone: 708 z 1294 wpisow gracz-turniej nie ma ANI JEDNEGO
  // wiersza w match_points. Pierwsze miejsce StarLadder Budapest 2025
  // ma 47 punktow (stage1 +12, stage2 +16, stage3 +12, playoffs +7)
  // i dostawalo siedem kafelkow z zerem.
  "profile.phase.kicker": "Помимо матчей",
  "profile.phase.title": "Очки за этапы",
  "profile.phase.intro": "Турнирная таблица учитывает и прогнозы на этапы — выходы, 3-0 и 0-3. Вот сколько очков они принесли.",
  "profile.phase.total": "За этапы всего",
  "profile.phase.mvp": "MVP",
  // Budapeszt ma 509 sklasyfikowanych graczy i ZERO meczow w bazie.
  // Kolonia 148 takich graczy na 523, Krakow 51 na 262.
  "profile.noMatches.title": "В этом результате нет ни одного матча",
  "profile.noMatches.text": "Весь результат сложился из прогнозов на этапы. Поэтому здесь нет ни точности, ни серий, ни рекордов по матчам — их не из чего считать.",
  "profile.progress.captionPhase": "Наведите на точку, чтобы увидеть этап и добычу.",

  // --- Przeceniane i niedoceniane druzyny ----------------------------------
  // Strona druzyny podaje „zaufanie" i „wygrywa" obok siebie i nikt
  // ich od siebie nie odejmuje - a to odejmowanie jest cala trescia.
  //
  // Zmierzone: GamerLegion - stawiano 85%, wygrala 40%. NRG odwrotnie:
  // stawiano 14%, wygrala 44%.
  "bias.kicker": "Где мы ошибаемся",
  "bias.title": "Переоценённые и недооценённые",
  // Prog osmiu meczow nie jest okragla liczba z sufitu. Mediana
  // |roznicy| spada z 30 (5-7 meczow) na 12 (8-11) i 9 (12+) - to szum,
  // ktory znika, a nie wiedza, ktora sie pojawia.
  "bias.intro": "Как охотно на команду ставили и как часто она действительно выигрывала. Считается по {count} командам минимум с {min} сыгранными матчами — при меньшем числе разница это шум, а не знание.",
  "bias.overrated": "Ставили слишком часто",
  "bias.underrated": "Ставили слишком редко",
  "bias.row": "ставили {trust}%, выиграла {win}%",
  "bias.sample": {
    one: "{count} матч",
    few: "{count} матча",
    many: "{count} матчей",
  },
  "bias.empty": "Пока ни одна команда не выделяется настолько, чтобы назвать это общей ошибкой.",

  // --- Punktacja - regulaminy juz nieobowiazujace --------------------------
  // Strona pokazywala JEDNA tabele i przypis o zmianie zasad
  // punktowania MAP. Stawka za SERIE zmienila sie mocniej i nie bylo
  // o niej ani slowa - a strona twierdzila wprost, ze „dokladny wynik
  // serii nie daje nic ponad to".
  //
  // Zmierzone: w IEM Cologne Major 2026 trafiony zwyciezca z dokladnym
  // wynikiem dawal 4 pkt, sam zwyciezca 1 pkt. Kolonia trzyma 12 812
  // punktow za serie; wedlug dzisiejszych stawek byloby 7 988.
  "scoringHistory.title": "Что действовало раньше",
  "scoringHistory.lead": "Архивный турнир сохраняет очки на момент подсчёта — мы его не пересчитываем, потому что это переписало бы таблицу, которую игроки уже увидели как окончательную. Значит, таблица выше описывает лишь часть турниров.",
  "scoringHistory.applied": "Действовало на: {events}",
  "scoringHistory.was": "тогда",
  "scoringHistory.now": "сегодня",
  "scoringHistory.cologne.seriesWinnerOnly": "только угаданный победитель, без точного счёта",
  // Uczciwosc wobec czytajacego: tych stawek nie ma w zadnym commicie
  // ani wpisie. Sa wyprowadzone z bazy, wiec strona ma to powiedziec.
  "scoringHistory.reconstructed": "Эти ставки восстановлены из начисленных очков, а не переписаны из тогдашнего регламента — такой записи нет. Они сходятся до очка на 6378 из 6424 прогнозов на матчи и 6224 из 6274 прогнозов на карты; остальное — строки, пересчитанные позже уже по новому правилу.",

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
  "leaderboard.picks": "{done} из {all} прогнозов",
  "leaderboard.picksHit": "{done} из {all} прогнозов · {percent}% верных",

  // --- Tlum jako miara odniesienia -----------------------------------------
  // Tlum jako miara odniesienia. Kazda liczba w serwisie jest
  // bezwzgledna - "69% trafien" nie mowi, czy to duzo. Zmierzone:
  // w Kolonii chodzenie za wiekszoscia dalo by SZOSTE miejsce na 410
  // typujacych, w Krakowie dopiero 28. z 252.
  "crowd.kicker": "Планка",
  "crowd.title": "Толпа против игроков",
  "crowd.intro": "Представьте человека, который в каждом матче выбирал просто то, что выбрало большинство, без единой собственной мысли. Вот сколько бы он угадал.",
  "crowd.stat.correct": "Толпа угадала",
  "crowd.stat.place": "Место по точности",
  "crowd.stat.beatenBy": "Игроков обошли её",
  "crowd.stat.ofPlayers": "из {count} в зачёте",
  "crowd.whoBeat": "Глаз острее, чем у всех вместе взятых:",
  // To zdanie musi stac na stronie, bo inaczej ktos slusznie zapyta,
  // skad mial wiedziec przed terminem, co wybierze wiekszosc.
  "crowd.disclaimer": "Большинство считается постфактум, по всем сделанным прогнозам, — до дедлайна его никто не мог знать. Это не стратегия, а мера того, добавило ли собственное суждение что-то к суждению группы.",
  "crowd.player.title": "Вы против толпы",
  "crowd.player.intro": "Всё выше говорит, сколько этот игрок угадал. Это говорит, добавило ли его собственное суждение что-то к суждению группы. Большинство считается без его голоса.",
  "crowd.player.gap": "Против толпы",
  "crowd.player.gapHint": "угаданных больше или меньше на {count} матчах",
  "crowd.player.you": "Этот игрок угадал",
  "crowd.player.crowd": "Толпа угадала бы",
  "crowd.player.ofMatches": "из тех же {count} матчей",

  // --- Ranking ze skutecznosci ---------------------------------------------
  "leaderboard.order.label": "Как упорядочить таблицу",
  "leaderboard.order.points": "Очки",
  "leaderboard.order.accuracy": "Точность",
  "leaderboard.head.accuracy": "Точность",
  // Zmierzone w IEM Cologne: mediana typujacego pominela 103 ze 106
  // meczow, a 163 osoby z 409 oddaly dokladnie jeden typ. Suma punktow
  // mierzy wiec w duzej mierze obecnosc - i dlatego ta tabela istnieje.
  "leaderboard.accuracy.intro": "Те же люди, но по доле угаданных победителей. Очки растут с каждым сделанным прогнозом, поэтому таблица очков во многом измеряет присутствие — эта измеряет чутьё.",
  "leaderboard.accuracy.field": {
    one: "В зачёте {count} человек — те, кто дал прогноз хотя бы на {threshold} из {all} матчей.",
    few: "В зачёте {count} человека — те, кто дал прогноз хотя бы на {threshold} из {all} матчей.",
    many: "В зачёте {count} человек — те, кто дал прогноз хотя бы на {threshold} из {all} матчей.",
  },
  "leaderboard.accuracy.empty": "Слишком мало сыгранных матчей, чтобы сравнивать точность.",
  "leaderboard.accuracy.outside": "Вас нет в этой таблице — не хватает прогнозов до порога. Переключитесь на очки, чтобы увидеть своё место.",
  "leaderboard.pointsRank": "#{rank} по очкам",
  // Stalo tu wczesniej „#6 z 410” - miejsce w liczbie TRAFIEN
  // wsrod wszystkich, ktorzy oddali choc jeden typ. Prawdziwe i mylace
  // naraz: tlum typuje kazdy mecz, wiec duza czesc tej przewagi to byla
  // sama obecnosc.
  "crowd.field": "В зачёт входят те, кто дал прогноз хотя бы на {threshold} из {all} матчей. Толпа прогнозировала каждый, поэтому сравнение с тем, кто сделал один прогноз, ничего не значило бы.",

  // --- Decyzje, ktore zrobily roznice --------------------------------------
  "decisions.title": "Матчи, которые решили дело",
  "decisions.intro": "Число выше — это сумма. Она складывается из нескольких решений, а не из всех матчей: в большинстве прогнозов этот игрок шёл туда же, куда и все, и получал то же, что и все.",
  "decisions.best": "Оказался прав почти в одиночку",
  // NIE „pomylil sie, choc wiekszosc wiedziala” - ta definicja
  // daje wszystkim TE SAME trzy mecze (w Kolonii: Vitality-9z,
  // MIBR-THUNDER, B8-M80), czyli strone Niespodzianki powtorzona
  // na profilu. Fakt o czlowieku zaczyna sie tam, gdzie czlowiek
  // odszedl od reszty.
  "decisions.worst": "Был один и ошибся",
  "decisions.pick": "поставил на {team}",
  "decisions.support": "так же считали {percent}% из {count}",
  // Osobny napis na zero procent. „razem z nim 0% z 53” brzmi jak
  // usterka zaokraglenia, a to jest najmocniejszy wynik w tej
  // sekcji: karwix przy Spirit - MIBR byl jedyna osoba na 53.
  "decisions.alone": "больше никто из {count}",
  "decisions.note": "Поддержка считается без собственного голоса и только в матчах, которые прогнозировали хотя бы {count} других — при трёх прогнозах «я был один» не значит ничего.",

  // --- Pewnosc typu: 2:0 kontra 2:1 ----------------------------------------
  "confidence.kicker": "Уверенность",
  "confidence.title": "Когда был уверен",
  // Zmierzone na wszystkich turniejach: typy 2:0 trafiaja zwyciezce
  // w 67.2% (3450 typow), typy 2:1 w 52.3% (3509). Kolumna, ktora nie
  // daje ani jednego punktu, niesie najmocniejszy sygnal w tabeli.
  "confidence.intro": "Счёт серии не даёт здесь ни одного очка — считается только победитель. И всё же он о чём-то говорит: «2:0» — уверенный прогноз, «2:1» — с сомнением. Вот как вышло у этого игрока.",
  "confidence.sure": "Прогноз 2:0",
  "confidence.close": "Прогноз 2:1",
  "confidence.gap": "Разница",
  "confidence.ofPicks": {
    one: "победитель угадан в {count} таком прогнозе",
    few: "победитель угадан в {count} таких прогнозах",
    many: "победитель угадан в {count} таких прогнозах",
  },
  "confidence.gapHint": "процентных пункта в пользу уверенных прогнозов",
  "confidence.inverted": "У этого игрока уверенность работает наоборот: прогнозы с сомнением выходят лучше тех, в которых он был убеждён. Таких четырнадцать человек из ста двух.",
  // TO JEST ZASTRZEZENIE, KTORE MUSI STAC NA EKRANIE. Bez niego
  // sekcja czyta sie jak „badz pewny siebie, a bedziesz trafial”,
  // czyli jak przyczynowosc, ktorej w tych danych nie ma.
  "confidence.note": "Это не значит, что уверенность помогает угадывать. «2:1» пишут в матчах, которые действительно равные, поэтому низкая точность отчасти принадлежит матчу, а не человеку. Это значит, что самооценка оказывается точной. Считается по BO3, от {count} прогнозов каждого вида.",

  // --- Cena nieobecnosci: mecze bez typu -----------------------------------
  "absence.kicker": "Что прошло мимо",
  "absence.title": "Матчи без прогноза",
  // Zmierzone w IEM Cologne: mediana typujacego pominela 103 ze 106
  // meczow, komplet wytypowaly CZTERY osoby, a lacznie pominiec bylo
  // 36 930. Rekordzista zyskalby +142 pkt i skoczyl o 47 miejsc.
  "absence.intro": "Весь сайт считает то, что человек спрогнозировал. Это обратная сторона: матчи, которые завершились без его прогноза. На каждый из них мы ставим то, что поставило большинство, — простейшая замена решения.",
  "absence.skipped": "Без прогноза",
  "absence.ofSettled": "из {count} сыгранных",
  "absence.points": "Там лежало",
  "absence.pointsHint": "очков, если бы на каждом идти за большинством",
  "absence.coverage": "Охват турнира",
  "absence.coverageHint": "матчей со своим прогнозом",
  "absence.crowdHit": {
    one: "большинство угадало {count} из них",
    few: "большинство угадало {count} из них",
    many: "большинство угадало {count} из них",
  },
  // TO ZASTRZEZENIE MUSI STAC NA EKRANIE. Bez niego liczba czyta sie
  // jak krzywda - a wiekszosci nie dalo sie znac przed terminem, wiec
  // nie byla to strategia, ktora ktokolwiek mogl zastosowac. To samo
  // zdanie stoi pod sekcja tlumu.
  "absence.note": "Это не альтернативный подсчёт и не «столько ему причиталось». Большинство считается постфактум, из всех сделанных прогнозов, — до дедлайна его никто не знал. Это оценка того, сколько турнира прошло мимо, в единственной валюте этого сайта.",
};

export default ru;
