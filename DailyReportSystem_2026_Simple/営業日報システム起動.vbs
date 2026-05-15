' 営業日報システム2026 ワンクリック起動
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptPath = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = scriptPath
WshShell.Run "cmd /c start_app.bat", 0, False
WScript.Sleep 5000
WshShell.Run "http://localhost:3000", 1, False
MsgBox "System started!", vbInformation, "Daily Report 2026"
