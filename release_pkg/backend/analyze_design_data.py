import pandas as pd
import os

excel_file = '../daily_report_template.xlsm'

if not os.path.exists(excel_file):
    print(f"File not found: {excel_file}")
    exit()

try:
    # Read the '営業日報' sheet
    df = pd.read_excel(excel_file, sheet_name='営業日報', header=0)
    
    # Clean up column names
    df.columns = [str(col).replace('\n', '').strip() for col in df.columns]
    
    # Rename specific columns if needed (based on previous knowledge)
    df = df.rename(columns={
        '得意先CD.': '得意先CD',
    })
    
    design_columns = [
        'デザイン提案有無',
        'デザイン種別',
        'デザイン名',
        'デザイン進捗状況',
        'デザイン依頼No.'
    ]
    
    print("Checking design columns...")
    for col in design_columns:
        if col in df.columns:
            print(f"\nColumn: {col}")
            print(f"Unique values (first 20): {df[col].dropna().unique()[:20]}")
            print(f"Count of non-null: {df[col].count()}")
        else:
            print(f"\nColumn '{col}' not found in Excel file.")
            
    # Check for a specific customer with design history
    print("\n\nChecking design history for a customer with designs...")
    # Find a customer with non-null design request numbers
    if 'デザイン依頼No.' in df.columns:
        customers_with_designs = df[df['デザイン依頼No.'].notna()]['得意先CD'].unique()
        print(f"Customers with designs: {customers_with_designs[:5]}")
        
        if len(customers_with_designs) > 0:
            target_customer = customers_with_designs[0]
            print(f"\nDetails for customer {target_customer}:")
            customer_data = df[df['得意先CD'] == target_customer]
            print(customer_data[design_columns].dropna(how='all').head(10))

except Exception as e:
    print(f"Error: {e}")
