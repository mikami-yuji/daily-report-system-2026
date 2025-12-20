import pandas as pd
import math
import re

excel_file = '../daily_report_template.xlsm'

# Read with pandas
df = pd.read_excel(excel_file, sheet_name='営業日報', header=0)

# Clean up column names
df.columns = [str(col).replace('\n', '') for col in df.columns]

# Rename specific columns
df = df.rename(columns={
    '得意先CD.': '得意先CD',
    '訪問先名得意先名': '訪問先名'
})

# Replace NaN with empty strings
df = df.fillna(value='')

# Convert to dict
records = df.to_dict(orient="records")

# Find first record with non-empty comment
for i, record in enumerate(records):
    if record.get('上長コメント') and record.get('上長コメント') != '':
        print(f"Found non-empty 上長コメント at row {i+1}:")
        print(f"  Raw value: {repr(record['上長コメント'])}")
        print(f"  Type: {type(record['上長コメント'])}")
        
        # Apply cleaning logic
        value = record['上長コメント']
        if isinstance(value, float):
            if math.isnan(value) or math.isinf(value):
                cleaned = None
            else:
                cleaned = value
        elif value == '':
            cleaned = None
        elif isinstance(value, str):
            cleaned_value = re.sub(r'_x000D_', '\n', value)
            cleaned_value = cleaned_value.replace('\r', '')
            cleaned = cleaned_value
        else:
            cleaned = value
            
        print(f"  Cleaned value: {repr(cleaned)}")
        break
