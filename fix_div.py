# -*- coding: utf-8 -*-
"""Fix batch page - properly formatted"""

file_path = r"frontend\src\app\reports\batch\page.tsx"

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Remove line 526 (index 525) - the extra </div>
# Line numbers are 1-indexed in editor, 0-indexed in list
if '</div>' in lines[525]:
    print(f"Removing line 526: {lines[525].strip()}")
    del lines[525]

# Write back
with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Done! Removed extra </div> at line 526")
