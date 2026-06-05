import { test } from 'node:test';
import assert from 'node:assert';
import { aggregateMonthlyActivities } from './activityUtils.ts';
import { MonthlyActivityStats } from '../types/activity.ts';
import { Report } from './api.ts';

test('aggregateMonthlyActivities correctly aggregates report activities by month', (): void => {
  // テスト用のダミーデータを作成
  const mockReports: Report[] = [
    {
      管理番号: 1,
      日付: '26/05/10',
      行動内容: '訪問 (商談)',
      エリア: '大阪府',
      得意先CD: '12345',
      直送先CD: '',
      訪問先名: 'テスト得意先A',
      直送先名: '',
      重点顧客: '重点',
      ランク: 'S',
      得意先目標: '目標',
      面談者: '山田',
      滞在時間: '1時間',
      デザイン提案有無: '有',
      デザイン種別: 'パッケージ',
      デザイン名: '新デザイン',
      デザイン進捗状況: '進行中',
      'デザイン依頼No.': '999',
      'システム確認用デザインNo.': '999',
      商談内容: 'パッケージのデザイン提案を行いました。',
      提案物: 'サンプルA',
      次回プラン: '見積もり提出',
      競合他社情報: 'なし',
      上長コメント: '',
      コメント返信欄: '',
      上長: '',
      山澄常務: '',
      岡本常務: '',
      中野次長: '',
      既読チェック: ''
    },
    {
      管理番号: 2,
      日付: '26/05/12',
      行動内容: '電話 (アポ取り)',
      エリア: '大阪府',
      得意先CD: '12345',
      直送先CD: '',
      訪問先名: 'テスト得意先A',
      直送先名: '',
      重点顧客: '重点',
      ランク: 'S',
      得意先目標: '目標',
      面談者: '山田',
      滞在時間: '10分',
      デザイン提案有無: '',
      デザイン種別: '',
      デザイン名: '',
      デザイン進捗状況: '',
      'デザイン依頼No.': '',
      'システム確認用デザインNo.': '',
      商談内容: 'アポ調整。クレーム対応について少し話しました。',
      提案物: '',
      次回プラン: '',
      競合他社情報: '',
      上長コメント: '',
      コメント返信欄: '',
      上長: '',
      山澄常務: '',
      岡本常務: '',
      中野次長: '',
      既読チェック: ''
    },
    {
      管理番号: 3,
      日付: '26/06/01',
      行動内容: '訪問 (納品)',
      エリア: '大阪府',
      得意先CD: '12345',
      直送先CD: '',
      訪問先名: 'テスト得意先A',
      直送先名: '',
      重点顧客: '重点',
      ランク: 'S',
      得意先目標: '目標',
      面談者: '鈴木',
      滞在時間: '30分',
      デザイン提案有無: '',
      デザイン種別: '',
      デザイン名: '',
      デザイン進捗状況: '',
      'デザイン依頼No.': '',
      'システム確認用デザインNo.': '',
      商談内容: '納品完了。',
      提案物: 'カタログ',
      次回プラン: '',
      競合他社情報: '',
      上長コメント: '',
      コメント返信欄: '',
      上長: '',
      山澄常務: '',
      岡本常務: '',
      中野次長: '',
      既読チェック: ''
    }
  ];

  const result: MonthlyActivityStats[] = aggregateMonthlyActivities(mockReports);

  // 検証
  assert.strictEqual(result.length, 2);

  // 26年05月の集計結果
  const mayStats = result[0];
  assert.strictEqual(mayStats.month, '26年05月');
  assert.strictEqual(mayStats.visits, 1);     // 管理番号1が「訪問」
  assert.strictEqual(mayStats.calls, 1);      // 管理番号2が「電話」
  assert.strictEqual(mayStats.designs, 1);    // 管理番号1がデザイン提案「有」かつNo.あり
  assert.strictEqual(mayStats.complaints, 1); // 管理番号2の商談内容に「クレーム」が含まれる
  assert.strictEqual(mayStats.proposals, 1);  // 管理番号1が「サンプルA」
  assert.strictEqual(mayStats.total, 2);

  // 26年06月の集計結果
  const juneStats = result[1];
  assert.strictEqual(juneStats.month, '26年06月');
  assert.strictEqual(juneStats.visits, 1);
  assert.strictEqual(juneStats.calls, 0);
  assert.strictEqual(juneStats.designs, 0);
  assert.strictEqual(juneStats.complaints, 0);
  assert.strictEqual(juneStats.proposals, 1);  // 「カタログ」
  assert.strictEqual(juneStats.total, 1);
});

test('aggregateMonthlyActivities ignores invalid dates and sorts ascending', (): void => {
  const mockReports: Report[] = [
    {
      管理番号: 1,
      日付: '26/10/05',
      行動内容: '訪問',
      エリア: '大阪府',
      得意先CD: '12345',
      直送先CD: '',
      訪問先名: 'テスト得意先A',
      直送先名: '',
      重点顧客: '',
      ランク: '',
      得意先目標: '',
      面談者: '',
      滞在時間: '',
      デザイン提案有無: '',
      デザイン種別: '',
      デザイン名: '',
      デザイン進捗状況: '',
      'デザイン依頼No.': '',
      'システム確認用デザインNo.': '',
      商談内容: '',
      提案物: '',
      次回プラン: '',
      競合他社情報: '',
      上長コメント: '',
      コメント返信欄: '',
      上長: '',
      山澄常務: '',
      岡本常務: '',
      中野次長: '',
      既読チェック: ''
    },
    {
      管理番号: 2,
      日付: 'invalid_date', // 不正な日付形式
      行動内容: '訪問',
      エリア: '大阪府',
      得意先CD: '12345',
      直送先CD: '',
      訪問先名: 'テスト得意先A',
      直送先名: '',
      重点顧客: '',
      ランク: '',
      得意先目標: '',
      面談者: '',
      滞在時間: '',
      デザイン提案有無: '',
      デザイン種別: '',
      デザイン名: '',
      デザイン進捗状況: '',
      'デザイン依頼No.': '',
      'システム確認用デザインNo.': '',
      商談内容: '',
      提案物: '',
      次回プラン: '',
      競合他社情報: '',
      上長コメント: '',
      コメント返信欄: '',
      上長: '',
      山澄常務: '',
      岡本常務: '',
      中野次長: '',
      既読チェック: ''
    },
    {
      管理番号: 3,
      日付: '26/02/10', // 26/10より前
      行動内容: '訪問',
      エリア: '大阪府',
      得意先CD: '12345',
      直送先CD: '',
      訪問先名: 'テスト得意先A',
      直送先名: '',
      重点顧客: '',
      ランク: '',
      得意先目標: '',
      面談者: '',
      滞在時間: '',
      デザイン提案有無: '',
      デザイン種別: '',
      デザイン名: '',
      デザイン進捗状況: '',
      'デザイン依頼No.': '',
      'システム確認用デザインNo.': '',
      商談内容: '',
      提案物: '',
      次回プラン: '',
      競合他社情報: '',
      上長コメント: '',
      コメント返信欄: '',
      上長: '',
      山澄常務: '',
      岡本常務: '',
      中野次長: '',
      既読チェック: ''
    }
  ];

  const result = aggregateMonthlyActivities(mockReports);

  // 不正な日付は除外され、2件となるはず
  assert.strictEqual(result.length, 2);

  // 時系列昇順で並んでいること（26年02月 -> 26年10月）
  assert.strictEqual(result[0].month, '26年02月');
  assert.strictEqual(result[1].month, '26年10月');
});
