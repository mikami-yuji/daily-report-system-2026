# -*- coding: utf-8 -*-
import re

file_path = r"frontend\src\app\reports\batch\page.tsx"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the corrupted button code
old_button = '''            {/* 訪問追加ボタン */ }
                    < button
        type = "button"
        onClick = { addVisit }
        className = "w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-sf-text-weak hover:border-sf-light-blue hover:text-sf-light-blue transition-colors flex items-center justify-center gap-2"
                    >
                    <Plus size={20} />
        訪問を追加
    </button>'''

new_button = '''            {/* 訪問追加ボタン */}
            <button
                type="button"
                onClick={addVisit}
                className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-sf-text-weak hover:border-sf-light-blue hover:text-sf-light-blue transition-colors flex items-center justify-center gap-2"
            >
                <Plus size={20} />
                訪問を追加
            </button>'''

if old_button in content:
    content = content.replace(old_button, new_button)
    print("Button fix applied!")
else:
    print("Button pattern not found, trying alternative patterns...")
    # Try regex approach
    pattern = r'\{\s*/\*\s*訪問追加ボタン\s*\*/\s*\}\s*<\s*button'
    if re.search(pattern, content):
        # Found the problematic pattern
        content = re.sub(r'\{\s*/\*\s*訪問追加ボタン\s*\*/\s*\}', '{/* 訪問追加ボタン */}', content)
        content = re.sub(r'<\s+button', '<button', content)
        content = re.sub(r'type\s*=\s*"button"', 'type="button"', content)
        content = re.sub(r'onClick\s*=\s*\{\s*addVisit\s*\}', 'onClick={addVisit}', content)
        content = re.sub(r'className\s*=\s*"', 'className="', content)
        print("Regex fixes applied!")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("File saved!")
