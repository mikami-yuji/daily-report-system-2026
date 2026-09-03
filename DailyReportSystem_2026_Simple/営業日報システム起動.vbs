Option Explicit
Dim WshShell, fso, scriptPath, exePath, oldPath, rc

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptPath = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = scriptPath

exePath = scriptPath & "\DailyReportServer.exe"
oldPath = scriptPath & "\DailyReportServer.exe.old"

' 1. 万一 DailyReportServer.exe が無く .old がある場合は復元
If Not fso.FileExists(exePath) And fso.FileExists(oldPath) Then
    fso.CopyFile oldPath, exePath, True
End If

' 2. サーバー起動
If fso.FileExists(exePath) Then
    rc = WshShell.Run("""" & exePath & """", 1, False)
Else
    MsgBox "DailyReportServer.exe が見つかりません。", vbCritical, "起動エラー"
End If
