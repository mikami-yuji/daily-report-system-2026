import { Report } from './api';

export interface CalendarDay {
    date: Date;
    dateString: string;
    isCurrentMonth: boolean;
    visits: {
        customerName: string;
        action: string;
        managementNumber: number;
        hasDesign: boolean;
        // 追加フィールド
        interviewer?: string;
        stayTime?: string;
        commercialContent?: string;
        designType?: string;
        designName?: string;
    }[];
}

export interface MonthData {
    year: number;
    month: number;
    days: CalendarDay[];
    totalVisits: number;
    uniqueCustomers: number;
}

/**
 * Get the number of days in a month
 */
export function getDaysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
}

/**
 * Get the day of week for the first day of the month (0 = Sunday, 6 = Saturday)
 */
export function getFirstDayOfMonth(year: number, month: number): number {
    return new Date(year, month, 1).getDay();
}

/**
 * Format date as YYYY/MM/DD
 */
export function formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
}

/**
 * Parse date string to Date object
 */
export function parseDate(dateStr: string | undefined): Date | null {
    if (!dateStr) return null;

    // Normalize separators: replace - and . with /
    const normalized = dateStr.replace(/[-.]/g, '/');

    // Handle YYYY/MM/DD or YY/MM/DD
    const parts = normalized.split('/');
    if (parts.length === 3) {
        let year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
        const day = parseInt(parts[2], 10);

        if (isNaN(year) || isNaN(month) || isNaN(day)) return null;

        // Adjust 2-digit year to 20YY
        if (year < 100) {
            year += 2000;
        }

        const date = new Date(year, month, day);
        if (!isNaN(date.getTime())) {
            return date;
        }
    }

    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
}

/**
 * Generate calendar data for a specific month
 */
export function generateMonthCalendar(year: number, month: number, reports: Report[]): MonthData {
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const days: CalendarDay[] = [];

    // Add days from previous month to fill the first week
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const daysInPrevMonth = getDaysInMonth(prevYear, prevMonth);

    for (let i = firstDay - 1; i >= 0; i--) {
        const day = daysInPrevMonth - i;
        const date = new Date(prevYear, prevMonth, day);
        days.push({
            date,
            dateString: formatDate(date),
            isCurrentMonth: false,
            visits: []
        });
    }

    // Add days of current month
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dateString = formatDate(date);

        // Filter reports for this date and extract visit information
        const visits = reports
            .filter(report => {
                const reportDate = parseDate(report.日付);
                if (!reportDate) return false;
                return formatDate(reportDate) === dateString;
            })
            .filter(report => {
                // Only include reports with visit action or internal work
                const action = String(report.行動内容 || '');
                return action.includes('訪問') || action === '社内（半日）' || action === '社内（１日）';
            })
            .map(report => {
                const action = String(report.行動内容 || '');
                const isInternal = action === '社内（半日）' || action === '社内（１日）';
                return {
                    customerName: isInternal ? action : (report.訪問先名 || '不明'),
                    action: action,
                    managementNumber: report.管理番号 || 0,
                    hasDesign: report.デザイン提案有無 === 'あり',
                    // 追加フィールド
                    interviewer: report.面談者 || '',
                    stayTime: report.滞在時間 || '',
                    commercialContent: report.商談内容 || '',
                    designType: report.デザイン種別 || '',
                    designName: report.デザイン名 || ''
                };
            });

        days.push({
            date,
            dateString,
            isCurrentMonth: true,
            visits
        });
    }

    // Add days from next month to fill the last week
    const remainingDays = 42 - days.length; // 6 weeks * 7 days
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;

    for (let day = 1; day <= remainingDays; day++) {
        const date = new Date(nextYear, nextMonth, day);
        days.push({
            date,
            dateString: formatDate(date),
            isCurrentMonth: false,
            visits: []
        });
    }

    // Calculate summary statistics
    const currentMonthDays = days.filter(d => d.isCurrentMonth);
    const totalVisits = currentMonthDays.reduce((sum, day) => sum + day.visits.length, 0);
    const uniqueCustomers = new Set(
        currentMonthDays.flatMap(day => day.visits.map(v => v.customerName))
    ).size;

    return {
        year,
        month,
        days,
        totalVisits,
        uniqueCustomers
    };
}

/**
 * Get month name in Japanese
 */
export function getMonthName(month: number): string {
    return `${month + 1}月`;
}

/**
 * Get day of week name in Japanese
 */
export function getDayName(dayOfWeek: number): string {
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    return days[dayOfWeek];
}
