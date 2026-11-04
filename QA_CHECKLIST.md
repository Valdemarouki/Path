# Проверки тестовой копии
Начальный прогон из корня требует Git, Python 3 и Node.js. Команды ниже запускаются в Bash (в Windows подойдёт Git Bash с Python 3 в PATH).
```bash
git status -sb
git remote -v
python3 build.py
node desktop/prepare.cjs
node desktop/check.cjs
node project-control/check-storage.cjs
TZ=Europe/Warsaw node project-control/check-habits.cjs
node project-control/check-recurrence.cjs
git status --short
```
Ожидаемый результат — ветка paperclip-test, пустой список remote, успешная сборка, сообщения PASS и пустой вывод последней команды. build.py использует существующую папку preview/dist, включённую в Git.

- [ ] Для регрессии RC18 отдельно подготовить зависимости по project-control/i18n-tools/package-lock.json (`npm ci --prefix project-control/i18n-tools --ignore-scripts` в изолированной среде с доступом к реестру пакетов), затем выполнить `node project-control/check-daily-route-date.cjs`. В первом автономном прогоне зависимость jsdom не требуется.
- [ ] Открыть локальный preview/dist/index.html в одноразовом браузерном профиле. Создать привычку, отметить её и проверить результат после перезагрузки.
- [ ] Проверить ежедневную и недельную привычки на запланированный и свободный дни. После навигации с другой даты Calendar проверить дату Today, счётчик и историю отметок.
- [ ] Для изменений хранения проверить перенос синтетического экспорта, повторное открытие, Undo/Redo и отказ записи. Для изменений синхронизации использовать имитацию транспорта или отдельную локальную БД.
- [ ] Нативные сценарии Windows испытывать в отдельной VM со снимком. Сохранить логи и сверить тестовый профиль до и после. Сборка HTML под Linux не проверяет обновление установленной Windows-программы.
