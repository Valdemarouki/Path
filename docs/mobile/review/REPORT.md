# Path Mobile — комплексная проверка

**В пределах выполненных проверок известных неисправленных P0/P1 нет.** Исправлены три воспроизведённых P1 и пять P2. Это локальный alpha-прототип с ограничениями, перечисленными ниже, а не обещание production-ready или отсутствия любых возможных ошибок.

## Исходная точка и сохранность

- Репозиторий: `Valdemarouki/Path`, рабочая копия `/workspace/Path`.
- Ветка: `feature/path-mobile-alpha`; исходный HEAD `905c9dcb39bdc6794c6a29e7af6e20bc77b57c0d`.
- Исходный `git status --short` пуст. Сбросов, clean, переключения на старую версию и замены рабочей копии не было.
- Найдены и проверены старые source archives (3d80a077 / 6da74ed6), старый bundle и готовые Windows ZIP. Они не являлись полным checkpoint текущего HEAD. Перед правками создан `/workspace/path-mobile-deliveries/checkpoint-905c9dcb39bd`: source archive, полный branch bundle и SHA256SUMS. Проверены gzip/tar, bundle и восстановление объектов с fsck в отдельном временном bare-репозитории.
- Все предыдущие этапы сохранены в истории. Изменяются только `mobile/` и `docs/mobile/`. Исторические правила AGENTS.md для прежней Paperclip-копии не менялись; используется разрешённая владельцем изолированная feature-ветка.

## Проблемы, исправления и доказательства

| Приоритет | Воспроизведённая проблема | Исправление | Проверка |
|---|---|---|---|
| P1 | Связанная обычная задача имела заблокированный checkbox, но редактор позволял изменить/удалить источник, нарушая защиту связей | Единая защита в редакторе и моделях для linked/archived/protected/ambiguous задач. При появлении связи во время редактирования введённый текст остаётся доступен для копирования, Save скрыт | UI 320/390/430 × EN/RU/ES; model byte-preservation; межвкладочное добавление ссылки во время черновика |
| P1 | Undo удалённой обычной задачи хранился только в переменной и исчезал после reload | Версионированный `mobileTaskUndo` сохраняет точную запись, позицию и main-reference. Восстановление не перезаписывает занятый ID и более новый выбор главной задачи | Delete → reload → quota failure → retry → restore → reload; неизвестные поля, ID и ссылка main сохранены |
| P1 | Refresh после завершения тренировки в другой вкладке молча стирал введённые значения подходов | Неотправленный ввод переносится в отдельную copyable recovery-область; не применяется к истории или другой сессии. Для остающейся сессии виден текущий сохранённый результат для сравнения. Discard отдельный, с подтверждением | Две вкладки: введено 9/21 kg, другой вкладкой сохранено 8/20 kg; после refresh сохранённый результат 8/20, черновик 9/21 доступен. Повторная навигация и discard не меняют результат |
| P2 | Смена только timed-категории legacy-события 12:07 / 5 минут требовала округления времени | Категория отделена от реального retiming. Исходные instants сохраняются; новая дата/время/длительность/fold и переход deadline остаются под прежними правилами | busy → focus + high importance, reload; start/end/duration/unknown fields равны оригиналу; реальное изменение 12:08 отвергается |
| P2 | Progress мог второй раз учитывать неоднозначную nested-копию ID обычной задачи | Подсчёт согласован с канонической проекцией; неоднозначные nested-ID не добавляют второй completion | Unit: один канонический результат, исходное дерево/ID не меняются |
| P2 | Undo/refresh controls вне main оставались вне inert-фона раскрытой панели | Панель выключает все соседние элементы shell и восстанавливает исходную inertness | Открыта панель при Undo и конфликте; фоновые controls inert, после Escape доступны |
| P2 | Поиск без совпадений сообщал, что заметок вообще нет | Раздельные пустое состояние и «совпадений нет» в EN/RU/ES | Поиск, очистка, возврат исходных заметок; строка storage не меняется |
| P2 | После успешного scoped Calendar completion могла оставаться старая quota-ошибка и неверный Sync status | Ошибка очищается после успешной записи. На время feedback сохраняется её layout-место, затем удаляется на следующем render | Ошибка Quick Add → успешный Calendar completion → Local saved; offsetTop и scroll position в момент завершения не меняются |

Исходные browser repro сохранены в `initial-reproductions.json`. Восемь новых model regression cases и 32 browser review scenarios покрывают эти исправления. Контроль коллизий ID добавлен также для создания обычных задач и Undo, без генерации новых ID вместо исходных.

## Готовность разделов

