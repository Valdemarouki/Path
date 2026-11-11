# Воспроизводимость финальных проверок

Только синтетические данные и одноразовые браузерные контексты. Проверки не
открывают listeners, не читают рабочие профили и не отправляют данные наружу.

- `core-compat.log`: **124 PASS**. Команда из корня:
  `node --test mobile/tests/sport-core.test.mjs mobile/tests/alpha-model.test.mjs mobile/tests/desktop-adapter.test.mjs mobile/tests/desktop-compatibility.test.mjs mobile/tests/desktop-test-repository.test.mjs mobile/tests/desktop-actions.test.mjs`.
- `desktop-regression.json` и `check-*.cjs.log`: семь существующих desktop
  проверок после `python3 build.py`; каждый запускается как
  `node project-control/<имя>.cjs`. Отдельные browser acceptance и видео лежат
  в `../browser/desktop/`.
- `phone-helper.log`: **15 PASS**, `python3 mobile/tests/phone-server.test.py`.
  Сокеты и сертификаты заменены mocks; настоящий firewall/доверие не меняются.
- `phone-resume.json`: **9 PASS** на новом typed UI; команда
  `MOBILE_PHONE_RESUME_EVIDENCE=/tmp/path-sport-resume node -r ./docs/sport/validation/local-assets.cjs mobile/tests/phone-resume.cjs`.
  Точный транспорт исторического прогона сохранён как `phone-resume.transport.cjs`.
- `phone-navigation-regression.json`: **47 PASS**, подробности и команды в
  `phone-navigation-regression.md`: viewport 8, gestures 7, layers 14, lifecycle 18.
  Тесты используют локальный request interception через `local-assets.cjs`.

Первый прогон старых navigation fixtures остановился из-за их MIME-таблицы без
`.js`; сохранён как `*.initial.*`. Новый preload исправляет только MIME
локального ответа, исходные assertions не меняет. Реальная Python-раздача
использует стандартный JavaScript MIME. Старые Sport smoke fixtures обновляются
на v4 raw draft вместо устаревшего scalar result и на утверждённую композицию
Library/Schedule; семантические проверки сохранения и планирования остаются.

`desktop-regression.initial.log` сохраняет первый запуск: устаревший scalar
draft assertion и реальная потеря sidebar из-за локализованного anchor. После
исправлений семь сценариев прошли; финальный aggregate — `desktop-regression.log`
и JSON. `sport-dataset-switch/initial-harness-*` сохраняет первоначальный таймаут
автоматизации на закрытом details; тест затем явно раскрывает доступный control.
Это не итоговые результаты: authoritative PASS находится в `verification.json`.

Полные новые UI цепочки: `node mobile/tests/sport-package-browser.cjs` и
`node project-control/check-sport-package-browser.cjs`, JSON и видео в
`../browser/`. В mobile suite дополнительно включён same-ID dataset-switch
regression после failed draft save; отдельное доказательство в
`sport-dataset-switch/`. `node mobile/tests/sport-legacy-template-browser.cjs`
проверяет два режима старого шаблона без exercises, отсутствие побочных записей
при просмотре/Cancel и безопасные явные rename/Add; доказательство в
`sport-legacy-template/`. Физический Safari/iPhone, установленный Windows, реальная
клавиатура, PWA и холодный offline этими проверками не подтверждаются.
