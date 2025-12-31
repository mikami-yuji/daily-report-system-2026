# -*- coding: utf-8 -*-
"""Comprehensive fix for batch/page.tsx"""
import re

file_path = r"frontend\src\app\reports\batch\page.tsx"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: Remove extra </div> at around line 526
# Pattern: closing the interviewer/stayTime section incorrectly
content = content.replace(
    '''                                    </div>
                                    </div>
                        )}''',
    '''                                    </div>
                                )}'''
)

# Fix 2: Remove misplaced )} at around line 698
content = content.replace(
    '''                                                </div>
                                )
                                            </div>
                                        )}''',
    '''                                                </div>
                                            </div>
                                        )}'''
)

# Fix 3: Fix the map closing - add missing </div> for the outer visit card
content = content.replace(
    '''                            </div>
                        ))}
                    </div>

            {/* 訪問追加ボタン */ }''',
    '''                            </div>
                        </div>
                    ))}
                </div>

            {/* 訪問追加ボタン */}'''
)

# Fix 4: Fix button code with spaces
content = content.replace('< button', '<button')
content = re.sub(r'type\s*=\s*"button"', 'type="button"', content)
content = re.sub(r'onClick\s*=\s*\{\s*addVisit\s*\}', 'onClick={addVisit}', content)
content = re.sub(r'className\s*=\s*"w-full', 'className="w-full', content)

# Fix 5: Remove extra space in comments
content = content.replace('{/* 訪問追加ボタン */ }', '{/* 訪問追加ボタン */}')
content = content.replace('{/* フッター */ }', '{/* フッター */}')

# Fix 6: Fix indentation of footer closing div
content = content.replace(
    '''    </div>
        </div >''',
    '''    </div>
        </div>'''
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("All fixes applied!")
