# Path Mobile — Functional Alpha

Изолированная локальная alpha в `/workspace/Path`, репозиторий `Valdemarouki/Path`, ветка `feature/path-mobile-alpha`. Исходный HEAD этапа: `3d80a0776b4519e0ebabdbd0088e15e0c26c1d64`, исходный status был чистым. Desktop, корневые настройки, AGENTS.md и ранее подготовленные мобильные результаты сохранены. Мобильное хранилище остаётся отдельным: `path-mobile-alpha-v1`, схема 5.

## Состояние разделов

| Раздел | Статус | Законченный сценарий / граница |
|---|---|---|
| Today / Tasks | Работает | Создать, изменить, завершить/вернуть, перенести, удалить/Undo, выбрать главную, просроченные, текущее/ближайшее событие, привычки. Задачи проекта читаются из исходной коллекции. Сложные workflow/связанные задачи доступны для просмотра. |
| Calendar | Работает с ограничениями | Даты, standalone CRUD, типы, четыре уровня важности, время/длительность/конец, completion, reload и устойчивый Undo. Проектные дедлайны — вычисляемые карточки. Тренировка открывает Sport. Серии и сложные связи защищены от редактирования; доставки напоминаний нет. |
| Quick Add | Работает | Быстрый вход Task / Event / Note; грязный ввод защищён при смене типа; без фиктивных типов. |
| Habits | Работает в базовом объёме | Создать/изменить daily или выбранные дни недели, dated completion/uncheck, последние 14 дней истории, серия, архив/восстановление. Старые записи остаются в хранилище. Weekly/count/duration/sport-source пока не активируются. |
| Sport / Workout | Работает в базовом объёме | Шаблон и упражнения → план со снимком в Calendar → активная тренировка → фактический результат и отдельный вес → отдых/пауза → reload → завершённая история. Программы, сложные блоки и редактор видов подходов не реализованы. |
| Notes | Работает | Список, Unicode-поиск по названию/тексту, Markdown-source редактор, Save/reload, корзина и восстановление с тем же ID. Документы с вложениями/сложными блоками защищены от потери форматирования. |
| Projects | Работает в базовом объёме | Название/описание/реальное состояние проекта, вложенные задачи, task status, deadline/importance, completion и настоящий прогресс. Gantt/зависимости — desktop-first. Не выдуман неподтверждённый project-level deadline. |
| Canvas | Ограничено | Список совместимых локальных досок, узлы/связи, pan/zoom, просмотр содержимого, общий путь открытия Note/Task/Project. Координаты/связи/viewport не записываются. Группы и неподдерживаемая геометрия явно блокируются. Пользовательского desktop-импорта для заполнения досок пока нет. |
| Progress | Работает | Today / неделя с понедельника / месяц до текущего дня; реальные completion dates, eligible habit history, завершённые workout records, текущий прогресс проектов. |
| Profile | Работает как локальный режим | Нет фиктивного пользователя, аккаунта, Sign in или Sign out. |
| Settings | Работает | EN/RU/ES, сохранённое уменьшение движения с учётом OS, версионированный мобильный JSON export. UI импорта нет. |
| Sync status | Локальное состояние работает | Сохранено на устройстве / ошибка / ревизия. Облачная синхронизация **не реализована** и не имитируется. |

## Данные и совместимость

[Полный контракт desktop/mobile по полям](COMPATIBILITY.md) содержит источники, типы, обратимость и ограничения всех сущностей, миграции, временные зоны, формулы Progress и предложение будущей offline/idempotency/conflict/ACL модели.

Главная задача — ссылка `mainTasks[date]`, а не копия. Today, Projects и вычисляемый дедлайн Calendar обновляют одну вложенную задачу. Отдельные Calendar события из-за этого не создаются. Подтверждённые desktop статусы: проект `active/paused/completed`, задача `planned/progress/done`. При правке только названия существующий частичный прогресс не обнуляется. Неизвестная форма известного поля делает редактирование read-only.

Шаблон тренировки, план и результат имеют разные ID и независимые снимки. Результаты повторений/секунд/кг соответствуют desktop `actualValue` и `unit`; одновременный дополнительный вес — **мобильное расширение `mobileLoadKg`**, а не выдуманное существующее desktop-поле. Подходы нумеруются с 1; `pausedAt` — epoch milliseconds; даты заметок и start/end/logged — ISO. Таймеры рассчитываются по timestamp, при возврате из фона остаток пересчитывается. Введённые значения сохраняются по Log set / Save entered results; несохранённый ввод защищён от ухода и остаётся после ошибки, но не обещан после принудительного закрытия браузера.

