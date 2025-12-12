' 営業日報システム ワンクリック起動
' このファイルをダブルクリックすると、バックエンドとフロントエンドが起動し、ブラウザが開きます

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' スクリプトのディレクトリを取得
scriptPath = fso.GetParentFolderName(WScript.ScriptFullName)

' バックエンドを起動（非表示）
WshShell.CurrentDirectory = scriptPath & "\backend"
WshShell.Run "cmd /c python -m uvicorn main:app --host 0.0.0.0 --port 8001", 0, False

' 少し待ってからフロントエンドを起動
WScript.Sleep 2000

' フロントエンドを起動（非表示）
WshShell.CurrentDirectory = scriptPath & "\frontend"
WshShell.Run "cmd /c npm run dev", 0, False

' サーバー起動を待つ
WScript.Sleep 5000

' ブラウザを開く
WshShell.Run "http://localhost:3000", 1, False

' 完了メッセージ
MsgBox "営業日報システムを起動しました！" & vbCrLf & vbCrLf & _
       "ブラウザで http://localhost:3000 が開きます。" & vbCrLf & _
       "このメッセージを閉じても、システムはバックグラウンドで動作し続けます。", _
       vbInformation, "営業日報システム"
