import openpyxl
from openpyxl.worksheet.datavalidation import DataValidation

excel_file = '../daily_report_template.xlsm'

wb = openpyxl.load_workbook(excel_file, keep_vba=True)
ws = wb['営業日報']

# Check data validations
print("Data Validations in the sheet:")
for dv in ws.data_validations.dataValidation:
    print(f"\nValidation: {dv.type}")
    print(f"  Formula1: {dv.formula1}")
    print(f"  Formula2: {dv.formula2}")
    print(f"  Ranges: {dv.sqref}")
    if dv.type == 'list':
        print(f"  List values: {dv.formula1}")

# Check specific cells for validation (row 2 as example)
# Column 3 = 行動内容, Column 13 = 滞在時間
print("\n\nChecking specific cells:")
for col, name in [(3, '行動内容'), (13, '滞在時間')]:
    cell = ws.cell(row=2, column=col)
    print(f"\n{name} (Column {col}):")
    print(f"  Cell value: {cell.value}")
    
    # Check if cell has validation
    for dv in ws.data_validations.dataValidation:
        if cell.coordinate in dv.cells:
            print(f"  Has validation: {dv.type}")
            print(f"  Formula: {dv.formula1}")

wb.close()