Все изменения проходят через один репозиторий: clone → mutation → validation → запись под Web Lock → обновление состояния. При quota/validation/conflict не показывается ложный успех. Устаревшая вкладка требует явного refresh; редактор сохраняет черновик и показывает актуальную запись для сравнения. После удаления исходной задачи в другой вкладке сохранение старого черновика не воссоздаёт её. Unknown root/entity fields не удаляются. Миграции ленивые, повторяемые, без замены ID; существующие архивные ссылки главной задачи не ломают загрузку старого состояния.

`desktop-adapter.mjs` — чистый lossless **staging** подтверждённого checkpoint v2 с обратным преобразованием. Это не live desktop importer и не слияние. Сложные habit rules, rich notes, program/workflow данные и asset pools возвращаются без потерь в staging-тестах, но это не означает, что все они редактируются в приложении. Никаких реальных экспортов не использовано.

## Что проверено

Итог — 14 наборов PASS; 402 проверки в последних результатах этих наборов. Это проверки разного масштаба: unit case, вертикальный browser flow или целая width/language matrix case; не 401 независимый ручной сценарий. Итог [validation/summary.json](validation/summary.json) сохраняет происхождение прогонов. Последний полный запуск 14/14 дополнен направленным повтором models, tasks и Functional Alpha после узкого исправления архивных ссылок/прогресса и защиты удалённого источника; остальные проверенные UI-модули после него не менялись.

| Набор | Проверок | Результат |
|---|---:|---|
| Models (включая adapter) | 63 | PASS |
| Existing browser flows | 55 | PASS |
| Task lifecycle | 24 | PASS |
| Functional Alpha workflows / matrix | 34 | PASS |
| Calendar editor | 72 | PASS |
| Calendar compatibility | 6 | PASS |
| Importance | 9 | PASS |
| Calendar cards | 9 | PASS |
| Calendar polish | 14 | PASS |
| Navigation / panel | 30 | PASS |
| Refinement | 13 | PASS |
| Surfaces | 26 | PASS |
| Transformation | 21 | PASS |
| Typography / real local font files | 26 | PASS |

Конкретные пути:

- Проект → вложенная задача → главная Today → completion → Calendar deadline → общий редактор → Projects 100% → delete/Undo → reload. Нет копии в homeTasks или persisted events.
- Quick Add: dirty Task → смена на Note → Continue сохраняет Task draft / Discard открывает Note. Создание и Unicode-поиск заметки → edit → reload → trash → Undo. Rich document не превращается в plain text.
- Note quota error: исходное состояние побайтно неизменно, введённое название осталось, retry успешен. Две вкладки: устаревший Save заблокирован; refresh показывает актуальную запись и сохраняет локальный ввод.
- Привычка с выбранным weekday → check/uncheck → reload → исправление dated history → архив без удаления значений. Модель проверяет смену расписания, исключение будущих отметок и серию.
- Шаблон → plannedSnapshot → Calendar → Open in Sport → изменение шаблона не меняет план → старт → invalid load и quota rollback → повторения/вес → Save entered results для ещё не отмеченного подхода → reload → elapsed/rest catch-up → finish → одна запись истории и done связанного плана.
- Canvas pan/zoom и note edit через entityRef: исходные nodes/edges/viewport остаются эквивалентными до/после. Актуальный текст проецируется из исходной заметки.
- Progress учитывает completion moments и дедупликацию workout IDs; завершённая главная задача не добавляет отдельный счётчик. Неделя начинается в понедельник.
- Все 11 основных представлений и формы Note/Workout/Habit/Project: EN/RU/ES × 320/390/430 px; длинные тексты, отсутствие горизонтального overflow. Landscape 844×390: Save достижим прокруткой редактора. В старых наборах дополнительно проверены уменьшенный viewport клавиатуры, много задач/событий, midnight/background и пустые состояния.
- OS reduced motion и сохранённый motion off, отсутствие icon flights/пружины при off, скрытые элементы не фокусируются. Keyboard route focus обозначен на заголовке, без большой рамки страницы после pointer input; кнопки/поля сохраняют focus-visible.
- Неизвестные enum и кавычки в ID остаются текстом; label/control association сохраняется. Все app requests ограничены loopback в одноразовых синтетических профилях; connect-src none остаётся в CSP.

