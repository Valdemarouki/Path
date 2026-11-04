# Карта исходников

| Задача | Где начать |
| --- | --- |
| Сборка интерфейса | build.py читает original.html и модули JS/CSS, добавляет SVG, переводы и скрипты. Генерирует standalone HTML, preview/dist/index.html и два файла проверки JS. |
| Данные и календарные даты | storage.js отвечает за загрузку, валидацию, историю и сохранение. timezone.js определяет локальный день. domain/ содержит общий код модели. privacy-export.js относится к экспорту. |
| Навигация и привычки | shell-navigation.js восстанавливает состояние вкладок. home.js формирует Today. habits.js, habit-history.js и habit-sources.js отвечают за расписание, отметки и источники. |
| Остальные разделы | Исходные модули calendar*, projects*, canvas*, sport*, notes*, progress* лежат в корне. Оформление находится в соседних CSS-файлах, тексты интерфейса — в i18n/. |
| Windows-оболочка | desktop/prepare.cjs собирает локальные ресурсы и HTML для Electron. desktop/main.cjs создаёт окно и профиль. preload.cjs предоставляет ограниченный интерфейс между страницей и главным процессом. |
| Аккаунты и обмен | desktop/account-*.cjs, desktop/sync*-host.cjs, cloud-sync/ и sync-preparation/ содержат клиентские адаптеры и модель синхронизации. Копии в desktop/cloud-sync/ и desktop/sync-preparation/ генерируются. |
| Обновления | desktop/update-security.cjs проверяет подпись и части файла. update-engine.cjs организует загрузку. desktop/build/installer.nsh расширяет установщик NSIS. При замене версии участвует деинсталлятор ранее установленного выпуска. |
| Проверки | project-control/check-*.cjs покрывают отдельные сценарии. desktop/qa/ содержит проверки упаковки и сценарии для тестовой Windows. |

Меняй исходный модуль и пересобирай интерфейс. Порядок включения скриптов в build.py значим. Сгенерированные HTML и копии модулей не нужно коммитить.
