# -*- coding: utf-8 -*-
"""Fix indentation at lines 760-761"""

file_path = r"frontend\src\app\reports\batch\page.tsx"

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Fix line 760 (index 759) - change indentation from 16 spaces to 20 spaces
# Fix line 761 (index 760) - change indentation from 12 spaces to 16 spaces

for i in range(len(lines)):
    # Line 760 should be ))}} with proper indent
    if i == 759 and '))}}' in lines[i]:
        lines[i] = '                    ))}}\n'
        print(f"Fixed line 760: {lines[i].rstrip()}")
    elif i == 760 and '</div>' in lines[i] and lines[i].strip() == '</div>':
        lines[i] = '                </div>\n'
        print(f"Fixed line 761: {lines[i].rstrip()}")

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Done!")
