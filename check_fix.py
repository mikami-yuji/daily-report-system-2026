# -*- coding: utf-8 -*-
"""Check and fix file content"""

file_path = r"frontend\src\app\reports\batch\page.tsx"

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

print("Current content around line 760:")
for i in range(757, min(765, len(lines))):
    print(f"{i+1}: {repr(lines[i])}")

# Fix: look for the pattern with ))} and wrong indentation
fixed = False
for i in range(len(lines)):
    line = lines[i]
    # Check for '))}' with wrong indentation (16 spaces instead of 20)
    if line.strip() == '))}' and line.startswith('                ))}'):
        lines[i] = '                    ))}' + '\r\n'
        print(f"\nFixed line {i+1}: ))} indentation")
        fixed = True
    # Check for </div> with wrong indentation after ))} (12 spaces instead of 16)
    if fixed and line.strip() == '</div>' and line.startswith('            </div>'):
        lines[i] = '                </div>' + '\r\n'
        print(f"Fixed line {i+1}: </div> indentation")
        break

if fixed:
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print("\nFile saved!")
else:
    print("\nNo fixes needed or pattern not found")
