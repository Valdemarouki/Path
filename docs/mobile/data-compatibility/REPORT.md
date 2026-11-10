# Path Mobile — проверяемая совместимость desktop-данных

Дата отчёта: 11 ноября 2026, Europe/Warsaw. Рабочая копия `/workspace/Path`, репозиторий `Valdemarouki/Path`, ветка `feature/path-mobile-alpha`. Исходный HEAD `55f7ff8290fcc8be39e3d05f5dbaf293e441b42a`; исходный `git status --short` пуст. Предыдущая история сохранена, существующий проверенный checkpoint этого HEAD актуален. Сбросов/clean/clone не было.

Реализован работающий **desktop checkpoint → мобильное представление → точечные изменения временной копии → desktop checkpoint**. Это подготовка совместимости, не синхронизация и не импорт в рабочее мобильное хранилище.

## Реализация

- Расширен существующий [desktop-adapter.mjs](../../../mobile/desktop-adapter.mjs). Старый lossless staging сохранён; параллельного контейнерного адаптера нет.
- [desktop-inspector.mjs](../../../mobile/desktop-inspector.mjs) — семантическая диагностика, области идентичности, обязательные поля/типы, ссылки, интервалы/зоны/fold, серии/исключения, история и snapshots, asset refs, разрешённые операции.
- `parseDesktopInput` проверяет UTF-8 byte budget, JSON, структуру, повторяющиеся имена свойств и числа, которые JSON.parse иначе округлил бы/превратил в ноль. Unsafe keys, getters/accessors, sparse arrays и не-JSON значения отвергаются.
- `desktopToMobileView` возвращает immutable view вместе с полным canonical staging. `mobileViewToDesktop` экспортирует исходный полный payload, а не урезанные UI DTO.
- `applyDesktopEdit` принимает только разрешённые команды; права повторно выводятся из полного исходника, не из потенциально подделанного списка возможностей view. Title/importance обновляют только выбранное поле. Time использует существующий `saveEvent`, но обратно копируются только timing fields. Task completion использует `toggleTask`, Markdown — `saveNote`; неизвестные/непоказанные поля не заменяются значениями по умолчанию.
- Существующие runtime модели, numeric picker, navigation и completion/IMPACT не переписывались. Изменения ограничены mobile/ и docs/mobile/.

## Совместимость по сущностям

Подробный обязательный field map со storage/export, ID, enum, связями, датами/историей/повторениями и ссылками на source: [CONTRACT.md](CONTRACT.md). Хеши прочитанных desktop-файлов: [SOURCES.json](SOURCES.json).

| Сущность | Статус текущего этапа |
|---|---|
| Tasks | Без потерь как полный источник; basic completion/undo в копии. Сложные/связанные задачи view-only. Persisted desktop Main Task не найден; выбор main существует только в контексте мобильного preview и не добавляет поле в desktop |
| Calendar | Без потерь; standalone title/time/importance edits. Linked/history/recurrence read-only. Неизвестные enum сохраняются opaque; новые значения не подставляются |
| Habits | Read-only полный просмотр расписаний, количественных/weekly/sport-source правил, истории, отмен, skips/availability; без упрощения до mobile completion |
| Sport | Read-only template/planned/completed snapshots, фактические результаты reps/seconds/kg и связи. Нет превращения mobileLoadKg в desktop actualValue |
| Projects | Полная структура/связи сохранены, basic task completion меняет исходную nested-задачу. Project workflow/Gantt/dependencies/milestones read-only |
| Notes | Поддерживаемый Markdown body редактируется с сохранением full record; вложения/future blocks/сложное содержимое read-only и не уничтожаются |
| Canvas | Полный read-only graph: узлы/edges, source refs, координаты, viewport, collapsed groups и attachments сохраняются; никакого flatten или новых ID |
| Progress | Сохраняются исходные completion/focus/workout/habit evidence; не создаются выдуманные даты, метрики или новая Progress-коллекция |
| Неверный/неизвестный формат, опасная структура, дубли задач/разорванные live-связи | Безопасное представление блокируется с диагностикой; отсутствует частичный молчаливый импорт |

## Синтетический набор и реальные расхождения

[Обычный desktop export v2](../../../mobile/compatibility-preview/fixtures/desktop-v2.json) и [repository checkpoint с codec 2/history](../../../mobile/compatibility-preview/fixtures/desktop-pooled-v2.json) сформированы детерминированно. Включены:

