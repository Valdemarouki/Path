; Path 2.0 uses the upstream installer engine; only presentation is customised.
!include "LogicLib.nsh"
!include "nsDialogs.nsh"
!define MUI_BGCOLOR "111214"
!define MUI_TEXTCOLOR "DDDDDD"
!define MUI_INSTFILESPAGE_COLORS "DDDDDD 1B1C1F"
!define MUI_CUSTOMFUNCTION_GUIINIT PathTheme
!define MUI_CUSTOMFUNCTION_UNGUIINIT un.PathTheme
!define MUI_HEADER_TRANSPARENT_TEXT

LangString PathDesktopShortcut 1033 "Create a desktop shortcut"
LangString PathDesktopShortcut 1049 "Создать ярлык на рабочем столе"
LangString PathShortcutFailed 1033 "The desktop shortcut could not be created. Check that Path 2.0 is installed in the selected folder."
LangString PathShortcutFailed 1049 "Не удалось создать ярлык. Проверьте, что Path 2.0 установлен в выбранной папке."

LangString PathRunAfterInstall 1033 "Launch Path after installation"
LangString PathRunAfterInstall 1049 "Запустить Path после установки"

LangString PathWelcome 1033 "Your next chapter."
LangString PathWelcome 1049 "Твой следующий шаг."
LangString PathIntro 1033 "A quieter place for your plans.$\r$\n$\r$\nTasks. Notes. Ideas.$\r$\nOne focused workspace.$\r$\n$\r$\nInstalled for your Windows account.$\r$\nYour existing data stays in place."
LangString PathIntro 1049 "Пространство для твоих планов.$\r$\n$\r$\nЗадачи. Заметки. Идеи.$\r$\nВсё важное — в одном месте.$\r$\n$\r$\nУстановка для твоей учётной записи.$\r$\nСуществующие данные сохраняются."
LangString PathRemove 1033 "Remove Path 2.0"
LangString PathRemove 1049 "Удаление Path 2.0"
LangString PathKeep 1033 "Only the application and its shortcuts will be removed.$\r$\n$\r$\nYour personal data stays in:$\r$\n%APPDATA%\Path-Paperclip-Test$\r$\n$\r$\nInstall Path 2.0 again to continue using it."
LangString PathKeep 1049 "Будут удалены только приложение и его ярлыки.$\r$\n$\r$\nЛичные данные сохранятся в:$\r$\n%APPDATA%\Path-Paperclip-Test$\r$\n$\r$\nУстановите Path 2.0 снова, чтобы продолжить работу."

LangString PathInstalling 1033 "Making room for your next chapter."
LangString PathInstalling 1049 "Готовим пространство для твоих планов."
LangString PathInstallingSub 1033 "Installing Path 2.0. Your personal data stays in place."
LangString PathInstallingSub 1049 "Устанавливаем Path 2.0. Личные данные сохраняются."
LangString PathFinished 1033 "Your Path is ready."
LangString PathFinished 1049 "Твой Path готов."
LangString PathFinishedBody 1033 "Installation is complete.$\r$\n$\r$\nA little more clarity.$\r$\nA little more progress.$\r$\n$\r$\nChoose below whether to open Path now."
LangString PathFinishedBody 1049 "Установка завершена.$\r$\n$\r$\nБольше ясности.$\r$\nБольше движения вперёд.$\r$\n$\r$\nНиже можно выбрать запуск Path."

; Force per-user installation. No UAC/elevation is needed or requested.
!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "$(PathWelcome)"
  !define MUI_WELCOMEPAGE_TEXT "$(PathIntro)"
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW PathWelcomeShow
  !define MUI_PAGE_CUSTOMFUNCTION_LEAVE PathMotionStop
  !define MUI_PAGE_CUSTOMFUNCTION_DESTROYED PathMotionStop
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customPageAfterChangeDir
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW PathInstallingShow
!macroend

