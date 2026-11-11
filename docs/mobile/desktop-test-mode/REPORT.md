# Path Mobile — desktop-данные в настоящих мобильных экранах

Дата: 11 ноября 2026, Europe/Warsaw. Репозиторий `Valdemarouki/Path`, рабочая копия `/workspace/Path`, ветка `feature/path-mobile-alpha`. Начальный HEAD `afcf1c073c21eb0f1f9a1cf1f35f9c2f53ad534e` совпал с ориентиром пользователя; начальный `git status --short` пуст. Сброса, очистки и повторного клонирования не выполнялось.

Подготовлен изолированный test mode **в самом приложении Path Mobile**: синтетический desktop checkpoint → настоящие мобильные экраны → разрешённые правки → отдельное сохранение → reload → desktop-совместимая копия. Это проверка интеграции данных, не облачная синхронизация и не импорт пользовательского экспорта.

## Подключённые экраны

| Экран | Поддержка в test mode | Ограничение |
| --- | --- | --- |
| Today / Tasks | Реальные задачи набора, completion/undo поддерживаемых задач, выбор главной для копии | Поля задачи read-only; нулевые и дробные duration не округляются |
| Calendar | Прежние карточки и редактор с прежними числовыми selectors; title/time/importance поддерживаемого самостоятельного события | Связанные, исторические и recurring данные не редактируются. Completion не включён в whitelist адаптера, поэтому test mode не предлагает его; native completion/IMPACT не заменены |
| Projects | Существующие project/task представления; completion/undo простого child task и согласованные проценты | Создание, metadata/workflow/Gantt/dependencies вне этапа |
| Notes | Существующий список и редактор Markdown body; title/metadata сохраняются | Rich/future blocks и attachments защищены от редактирования и потери |
| Habits | Исходные schedules и реальная история values/checkIns/exceptions | Нет активации неподдерживаемых отметок, правил или ложного счётчика |
| Sport | Реальные templates, planned snapshots, completed records и фактические результаты | Нет новой сессии/планирования/редактирования immutable snapshots |
| Canvas | Существующий поддерживаемый просмотр, либо явный ограниченный просмотр узлов/связей/геометрии сложной доски | Полный grouped Canvas editor не заявляется; граф и координаты не переписываются |
| Progress | Только реально интерпретируемые completion/focus/workout/habit записи и процент проектов | Отсутствующая история не выдаётся за достоверный ноль; planned minutes не считаются actual focus |

Полная структура, свойства и исходные ID сохраняются независимо от того, можно ли показать или редактировать их смысл. Подробности разделены в [ARCHITECTURE.md](ARCHITECTURE.md); desktop facts и ссылки на первоначальные источники — в [CONTRACT.md](../data-compatibility/CONTRACT.md).

## Что реализовано

- Отдельный namespace `path-mobile-desktop-test-v1`, независимый от `path-mobile-alpha-v1`.
- Компактная постоянная пометка «Тестовые данные», выход в обычный локальный режим, список сохранённых test copies.
- Только две подготовленные synthetic fixtures: [plain](../../../mobile/compatibility-preview/fixtures/desktop-v2.json) и [pooled/history](../../../mobile/compatibility-preview/fixtures/desktop-pooled-v2.json). Загрузки реального экспорта в приложение нет.
- CSP мобильной страницы разрешает `connect-src self` для чтения встроенных fixtures вместо прежнего `none`; внешние источники по-прежнему запрещены. Загрузка произвольных файлов не добавлена.
- Новая загрузка создаёт отдельную копию; изменённая предыдущая копия остаётся доступной. Ограничения: 12 копий и 8 MiB всего сохранённого test namespace.
- Существующий [desktop-adapter.mjs](../../../mobile/desktop-adapter.mjs) переиспользован. Новый [test repository](../../../mobile/desktop-test-repository.mjs) хранит полный `original/current`, отдельные prefs и revision, строит одноразовые UI-проекции и переводит разрешённые callback-различия в старые канонические команды. Второго независимого desktop-адаптера нет.
- Save failure не меняет кеш/состояние и не показывает успех; ошибочная загрузка не заменяет рабочую копию. Cross-tab stale write обнаруживается Web Locks + optimistic equality; не реализован автоматический merge.
- Recovery download сохраняет полную кешированную test-копию, актуальную строку test namespace и текущие поля открытых форм до явного refresh. Обычные мобильные записи в recovery не читаются.
- Выбор Main Task — только mobile prefs этой копии. Исходное desktop-поле не выдумано. Неподходящая/недоступная ссылка отбрасывается из проекции.
- Legacy wall time без tzid не получает UTC/Europe/Warsaw. Desktop fallback на текущую системную зону найден в `timezone.js`, но исходная историческая зона из этого не следует; зависимый retime ограничен и объяснён.
- Markdown, описания и названия остаются данными; HTML/скрипты не исполняются. Неизвестные enum показываются как неподдерживаемые, без подмены значения «none».

