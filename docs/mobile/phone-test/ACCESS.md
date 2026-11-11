# iPhone 12 Pro Safari → Windows 11: ручной локальный HTTPS

Выбранная конфигурация: **iPhone 12 Pro, Safari, Windows 11, одна домашняя Wi-Fi-сеть**. Версия iOS будет уточнена. Ни телефон, ни настройки Windows этой инструкцией автоматически не меняются. Физический тест ещё не выполнен.

Ниже — подготовленный план ручных действий пользователя. Агент не устанавливал CA, не запускал LAN-сервер, не создавал сетевые правила, туннель или публикацию. Перед выполнением пользователь должен решить, что разрешает временный локальный HTTPS и установку именно этого тестового CA.

## Почему нужен HTTPS

Пользовательское сохранение в [app.mjs](../../../mobile/app.mjs), `commit`, требует `navigator.locks`. На компьютере доверенным локальным origin может быть `http://127.0.0.1`; на iPhone этот адрес означает сам iPhone, а не Windows. Обычный `http://192.168.…` по Wi-Fi не даёт secure context: страница может открыться, но полноценное сохранение недоступно.

Используем согласованный **`https://<IPv4-компьютера>:8443/`** с корректно доверенным локальным CA. Safari не должен показывать предупреждение о соединении. Нельзя нажимать «всё равно открыть» или менять browser security flags. Если iOS/Safari не предоставляет Web Locks даже в корректном HTTPS, тест записи останавливается до уточнения версии/совместимости.

Для передачи открытого CA предусмотрен отдельный короткоживущий HTTP-bootstrap. Он отдаёт **только публичный сертификат**, не приложение и не ключи. Это способ первоначальной доставки CA, а не запуск приложения через небезопасный origin.

## 1. Подготовьте пакет и запишите сборку

Нужны Python **3.10 или новее** с launcher `py`, PowerShell и поставляемый `Tools\serve-phone.py`. Node/npm/Git для готового ZIP не нужны.

1. Распакуйте пакет в **новую** папку `C:\PathMobile-Phone-Test`. Не перезаписывайте старую копию.
2. Проверьте:

```text
C:\PathMobile-Phone-Test\Path-Mobile\index.html
C:\PathMobile-Phone-Test\Path-Mobile\BUILD.txt
C:\PathMobile-Phone-Test\Tools\serve-phone.py
```

3. Запишите Build/HEAD из `BUILD.txt`. Если архиватор добавил лишнюю папку, сначала найдите фактическую папку с `Path-Mobile` и `Tools`.
4. Откройте обычный PowerShell:

```powershell
Set-Location C:\PathMobile-Phone-Test
py -3 --version
```

Версия в выводе `py -3 --version` должна быть не ниже 3.10: это требование поставляемого HTTPS-helper. Если установлена более старая версия, сначала установите поддерживаемый Python с официального python.org; команды сервера не запускайте наугад.

Схема будущих файлов:

```text
Path-Mobile\                 Только web-приложение и synthetic fixtures
Tools\serve-phone.py         Поставляемый сервер
Tools\mkcert.exe             Загружается пользователем из официального release
%LOCALAPPDATA%\PathMobile-Phone-Test\Private\CA\rootCA.pem     Публичный CA
%LOCALAPPDATA%\PathMobile-Phone-Test\Private\CA\rootCA-key.pem СЕКРЕТНЫЙ ключ CA
%LOCALAPPDATA%\PathMobile-Phone-Test\Private\phone-cert.pem     Сертификат HTTPS
%LOCALAPPDATA%\PathMobile-Phone-Test\Private\phone-key.pem      СЕКРЕТНЫЙ ключ сервера
Trust\Path-Mobile-Local-CA.cer Только публичный CA для передачи на iPhone
```

**Не копируйте `rootCA-key.pem` или `phone-key.pem` внутрь `Path-Mobile` или `Trust`. Не отправляйте их в чат, ZIP диагностики или на телефон.** Private располагается в локальном профиле текущего пользователя Windows, вне распакованного пакета. Это также уменьшает риск случайно включить ключи в ZIP. Не создавайте её в общем корне C:\. Сервер проверяет отделение cert/key от document root; это не заменяет правильный выбор папок.

## 2. Узнайте два локальных IPv4

На Windows выполните:

```powershell
ipconfig
```

Найдите **IPv4 Address / IPv4-адрес активного Wi-Fi-адаптера**. Не берите Default Gateway/основной шлюз, DNS, адрес VPN/виртуального адаптера или `127.0.0.1`.

На iPhone: **Настройки → Wi-Fi → ⓘ у подключённой домашней сети → IPv4-адрес → IP-адрес**. Не используйте поле «Маршрутизатор». Названия могут отличаться в версии iOS; версия пока не сообщена.