| Раздел | Проверенный текущий объём | Ограничения |
|---|---|---|
| Today / Tasks | Create/edit/move/main/complete/uncomplete, overdue, счётчики без главной задачи дважды, общий источник с Projects, reload, durable Undo, foreground/day refresh | Связанные/архивные/неоднозначные источники read-only. Undo хранит последнее удаление обычной задачи, не полноценную корзину всех задач |
| Calendar | Дата/сегодня/шаги, standalone CRUD, 6 типов и 4 важности, порядок, одинаковое время, midnight/DST, legacy metadata, hold/undo/reload | Recurrence/exceptions и сложные связи сохранены read-only; редактор повторений и уведомления не добавлены |
| Quick Add | Task / Event / Note, обязательные поля, двойной submit, quota retry без потери текста, discard, достижимость Save | Экранная клавиатура проверялась уменьшением viewport, не реальной IME |
| Habits | Daily/selected days, effective schedule, отметки/отмена по датам, Today/Progress, 14-day history, streak, archive | Weekly/count/duration/sport-source и расширенный редактор исключений не активируются |
| Sport | Библиотека, простые templates/plans, immutable snapshots, active-session reload, reps/seconds/kg и отдельный mobileLoadKg, rest/pause/foreground, finish/history/Calendar link, ручная защита черновиков | Programs/сложные схемы read-only. Recovery-черновики существуют в текущей вкладке; скопировать перед reload/close |
| Notes | Markdown source, Unicode search, edit/reload, trash/restore, длинный ввод и ошибки записи | Rich blocks/attachments сохраняются read-only; HTML/attachments не конвертируются в plain text |
| Projects | Список/статус/описание, вложенные задачи, deadline/importance/main/completion, реальный процент, shared IDs и Undo | Gantt/workflow/dependencies и неоднозначные desktop-scopes остаются read-only |
| Canvas | Совместимый read-only viewer, pan/zoom/fit, узлы/связи и открытие источника | Координаты/edges/viewport не записываются; полного редактора/активации desktop import нет |
| Progress | Периоды day/week/month, реальные completedAt и eligible checks, уникальные workout IDs и канонические задачи, пустое состояние | Старым done без timestamps не выдумываются даты; project % lifetime, отдельно от выбранного периода |
| Profile | Честный локальный профиль | Аккаунтов, фиктивного пользователя и sign-in нет |
| Settings | Сохранение EN/RU/ES, Path Motion Off + OS preference, мобильный JSON export | UI import/merge отсутствует; экспорт не называется desktop-синхронизацией |
| Sync status | Реальный локальный revision/error/saved после записи; stale-tab блокировка, явный refresh | Это не облачная очередь, полноценный conflict resolver или доказательство sync |
| Нижняя панель | Primary Today/Calendar/+/Sport/Habits; единая раскрытая сетка, Habits справа во втором ряду стандартной сетки, компактная ширина/высота, safe-area, focus/inert, rapid reverse | Реальная динамика iOS safe-area/gesture bar не проверена |

Все ограничения выше являются честными границами alpha, а не скрытыми неработающими кнопками.

## Визуальный и motion-проход

Сохранены локальный Manrope (200 крупные заголовки, 300 часть карточек, 400 функциональный текст, 500 основные controls), лицензии, графитовые поверхности с тонким noise, философ, единые SVG и светлые кнопки главного создания. Нет нового глобального редизайна. Recovery использует существующий материал, а доступные для копирования значения видны перед исходным JSON. Ссылки содержимого/Markdown не переписывались.

У панели остались реальные backdrop blur/прозрачность, статичный subtle noise, верхний блик и контур; нижняя системная полоска не рисуется. Проверены normal/expanded/compact, скролл под стеклом, drag из compact, быстрый reverse, внутренняя прокрутка, текущее выделение и отсутствие скрытых фокусируемых дублей.

Параметры утверждённой анимации не перенастраивались: panel 440 ms, short stagger 25 ms, compact 320 ms, active frame 420 ms; Calendar hold 800 ms, check 565 ms, source impulse 520 ms, neighbor return 820 ms, максимум 14 px, один reverse overshoot 12%, radius 560 px и дистанционные задержки до 410 ms. Эффект только после успешной локальной записи; layout/даты/порядок/scroll не меняются. Reduced motion не отталкивает карточки. Подробный исходный desktop-audit остаётся в `../calendar-impact/REPORT.md`.

## Сборка и проверки

Исходный baseline: 18/18 suites PASS. Финальный текущий прогон: **19/19 suites PASS**, включая **80 unit cases**, **32 review defect scenarios**, 93 action-control cases, существующие Task/Calendar/Workout/Notes/Projects/Canvas flows и 13 impact cases. Единицы счёта разного масштаба: unit, flow и matrix group, не сотни независимых ручных сценариев.

Результаты: `validation/summary.json`, `validation/test-results.txt`, `validation/review.json`. Матрица: **320/390/430 × EN/RU/ES**, long/empty/large-list states, CSS safe-area, reduced motion, touch/focus/return focus, draft/quota/stale tab, migration/opaque fields, staging round-trip. Дополнительно 1000 длинных задач на 320 px: 1000 controls, 0/999 без повторного main, footer полностью выше панели и нет horizontal overflow. Весь сценарий включая запуск профиля и ожидание скролла занял около 1 с в этой среде; это не benchmark слабого телефона.

