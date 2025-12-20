import openpyxl

excel_file = '../daily_report_template.xlsm'

wb = openpyxl.load_workbook(excel_file, keep_vba=True)

# Get specific named ranges
target_names = ['行動内容', '滞在時間']

for name_obj in target_names:
    if name_obj in wb.defined_names:
        print(f"\n{name_obj}:")
        name_value = wb.defined_names[name_obj]
        
        for sheet_name, cell_range in name_value.destinations:
            ws = wb[sheet_name]
            cell_range = cell_range.replace('$', '')
            
            # Read the range
            if ':' in cell_range:
                cells = ws[cell_range]
                values = []
                for row in cells:
                    if isinstance(row, tuple):
                        for cell in row:
                            if cell.value:
                                values.append(str(cell.value))
                    else:
                        if row.value:
                            values.append(str(row.value))
                
                print(f"  Range: {cell_range}")
                print(f"  Values: {values}")
    else:
        print(f"\n{name_obj}: Not found")

wb.close()
