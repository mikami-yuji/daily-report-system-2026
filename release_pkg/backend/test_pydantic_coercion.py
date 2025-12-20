from pydantic import BaseModel, ValidationError
from typing import Union

class ReportInput(BaseModel):
    得意先CD: str

try:
    print("Testing int input for str field...")
    model = ReportInput(得意先CD=43006)
    print(f"Success: {model.得意先CD} (type: {type(model.得意先CD)})")
except ValidationError as e:
    print("Validation Failed:")
    print(e.json())

print("\nTesting with Union[str, int]...")
class ReportInputUnion(BaseModel):
    得意先CD: Union[str, int]

try:
    model = ReportInputUnion(得意先CD=43006)
    print(f"Success: {model.得意先CD} (type: {type(model.得意先CD)})")
except ValidationError as e:
    print("Validation Failed:")
    print(e.json())