В PowerShell введите реальные значения локально:

```powershell
$pathPcIp = Read-Host "IPv4 Windows из ipconfig"
$pathPhoneIp = Read-Host "IPv4 iPhone из Wi-Fi"
```

Не публикуйте эти значения в bug report без необходимости. Предстоящие команды используют их как адреса данных, а не как shell-код. Если адрес изменится из-за DHCP, остановите сервер и обновите адреса, сертификат и собственные временные правила; не отключайте проверку сертификата.

Сеть Windows должна быть вашей доверенной домашней **Private / Частной** сетью. Если она Public, профиль не меняется автоматически: выберите частный профиль вручную только для своей домашней сети либо остановитесь. Гостевая Wi-Fi-сеть/client isolation может блокировать связь устройств; не включайте port forwarding на роутере и не ослабляйте его защиту ради теста.

## 3. Создайте отдельный тестовый CA на Windows

Официальный проект: [mkcert](https://github.com/FiloSottile/mkcert), [готовые releases](https://github.com/FiloSottile/mkcert/releases). Скачайте Windows-binary для архитектуры своего компьютера и назовите файл `Tools\mkcert.exe`. Проверьте «Тип системы» в Windows, если не уверены в x64/ARM. Не используйте случайный mirror; если подходящей сборки нет, остановитесь и уточните вариант.

README mkcert подтверждает Windows pre-built binaries, отдельный `CAROOT`, `-cert-file/-key-file` и iOS profile/full-trust workflow. Команды ниже устанавливают **отдельный тестовый CA в доверие Windows** и генерируют leaf certificate. Они ещё не запускались агентом; возможен запрос Windows о правах/доверии.

```powershell
$pathPrivate = Join-Path $env:LOCALAPPDATA "PathMobile-Phone-Test\Private"
$env:CAROOT = Join-Path $pathPrivate "CA"
New-Item -ItemType Directory -Force $env:CAROOT, Trust | Out-Null
.\Tools\mkcert.exe -install
if ($LASTEXITCODE -ne 0) { throw "mkcert -install не выполнен; остановитесь" }
.\Tools\mkcert.exe -cert-file (Join-Path $pathPrivate "phone-cert.pem") -key-file (Join-Path $pathPrivate "phone-key.pem") $pathPcIp localhost 127.0.0.1
if ($LASTEXITCODE -ne 0) { throw "Сертификат не создан; остановитесь" }
certutil -decode (Join-Path $env:CAROOT "rootCA.pem") Trust\Path-Mobile-Local-CA.cer
if ($LASTEXITCODE -ne 0) { throw "Публичный CA не подготовлен; остановитесь" }
```

Если `mkcert -install` отказал из-за прав, не запускайте его в другом окне с потерянным `CAROOT`: в повышенном PowerShell той же учётной записи Windows сначала повторите `Set-Location C:\PathMobile-Phone-Test` и `$pathPrivate = Join-Path $env:LOCALAPPDATA "PathMobile-Phone-Test\Private"; $env:CAROOT = Join-Path $pathPrivate "CA"`, затем повторите только scoped `mkcert -install`. Блокировку исполняемого файла защитой Windows не обходите отключением защиты; сначала уточните допустимый способ установки.

`-cert-file` и `-key-file` стоят **до** списка адресов, как требует mkcert. Сертификат включает реальный LAN-IP компьютера; `localhost`/`127.0.0.1` добавлены для локальной проверки Windows. При смене IP новый leaf certificate выпускается той же локальной CA; сам CA не надо удалять и случайно создавать заново.

Проверьте открытый сертификат и запишите его SHA256:

```powershell
certutil -dump Trust\Path-Mobile-Local-CA.cer
certutil -hashfile Trust\Path-Mobile-Local-CA.cer SHA256
```

`certutil -decode` создаёт DER-файл сертификата; SHA256 этого DER соответствует SHA256 fingerprint **корневого CA**. Это не fingerprint `phone-cert.pem`. Запишите subject/issuer, serial, срок и SHA256 с экрана своего компьютера отдельно от HTTP-страницы — например, вручную или фотографией именно этих публичных данных. Не фотографируйте открытые private-key файлы.

## 4. Подготовьте узкие временные правила Windows — только вручную

Сначала убедитесь, что старый computer-only сервер 8019 остановлен Ctrl+C. Откройте **отдельный PowerShell от администратора**, перейдите в папку пакета и снова введите эти же два IPv4 через `Read-Host`.

Правила разрешают только Private profile, конкретный local IP, конкретный remote iPhone IP и два порта. Не включают Public profile, не отключают firewall и не создают правила на роутере:

```powershell
Set-Location C:\PathMobile-Phone-Test
$pathPcIp = Read-Host "Тот же IPv4 Windows"
$pathPhoneIp = Read-Host "Тот же IPv4 iPhone"
New-NetFirewallRule -Name "PathMobile-PhoneTest-CA-8019" -DisplayName "Path Mobile test CA bootstrap" -Direction Inbound -Action Allow -Protocol TCP -LocalAddress $pathPcIp -LocalPort 8019 -RemoteAddress $pathPhoneIp -Profile Private
New-NetFirewallRule -Name "PathMobile-PhoneTest-HTTPS-8443" -DisplayName "Path Mobile test HTTPS" -Direction Inbound -Action Allow -Protocol TCP -LocalAddress $pathPcIp -LocalPort 8443 -RemoteAddress $pathPhoneIp -Profile Private
```

Если правило с этим именем уже существует или команда выдаёт ошибку, не удаляйте чужие правила и не выбирайте «разрешить Python во всех сетях». Сначала уточните состояние своих временных правил. Ни одна команда выше не выполнена в текущей облачной среде.

## 5. Передайте только публичный CA на iPhone

В **обычном** PowerShell из папки пакета (где задан `$pathPcIp`) запустите:

```powershell
Set-Location C:\PathMobile-Phone-Test
$pathPcIp = Read-Host "Тот же IPv4 Windows"
py -3 Tools\serve-phone.py --public-ca Trust\Path-Mobile-Local-CA.cer --bind $pathPcIp --allow-lan --port 8019
```

Этот bootstrap обслуживает единственный путь `/Path-Mobile-Local-CA.cer`, без directory listing, web-приложения и ключей. В Safari iPhone вручную откройте:

```text
http://<реальный-IPv4-Windows>:8019/Path-Mobile-Local-CA.cer
```

Не `127.0.0.1`, не `<…>` буквально и не адрес из чужого примера. Если Safari спрашивает разрешение загрузить профиль, проверьте, что это ожидаемое действие для только что запущенного вами CA-server.

После загрузки откройте **Настройки → Профиль загружен**. Если такого пункта нет, обычный путь — **Настройки → Основные → VPN и управление устройством → загруженный профиль**. В разных iOS названия/расположение могут отличаться; точная версия будет уточнена.

Перед установкой откройте сведения о сертификате и проверьте:

- профиль содержит только ожидаемый сертификат CA, а не VPN/proxy/MDM-настройки;
- subject/issuer, serial и срок соответствуют `certutil -dump` на вашем компьютере;
- если iOS показывает fingerprint SHA256, сравните **полное** значение с записанным на компьютере. Не сравнивайте root fingerprint с leaf certificate сайта.

Наличие SHA256 fingerprint в конкретном iOS UI здесь **не проверено и не обещается**. Если fingerprint не отображается и вы не можете независимо удостовериться в доставленном CA, **не включайте Full Trust**: сообщите версию iOS и остановитесь на этом шаге для уточнения проверяемого способа передачи/сверки. Само имя файла по HTTP не доказывает его подлинность; HTTP-bootstrap не является аутентифицированной доставкой.

Для проверенного CA выберите **Установить / Install**, подтвердите код-паролем iPhone и завершите установку. Это явное добавление известного локального CA в настройки ОС, а не обход предупреждения Safari. Если профиль содержит неожиданные payloads или сертификат не совпадает, установка не продолжается.

Затем откройте **Настройки → Основные → Об этом устройстве → Доверие сертификатам / Certificate Trust Settings**, найдите **именно созданный тестовый CA** по сверенным сведениям и включите для него полное доверие. Не включайте доверие для всех найденных корней.

Остановите bootstrap **Ctrl+C** в его окне и в администраторском PowerShell удалите только своё правило:

```powershell
Remove-NetFirewallRule -Name "PathMobile-PhoneTest-CA-8019"
```

## 6. Запустите HTTPS-приложение и откройте Safari

В обычном PowerShell из корня пакета, в котором сохранены `$pathPcIp` и `$pathPrivate` (после открытия нового окна повторите их определения):

```powershell
Set-Location C:\PathMobile-Phone-Test
$pathPcIp = Read-Host "IPv4 Windows, включённый в сертификат"
$pathPrivate = Join-Path $env:LOCALAPPDATA "PathMobile-Phone-Test\Private"
py -3 Tools\serve-phone.py --directory Path-Mobile --bind $pathPcIp --allow-lan --port 8443 --cert (Join-Path $pathPrivate "phone-cert.pem") --key (Join-Path $pathPrivate "phone-key.pem")
```

На iPhone используйте обычную вкладку Safari, не Private и не иконку Home Screen для первого прогона. Сначала откройте:

```text
https://<реальный-IPv4-Windows>:8443/phone-check.html
```

Проверьте сборку `phone-preflight-2026-11-11-r1`, `secureContext: true` и `webLocks: true`. Нажмите «Проверить тестовую запись» и получите успешный результат. Это три операции с отдельным временным ключом, который удаляется; записи Path не читаются. При ошибке остановитесь и сохраните сведения из поля отчёта, укажите точную версию iOS. Не переключайтесь на HTTP и не обходите предупреждение сертификата.

Затем откройте обычное приложение:

```text
https://<реальный-IPv4-Windows>:8443/
```

Проверьте отсутствие предупреждения о соединении и совпадение сборки с `BUILD.txt`. Не нажимайте «всё равно открыть». При ошибке проверяются IP в URL/SAN, цепочка, срок, правильный root CA и включённое доверие; сервер не заменяется HTTP-вариантом для приложения.

Обычный режим `/` нужен для создания задач/длинной заметки и Sport. Синтетическая desktop-копия открывается по:

```text
https://<тот-же-IPv4-Windows>:8443/?desktop-test=1
```

Раскройте Desktop test mode и загрузите prepared copy. Начните [15–20-минутный чеклист](PHONE_CHECKLIST.md). Если Safari сообщает, что Web Locks недоступен, сохранение не считается проверенным: остановитесь и сообщите версию iOS/Safari.

## 7. Остановка и удаление временного доверия

1. Сохраните нужные synthetic exports/recovery downloads на самом iPhone. Browser localStorage не включён в source ZIP или bundle.
2. **Ctrl+C** в окне HTTPS-server. После этого код с компьютера недоступен; это не удаляет записи телефона.
3. В администраторском PowerShell удалите только созданное правило:

```powershell
Remove-NetFirewallRule -Name "PathMobile-PhoneTest-HTTPS-8443"
```

4. Когда тестовое доверие больше не нужно, удалите именно этот установленный CA-профиль на iPhone через VPN и управление устройством; проверьте, что его Full Trust больше не включён.
5. Для удаления своего CA из доверия Windows используйте **тот же scoped CAROOT**, не чужой глобальный CA:

```powershell
Set-Location C:\PathMobile-Phone-Test
$pathPrivate = Join-Path $env:LOCALAPPDATA "PathMobile-Phone-Test\Private"; $env:CAROOT = Join-Path $pathPrivate "CA"
.\Tools\mkcert.exe -uninstall
```

Private keys не публикуются и не входят в диагностику. Не удаляйте другие корневые сертификаты или правила firewall.

## Сохранение, offline и пределы проверки

- Телефон и компьютер не синхронизируются: код приходит с Windows, записи сохраняются в origin/profile Safari на телефоне. Другая схема/адрес/порт — другое хранилище. Вернув прежний origin, можно снова обратиться к его записям, если профиль не очищен.
- `path-mobile-alpha-v1` обычного режима отделён от `path-mobile-desktop-test-v1`. Return to local mode не удаляет test copies. Создание сущностей/Sport проверяется в обычном режиме; desktop-test сохраняет принятые ограничения совместимости.
- Внешний Интернет может пропасть, а домашний LAN-server остаться доступным. Работа/reload через него не доказывает автономный запуск без сервера. Сценарии A/B/C — в [OFFLINE_PROPOSAL.md](OFFLINE_PROPOSAL.md).
- Приватный режим, очистка данных, Home Screen-контейнер и выгрузка вкладки ОС проверяются отдельно. Простой Add to Home Screen не объявляется PWA/offline package.
- Это подготовленная инструкция, проверенная по доступному коду и README mkcert. Реальные Windows network/firewall/trust и Safari/iPhone шаги не выполнялись; версия iOS неизвестна. Эмуляция 390×844 CSS px соответствует ориентиру iPhone 12 Pro, но не воспроизводит полностью его клавиатуру, safe areas, Safari chrome и жизненный цикл.

Источники: [mkcert README — Mobile devices/CAROOT](https://github.com/FiloSottile/mkcert#mobile-devices), [Apple — доверие вручную установленным сертификатам](https://support.apple.com/en-us/102390). README mkcert прочитан; Apple-страница недоступна для проверки в текущем доступе, поэтому конкретный UI iOS не представлен как фактически проверенный.

## Другие варианты — только по отдельному выбору

Без публикации компьютерная проверка доступна через loopback HTTP. Для Android возможен отдельно согласованный USB `adb reverse` к localhost; он не использовался и не нужен выбранному iPhone. Защищённое внешнее размещение потребует отдельного разрешения и контроля доступа; в текущей задаче не создаётся. Универсальный iPhone USB TCP-путь или `iproxy` как замена Android reverse не предлагается.
