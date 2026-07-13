import { Report } from '../types/report';

// Helper to sanitize report object for API updates
export const sanitizeReport = (report: Partial<Report>): Partial<Report> => {
    const sanitized: Record<string, unknown> = {};
    for (const key in report) {
        const value = report[key as keyof Report];
        if (value === null || value === undefined) {
            sanitized[key] = '';
        } else {
            sanitized[key] = value;
        }
    }
    return sanitized as Partial<Report>;
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

/**
 * YY/MM/DD形式をYYYY-MM-DD形式に変換します
 */
export function convertYYMMDDToYYYYMMDD(yyMmDd: string): string {
    if (!yyMmDd) return '';
    const parts = yyMmDd.split('/');
    if (parts.length !== 3) return '';
    const yy = parts[0].padStart(2, '0');
    const mm = parts[1].padStart(2, '0');
    const dd = parts[2].padStart(2, '0');
    if (yy.length !== 2 || mm.length !== 2 || dd.length !== 2) return '';
    if (isNaN(Number(yy)) || isNaN(Number(mm)) || isNaN(Number(dd))) return '';
    return `20${yy}-${mm}-${dd}`;
}

/**
 * YYYY-MM-DD形式をYY/MM/DD形式に変換します
 */
export function convertYYYYMMDDToYYMMDD(yyyyMmDd: string): string {
    if (!yyyyMmDd) return '';
    const parts = yyyyMmDd.split('-');
    if (parts.length !== 3) return '';
    const [yyyy, mm, dd] = parts;
    if (yyyy.length !== 4 || mm.length !== 2 || dd.length !== 2) return '';
    return `${yyyy.slice(2)}/${mm}/${dd}`;
}

/**
 * セキュアコンテキスト（HTTPS/localhost）以外でも動作するUUID v4生成関数
 */
export function generateUUID(): string {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
        try {
            return window.crypto.randomUUID();
        } catch (e) {
            // フォールバックへ
        }
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
