# Path Mobile — выполнение событий и отметки привычек в desktop-копиях

11 ноября 2026, Europe/Warsaw. Репозиторий `Valdemarouki/Path`, рабочая копия `/workspace/Path`, ветка `feature/path-mobile-alpha`. Исходный HEAD `5a5205f3e6312506795207a312b465799d6768a9` совпал с ориентиром пользователя, исходный `git status --short` пуст. Более ранняя работа и резервные копии сохранены; reset, clean и повторного клонирования не было.

Этап расширяет существующий изолированный desktop test mode и общий адаптер. Синтетическая desktop-копия открывается в настоящих Today, Calendar и Habits, разрешённые действия меняют полную исходную запись, сохраняются отдельно и возвращаются в desktop-совместимый экспорт. Аккаунты, реальные пользовательские данные и облачная синхронизация не подключены.

## Подтверждённая desktop-семантика

Подробные факты, порядок overrides, ссылки на функции/строки и хеши 18 прочитанных desktop-файлов — в [DESKTOP_SEMANTICS.md](DESKTOP_SEMANTICS.md). Desktop-код не выполнялся как приложение и не изменялся.

- Calendar completion меняет только `events[].done`. Завершение — `true`, отмена — `false`; event `completedAt`, новые ID, task completion и actual workout records не создаются. Чистая операция не распространяет completion на всю серию и не выдумывает `seriesException`.
- Бинарная привычка хранит состояние конкретного civil day в `values[date]` и `checkIns[date]`. Отметка записывает `1/true`; отмена оставляет явные `0/false`. Другие даты не удаляются. Повторное применение того же целевого состояния идемпотентно и не превращает отсутствие записи в миграцию.
- Ручные count/duration значения хранятся в `values[date]`; `checkIns` этим действием не переписывается. Допустимы конечные неотрицательные дробные числа. Count выражен в units, duration — в minutes; перевода в секунды или выдуманной пользовательской единицы нет.
- Действие проверяет последнее schedule, dated availability, дни недели, skipped, дату начала и прошлый/текущий локальный календарный день. Локальная дата не заменяется UTC-днём. Наличие пустого `availability[]` отличается от отсутствующего свойства.

## Поддерживаемые действия и ограничения

| Действие | Поддержка этапа | Ограничения |
| --- | --- | --- |
| Самостоятельное Calendar-событие | Completion/undo через прежнее удержание, доступную клавиатурную команду и существующий редактор | Только подтверждённая capability `eventCompletion`; free time, deadline, неизвестная зона/семантика и неподдерживаемые ссылки защищены |
| Связанное событие, Sport snapshot/session, materialized recurrence | Полная запись и её done сохраняются и показываются | Действие остаётся ограниченным: не активируется каскад task/workout и не выбирается scope серии от имени пользователя |
| Manual binary habit, daily/selected days | Отметка/отмена за eligible день из Today или Habits, история, reload | Day вне расписания, skipped, paused/archived, до начала или в будущем не изменяется |
| Manual count/duration, daily/selected days | Точное factual value и явная коррекция до 0 по дате | Только подтверждённые kind/unit; неизвестные правила не приводятся к бинарной привычке |
| Weekly и sport-derived Habits | Существующие исходные правила/история доступны для просмотра | Ручное действие отключено с причиной; weekly obligations и Sport source records не переписываются |
| Streak и агрегатная статистика | Показываются реальные отметки/значения и исходные evidence | Упрощённая новая формула серии не добавлена |

Количество вводится прямо в существующем editor sheet: `step="any"`, без принудительного округления. Общий числовой picker предназначен для ограниченных диапазонов/шага; desktop finite >=0 не имеет такого общего верхнего предела. Поэтому этот ввод не подгоняет desktop-значение под wheel-диапазон. Парсер числового текста использует уже существующую защиту JSON-чисел от потери точности; открытие и закрытие формы не записывает значения по умолчанию.

Today показывает привычки за текущий день тестовой копии. В Habits можно выбрать другой civil day; это меняет контекст просмотра, а не дату существующих исторических записей. Изменение eligible текущего дня отражается при переходе между обоими экранами из одного источника данных. Выбранный день просмотра не является desktop-полем и не выдаётся за persisted настройку источника.

## Путь сохранения и изоляция

Существующие [desktop-adapter.mjs](../../../mobile/desktop-adapter.mjs), [desktop-inspector.mjs](../../../mobile/desktop-inspector.mjs) и [desktop-test-repository.mjs](../../../mobile/desktop-test-repository.mjs) переиспользованы. Добавлены команды `eventCompletion` и `habitValue`; отдельного независимого адаптера нет.

`datasets[].current` — полная каноническая desktop-копия, `original` — её первоначальный источник. UI получает временную проекцию. Разрешённые callback-различия переводятся в точечные команды, после чего сравниваются с ожидаемой проекцией. Постороннее изменение отвергает всю операцию. Сохранение UI DTO поверх полной записи запрещено этим путём.

