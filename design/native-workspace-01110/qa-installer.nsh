!macro customCheckAppRunning
  ${nsProcess::FindProcess} "${APP_EXECUTABLE_FILENAME}" $R0
  ${if} $R0 != 603
    IfSilent +2
    MessageBox MB_OK|MB_ICONEXCLAMATION "Please close PGY Workbench QA normally, then retry. No process will be terminated by this installer."
    SetErrorLevel 2
    Quit
  ${endif}
!macroend
