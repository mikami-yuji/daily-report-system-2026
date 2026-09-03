from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional, Any

class ReportInput(BaseModel):
    model_config = {"populate_by_name": True, "extra": "ignore"}
    
    日付: str = ""
    行動内容: str = ""
    エリア: str = ""
    得意先CD: str = ""
    直送先CD: str = ""
    訪問先名: str = ""
    直送先名: str = ""
    重点顧客: str = ""
    ランク: str = ""
    面談者: str = ""
    滞在時間: str = ""
    商談内容: str = ""
    提案物: str = ""
    次回プラン: str = ""
    競合他社情報: str = ""
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
    original_values: Optional[Any] = None

    @model_validator(mode='before')
    @classmethod
    def convert_all_to_string(cls, data: Any) -> Any:
        if isinstance(data, dict):
            for key, value in data.items():
                if key == 'original_values':
                    continue
                if value is None:
                    data[key] = ""
                elif isinstance(value, (int, float)):
                    if isinstance(value, float) and value.is_integer():
                        data[key] = str(int(value))
                    else:
                        data[key] = str(value)
                elif not isinstance(value, str):
                    data[key] = str(value)
        return data

    @field_validator('得意先CD', '直送先CD', mode='before')
    @classmethod
    def convert_to_string(cls, v):
        if v is None:
            return ""
        return str(v)

class CommentInput(BaseModel):
    上長コメント: Optional[str] = None
    コメント返信欄: Optional[str] = None
    original_values: Optional[dict] = None

class ApprovalInput(BaseModel):
    上長: Optional[str] = None
    山澄常務: Optional[str] = None
    岡本常務: Optional[str] = None
    中野次長: Optional[str] = None
    既読チェック: Optional[str] = None
    original_values: Optional[dict] = None

class ReplyInput(BaseModel):
    コメント返信欄: str
    original_values: Optional[dict] = None
