# Path Mobile — подготовка теста на iPhone

11 ноября 2026, Europe/Warsaw. Репозиторий `Valdemarouki/Path`, `/workspace/Path`, ветка `feature/path-mobile-alpha`. Исходный HEAD `62e07ad1ebfdfbfc746e4fdccb6ffc8edff17e0a`, исходный status пуст; совпал с ориентиром пользователя. Reset/clean/повторное клонирование не выполнялись.

**Пакет подготовлен; физический iPhone ещё не проверен.** Выбран iPhone 12 Pro, Safari, Windows 11, одна домашняя Wi-Fi сеть. Точная версия iOS неизвестна. Сборка имеет видимый бейдж `PHONE R1` и идентификатор `phone-preflight-2026-11-11-r1`, также доступный в Settings, phone-check и BUILD.txt. Последний содержит конкретный HEAD поставки.

## Подтверждённые проблемы и исправления

| Наблюдение | Исправление и проверка |
| --- | --- |
| Save существующего события центрировал карточку и сдвигал Calendar | Захватывается existing/editing до close; возвращается focus без прокрутки. В baseline сдвиг −164 px, в финальном прогоне 1897→1897 px |
| При неизменном layout 844 px и visual viewport 430 px подтверждение оказывалось ниже доступной области | Sheet учитывает высоту/offset visual viewport; CSS min с 100dvh защищает немедленный resize. В модели Save теперь 401,5≤430 px; long drafts и Cancel сохранены |
| Фокус на самом #content блокировал обновление NextEvent после фона | Обновление зависит от дня/ID/ongoing/timezone; контейнер не считается полем ввода. Body обновляется при смене дня за нетронутой формой |
| Независимые страницы пересоздавались в полночь, включая живой Sport | Sport/Notes не требуют такого пересоздания; черновики в живой странице сохраняются. Разрушение страницы ОС остаётся отдельным неподтверждённым случаем |
| Workout interval просыпался каждую секунду даже вне Sport | Таймер существует только для видимого непоставленного на паузу Sport. Background/pagehide/route exit прекращают его; foreground пересчитывает время по timestamps |
| Calendar создавал formatters на каждой строке | Два ограниченных кеша immutable Intl.DateTimeFormat: по locale/zone и для zoneParts. Результаты времени не кешируются; DST/даты/исходные поля не меняются |
| После смены системной timezone время могло остаться старым | Zone включена в clock key. CDP Warsaw→New York меняет 11:00→05:00 после focus, source tzid и сохранённые записи остаются прежними |

Дизайн, характер IMPACT, материал стекла/noise, модели данных, namespace и ограничения desktop-совместимости сохранены. PWA, service worker, обновление/кеширование приложения и новые аккаунты не добавлялись.

## Проверки

[Сводка](validation/summary.json): **11/11 выбранных наборов PASS**. Единицы счёта различаются: browser group, unit case, matrix scenario; их не следует складывать в число физических тестов.

- Новые: viewport model 8, реальные CDP touch-жесты 7, resume 9, performance/offline 7, HTTPS-helper 15 unit tests без сетевого прослушивания.
- По причине изменений повторены только 5 затронутых прежних browser suites: browser 55, Calendar editor 72, numeric 27, functional Alpha 34, desktop actions 31; 4 файла Calendar/adapter models — 69 cases. Полный прежний прогон 23 suites не повторялся.
- Обе статические сборки успешны. Корректность timezone/DST и desktop-экспорта проверена затронутыми моделями и прежними integration flows.
- Expanded panel удерживает фон; nested numeric Cancel сохраняет parent draft/scroll. Повороты 320/390/844 px сохраняют ввод, последняя карточка и подтверждение достижимы. Touch-прокрутка отменяет hold без записи.
- В живой странице сохраняются workout inputs, таймер правильно учитывает разрыв/паузу, сохранённая тренировка переживает reload. Перед намеренным reload несохранённые inputs требуют **Save inputs**. Выгрузка страницы ОС и реальная блокировка iPhone не тестировались.
- Диагностика `/phone-check.html` не читает native/test namespaces: временный probe выполняет set/get/remove только своего случайного ключа и удаляет его. При отсутствии Web Locks запись не выполняется.

[Логи](validation/test-results.txt), [viewport](validation/viewport.json), [жесты](validation/gestures.json), [resume](validation/resume.json). Начальные проверки поймали также регрессию обновления даты за формой и немедленного изменения высоты; обе исправлены и повторно прошли исходные assertions. Проверки не заменялись ослабленными условиями.

Visual viewport проверен **JS-моделью**, не OS-клавиатурой. Вычисленный шрифт полей — 16 px. CDP safe-area override недоступен, env-инсеты в эмуляции равны нулю. Физические safe areas, адресная панель, инерция Safari, реальные клавиатуры/IME/диктовка, меню сертификата и фоновые ограничения iOS остаются в пользовательском чеклисте.

## Производительность и offline