ID, typed references, история, unknown props, вложения, envelope/history и неотображаемые структуры сохраняются. Неизменённое отсутствующее поле не превращается в 0 или пустую строку. Явный 0 после действия отмены — подтверждённый результат операции, а не автоматическая нормализация.

Test mode по-прежнему использует только `path-mobile-desktop-test-v1`; обычный `path-mobile-alpha-v1` не активируется из него. Сохраняются прежние ограничения namespace: не более 12 копий и 8 MiB; новая загрузка создаёт отдельную копию. Неподдерживаемая загрузка/ошибка записи не заменяет последний рабочий кеш.

Web Locks и проверка предыдущей строки namespace обнаруживают stale write. Это обнаружение конфликта, не автоматический merge. Черновик quantitative editor остаётся доступным после отказа записи/конфликта; recovery download сохраняет текущую копию, raw test namespace и поля открытых форм до явного refresh. Обычные мобильные записи для recovery не читаются.

## Completion и IMPACT

Переиспользованы [calendar-completion.mjs](../../../mobile/calendar-completion.mjs) и [calendar-impact.mjs](../../../mobile/calendar-impact.mjs). Успешный feedback начинается после локального commit, а не после будущей синхронизации. Ошибка записи не запускает успешную волну. Короткое нажатие открывает редактор; scroll/pointer cancellation/потеря foreground отменяют удержание; отпускание после успешного hold не открывает редактор повторно.

Фактические параметры существующей реализации: удержание 800 ms, tap threshold 200 ms, cancellation movement 7 CSS px, уход незавершённого заполнения 180 ms, check feedback 565 ms. Волна 660 ms; радиус воздействия 560 CSS px, предел смещения 14 CSS px, задержка фронта до 410 ms, возврат соседних карточек 820 ms с одним overshoot 0.12. Амплитуда уменьшается с расстоянием и ограничивается краями viewport.

Соседи движутся отдельной additive translate-анимацией; реальные layout, scroll, дата/время и сохранённые координаты не меняются. Смена даты/вкладки и повторное действие очищают временные слои. Reduced motion сохраняет понятное заполнение/смену состояния и короткое затухание, без большого движения и пружины. Обычный мобильный completion использует прежнюю ветку поведения.

## Проверки и доказательства

**23/23 набора PASS.** Model suite: 154 проверки, включая 21 новую. Новый browser-набор расширен и повторно прошёл **31 группу** на итоговом коде. Обе статические сборки успешны. Прежние native Calendar completion (31 сценарий) и IMPACT (13), Numeric selectors, navigation, actions, tasks, typography и остальные наборы прошли.

[Сводка](validation/summary.json), [логи](validation/test-results.txt), [browser verification](validation/verification.json), [первоначальный полный прогон](validation/initial-run-summary.json). В первоначальном запуске новый browser-набор содержал 27 групп; финальный повтор включает 31, добавленные edge cases и duration EN/RU/ES.

Подтверждены 0 page/console/HTTP ошибок и 0 внешних запросов. Из test-mode приложения зафиксировано **0 чтений и 0 записей ключа обычного mobile storage**; синтетический sentinel побайтно неизменён. Это подтверждено trap-инструментацией и повторным сравнением.

Канонические операции сравниваются с реальными trusted desktop-функциями `completeCalendarOccurrence` и `logHabitValue` в VM без DOM/storage/app startup. Финальные файлы дополнительно прошли фактический изолированный codec/pathValidate.

Обязательные сквозные сценарии для финального отчёта:

1. Синтетическая копия → hold самостоятельного события → заполнение → успешный commit → IMPACT → reload → реальный browser download → фактический изолированный desktop-валидатор.
2. Отмена event completion → экспорт → comparison с исходником по конкретным paths; никаких произвольных timestamps/history.
3. Binary mark в Today → то же состояние в Habits → reload → undo в Habits → Today → экспорт; после undo остаются явные dated `0/false`.
4. Quantitative factual value/коррекция, repeat, future/off-schedule/skipped, смена дня, save failure без wave, конфликт вкладок с сохранённым draft, одинаковые строки ID разных типов, EN/RU/ES × 320/390/430 и reduced motion.
5. Регрессия native Calendar completion/IMPACT; независимый native sentinel и ноль вызовов его Storage key из test-mode приложения.

[Точное сравнение экспортов](validation/EXACT_CHANGES.json): завершение события меняет только `done:false→true`; undo возвращает весь исходник точно. Binary mark→undo оставляет `values[2026-11-11]=0`, `checkIns[2026-11-11]=false`, ранее отсутствовавшие; остальные данные совпадают. [Count 6→7.25→0](validation/habit-quantity-diff.json) и [duration 12.75 min→0 в EN/RU/ES](validation/habit-duration-diff.json) меняют только dated `values`; `checkIns` сохраняется.

