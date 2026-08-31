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

/**
 * ファイル名から営業担当者情報（名字、区別用識別子、表示用名）を抽出します
 */
export interface SalesPersonInfo {
    fullName: string;      // 例: "木村（寿）"
    surname: string;       // 例: "木村"
    distinguisher: string; // 例: "寿" (同姓がいる場合の識別文字)
}

export function extractSalesPersonInfo(filename: string | null | undefined): SalesPersonInfo {
    if (!filename) return { fullName: '', surname: '', distinguisher: '' };
    
    const base = String(filename).replace(/\.xlsm$/i, '');
    const matchBrackets = base.match(/【(.*?)】/);
    let raw = matchBrackets ? matchBrackets[1] : base;
    raw = raw.replace(/^日報_/, '');
    raw = raw.replace(/(MGR|Mgr|マネージャー|マネ|次長|課長|部長|係長|主任|担当|顧問|専務|常務|社長)$/i, '').trim();

    // カッコ内の区別文字（例: 木村（寿） -> "寿", 山下（尚） -> "尚", 山下和 -> "和"）
    let distinguisher = '';
    const parenMatch = raw.match(/[\(（](.*?)[\)）]/);
    if (parenMatch) {
        distinguisher = parenMatch[1].trim();
    } else {
        // カッコがない場合で、山下和次長のように「山下和」となっているケース
        if (raw.startsWith('山下和')) {
            distinguisher = '和';
        }
    }

    // 名字（カッコや区別文字を除いた部分）
    let surname = raw.replace(/[\(（].*?[\)）]/, '').trim();
    if (surname === '山下和') {
        surname = '山下';
    }

    // 表示用フルネーム（例: 木村（寿）、森田）
    const fullName = distinguisher ? `${surname}（${distinguisher}）` : surname;

    return {
        fullName,
        surname,
        distinguisher
    };
}

/**
 * ファイル名から営業担当者表示名を抽出するヘルパー（後方互換性用）
 */
export function extractSalesPersonName(filename: string | null | undefined): string {
    const info = extractSalesPersonInfo(filename);
    return info.fullName;
}

/**
 * 企画課ビューワ側の担当者名 (viewerRep) と、選択中ファイル側の担当者情報 (activeRep / filename) が
 * 同姓の別人を含まずに正しく一致しているかを精密に判定します。
 */
export function isSalesPersonMatch(
    viewerRep: string | null | undefined,
    filenameOrActiveRep: string | null | undefined
): boolean {
    if (!viewerRep || !filenameOrActiveRep) return false;

    // ファイル名または担当者名から情報を抽出
    const activeInfo = extractSalesPersonInfo(filenameOrActiveRep);
    if (!activeInfo.surname) return false;

    // ビューワ側の担当者文字列をクリーンアップ
    // 全角・半角カッコ、空白を整理
    const vStr = String(viewerRep).toLowerCase().trim();
    const vClean = vStr.replace(/[\s　]+/g, '');
    const activeSurname = activeInfo.surname.toLowerCase();
    const activeDist = activeInfo.distinguisher.toLowerCase();

    // 1. 名字が含まれているか
    if (!vClean.includes(activeSurname)) {
        return false;
    }

    // 同姓が存在する代表的な苗字の区別文字リスト
    const KNOWN_DISTINGUISHERS: Record<string, string[]> = {
        '木村': ['寿', '拓'],
        '山下': ['尚', '雄', '和'],
    };

    const knownDists = KNOWN_DISTINGUISHERS[activeInfo.surname];

    if (activeDist) {
        // 現在のファイルに区別文字（例: 「寿」）がある場合:
        // ビューワ側にこの区別文字が含まれている必要がある
        if (!vClean.includes(activeDist)) {
            return false;
        }

        // さらに、他人の区別文字（例: 「拓」）が含まれている場合は除外
        if (knownDists) {
            for (const otherDist of knownDists) {
                if (otherDist.toLowerCase() !== activeDist && vClean.includes(otherDist.toLowerCase())) {
                    return false;
                }
            }
        }
        return true;
    } else {
        // 現在のファイルに区別文字がない場合（森田、中野など）:
        // もし同姓がある苗字（木村、山下等）なのに区別文字がファイル名にない場合は、
        // ビューワ側が特定の他人の区別文字を持っているならマッチさせない
        if (knownDists) {
            for (const otherDist of knownDists) {
                if (vClean.includes(otherDist.toLowerCase())) {
                    return false;
                }
            }
        }
        return true;
    }
}

