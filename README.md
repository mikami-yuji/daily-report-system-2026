# 営業日報システム (Daily Report System)

エクセルベースの日報を、モダンなWebインターフェースで管理できるシステムです。Salesforceのような使いやすいUIで、日々の活動報告やデザイン依頼の管理を効率化します。

## ✨ 特徴

- 📊 **エクセル連携**: 既存のエクセルファイル（`.xlsm`）を直接読み書き。関数やマクロを保持したまま運用可能。
- ☁️ **Salesforce風UI**: 直感的でプロフェッショナルなデザイン。サイドバーナビゲーションやカード型レイアウトを採用。
- 🔍 **高度なデザイン検索**:
    - デザインNo.、得意先、デザイン名、種別でのクロス検索
    - 得意先ごとのデザイン種別動的フィルタリング
    - 進捗状況の可視化（色分けバッジ）
    - 関連する活動履歴の時系列表示
- 📈 **データ分析**: 月ごとの訪問数・電話数、重点顧客への活動状況をグラフで可視化。
- 📂 **ファイル管理**: ブラウザから直接エクセルファイルをアップロードして切り替え可能。
- 📱 **レスポンシブ**: PC・タブレット・スマホ対応。
- ⚡ **高速な動作**: Next.js 16 (App Router) と Tailwind CSS によるモダンな実装。

## 📸 スクリーンショット

(スクリーンショットは開発中のものです)

## 🚀 クイックスタート

### 1. バックエンドを起動
```powershell
cd backend
py main.py
```

### 2. フロントエンドを起動（別のターミナルで）
```powershell
cd frontend
npm run dev
```

### 3. ブラウザでアクセス
`http://localhost:3000` を開く

## 📁 プロジェクト構成

```
daily-report-system/
├── backend/              # Python FastAPI バックエンド
│   ├── main.py          # メインAPIファイル (Excel操作、アップロード処理)
│   └── requirements.txt # Python依存関係
├── frontend/            # Next.js フロントエンド
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx          # ダッシュボード（グラフ、統計、ファイルアップロード）
│   │   │   ├── design-search/    # デザイン依頼検索機能
│   │   │   │   └── page.tsx
│   │   │   └── input/            # 日報入力フォーム
│   │   │       └── page.tsx
│   │   ├── components/           # 共通コンポーネント
│   │   │   ├── AppLayout.tsx     # レイアウト
│   │   │   ├── Header.tsx        # ヘッダー
│   │   │   └── Sidebar.tsx       # サイドバー
│   │   └── lib/
│   │       └── api.ts            # APIクライアント
│   └── package.json
├── daily_report_template.xlsm  # エクセルデータファイル
└── 使い方ガイド.md              # 詳細な使い方
```

## 🛠️ 技術スタック

### バックエンド
- Python 3.13
- FastAPI (Web APIフレームワーク)
- pandas (データ処理)
- openpyxl (Excel操作)

### フロントエンド
- Next.js 16 (Reactフレームワーク)
- TypeScript
- Tailwind CSS (スタイリング)
- Recharts (グラフ描画)
- Lucide React (アイコン)

## 🎯 実装状況

### ✅ Phase 1: 基本機能 (完了)
- [x] バックエンドAPI（FastAPI）
- [x] エクセルファイルの読み込み・書き込み
- [x] 日報一覧表示
- [x] 管理番号の自動採番

### ✅ Phase 2: UI/UX改善 (完了)
- [x] Salesforce風のモダンなUIデザイン
- [x] サイドバーナビゲーション
- [x] レスポンシブ対応

### ✅ Phase 3: 分析・検索機能 (完了)
- [x] 月次活動推移のグラフ表示
- [x] 重点顧客活動サマリー
- [x] **デザイン依頼検索機能**
    - [x] デザインNo/得意先/種別/名称での検索
    - [x] 進捗状況の可視化
    - [x] 活動履歴の紐付け表示
- [x] エクセルファイルのWebアップロード機能

## 📝 ライセンス

MIT License