## Проверки и доказательства

**Итог: 22/22 набора PASS**: 133 model cases (21 новая проверка repository), 26 новых browser-групп и вся прежняя регрессия, включая native completion/IMPACT, Calendar/numeric selectors, typography и navigation. Обе статические сборки успешны; отдельно проверена выдача fixture на loopback typography preview.

[Сводка](validation/summary.json), [логи](validation/test-results.txt), [browser verification](validation/verification.json). Первая попытка нового browser-набора была остановлена строгой валидацией смешанной legacy-записи без timezone, но с instants. Тест исправлен так, чтобы проверять именно отказ загрузки и сохранение предыдущей копии; валидатор не ослаблялся. Финальный набор повторно прошёл все 26 групп. Исходная сводка сохранена отдельно в [initial-run-summary.json](validation/initial-run-summary.json).

В test mode зафиксированы **0 чтений и 0 записей** обычного ключа `path-mobile-alpha-v1`; синтетический native sentinel побайтно сохранился, включая выход в обычный режим и повторный вход. Отдельно проверены conflict draft/recovery, quota failure без ложного успеха, damaged fixture, сохранение после reload, отдельные копии и delayed loading race. Console/page/HTTP/external errors отсутствуют.

[Экспорт после реальных экранов](validation/desktop-export-after-real-screens.json) прошёл фактический изолированный desktop-валидатор. [Точный before/after](validation/export-diff.json) содержит только 13 разрешённых путей: домашняя задача `done/completedAt`; проектная `status/progress/completedAt`; событие `title/hour/duration/importance/start_at/end_at`; заметка `body/updatedAt`. Остальные поля, ID, связи, asset pool/history/unknown props совпадают с pooled fixture. Completion/undo также проверен 21 unit cases вместе с реальной desktop-семантикой прежнего adapter-набора.

[Today с завершённой задачей](screens/today-completed-en-390.png), [Calendar с отредактированной карточкой](screens/calendar-edited-card-en-390.png), [Projects](screens/projects-en-390.png), [редактор Notes](screens/note-editor-en-390.png), а также остальные readonly-экраны и EN/RU/ES × 320/390/430 находятся в screens. [Видео реального взаимодействия](real-screen-workflow.mp4), 22,4 секунды, обычная скорость: Today → Calendar → Projects → Notes → reload. Это реальная запись Chromium.

Физические Windows/iOS/Android, Safari/WebKit, desktop import UI и реальные assistive technologies не проверялись. Использованы только новые синтетические профили Linux Chromium, без desktop app или внешних API.

Обязательная проверка включает A–J через реальные Today/Calendar/Projects/Notes: загрузка pooled fixture, completion домашней и проектной задач, title/time/importance события, Markdown body, reload, повторное открытие редакторов, реальное скачивание экспорта, actual desktop validator и exact allowed-field diff, выход/возврат с неизменным native namespace. Дополнительно проверяются отдельные копии, quotas/ошибки, конфликты двух вкладок, повреждённый fixture, типизированные одинаковые строки ID, `0`/`25.5`, unzoned legacy, recurrence read-only, EN/RU/ES, 320/390/430 px и reduced motion.

Числовые итоги не следует выводить из одного JSON.parse: browser export должен повторно пройти [desktop-oracle.mjs](../../../mobile/tests/desktop-oracle.mjs) и сравнение конкретных полей. Непоказанные ID/связи/вложения/unknown props/history должны оставаться равными fixture.

Автоматические сценарии:

