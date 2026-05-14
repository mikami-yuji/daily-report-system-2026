
// Helper to sanitize report object for API updates
export const sanitizeReport = (report: any) => {
    const sanitized: any = {};
    for (const key in report) {
        if (report[key] === null || report[key] === undefined) {
            sanitized[key] = '';
        } else {
            sanitized[key] = report[key];
        }
    }
    return sanitized;
};

export function cleanText(text: string | null | undefined): string {
    if (!text) return '';
    return String(text).replace(/_x000D_/g, '\n').replace(/\r/g, '');
}

/**
 * YY/MM/DD 形式の日付を YYYYMMDD の形式に正規化してソートしやすくします
 * 1桁の月日は 0 埋めされます (例: 26/5/8 -> 260508)
 */
export function normalizeDateForSort(dateStr: string | null | undefined): string {
    if (!dateStr) return '00000000';
    const cleanDate = String(dateStr).trim();
    if (!cleanDate) return '00000000';

    const parts = cleanDate.split('/');
    // 各パーツを2桁にパディングして結合 (例: 26/5/8 -> 260508, 26/5 -> 2605)
    return parts.map(p => p.padStart(2, '0')).join('');
}

/**
 * 2つの日付文字列 (YY/MM/DD) を比較します
 */
export function compareDates(dateA: string, dateB: string): number {
    const normA = normalizeDateForSort(dateA);
    const normB = normalizeDateForSort(dateB);
    return normA.localeCompare(normB);
}

/**
 * ユーザー入力を正規化します (例: 26/5/8 -> 26/05/08)
 */
export function normalizeDateInput(dateStr: string): string {
    if (!dateStr) return dateStr;
    const parts = String(dateStr).trim().split('/');
    if (parts.length !== 3) return dateStr;

    const year = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const day = parts[2].padStart(2, '0');

    return `${year}/${month}/${day}`;
}