!macro customFinishPage
  ; A native second finish-page checkbox. Never creates a link to a missing EXE.
  Function PathCreateDesktopShortcut
    IfFileExists "$appExe" 0 path_shortcut_failed
    ClearErrors
    CreateShortCut "$newDesktopLink" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
    IfErrors path_shortcut_failed
    WinShell::SetLnkAUMI "$newDesktopLink" "${APP_ID}"
    System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'
    Return
    path_shortcut_failed:
    MessageBox MB_OK|MB_ICONEXCLAMATION "$(PathShortcutFailed)"
  FunctionEnd
  !define MUI_FINISHPAGE_SHOWREADME
  !define MUI_FINISHPAGE_SHOWREADME_TEXT "$(PathDesktopShortcut)"
  !define MUI_FINISHPAGE_SHOWREADME_FUNCTION PathCreateDesktopShortcut
  !define MUI_FINISHPAGE_TITLE "$(PathFinished)"
  !define MUI_FINISHPAGE_TEXT "$(PathFinishedBody)"
  ; Keep the upstream user-level launch path; custom finish pages must opt in.
  !ifndef HIDE_RUN_AFTER_FINISH
    Function PathStartApp
      ${If} ${isUpdated}
        StrCpy $1 "--updated"
      ${Else}
        StrCpy $1 ""
      ${EndIf}
      ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
    FunctionEnd
    !define MUI_FINISHPAGE_RUN
    !define MUI_FINISHPAGE_RUN_FUNCTION "PathStartApp"
    !define MUI_FINISHPAGE_RUN_TEXT "$(PathRunAfterInstall)"
  !endif
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW PathFinishShow
  !define MUI_PAGE_CUSTOMFUNCTION_LEAVE PathMotionStop
  !define MUI_PAGE_CUSTOMFUNCTION_DESTROYED PathMotionStop
  !insertmacro MUI_PAGE_FINISH
!macroend

!macro customUnWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "$(PathRemove)"
  !define MUI_WELCOMEPAGE_TEXT "$(PathKeep)"
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW un.PathWelcomeShow
  !define MUI_PAGE_CUSTOMFUNCTION_LEAVE un.PathMotionStop
  !define MUI_PAGE_CUSTOMFUNCTION_DESTROYED un.PathMotionStop
  !insertmacro MUI_UNPAGE_WELCOME
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW un.PathProgressTheme
!macroend

; Standard progress remains tied to extraction; never simulate completion.
; PBS_SMOOTH + monochrome native progress is deliberately restrained.
!macro PathThemeFunctions PREFIX
Function ${PREFIX}PathTheme
  SetCtlColors $HWNDPARENT DDDDDD 111214
  ; Remove the bright horizontal separators, retaining native controls.
  GetDlgItem $0 $HWNDPARENT 1035
  ShowWindow $0 0
  GetDlgItem $0 $HWNDPARENT 1036
  ShowWindow $0 0
  GetDlgItem $0 $HWNDPARENT 1028
  SetCtlColors $0 929396 111214
  GetDlgItem $0 $HWNDPARENT 1037
  SetCtlColors $0 DDDDDD 111214
  GetDlgItem $0 $HWNDPARENT 1038
  SetCtlColors $0 A8A9AB 111214
  ; Windows 10/11 title bar; ignored by older systems.
  System::Call 'dwmapi::DwmSetWindowAttribute(p $HWNDPARENT, i 20, *i 1, i 4) i .r0'
FunctionEnd
Function ${PREFIX}PathPageTheme
  Call ${PREFIX}PathTheme
  FindWindow $0 "#32770" "" $HWNDPARENT
  SetCtlColors $0 DDDDDD 111214
FunctionEnd
Function ${PREFIX}PathProgressTheme
  Call ${PREFIX}PathPageTheme
  FindWindow $0 "#32770" "" $HWNDPARENT
  ; Status text above the progress bar must not inherit a white background.
  GetDlgItem $1 $0 1006
  SetCtlColors $1 B4B5B8 111214
  GetDlgItem $1 $0 1016
  SetCtlColors $1 B4B5B8 1B1C1F
  GetDlgItem $1 $0 1004
  System::Call 'uxtheme::SetWindowTheme(p r1, w "", w "")'
  SendMessage $1 0x409 0 0x00DDDDDD ; PBM_SETBARCOLOR
  SendMessage $1 0x2001 0 0x001F1C1B ; PBM_SETBKCOLOR
  System::Call 'user32::GetWindowLongW(p r1, i -16) i .r2'
  IntOp $2 $2 | 1 ; PBS_SMOOTH
  IntOp $2 $2 & 0xFF7FFFFF ; remove WS_BORDER

  System::Call 'user32::SetWindowLongW(p r1, i -16, i r2)'
  System::Call 'user32::GetWindowLongW(p r1, i -20) i .r2'
  IntOp $2 $2 & 0xFFFFFDFF ; remove WS_EX_CLIENTEDGE
  System::Call 'user32::SetWindowLongW(p r1, i -20, i r2)'
  System::Call 'user32::SetWindowPos(p r1, p 0, i 0, i 0, i 0, i 0, i 0x27)'
