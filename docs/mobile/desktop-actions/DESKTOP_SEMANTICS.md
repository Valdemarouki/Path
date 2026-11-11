# Desktop semantics: Calendar completion и Habits

Проверено по исходникам текущей изолированной копии Path, исходный mobile HEAD `5a5205f3e6312506795207a312b465799d6768a9`, 11 ноября 2026, Europe/Warsaw. Desktop-код только прочитан. Desktop app, пользовательское хранилище и сеть не запускались. Ниже отделена доменная семантика действия от побочных действий общего desktop save/editor pipeline.

## Calendar: подтверждённые факты

| Источник | Факт | Следствие для адаптера |
| --- | --- | --- |
| [calendar-pulse.js](../../../calendar-pulse.js), `calendarCanComplete` строка 3, `completeCalendarOccurrence` строка 12 | Удержание находит объект в `data.events` по исходному `id`, исключает `free_time`/`deadline` и уже done, присваивает **только `event.done=true`**, затем `save()`. В заголовке файла прямо указано: occurrence, не linked task/workout log | Завершение не создаёт event `completedAt`, новый ID, тренировку или completion задачи |
| [calendar.js](../../../calendar.js), `modalEvent` строки 54, 59–63 | Статус editor `planned/done` записывается как `done: v.status==='done'`; deadline принудительно planned. Это подтверждает обратное состояние `done=false` | Отмена — boolean false исходной записи; произвольная история не удаляется |
| [calendar.js](../../../calendar.js), строка 63 | Сохранение полного редактора linked event отдельно обновляет importance связанной задачи. Это не completion cascade | Нельзя запускать весь editor save для точечного completion: это могло бы затронуть несвязанные поля/задачу |
| [calendar-recurrence.js](../../../calendar-recurrence.js), `createCalendarSeries` строки 2–8, `modalEvent` строки 14, 20–35 | Серия materialized: каждый occurrence имеет свой event ID, `seriesId`, `occurrenceDate`; prompt прямо говорит «completion only affects this event». Ключи распространения на siblings не включают done | Завершение одного экземпляра не завершает серию. Сохранение `seriesException`, cancelledDates, siblings обязательно. Полный редактор scope и pulse имеют разный путь исполнения |
| [calendar-recurrence.js](../../../calendar-recurrence.js), `markCalendarExceptions` строка 44 | Автоматическая пометка exception сравнивает date/hour/duration/title/location/notes/type; done не входит | Чистое присваивание done не должно выдумывать `seriesException=true` |
| [calendar-workflow-finish.js](../../../calendar-workflow-finish.js), строки 1–3 | Project deadline — проекция task, ID `task-deadline:<task id>`, а не самостоятельный объект `events[]` | У этого projection нет независимого event completion; нужен task action. Не добавлять его в events |
| [sport.js](../../../sport.js), workout finish; [sport-smart.js](../../../sport-smart.js), `sportFinish` строки 26–30 | Реальная завершённая тренировка может установить done своего calendar session. Обратный переход calendar done → actual workout record не реализован этим pulse | Нельзя выдавать галочку Calendar за зарегистрированные Sport results. Плановые snapshots/активные/исторические session refs следует защищать |

Удержание desktop в `calendar-pulse.js:14` — **800 ms**. Завершение вызывается после достижения времени удержания. Путь сохранения обязан вернуть успех до успешного mobile feedback. Текущая mobile completion/IMPACT реализация переиспользуется; эта семантическая записка не вводит новую анимацию.

### Время и legacy

[calendar-time.js](../../../calendar-time.js), `reconcileTaskCompletion:18`, при общем сохранении stamp-ит записи с отсутствующим start_at, а также новые или изменённые timing fields. [timezone.js](../../../timezone.js), `pathEventTiming:18–22` выбирает `event.tzid || pathSystemTimeZone()`, `pathStampEvent:24` записывает start/end/zone/fold. Поэтому generic desktop save иногда включает incidental migration legacy-времени. Это **не основание** присваивать неизвестную историческую зону на телефоне ради галочки. Адаптер не обязан воспроизводить такой общий migration hook: точечное действие должно сохранять исходные timing fields; неясные случаи можно ограничить.

Completion самостоятельного события подтверждён. Сохранность полей linked/recurring/workout записи сама по себе не означает, что все связанные UI-сценарии уже реализованы. Конкретная capability текущего этапа определяется адаптером и его тестами; консервативное read-only для связей/серий допустимо и должно объясняться.

