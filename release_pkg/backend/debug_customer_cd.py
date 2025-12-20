import pandas as pd

excel_file = '../daily_report_template.xlsm'

# Read with pandas
df = pd.read_excel(excel_file, sheet_name='営業日報', header=0)

# Clean up column names
df.columns = [str(col).replace('\n', '') for col in df.columns]

# Rename specific columns
df = df.rename(columns={
    '得意先CD.': '得意先CD',
})

# Check the data type and values for 得意先CD
print("得意先CD data type:", df['得意先CD'].dtype)
print("\nFirst 10 unique 得意先CD values:")
print(df['得意先CD'].dropna().unique()[:10])

# Check for customer 77653
customer_cd = 77653.0
print(f"\n\nSearching for customer {customer_cd}:")
customer_reports = df[df['得意先CD'] == customer_cd]
print(f"Found {len(customer_reports)} reports")

if len(customer_reports) > 0:
    print("\nInterviewers for this customer:")
    interviewers = customer_reports['面談者'].dropna().unique()
    print(interviewers)
    
# Try with string comparison
print(f"\n\nSearching for customer '{customer_cd}' as string:")
customer_reports_str = df[df['得意先CD'].astype(str) == str(customer_cd)]
print(f"Found {len(customer_reports_str)} reports")

if len(customer_reports_str) > 0:
    print("\nInterviewers for this customer:")
    interviewers = customer_reports_str['面談者'].dropna().unique()
    print(interviewers)