Непроверено: физические iPhone/Android, Safari/WebKit, системная клавиатура/IME и pickers, реальные safe-area изменения, OS eviction/background suspension, большие реальные desktop-документы, реальный sync/multi-user. Browser clock/background events — управляемая эмуляция, не проверка OS. Масштабирование очень больших проектов/графов потребует индексов и профилирования; импорт не включён. Архив исходников не содержит browser localStorage.

## Визуальные доказательства

Скриншоты — реальные кадры Chromium, локальный Manrope с прежней лицензией. Синтетическая дата примеров фиксирована на 10 ноября 2026. Manrope 200 сохранён в крупных заголовках, 300 в части карточек, 400 в мелком тексте, 500 в основных кнопках. Философ и греческие иконки сохранены. `navigation.css`, исходные поверхности Today и Calendar не переписаны; в navigation.mjs добавлены только честные local captions и подключение ручного reduced motion к существующему контроллеру.

| Пример | Файл |
|---|---|
| Today | [screens/today-en-390.png](screens/today-en-390.png) |
| Today, привычки и философ | [screens/today-habits-philosopher-en-390.png](screens/today-habits-philosopher-en-390.png) |
| Полный Today | [screens/today-full-en-390.png](screens/today-full-en-390.png) |
| Calendar, deadline/importance/completed | [screens/calendar-en-390.png](screens/calendar-en-390.png) |
| Calendar editor | [screens/calendar-editor-en-390.png](screens/calendar-editor-en-390.png) |
| Habits | [screens/habits-en-390.png](screens/habits-en-390.png) |
| Active workout | [screens/sport-en-390.png](screens/sport-en-390.png) |
| Notes / editor | [screens/notes-en-390.png](screens/notes-en-390.png), [screens/note-editor-en-390.png](screens/note-editor-en-390.png) |
| Projects / detail | [screens/projects-en-390.png](screens/projects-en-390.png), [screens/project-detail-en-390.png](screens/project-detail-en-390.png) |
| Canvas viewer | [screens/canvas-board-en-390.png](screens/canvas-board-en-390.png) |
| Progress | [screens/progress-en-390.png](screens/progress-en-390.png) |
| Profile / Settings / Sync | [screens/profile-en-390.png](screens/profile-en-390.png), [screens/settings-en-390.png](screens/settings-en-390.png), [screens/sync-en-390.png](screens/sync-en-390.png) |
| Quick Add | [screens/quick-add-en-390.png](screens/quick-add-en-390.png) |
| RU 320 | [screens/today-ru-320.png](screens/today-ru-320.png), [screens/calendar-ru-320.png](screens/calendar-ru-320.png) |
| Панель normal / expanded / compact, один viewport | [screens/panel-normal-390.png](screens/panel-normal-390.png), [screens/panel-expanded-390.png](screens/panel-expanded-390.png), [screens/panel-compact-390.png](screens/panel-compact-390.png) |
| Полная матрица | Папка [matrix/](matrix/), 135 screenshots + [checks.json](matrix/checks.json) |

[Короткое видео интерфейса, MP4](screens/functional-alpha-demo.mp4): реальные completion feedback, scroll под стеклом, compact по ширине/высоте, drag-переход в сетку, разделы, Quick Add Note, подход тренировки. H.264 390×844, около 12 секунд; [метаданные](screens/visual-verification.json). Использован CDP screencast + уже установленный системный FFmpeg, без установки нового recorder. Параметры самой панели сохранены: 440 ms transform, 25 ms stagger, 320 ms compact, 420 ms active frame. Новое completion feedback подхода использует прежний 565 ms check keyframe; новый focus-маркер — на заголовке при клавиатуре. Reduced motion отменяет движение.

## Запуск

Python 3 и современный Chrome/Edge с localStorage/Web Locks. Никакой npm install и desktop build не требуется.

```sh
cd /workspace/Path
python3 mobile/build.py
python3 -m http.server 8010 --bind 127.0.0.1 --directory mobile/dist
```

Открыть **http://127.0.0.1:8010** на той же машине. Это loopback server, не публикация приложения. Остановка Ctrl+C; HTML через file:// не поддерживается. Для сохранённых данных повторно используйте тот же browser profile, host и port. Очистка site data удалит локальные записи; используйте Settings → Export mobile test data для отдельной JSON копии.

Windows после получения `path-mobile-alpha-source.tar.gz`:

1. Установить Python 3 с launcher `py`, если его ещё нет. Для работы приложения Git/Node/Android Studio/Xcode не нужны.
2. Выбрать пустую папку, например `C:\PathMobile`. Архив должен быть скачан отдельно; наличие файла в облачной рабочей среде этого не доказывает.
3. В PowerShell выполнить (путь Downloads при необходимости заменить):