[Полные условия/таблицы](PERFORMANCE.md), [before/after](validation/performance-BEFORE_AFTER.json). Наборы воспроизводятся через `mobile/tests/phone-fixtures.mjs`: normal 24 events/32 notes, large 400/400, около 722 KB. Не загружаются в приложение по умолчанию.

Linux Chromium headless, 390×844, DPR 1, без CPU throttling, общая облачная машина. Большой Calendar: 147–249 ms до оптимизаций, 99–107 ms в финальных двух наблюдениях. Formatter constructions — 3 при первом заходе и 2 при повторном; после только первого кеша было измерено 402. Нормальный набор не стал достоверно быстрее в каждом замере: шум/порядок запусков существенны. Остались long tasks 52–86 ms; это не обещание FPS iPhone.

DOM/обработчики не накапливаются после повторов. После успокоения нет pending RAF/timeouts/animation layers, остаётся один clock interval 30 s. IMPACT ограничен видимыми карточками: 5 animations/1 layer и на большом наборе. Программный scroll p95≈16,7–16,8 ms не является измерением физической инерции/FPS Safari.

| Сценарий | Подтверждено |
| --- | --- |
| A: сеть полностью пропала в уже загруженной странице | Локальная синтетическая запись работает; загрузка нового fixture/неполученного ресурса требует сервера |
| B: cold reload без доступного app server | Не поддержан; проверено с отключённым/очищенным HTTP cache |
| C: новая страница после закрытия, server недоступен | Не поддержан; localStorage не загружает код приложения |
| Внешнего Internet нет, но локальный server доступен | Reload/новая страница работают, внешних ресурсов нет |

Неудачный offline launch не удалил сохранённые синтетические записи; восстановление подключения вернуло их. Это браузерное наблюдение, не гарантия сохранности Safari при eviction/Private browsing. [Предложение PWA](OFFLINE_PROPOSAL.md) отделено от реализации.

## Пакет и пользовательский прогон

[ACCESS.md](ACCESS.md) — подробные раздельные действия на Windows и iPhone. [PHONE_CHECKLIST.md](PHONE_CHECKLIST.md) — 15–20 минут после настройки HTTPS с ожидаемыми результатами и шаблоном ошибки. Точная iOS нужна для уточнения меню и физического подтверждения API.

Готовый ZIP содержит `Path-Mobile/`, `Tools/serve-phone.py`, `OPEN-IPHONE.html/.txt`, `PHONE-CHECKLIST.html/.txt`, `Instructions/` и BUILD.txt. Распаковать в новую `C:\PathMobile-Phone-Test`. Для проверки только на компьютере:

```powershell
py -3 -m http.server 8019 --bind 127.0.0.1 --directory "C:\PathMobile-Phone-Test\Path-Mobile"
```

Открыть `http://127.0.0.1:8019/phone-check.html`, затем обычный `/` или `/?desktop-test=1`. Остановка Ctrl+C. Этот localhost с iPhone не указывает на Windows.

Для домашней Wi-Fi нужен доверенный HTTPS; raw LAN HTTP не даёт требуемого secure context/Web Locks. Инструкция описывает ручной scoped mkcert, проверку CA, доверие iOS, узкие Private firewall-правила и запуск helper на конкретном IP. Private keys — только в профиле Windows под LOCALAPPDATA, вне пакета/HTTP root. В пакет не включаются mkcert.exe, сертификаты или ключи.

**Ни один LAN-listener, firewall rule, туннель, сертификат или trust не был настроен агентом.** В лаборатории использованы существовавшие loopback 8010/8020. HTTPS-helper проверен без открытия сокетов. Сертификат-only bootstrap и установка CA остаются будущими ручными действиями; предупреждения Safari не обходятся.

## Сохранность и история

Исходная поставка `desktop-actions-62e07ad1ebfd` проверена по SHA256 и сохранена. Новые архивы создаются в отдельном `phone-preflight-<HEAD12>` после commit, с проверкой source rebuild и bundle restore. [Полный список изменений](CHANGED_FILES.txt) сравнивается с исходным 62e07ad.

Локальные коммиты кода:

- `5e3894e7a0bd0f02032f393184cd6eb144d2ccaf` — viewport/foreground/scroll/timers/formatters, идентификация и focused tests;
- `7ad973c6e5f3254a9f6ffb7bc39b5c2553f93809` — ручной HTTPS/public-CA helper и 15 mocked tests.

Итоговый commit сохраняет документы и доказательства; его полный SHA, clean status и ссылки на доставку приводятся в итоговом ответе/DELIVERY.json. Пользовательское скачивание клиентом не проверено. Source/bundle не включают browser localStorage; внешний backup появляется после скачивания и отдельного сохранения exports/recovery.

Desktop, AGENTS.md, Paperclip, Daytona, main/paperclip-test, production и реальные пользовательские данные не изменены. Push, PR, merge, deployment и публикаций среды не было. После подготовки этап останавливается. **Физический тест не объявляется завершённым.**
