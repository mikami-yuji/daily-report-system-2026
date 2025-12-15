import os

vbs_content = """' 営業日報システム ワンクリック起動
' このファイルをダブルクリックすると、バックエンドとフロントエンドが起動し、ブラウザが開きます

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' スクリプトのディレクトリを取得
scriptPath = fso.GetParentFolderName(WScript.ScriptFullName)

' start_app.bat を起動（非表示）
WshShell.CurrentDirectory = scriptPath
WshShell.Run "cmd /c start_app.bat", 0, False

' サーバー起動を待つ
WScript.Sleep 5000

' ブラウザを開く
WshShell.Run "http://localhost:3000", 1, False

' 完了メッセージ
MsgBox "営業日報システムを起動しました！" & vbCrLf & vbCrLf & "ブラウザで http://localhost:3000 が開きます。" & vbCrLf & "このメッセージを閉じても、システムはバックグラウンドで動作し続けます。", vbInformation, "営業日報システム"
"""

target_path = os.path.join(os.getcwd(), '営業日報システム起動.vbs')

print(f"Writing VBS to {target_path} with CP932 encoding...")
with open(target_path, 'w', encoding='cp932', errors='ignore') as f:
    f.write(vbs_content)

print("Done.")
