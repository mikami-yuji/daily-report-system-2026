# -*- coding: utf-8 -*-
"""Fix batch page syntax errors"""
import re

file_path = r"frontend\src\app\reports\batch\page.tsx"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: Remove extra </div> at line ~526 (before "外出時間用フィールド")
content = content.replace(
    '                                    </div>\n                                    </div>\n                        )}',
    '                                    </div>\n                                )}'
)

# Fix 2: Remove duplicate 0% option
content = content.replace(
    '<option value="0%">0%</option>\n                                        <option value="0%">0%</option>',
    '<option value="0%">0%</option>'
)

# Fix 3: Remove misplaced )} at line ~697
content = content.replace(
    '                                                </div>\n                                )}\n                                            </div>\n                                        )}',
    '                                                </div>\n                                            </div>\n                                        )}'
)

# Fix 4: Fix corrupted button code
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

content = content.replace(old_button, new_button)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Fix applied successfully!")