Полные файлы: [Calendar completed](validation/event-completed-desktop.json), [Calendar original/undo](validation/event-undo-desktop.json), [исходный pooled habit fixture](validation/habit-original-desktop.json), [Habits after undo](validation/habit-after-undo-desktop.json). Проверены ID, связи, unknown props, asset pool и envelope history; UI DTO не заменяет исходные records.

[Видео Calendar completion с IMPACT](calendar-impact.mp4) и [видео Today ↔ Habits](habits-cross-screens.mp4) записаны настоящим Chromium в обычной скорости. Фактические длительности — 18,84 и 16,20 секунды соответственно, определены ffprobe после кодирования.

[Calendar](screens/calendar-completed-390.png), [Habits](screens/habits-marked-390.png), [duration RU](screens/habit-duration-minutes-ru-390.png), остальные EN/RU/ES × 320/390/430 — в screens. [Измерения compositor/rAF](validation/impact-measurements.json): при данной синтетической геометрии 390 px ближние карточки ±13.72 px с обратным перелётом ≈1.64 px, дальние ≈10 px/1.2 px; дальний фронт запаздывает на ≈112 ms. Layout, scroll, navigation и точное возвращение проверены отдельно. Эти измерения не являются новыми глобальными design tokens.

Добавлен explicit UI marker для generated task deadlines: допустимый ID канонического события с префиксом `task-deadline:` не открывает задачу и не смешивает completion. Идентификаторы в desktop-экспорте не переписываются; DOM/ARIA ID имеют контекст типа.

Физический ввод десятичной запятой не проверялся: браузерный `input type=number` заполнялся стандартизованной строкой `12.75`. Точность сохранения и единицы min/мин/min подтверждены.

Desktop Electron/import UI, физические Windows/iOS/Android, Safari/WebKit и реальные assistive technologies не заявляются проверенными. Проверен Linux Chromium с новыми синтетическими профилями и loopback-ресурсами; внешние сервисы/аккаунты не подключаются.

## Локальный запуск

Из распакованных исходников, Python 3 и Chrome/Edge:

```bash
python3 mobile/build.py
python3 -m http.server 8010 --bind 127.0.0.1 --directory mobile/dist
```

Открыть **http://127.0.0.1:8010/?desktop-test=1**, раскрыть Desktop test mode и загрузить подготовленную plain/pooled синтетическую копию. Обычный режим доступен по Return to local mode; повторный вход читает сохранённый test namespace этого же origin/profile.

Для готового `path-mobile-desktop-actions-windows.zip` нужны Python 3 (launcher `py`) и Chrome/Edge. Распаковать в новую папку `C:\PathMobile-Actions-Test`, проверить `C:\PathMobile-Actions-Test\Path-Mobile\index.html`, затем выполнить `py -3 -m http.server 8018 --bind 127.0.0.1 --directory "C:\PathMobile-Actions-Test\Path-Mobile"` и открыть `http://127.0.0.1:8018/?desktop-test=1`. Новый порт создаёт отдельный browser origin; старый namespace на прежнем порту не удаляется. Не запускать сервер из Downloads без явного `--directory` и не открывать ES-модули через `file://`.

Локальное сохранение относится к конкретному browser profile/origin, включая порт. Очистка browser data, приватная сессия, смена origin или утрата среды могут удалить доступ к нему. Source archive и Git bundle не включают browser localStorage. Экспорт desktop copy и recovery download нужно сохранять отдельно. Локальный commit и файлы внутри среды не являются внешней резервной копией до скачивания пользователем.

## Файлы, коммиты и поставка

[Полный manifest](CHANGED_FILES.txt) сравнивается с исходным `5a5205f3e6312506795207a312b465799d6768a9`. Локальные коммиты кода:

- `3fff54c1582a81f98a6f43de24dd1c5caa8abf17` — канонические event/habit операции и 21 новая unit-проверка;
- `18b1d6b4bbe1788ec9203dc78944b0d4cbf05945` — действующие экраны, hold/IMPACT, UI identity и browser tests.

Итоговый commit сохраняет документацию/доказательства и дополняет browser duration case. Его SHA/конечный HEAD и чистый status приводятся в итоговом ответе и DELIVERY.json; самоссылка в commit не создаётся.

Предыдущая поставка `desktop-test-5a5205f3e631` проверена по SHA256 и сохранена. Новые архивы создаются в отдельном `path-mobile-deliveries/desktop-actions-<HEAD12>`. После commit проверяются gzip/ZIP CRC, SHA256, сборка распакованного source в новой папке, Git bundle unbundle/fsck и source bytes. Конкретные ссылки/результат integrity приводятся в итоговом ответе. Скачивание в пользовательском клиенте не проверено.

Desktop-правки для выполненной поддержки не понадобились. Расширение linked/series/weekly/Sport действий требует отдельной адаптации и проверки связей/периодных правил.

Работа ограничена mobile/ и docs/mobile/. Desktop, AGENTS.md, main/paperclip-test, Paperclip, Daytona, production и реальные пользовательские данные не изменяются. Push, PR, merge, deployment и публикации среды не выполняются. После финального отчёта этап останавливается.