- 12 Calendar events: все 6 типов и 4 важности, completed, midnight, оба DST fold, linked project session, planned/completed workout; bounded daily series с cancelled occurrence и moved exception;
- 3 home tasks + 3 project tasks, три project status, все task status, deadline/workflow/dependencies/subtask/source-note, completedAt; duration 0, дробная и отсутствующая длительность различаются;
- 4 habits: daily completion, selected-day count goal, weekly duration goal, sport source, dated values/checkIns, отмена через 0 и отсутствующий check-in, skipped/availability;
- template/program/плановый snapshot и completed record с реальными синтетическими reps/fractional seconds/kg, one-based set index и immutable snapshot;
- длинный Markdown, Unicode, private synthetic Journal, вложение, future block/editor metadata; Canvas groups/edges/typed entity refs/viewport и общая embedded asset reference;
- unknown/null/false/0/empty properties на разных уровнях и metadata/history envelope.

Число элементов подтверждено machine-readable preflight. Ни реальные пользовательские файлы/профили, ни desktop stores не читались. В браузере все контексты новые, запросы ограничены loopback.

Обнаруженные расхождения:

1. Старое описание project-scoped desktop task IDs было неточным: `storage.js:pathValidate` требует уникальность среди всех project/home tasks. Исправлено в текущей документации; raw staging не считается доменной валидацией.
2. Desktop разрешает одинаковую строку ID у разных видов сущностей. Для реальной активации нужен typed ref, не глобальная замена ID.
3. Сохраняемой desktop ссылки Main Task в данном снимке не найдено. `activeFocus.taskId` относится к таймеру focus, не доказательство persisted daily-main. В fixture выбрана главная только в контексте mobile view; обратный desktop JSON не меняется.
4. Desktop numeric createdAt, zero/fractional task duration и некоторые лимиты/правила Habits/Sport шире live Mobile schema 5. Прямой migrate/replace всего state поэтому не включён.
5. Rich UI Notes сохраняет Markdown body; future blocks/attachments нельзя терять при обычном text save.
6. Legacy time без tzid нельзя безопасно переносить по текущей зоне машины. Metadata-only изменения возможны без retime; исходные поля не нормализуются.
7. User backup, repository checkpoint/history, single note/canvas и native mobile backup — разные входные форматы; неподдерживаемые обёртки не смешиваются.

## Preview и запуск

После `python3 mobile/build.py` инструмент находится по адресу **`http://127.0.0.1:8010/compatibility-preview/`** при обычном локальном static server. Он показывает формат/версию, количества, editable/view/opaque records, ошибки, duplicate IDs, missing references, unknown fields и opaque scopes. В UI явно указано, что partial edits не означают полную runtime-совместимость.

Load synthetic example выбирает plain или pooled fixture. File picker допускает только ограниченный UTF-8 JSON; при ошибке edit/export отключаются. Все содержимое, названия и описания выводятся через textContent/value, не как исполняемый HTML.

Experiment on a copy позволяет проверить требуемые действия; Apply меняет только immutable-source-derived копию в памяти. Ошибка нескольких полей не применяет даже первую успешную часть. Reset возвращает исходный sample; reload удаляет временный эксперимент. Download desktop copy создаёт новый файл, не пишет исходник, desktop repository или mobile storage. Изменённый current state с сохранёнными revision/undo/redo — исследовательская копия для проверки file-import, не замена внутреннего repository checkpoint и не серверная операция.

```bash
cd /workspace/Path
python3 mobile/build.py
python3 -m http.server 8010 --bind 127.0.0.1 --directory mobile/dist
# http://127.0.0.1:8010/compatibility-preview/
```

Для готового Windows ZIP (если используется новая поставка): Python 3 + Chrome/Edge, новая папка `C:\PathMobile-Compatibility-Test\Path-Mobile`, затем `py -3 -m http.server 8017 --bind 127.0.0.1 --directory "C:\PathMobile-Compatibility-Test\Path-Mobile"`; открыть `http://127.0.0.1:8017/compatibility-preview/`. Node нужен только для автоматических тестов, не приложения.

Source archive содержит mobile/ и docs/mobile/. Для повторения oracle-проверок нужен **полный репозиторий из Git bundle**, поскольку тест читает исходные desktop storage.js/timezone.js/integration.js. Готовому ZIP и самому preview desktop-файлы не нужны: они не импортируются браузерным runtime. Архивы проверяются в отдельных временных каталогах, существующая рабочая копия не заменяется.

## Проверки