Консольный проход по 11 экранам: **0 page exceptions, console errors/warnings, HTTP errors и request failures** (`validation/console.json`). Все браузеры использовали новые синтетические профили и блокировку внешних запросов. Desktop не запускался. Один промежуточный assert был исправлен: Playwright не считает сам fieldset disabled-control; проверяется native disabled и реальный input. Это была ошибка тестового предиката, не отказ приложения; финальный прогон чистый.

Не проверены физические iOS/Android, Safari/WebKit, VoiceOver/TalkBack, реальные IME/pickers, OS eviction/убийство процесса, actual device safe-area и производительность на слабом телефоне. Browser clock/lifecycle/viewport — эмуляция. Не включены real desktop import, общий аккаунт, сервер, outbox, ACL, shared editing, автоматическое разрешение конфликтов и attachment delivery. При forced close несохранённые tab-local recovery drafts не гарантированы; UI требует скопировать их и предупреждает об уходе.

Обновлённый [контракт совместимости](../functional-alpha/COMPATIBILITY.md) различает подтверждённые поля, обратимое staging, ограничения runtime и работу перед общим сервером. Простое предупреждение/refresh не названо полноценным разрешением конфликтов.

## Скриншоты, видео и запуск

`screens/` содержит свежие основные экраны, формы, три состояния панели и RU 320. `defects/` показывает protected task, durable Undo после reload/ошибки и recovery тренировки. `screens-overview.png` — четыре настоящих снимка, соединённые без перерисовки; `panel-states.png` — normal/expanded/compact на одинаковом viewport 390 × 844.

- `panel-motion.mp4` — 10 с реального браузера: normal/compact, скролл под стеклом, grid-transform и возврат. Это фрагмент `panel-and-flows.mp4`; исходный сценарий `mobile/tests/alpha-evidence.cjs`.
- `calendar-impact-1x.mp4` / `.gif` — актуальная запись normal-speed hold → save → wave → отталкивание соседей → settle, сценарий `mobile/tests/calendar-impact.cjs`.
- Metadata и измерения: `validation/visuals.json`, `validation/impact.json`, `validation/impact-samples.json`.

Для готового Windows ZIP: Python 3 + современный Chrome/Edge. Распаковать в новую `C:\PathMobile-Review-Test`, проверить `Path-Mobile\index.html`, выполнить:

```powershell
py -3 -m http.server 8015 --bind 127.0.0.1 --directory "C:\PathMobile-Review-Test\Path-Mobile"
```

Открыть `http://127.0.0.1:8015/`, оставить PowerShell открытым; Ctrl+C останавливает сервер. Отдельный порт/тестовый профиль не импортируют данные прежних установок. ZIP включает `START-WINDOWS.txt` и локальную лицензию шрифта. Не открывать `index.html` через file://.

Из source archive, в корне `Path-Mobile-Source`:

```bash
python3 mobile/build.py
python3 -m http.server 8015 --bind 127.0.0.1 --directory mobile/dist
```

Команды проверки в этой среде (Playwright/Chromium уже установлены; для самого приложения Node не нужен):

```bash
python3 mobile/build.py
python3 mobile/typography-preview/build.py
# При работающих localhost servers 8010/8020:
node mobile/tests/run-polish.cjs --evidence /tmp/path-review-complete --with-typography
MOBILE_ALPHA_VISUALS=/tmp/path-review-visuals node mobile/tests/alpha-evidence.cjs
```

## История, архивы и итог

Локальные коммиты кода:

1. `541b8ee5c6eb96e9f617687280f15638973adb8f` — защита task links/ID, durable Undo, legacy category edit и канонический Progress + unit regressions.
2. `92d882c873cd16cfc9f3959c5b33406489680025` — UI защиты/копирования черновиков, recovery, inertness, понятные состояния и browser regressions.

Отдельный commit документации/доказательств и полный конечный HEAD указаны в итоговом ответе. Полный список относительно исходного HEAD — `CHANGED_FILES.txt`.

Актуальные `path-mobile-alpha-source.tar.gz`, `path-mobile-alpha.bundle`, готовый Windows ZIP, `SHA256SUMS` и метаданные проверки находятся **вне репозитория**, в новой папке `/workspace/path-mobile-deliveries/` для финального HEAD. Source archive содержит tracked mobile/docs; bundle содержит полную историю feature-ветки. Они не содержат browser localStorage, зависимостей, Git remote credentials или реальных пользовательских данных. Проверяются gzip/tar/ZIP, содержимое, повторная сборка извлечённого source и unbundle/fsck в новом временном bare-репозитории. Точная итоговая проверка записана рядом с архивами.

Эти файлы пока находятся в данной среде. Они не считаются внешней резервной копией до подтверждённого скачивания пользователем. Исходная рабочая копия не заменялась.

Desktop, AGENTS.md, root configs/lockfiles, main/paperclip-test, Paperclip, Daytona, production и существующие пользовательские данные не изменены. Push, PR, merge, deployment и повторной публикации среды не было. Финальное рабочее дерево чистое; это отдельно проверяется после коммита доказательств. После отчёта работа остановлена.