## Habits: запись, чтение, расписание

Окончательная семантика складывается из последовательных overrides: базовые функции [modules.js](../../../modules.js), затем [habit-history.js](../../../habit-history.js), затем [habit-sources.js](../../../habit-sources.js); порядок включения подтверждён [build.py](../../../build.py), строка 54. Поздний [habits-design.js](../../../habits-design.js) меняет presentation и вызывает те же команды. Старый `habits.js:19` с удалением checkIn — исторический fallback, **не актуальный основной log path**.

| Операция/значение | Точная desktop-семантика | Источник |
| --- | --- | --- |
| Дата действия | Plain local civil `YYYY-MM-DD`, из `pathToday(now)=pathZoneParts(now).date`; не UTC-день | [habits.js](../../../habits.js):2, [timezone.js](../../../timezone.js):4,7–9 |
| Действующее правило | Последнее правило с `from <= date`; при отсутствующем schedules существует legacy fallback. Пустой schedules даёт отсутствие правила | [modules.js](../../../modules.js):13 |
| Численное значение | `Number(h.values?.[date] ?? (h.checkIns?.[date] ? 1 : 0))`; явный 0 имеет приоритет над checkIns=true | [modules.js](../../../modules.js):15 |
| Завершённость | Правило существует и значение `>= rule.goal`; поздний skip override исключает skipped day | [modules.js](../../../modules.js):17; [habit-sources.js](../../../habit-sources.js):6–7 |
| Binary log | На eligible текущий/прошлый день пишет `values[date] = done ? 0 : 1` и `checkIns[date] = values[date] > 0` | [modules.js](../../../modules.js):25–27 |
| Binary undo | В результате остаются **`values[date]=0`, `checkIns[date]=false`**. Никакая старая дата не удаляется | Тот же `logHabitValue`; это отличается от старого fallback `toggleHabitDate` |
| Count/duration log | Пишет **только `values[date] = Number(input)`**, finite и >=0. `checkIns` не переписывает; дробное число допустимо | [modules.js](../../../modules.js):28 |
| Quantitative undo/correction | Явное factual 0 по выбранной дате; прежние даты и checkIns не удаляются. Отсутствие поля до действия не равно явному записанному 0 | Тот же `logHabitValue`; manual correction [habit-sources.js](../../../habit-sources.js):12 |
| Единицы | duration — **minutes**, count — **units/count**. Нет основания выдумывать пользовательскую единицу или переводить duration в секунды | [modules.js](../../../modules.js):19,20,28; [habits-design.js](../../../habits-design.js):7 |
| Доступность | Последняя version `availability.from <= date`; без подходящей version: наличие самого availability даёт active, иначе archived flag → archived/active. **Пустой availability[] и отсутствие поля различаются** | [habit-history.js](../../../habit-history.js):3 |
| Eligibility | Правило существует; availability active; для frequency days проверяется weekday в days. Поздний override дополнительно запрещает exceptions[date]=='skipped' | [habit-history.js](../../../habit-history.js):5; [habit-sources.js](../../../habit-sources.js):4–5 |
| Civil weekday | `new Date(date+'T12:00:00Z').getUTCDay()` — вычисление дня недели по неизменной civil строке. Это не преобразование самой записи в UTC-день | [habit-history.js](../../../habit-history.js):5 |
| Будущее/вне расписания | Основной log отвергает date>pathToday и неeligible. startDate отдельно не сравнивается при наличии schedules; действует rule.from | [modules.js](../../../modules.js):26 и более поздний eligibility override |
| Источник Sport | Значение вычисляется из unique workout records по completedDate или local day endedAt, с хотя бы одним done set. Completion=count>0; count=число records; duration=durationMs/60000 или elapsed minutes | [habit-sources.js](../../../habit-sources.js):1–3 |
| Manual sport log | Явно запрещён, чтобы не создать дублирующую ручную отметку | [habit-sources.js](../../../habit-sources.js):8–9 |

Поле `archived` само по себе не заменяет dated availability history. Пропуски не удаляют историю значений; skip хранится отдельно в exceptions. В desktop Details есть отдельные skip/restore/correction команды (`habit-sources.js:12`), но их наличие не требует включать новые управляющие функции в текущий mobile этап.

### Недельные цели, серии и статистика

