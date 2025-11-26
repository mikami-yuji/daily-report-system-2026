import pandas as pd
excel_file = "../daily_report_template.xlsm"
try:
    df = pd.read_excel(excel_file, sheet_name='営業日報', header=0)
    print("Index | Column Name")
    for i, col in enumerate(df.columns):
        print(f"{i+1} | {repr(col)}")
except Exception as e:
    print(e)