```powershell
New-Item -ItemType Directory -Force C:\PathMobile
tar -xzf "$env:USERPROFILE\Downloads\path-mobile-alpha-source.tar.gz" -C C:\PathMobile
Set-Location C:\PathMobile\path-mobile-alpha
py -3 mobile\build.py
py -3 -m http.server 8010 --bind 127.0.0.1 --directory mobile/dist
```

4. Открыть http://127.0.0.1:8010 в Chrome/Edge. Точная папка запуска — **C:\PathMobile\path-mobile-alpha**, содержащая `mobile` и `docs`. Терминал сервера оставить открытым. DevTools device mode позволяет посмотреть 320/390/430 px; это не native-приложение.

Для тестов нужны уже имеющиеся в этой среде Node, Playwright/Chromium, Python/fontTools и системный FFmpeg. Установка этих инструментов не является частью запуска прототипа на Windows.

```sh
python3 mobile/typography-preview/build.py
# Второй терминал, помимо server 8010:
python3 -m http.server 8020 --bind 127.0.0.1 --directory mobile/typography-preview/dist
# При работающих 8010/8020:
node mobile/tests/run-polish.cjs --evidence /tmp/path-alpha-validation --with-typography
TZ=Europe/Warsaw MOBILE_ALPHA_VISUALS=/tmp/path-alpha-visuals node mobile/tests/alpha-evidence.cjs
```

## Коммиты, файлы и сохранение результата

- `553ffda778d2668804e21fce9337fcf406a46690` — entity lifecycle model, lazy schema 5, canonical selectors, pure desktop staging + model tests/contract.
- `bff3e7a13ec83f38f05af163b357ff2d52e1c854` — локальные разделы и редакторы, Quick Add, Sport/history/Canvas/Progress, EN/RU/ES, feedback/focus/motion, browser tests и evidence driver.
- `a8f438c19861e6b6b3a4fa7fb8b45027f30c02d7` — сохранение архивных main references и fractional project progress; guards против преобразования неизвестной формы поля в строку.
- `160e1cbfc6919f5c21f11e1caf0f4b84cb2d1a18` — stale editor не воссоздаёт удалённый источник после refresh; черновик остаётся, добавлена двухвкладочная проверка.
- Следующий docs/evidence commit содержит этот отчёт и результаты проверок; его полный SHA сообщается в итоговом ответе и `git log`.

[Полный список изменённых файлов относительно исходного HEAD](CHANGED_FILES.txt) включает код, документацию, каждый screenshot, видео и validation log. Новые модули: date-utils/task-selectors, alpha-model, alpha-ui, alpha-i18n, alpha.css, desktop-adapter; существующий app получил узкие точки подключения. `shared/` не создан. Существующие desktop и root-файлы не менялись.

`python3 mobile/package.py` после чистого commit создаёт **вне репозитория** source archive (committed mobile/docs), bundle feature-ветки с историей и SHA256SUMS в `/workspace/path-mobile-deliveries/<12-char-HEAD>/`. Проверка должна включать hashes, `git bundle verify`, распаковку и сборку исходников, временное восстановление bundle с проверкой HEAD и fsck. Результат проверки и конкретные пути сообщаются в финале; они относятся к этой среде.

В доступном наборе инструментов нет подтверждённой операции выдачи downloadable attachment в чат. Внутренний путь не выдаётся за проверенное скачивание. Файлы и коммиты сейчас сохраняются в этой рабочей копии; их сохранность после уничтожения/замены среды или за пределами чата настройки не подтверждена. Локальный commit и соседний архив — **не внешняя резервная копия**. Git bundle не содержит browser localStorage. Формат JSON export — отдельный `path-mobile-backup` v1, без опасного UI импорта.

## Дальнейшие приоритеты

1. Проверка на физических Safari/iOS и Android: IME, safe areas, background eviction, reduced motion и доступность со screen reader.
2. Отдельный reviewed desktop → runtime activation/import с preview, scoped identity, конфликтами, сложными habit rules и asset resolution; затем только проектирование серверного sync.
3. Program editor, workflow/dependencies, richer Canvas/attachments и долгосрочное восстановление резервных копий — отдельные этапы, без имитации их готовности сейчас.

Desktop, AGENTS.md, main/paperclip-test, Paperclip/его сервисы и worktrees, Daytona, production и реальные пользовательские данные не изменялись. Push, PR, merge, deployment и повторной публикации среды не было. После передачи этого этапа разработка остановлена до решения владельца.
