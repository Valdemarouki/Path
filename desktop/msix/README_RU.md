# MSIX — подготовка, не готовый Store-релиз

Electron/Win32 x64 может быть упакован как full-trust desktop-приложение. Приложение пишет данные вне каталога установки; отсутствуют драйверы и службы. Нельзя просто переименовать NSIS EXE в MSIX.

1. Получить точные Identity Name, Publisher (CN=...) и PublisherDisplayName из Partner Center. Не придумывать юридического издателя. Зарезервировать имя приложения.
2. Собрать win-unpacked. Выполнить `node msix/prepare.cjs "IdentityName" "CN=actual-publisher" "Actual publisher" "2.0.0.0"` с реальными значениями. Стадия помещается в release/msix-stage; существующая стадия не перезаписывается.
3. На Windows SDK: `MakeAppx.exe pack /d release\msix-stage /p release\Path-2.0.msix`. Не использовать /nv (пропуск валидации). Далее WACK и тестовые установка, обновление, удаление.
4. В шаблоне запрошены runFullTrust и unvirtualizedResources. В Windows 11 исключён только профиль RoamingAppData\Path-Paperclip-Test; для Windows 10 предусмотрено отключение виртуализации файловых записей. Это требует обоснования restricted capability при рассмотрении Store. Поддержка ОС и фактическое поведение должны пройти тесты.
5. Если Store не одобрит unvirtualizedResources, сначала изменить стратегию сохранения/экспорта и повторить проверку. Не выпускать MSIX с обещанием сохранения данных после удаления по умолчанию: виртуализированные данные пакета могут удаляться.
6. Проверить отсутствие одновременного доступа NSIS и MSIX версий к одному Chromium-профилю. До проверки совместное использование не поддерживается; NSIS-приложение нужно закрыть перед Store-версией. Не менять существующий профиль автоматически.
7. Для тестовой установки нужна доверенная подпись; не отключать SmartScreen, Smart App Control или проверку сертификатов. Store подписывает одобренный MSIX при распространении. NSIS остаётся отдельным каналом.

Подготовлены manifest template, staging script и три размера логотипа. MSIX не собран, не подписан, не сертифицирован и не отправлен в Store.

Источники (проверены 30.10.2026):
- https://learn.microsoft.com/en-us/windows/msix/desktop/flexible-virtualization
- https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options