FunctionEnd
!macroend
; electron-builder compiles an installer stub to emit the uninstaller.
; Both GUI callbacks must resolve; unused counterpart functions are expected.
!pragma warning disable 6010
!insertmacro PathThemeFunctions ""
!ifdef BUILD_UNINSTALLER
!insertmacro PathThemeFunctions "un."
!endif

!macro customUninstallPage
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW un.PathFinishShow
  !define MUI_PAGE_CUSTOMFUNCTION_LEAVE un.PathMotionStop
  !define MUI_PAGE_CUSTOMFUNCTION_DESTROYED un.PathMotionStop
!macroend
; Local resources only: no webview, JS engine, network or third-party animation plugin.
Var PathMotionImage
Var PathMotionTitle
Var PathMotionBitmap
Var PathMotionOriginal
Var PathMotionRunning
Var PathMotionStart
Var PathMotionFrame
Var PathMotionAllowed

!macro customInit
  InitPluginsDir
  SetOutPath "$PLUGINSDIR\path-motion"
  File "${BUILD_RESOURCES_DIR}\motion\*.bmp"
  SetOutPath $INSTDIR
!macroend
!macro customUnInit
  InitPluginsDir
  SetOutPath "$PLUGINSDIR\path-motion"
  File "${BUILD_RESOURCES_DIR}\motion\*.bmp"
  SetOutPath $INSTDIR
!macroend

!macro PathMotionFunctions PREFIX
Function ${PREFIX}PathMotionCheck
  Push $0
  Push $1
  Push $2
  StrCpy $PathMotionAllowed 0
  ; Fail closed when animation preference cannot be queried.
  System::Call 'user32::SystemParametersInfoW(i 0x1042, i 0, *i .r0, i 0) i .r1'
  ${If} $1 <> 0
  ${AndIf} $0 <> 0
    StrCpy $PathMotionAllowed 1
  ${EndIf}
  System::Call '*(i 12, i 0, p 0) p.r0'
  System::Call 'user32::SystemParametersInfoW(i 0x42, i 12, p r0, i 0) i .r1'
  ${If} $1 <> 0
    System::Call '*$0(i, i.r2, p)'
    IntOp $2 $2 & 1
    ${If} $2 <> 0
      StrCpy $PathMotionAllowed 0
    ${EndIf}
  ${EndIf}
  System::Free $0
  Pop $2
  Pop $1
  Pop $0
FunctionEnd
Function ${PREFIX}PathMotionStart
  StrCpy $PathMotionBitmap 0
  StrCpy $PathMotionRunning 0
  StrCpy $PathMotionFrame -1
  Call ${PREFIX}PathMotionCheck
  ${If} $PathMotionAllowed == 1
    System::Call 'kernel32::GetTickCount() i .r0'
    StrCpy $PathMotionStart $0
    SetCtlColors $PathMotionTitle 8C8C8C 111214
    StrCpy $PathMotionRunning 1
    ${NSD_CreateTimer} ${PREFIX}PathMotionTick 50
  ${EndIf}
FunctionEnd
Function ${PREFIX}PathMotionStop
  ${If} $PathMotionRunning == 1
    ${NSD_KillTimer} ${PREFIX}PathMotionTick
    StrCpy $PathMotionRunning 0
  ${EndIf}
  ; Restore the MUI-owned bitmap; only free the bitmap owned by this animation.
  ${If} $PathMotionBitmap P<> 0
    SendMessage $PathMotionImage ${STM_SETIMAGE} ${IMAGE_BITMAP} $PathMotionOriginal
    ${NSD_FreeImage} $PathMotionBitmap
    StrCpy $PathMotionBitmap 0
  ${EndIf}
  SetCtlColors $PathMotionTitle DDDDDD 111214