**Итог: 21/21 suites PASS**, включая 112 model cases (26 новых domain cases), 27 новых desktop preview browser groups и прежние Numeric/Calendar/IMPACT/navigation/functional suites. Это разные единицы счёта — unit case, flow, matrix group, а не независимые ручные сценарии на телефоне. Обе статические сборки успешны. Все новые браузерные контексты завершились без page exceptions, console errors/warnings, HTTP errors и внешних запросов.

[Summary](validation/summary.json), [полные логи](validation/test-results.txt), [browser verification/storage isolation](validation/browser.json), [точные JSON diff paths и desktop validation после правок](EDIT_ROUNDTRIPS.json).

[Preflight EN 390](screens/report-en-390.png), [ошибка duplicate task ID RU 320](screens/duplicate-id-report-ru-320.png), [readonly rich note](screens/opaque-note-en-390.png). Остальные matrix screenshots доступны в screens. Проверки адаптера и preview включают:

- Desktop codec/pathValidate реально выполняется в VM на синтетическом JSON: [desktop-oracle.mjs](../../../mobile/tests/desktop-oracle.mjs). Загружаются только pure функции из прочитанных source; repository class/DOM/Storage/network/app startup не выполняются.
- Source → view → export проверяется через deep semantic equality, а не только parse; повторения не добавляют объекты. Input/view/output независимы, view frozen.
- После title/time/importance/task done/undo/note body сравниваются точные изменённые JSON paths, остальные записи/поля/связи/asset pool/history остаются идентичны. Результаты повторно проходят настоящий desktop validator. Completion/undo сравниваются с реальным desktop `setTaskComplete` при фиксированном синтетическом времени.
- Absence/null/false/0/empty, неизвестные enums, both folds/midnight, зоны UTC/New York/Kiritimati, rich note/Canvas/cancelled series round-trip, duplicate/invalid IDs, missing refs, corrupt/version/type/oversize/UTF-8/unsafe/precision cases.
- Browser preview tests блокируют Storage get/set/remove/clear/key, проверяют ноль вызовов и неизменные sentinels. Файл с `<script>`/onerror и внешним URL не исполняется и не загружает внешние ресурсы.
- EN/RU/ES × 320/390/430, экспорт через реальный browser download, disabled export при ошибке, readonly сложного содержимого, reset/reload и reused numeric picker Cancel.

Команды:

```bash
node --test mobile/tests/desktop-adapter.test.mjs mobile/tests/desktop-compatibility.test.mjs
MOBILE_DESKTOP_PREVIEW_EVIDENCE=/tmp/path-desktop-preview node mobile/tests/desktop-preview.cjs
# Для полной регрессии: сборка обоих preview и loopback servers 8010/8020:
node mobile/tests/run-polish.cjs --evidence /tmp/path-desktop-release --with-typography
# Явная регенерация только синтетических fixtures:
node mobile/tests/make-desktop-fixtures.mjs
```

## Что ещё нельзя обещать

Это не универсальная активация desktop-state в schema 5 и не импорт существующих пользовательских данных. Нет merge, auto replace, cloud/account/shared sync, ACL/outbox/conflict resolver, asset rendering/upload, повторений/advanced habits/program editing. Opaque scopes сохраняются без полной доменной интерпретации. Preview limit 8 MiB не покрывает все desktop backups до 64 MiB.

Desktop app/Electron/Windows import UI, физические iOS/Android, Safari/WebKit, реальные IME/assistive technology и большие реальные asset pools не проверены. Проверен фактический pure desktop codec/validator на синтетике и Linux Chromium. Для текущего этапа desktop-правки не нужны; минимальные будущие предложения отделены от фактов в [CONTRACT.md](CONTRACT.md).

Локальные коммиты кода: `19327f83df1f7e8b3d224e497adc90613579b9d3` — semantic adapters/canonical edits, actual desktop oracle и fixtures; `fbc594e888b1e2b532425df370f01a239046b9e5` — isolated preview/build/browser regression. Отдельный commit документации/доказательств и полный конечный HEAD указаны в итоговом ответе. Полный список изменений относительно исходного HEAD — [CHANGED_FILES.txt](CHANGED_FILES.txt). Итоговый чистый git status проверяется после коммита доказательств. Все архивы до скачивания остаются внутри среды, локальный commit не является внешней резервной копией.

Desktop, AGENTS.md, root config/lockfiles, main/paperclip-test, Paperclip, Daytona, production и реальные пользовательские данные не изменены. GitHub push/PR/merge/deployment и публикации среды не было. После отчёта работа останавливается.