```bash
node --test mobile/tests/desktop-adapter.test.mjs mobile/tests/desktop-compatibility.test.mjs mobile/tests/desktop-test-repository.test.mjs
MOBILE_DESKTOP_TEST_EVIDENCE=/tmp/path-desktop-test-evidence node mobile/tests/desktop-test-app.cjs
# Полная регрессия требует сборок и loopback servers 8010/8020:
node mobile/tests/run-polish.cjs --evidence /tmp/path-desktop-test-release --with-typography
```

## Локальный запуск

Python 3 и современный Chrome/Edge; зависимости для обычного просмотра не устанавливаются. Из полного исходного архива:

```bash
cd /путь/к/распакованной/копии
python3 mobile/build.py
python3 -m http.server 8010 --bind 127.0.0.1 --directory mobile/dist
```

Открыть **http://127.0.0.1:8010/?desktop-test=1**. В панели test mode выбрать новую plain или pooled копию. Либо открыть Settings обычного приложения и перейти по «Desktop test mode».

После правок можно скачать desktop copy и change report. Report имеет вид объект → поле → before/after с указанием отсутствовавших свойств. Выйти действием «Вернуться в локальный режим». При возвращении по тому же адресу/порту в том же browser profile выбранная test-копия и изменения восстанавливаются.

Для готового `path-mobile-desktop-test-windows.zip`: распакуйте в новую папку `C:\PathMobile-Desktop-Test`, проверьте `C:\PathMobile-Desktop-Test\Path-Mobile\index.html`, запустите `py -3 -m http.server 8017 --bind 127.0.0.1 --directory "C:\PathMobile-Desktop-Test\Path-Mobile"` и откройте `http://127.0.0.1:8017/?desktop-test=1`. Source archive содержит mobile/docs; повторение oracle-тестов требует полного репозитория из Git bundle, поскольку они читают pure desktop source. Сам browser runtime desktop-файлы не импортирует.

## Ограничения и сохранность

Тестовые копии существуют локально в конкретном браузерном origin/profile; очистка данных, другой порт, private browsing и утрата среды могут нарушить доступность. Выход из test mode не удаляет namespace. Download/export не означает, что файл уже сохранён вне среды; локальный commit не является внешней резервной копией.

Это не общий importer native schema 5, не desktop import UI, не shared account, не синхронизация, не conflict resolver, не редактор всех desktop-сущностей. Desktop-правок для текущего этапа не требуется. Будущие предложения из предыдущего контракта не реализованы автоматически.

Физические Windows/iOS/Android, Safari/WebKit, реальные IME и assistive technology, desktop Electron/import UI и реальные пользовательские хранилища не проверялись. Browser/oracle проверки выполняются на синтетических профилях и не доказывают эти платформы.

## Изменения и локальная история

[Полный список изменённых файлов](CHANGED_FILES.txt) сравнивается с исходным `afcf1c073c21eb0f1f9a1cf1f35f9c2f53ad534e`. Локальные коммиты кода:

- `ddfbc68e5fbf1043f842437f5035f3d1bf6f6d26` — канонический test repository и его unit tests;
- `e7a625432e48071747ccaed6dda3058803e0918b` — реальные экраны, controls, builds и browser scenario.

Финальный commit добавляет доказательства и документацию, уточняет подпись Save changes тестового редактора и включает необходимые fixtures в typography build. Его SHA/итоговый HEAD и чистый status приводятся в итоговом ответе и DELIVERY.json, чтобы не создавать самоссылку внутри коммита.

Предыдущая поставка `compatibility-afcf1c073c21` проверена по SHA256 и сохранена. Новые source/bundle/SHA256SUMS и готовый ZIP создаются в новом каталоге `path-mobile-deliveries/desktop-test-<HEAD12>` после commit. Проверяются CRC, SHA256, source rebuild в новой временной папке, bundle unbundle/fsck и соответствие source bytes. Конкретные ссылки и подтверждение проверки — в итоговом ответе. Пользовательское скачивание в клиенте не проверено.

Desktop, AGENTS.md, root config/lockfiles, main/paperclip-test, Paperclip, Daytona, production и пользовательские данные не изменяются. Push, PR, merge, deployment и повторная публикация среды не выполняются. После итогового отчёта работа останавливается.
