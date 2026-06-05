import { Report } from './api';
import { MonthlyActivityStats } from '../types/activity';

/**
 * 日報の配列から得意先の月別の活動数を集計します。
 * 
 * @param reports 得意先でフィルタリングされた日報データの配列
 * @returns 月別の活動数集計（月キーの昇順でソート済み）
 */
export function aggregateMonthlyActivities(reports: Report[]): MonthlyActivityStats[] {
  const dataMap = new Map<string, MonthlyActivityStats>();

  reports.forEach((r: Report): void => {
    const dateStr = r.日付;
    if (!dateStr) {
      return;
    }
    const parts = dateStr.split('/');
    if (parts.length < 2) {
      return;
    }

    // YY/MM/DD から年と月を抽出
    const year = parts[0].length === 4 ? parts[0].slice(2) : parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const monthKey = `${year}/${month}`; // ソート用キー
    const monthLabel = `${year}年${month}月`; // 表示用ラベル

    if (!dataMap.has(monthKey)) {
      dataMap.set(monthKey, {
        month: monthLabel,
        visits: 0,
        calls: 0,
        designs: 0,
        complaints: 0,
        proposals: 0,
        total: 0,
      });
    }

    const stats = dataMap.get(monthKey)!;
    stats.total += 1;

    // 訪問・電話のカウント
    if (r.行動内容 && r.行動内容.includes('訪問')) {
      stats.visits += 1;
    }
    if (r.行動内容 && r.行動内容.includes('電話')) {
      stats.calls += 1;
    }

    // デザイン提案のカウント（提案有無が「有」、またはシステム確認用デザインNo.が存在）
    const hasDesign = (r.デザイン提案有無 && r.デザイン提案有無.includes('有')) || 
                      (r['システム確認用デザインNo.'] && !isNaN(Number(r['システム確認用デザインNo.'])));
    if (hasDesign) {
      stats.designs += 1;
    }

    // クレーム対応のカウント（行動内容か商談内容に「クレーム」を含む）
    const isComplaint = (r.行動内容 && r.行動内容.includes('クレーム')) || 
                        (r.商談内容 && String(r.商談内容).includes('クレーム'));
    if (isComplaint) {
      stats.complaints += 1;
    }

    // 提案物のカウント（空文字や '-' 以外の有効な文字列がある場合）
    if (r.提案物 && typeof r.提案物 === 'string' && r.提案物.trim() !== '' && r.提案物.trim() !== '-') {
      stats.proposals += 1;
    }
  });

  // キーの昇順でソートして配列で返却
  return Array.from(dataMap.entries())
    .sort((a: [string, MonthlyActivityStats], b: [string, MonthlyActivityStats]): number => a[0].localeCompare(b[0]))
    .map((entry: [string, MonthlyActivityStats]): MonthlyActivityStats => entry[1]);
}
