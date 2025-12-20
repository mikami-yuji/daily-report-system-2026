from pydantic import BaseModel, Field, ValidationError
import json

class ReportInput(BaseModel):
    日付: str
    行動内容: str
    エリア: str = ""
    得意先CD: str = ""
    直送先CD: str = ""
    訪問先名: str
    直送先名: str = ""
    重点顧客: str = ""
    ランク: str = ""
    面談者: str = ""
    滞在時間: str = ""
    商談内容: str = ""
    提案物: str = ""
    次回プラン: str = ""
    デザイン提案有無: str = ""
    デザイン種別: str = ""
    デザイン名: str = ""
    デザイン進捗状況: str = ""
    デザイン依頼No: str = Field("", alias="デザイン依頼No.")
    上長コメント: str = ""
    コメント返信欄: str = ""
    上長: str = ""
    山澄常務: str = ""
    岡本常務: str = ""
    中野次長: str = ""
    既読チェック: str = ""

# Test data matching frontend formData
test_data = {
    '日付': '25/01/15',
    '行動内容': 'テスト',
    'エリア': '',
    '得意先CD': '',
    '訪問先名': 'テスト訪問先',
    '面談者': '',
    '滞在時間': '',
    '商談内容': '',
    '提案物': '',
    '次回プラン': '',
    '重点顧客': '',
    'ランク': '',
    'デザイン提案有無': '',
    'デザイン種別': '',
    'デザイン名': '',
    'デザイン進捗状況': '',
    'デザイン依頼No.': '',
}

try:
    report = ReportInput(**test_data)
    print("✓ Validation successful!")
    print(f"Report: {report}")
except ValidationError as e:
    print("✗ Validation failed!")
    print(json.dumps(e.errors(), indent=2))
