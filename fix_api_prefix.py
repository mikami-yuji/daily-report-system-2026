#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""APIエンドポイントに/api/プレフィックスを追加するスクリプト"""

import re

# main.pyを読み込み
with open('backend/main.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 置換パターン（元のパス -> /api/プレフィックス付きパス）
replacements = [
    (r'@app\.get\("/health"\)', '@app.get("/api/health")'),
    (r'@app\.get\("/files"\)', '@app.get("/api/files")'),
    (r'@app\.get\("/customers"\)', '@app.get("/api/customers")'),
    (r'@app\.get\("/priority-customers"\)', '@app.get("/api/priority-customers")'),
    (r'@app\.get\("/interviewers"\)', '@app.get("/api/interviewers")'),
    (r'@app\.get\("/reports/\{management_number\}"\)', '@app.get("/api/reports/{management_number}")'),
    (r'@app\.get\("/reports"\)', '@app.get("/api/reports")'),
    (r'@app\.get\("/interviewers/\{customer_cd\}"\)', '@app.get("/api/interviewers/{customer_cd}")'),
    (r'@app\.get\("/designs/\{customer_cd\}"\)', '@app.get("/api/designs/{customer_cd}")'),
    (r'@app\.post\("/reports"\)', '@app.post("/api/reports")'),
    (r'@app\.patch\("/reports/\{management_number\}/reply"\)', '@app.patch("/api/reports/{management_number}/reply")'),
    (r'@app\.patch\("/reports/\{management_number\}/comment"\)', '@app.patch("/api/reports/{management_number}/comment")'),
    (r'@app\.patch\("/reports/\{management_number\}/approval"\)', '@app.patch("/api/reports/{management_number}/approval")'),
    (r'@app\.post\("/reports/\{management_number\}"\)', '@app.post("/api/reports/{management_number}")'),
    (r'@app\.delete\("/reports/\{management_number\}"\)', '@app.delete("/api/reports/{management_number}")'),
    (r'@app\.post\("/upload"\)', '@app.post("/api/upload")'),
    (r'@app\.get\("/images/list"\)', '@app.get("/api/images/list")'),
    (r'@app\.get\("/images/content"\)', '@app.get("/api/images/content")'),
    (r'@app\.get\("/images/search"\)', '@app.get("/api/images/search")'),
    (r'@app\.post\("/sales/upload"\)', '@app.post("/api/sales/upload")'),
    (r'@app\.get\("/sales/all"\)', '@app.get("/api/sales/all")'),
    (r'@app\.get\("/sales/\{customer_code\}"\)', '@app.get("/api/sales/{customer_code}")'),
]

# 置換実行
for pattern, replacement in replacements:
    content = re.sub(pattern, replacement, content)

# 書き込み
with open('backend/main.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("API prefix added to all endpoints!")