FunctionEnd
Function ${PREFIX}PathMotionTick
  Push $0
  Push $1
  Push $2
  Push $3
  Call ${PREFIX}PathMotionCheck
  ${If} $PathMotionAllowed == 0
    Call ${PREFIX}PathMotionStop
    Goto path_tick_end_${PREFIX}
  ${EndIf}
  System::Call 'kernel32::GetTickCount() i .r0'
  IntOp $0 $0 - $PathMotionStart
  ; Title reveal: short brightness easing, no window opacity/focus changes.
  ${If} $0 < 100
    SetCtlColors $PathMotionTitle 8C8C8C 111214
  ${ElseIf} $0 < 200
    SetCtlColors $PathMotionTitle B0B0B0 111214
  ${ElseIf} $0 < 300
    SetCtlColors $PathMotionTitle CCCCCC 111214
  ${Else}
    SetCtlColors $PathMotionTitle DDDDDD 111214
  ${EndIf}
  IntOp $1 $0 / 50
  IntOp $1 $1 % 96
  ${If} $1 >= 64
    StrCpy $1 0
  ${EndIf}
  ${If} $1 != $PathMotionFrame
    StrCpy $PathMotionFrame $1
    StrCpy $2 $PathMotionBitmap
    ${NSD_SetStretchedImage} $PathMotionImage "$PLUGINSDIR\path-motion\wave-$1.bmp" $PathMotionBitmap
    ${If} $PathMotionBitmap P= 0
      SendMessage $PathMotionImage ${STM_SETIMAGE} ${IMAGE_BITMAP} $PathMotionOriginal
      Call ${PREFIX}PathMotionStop
    ${EndIf}
    ${If} $2 P<> 0
      ${NSD_FreeImage} $2
    ${EndIf}
  ${EndIf}
  path_tick_end_${PREFIX}:
  Pop $3
  Pop $2
  Pop $1
  Pop $0
FunctionEnd
Function ${PREFIX}PathWelcomeShow
  Call ${PREFIX}PathPageTheme
  StrCpy $PathMotionImage $mui.WelcomePage.Image
  StrCpy $PathMotionOriginal $mui.WelcomePage.Image.Bitmap
  StrCpy $PathMotionTitle $mui.WelcomePage.Title
  Call ${PREFIX}PathMotionStart
FunctionEnd
Function ${PREFIX}PathFinishShow
  Call ${PREFIX}PathPageTheme
  StrCpy $PathMotionImage $mui.FinishPage.Image
  StrCpy $PathMotionOriginal $mui.FinishPage.Image.Bitmap
  StrCpy $PathMotionTitle $mui.FinishPage.Title
  Call ${PREFIX}PathMotionStart
FunctionEnd
!macroend
!macro customHeader
  ; MUI page variables exist only after the page macros have expanded.
  !insertmacro PathMotionFunctions ""
  !ifdef BUILD_UNINSTALLER
    !insertmacro PathMotionFunctions "un."
  !endif
!macroend

Function PathInstallingShow
  Call PathProgressTheme
  GetDlgItem $0 $HWNDPARENT 1037
  SendMessage $0 ${WM_SETTEXT} 0 "STR:$(PathInstalling)"
  GetDlgItem $0 $HWNDPARENT 1038
  SendMessage $0 ${WM_SETTEXT} 0 "STR:$(PathInstallingSub)"
FunctionEnd

; Refuse the success screen when required application files are missing.
LangString PathIncompleteInstall 1033 "Installation is incomplete: required Path files are missing. Please retry installation. Your personal data has not been removed."
LangString PathIncompleteInstall 1049 "Установка не завершена: отсутствуют необходимые файлы Path. Повторите установку. Личные данные не удалены."
!macro customInstall
  IfFileExists "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 path_install_incomplete
  IfFileExists "$INSTDIR\resources\app.asar" 0 path_install_incomplete
  IfFileExists "$INSTDIR\icudtl.dat" 0 path_install_incomplete
  Goto path_install_verified
  path_install_incomplete:
    MessageBox MB_OK|MB_ICONSTOP "$(PathIncompleteInstall)"
    SetErrorLevel 2
    Abort
  path_install_verified:
!macroend
