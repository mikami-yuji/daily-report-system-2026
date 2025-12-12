' 営業日報システム 停止
' このファイルをダブルクリックすると、バックエンドとフロントエンドを停止します

Set WshShell = CreateObject("WScript.Shell")

' Node.jsプロセス（フロントエンド）を停止
WshShell.Run "taskkill /F /IM node.exe", 0, True

' Pythonプロセス（バックエンド）を停止
WshShell.Run "taskkill /F /IM python.exe", 0, True

MsgBox "営業日報システムを停止しました。", vbInformation, "営業日報システム"
