import pandas as pd

excel_file = '../daily_report_template.xlsm'

# Read with pandas
df = pd.read_excel(excel_file, sheet_name='営業日報', header=0)

# Clean up column names
df.columns = [str(col).replace('\n', '') for col in df.columns]

# Check first 5 rows for comment columns
print("First 5 rows - 上長コメント and コメント返信欄:")
for i in range(min(5, len(df))):
    print(f"Row {i+1}:")
    print(f"  上長コメント: {repr(df.iloc[i]['上長コメント'])}")
    print(f"  コメント返信欄: {repr(df.iloc[i]['コメント返信欄'])}")
    print()

# Check if there are any non-null values in these columns
print(f"Total rows: {len(df)}")
print(f"Non-null 上長コメント: {df['上長コメント'].notna().sum()}")
print(f"Non-null コメント返信欄: {df['コメント返信欄'].notna().sum()}")