- [habit-history.js](../../../habit-history.js), `habitPeriodWeek:6–10`: calendar week Monday-first; daily/days обязательства считаются по eligible датам. Weekly правила группируются по версии `rule.from`; target ограничен `min(weekTarget, eligible dates count)`, done ограничен target. Weekly goal — число завершённых **дней**, а не сумма количественных values за неделю.
- `habitCurrentStreak:14–19`: текущая единица days/weeks зависит от frequency действующего правила. Нерабочие/paused/skipped дни не считаются пропущенными daily обязательствами. Недельные серии используют closed week completeness, а не простую последовательность календарных галочек.
- [habit-analytics.js](../../../habit-analytics.js), `habitBestStreak:2–8`, `habitDayAnalytics:10–14`, `habitCompletionDays:16`: daily consistency исключает weekly rules из daily denominator; activity и completion-days используют eligibility и done. Эти метрики не взаимозаменяемы.
- Расчёт серий не нужен для безопасной точечной отметки. Если мобильный этап не переносит все подтверждённые period/streak правила и не сверяет их с desktop, корректно показывать исходную историю/фактические значения и явно ограничивать производные показатели.

## Контракт изменения полной записи

Для новых адаптерных операций достаточно patch одного events[i].done либо ровно одного dated значения привычки (и checkIn для binary). Не нужны новые ID, новые desktop-поля, новые массивы истории, UTC-нормализация, изменение rule/availability или очистка unknown properties. Сохранение полной canonical записи и source envelope остаётся обязанностью существующего desktop adapter/test repository. Идемпотентный set-to-state command — мобильная форма интерфейса операции; на повторном применении не должно появляться дополнительных дат/объектов или записей.

Валидация чисел не должна округлять точные existing fractions ради удобства selector. [storage.js](../../../storage.js):94 допускает finite nonnegative values; :95 допускает completion/count/duration, daily/days/weekly и положительную goal. Неизвестные будущие rule kinds/source/frequency нельзя подменять известными.

## Хеши прочитанных desktop-источников

Это контроль сохранности исходников при выполнении этапа, не хеш пользовательского хранилища.

| Файл | SHA256 |
| --- | --- |
| `calendar-pulse.js` | `3f5c91b92db95a2b69367240fdedd8d4caf4280c45d04edf84b7df7714ec1cc3` |
| `calendar.js` | `06d8d3ee577a72392acb6c3ceabbbc38f26808cae555658419fb50eee54310e9` |
| `calendar-recurrence.js` | `19ad596e02b04ec4a70407bf48476ebe8c7e533c6c2ff45f8999c47ba8271ea4` |
| `calendar-time.js` | `b53c6410032284ec03138a23862bf08a67f98e650f68619bd22bc5d209254c45` |
| `calendar-workflow-finish.js` | `ca4f9f755cb1071d704bc68b3fe091812fc101e48fcdcbeb716191fa32ad6b65` |
| `integration.js` | `22dcefbfb8b2b336b27f2911c2d45d7e9fce394d9da8706f893f180fee3f188e` |
| `modules.js` | `a30eab1c8d8559fca709b340f2c8fe5ad2331699fc2b54a353990e4f1c3bb5eb` |
| `habits.js` | `222478e212b0e5825385216affb1c572fe19532cbbd11c8b5422d476e287994b` |
| `habit-history.js` | `a77a65880e70e232c7acec5e5731c0007a2b86167faa8c8d5b28a956bb7096e8` |
| `habit-sources.js` | `66168852bd6c9e2501c701bd6ccff1fa599a1e3e4472a8cd0e3f2f82d21478a1` |
| `habit-analytics.js` | `20c764b279f128374f9f7694ed0271adba2dc2edf318df249a09515a6a19fd74` |
| `habits-design.js` | `b3b8b9e30f60c69e73e7debd908296a38b0ab6007251c7ca3e8fc1ace4f36f06` |
| `timezone.js` | `604ca4503b629ebdf986628180bf49ee23b6a4a579a017eec6100373265ffef3` |
| `storage.js` | `78ccec5eeb781e7f608ef0c97be69c57ec85eff6d364df011f3163702b7a87c8` |
| `build.py` | `2de293394b8720644081e65cc29d3ba5cddbea51ab31c3a77bc614c2a9fde57c` |
| `original.html` | `63f75dd2a14e703beee8441416ac60e07242dddae388e8bfa3f686cd47b8b2f7` |
| `sport.js` | `02811caa36479c6721b0f5e37fca88dd14237af4f53372d3f75111723a71251c` |
| `sport-smart.js` | `72b470ddfc6d8761ddc6fa87250b22ad3012e521e5b5d29597cdd5331961cdb1` |
