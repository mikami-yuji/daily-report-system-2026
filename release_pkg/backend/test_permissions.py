import os
import openpyxl

# Test write permission to network share
test_file = r"\\Asahipack02\社内書類ｎｅｗ\01：部署別　営業部\02：営業日報\2025年度\本社008　2025年度用日報【見上】.xlsm"

print(f"Testing file: {test_file}")
print(f"File exists: {os.path.exists(test_file)}")

# Check if file is locked (being used by another process)
try:
    # Try to open in exclusive mode
    with open(test_file, 'r+b') as f:
        print("✓ File is not locked, can open for reading and writing")
except PermissionError as e:
    print(f"✗ Permission denied: {e}")
    print("  → File may be open by another user")
except Exception as e:
    print(f"✗ Error: {e}")

# Try to load with openpyxl
try:
    wb = openpyxl.load_workbook(test_file, keep_vba=True)
    print(f"✓ Can load workbook with openpyxl")
    wb.close()
except Exception as e:
    print(f"✗ Cannot load workbook: {e}")

# Check write permission by trying to create a test file
test_write_file = r"\\Asahipack02\社内書類ｎｅｗ\01：部署別　営業部\02：営業日報\2025年度\test_write_permission.txt"
try:
    with open(test_write_file, 'w') as f:
        f.write("test")
    os.remove(test_write_file)
    print("✓ Have write permission to directory")
except Exception as e:
    print(f"✗ No write permission: {e}")
