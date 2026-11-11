# Регрессия панели и подготовки телефона

11 ноября 2026: **47 групп PASS** на текущем `mobile/dist`:

| Неизменённый тест | Результат |
| --- | --- |
| `phone-viewport.cjs` | 8 PASS |
| `phone-gestures.cjs` | 7 PASS |
| `navigation-layers.cjs` | 14 PASS |
| `navigation-lifecycle.cjs` | 18 PASS |

Команда для каждого файла: `node -r ./docs/sport/validation/local-assets.cjs mobile/tests/<имя>.cjs`.
Логи, JSON исполнения и подробные результаты сохранены рядом; сводка —
`phone-navigation-regression.json`.

Использованы новые синтетические профили Linux Chromium, локальный перехват
запросов и текущая сборка. Серверы, listeners, туннели и сетевой доступ не
открывались. Это не проверка физического iPhone/Safari, системной клавиатуры или
приостановки приложения iOS.

Первый запуск двух navigation-тестов остановился до появления Today: их
собственные старые таблицы MIME не знали расширение `.js` новых доменных
модулей. Исправлен только транспортный preload: для `.js` он заменяет
`application/octet-stream` на `text/javascript`. Утверждения и исходные файлы
четырёх тестов не менялись. После этого оба теста прошли; первоначальные
timeout-логи и JSON сохранены как `navigation-*.initial.*`.
