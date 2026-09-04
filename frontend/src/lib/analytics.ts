import { Report } from '@/types/report';
import { AnalyticsData, PriorityMatrixData, PersonalScoreData, NeglectedCustomerAlert } from '@/types/analytics';


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

    // Fallback to standard parsing (try to force local time if possible, but standard new Date(str) is inconsistent)
    // With normalization above, most dates should be caught by the split logic.
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
}

export function aggregateAnalytics(
    reports: Report[],
    startDate?: Date,
    endDate?: Date,
    priorityCustomers?: { 得意先CD: string; 得意先名: string }[]
): AnalyticsData {
    // Filter by date range if provided
    let filteredReports = reports;
    if (startDate || endDate) {
        filteredReports = reports.filter(report => {
            const reportDate = parseDate(report.日付);
            if (!reportDate) return false;

            // Reset time part for comparison
            reportDate.setHours(0, 0, 0, 0);

            if (startDate) {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                if (reportDate < start) return false;
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                if (reportDate > end) return false;
            }
            return true;
        });
    }

    // Calculate KPIs
    // Fix: totalVisits should only count records where action includes '訪問'
    const totalVisits = filteredReports.filter(r => {
        const action = String(r.行動内容 || '');
        return action.includes('訪問');
    }).length;

    // Count total unique design requests using システム確認用デザインNo. (same as design search)
    const uniqueDesignNos = new Set(
        filteredReports
            .filter(r => r['システム確認用デザインNo.'] && String(r['システム確認用デザインNo.']).trim() !== '')
            .map(r => String(r['システム確認用デザインNo.']).trim())
    );
    const totalProposals = uniqueDesignNos.size;

    // Completed designs: unique designs with 出稿 status (count by システム確認用デザインNo.)
    const completedDesignNos = new Set(
        filteredReports
            .filter(r => {
                if (!r['システム確認用デザインNo.']) return false;
                if (!r.デザイン進捗状況) return false;
                return String(r.デザイン進捗状況).includes('出稿');
            })
            .map(r => String(r['システム確認用デザインNo.']).trim())
    );
    const completedDesigns = completedDesignNos.size;

    // Rejected designs: unique designs with 不採用 status (count by システム確認用デザインNo.)
    const rejectedDesignNos = new Set(
        filteredReports
            .filter(r => {
                if (!r['システム確認用デザインNo.']) return false;
                if (!r.デザイン進捗状況) return false;
                return String(r.デザイン進捗状況).includes('不採用');
            })
            .map(r => String(r['システム確認用デザインNo.']).trim())
    );
    const rejectedDesigns = rejectedDesignNos.size;

    // Active projects: all unique designs minus completed and rejected
    const activeDesignNos = new Set(uniqueDesignNos);
    completedDesignNos.forEach(no => activeDesignNos.delete(no));
    rejectedDesignNos.forEach(no => activeDesignNos.delete(no));
    const activeProjects = activeDesignNos.size;

    // Acceptance Rate
    const acceptanceRate = totalProposals > 0
        ? Math.round((completedDesigns / totalProposals) * 100)
        : 0;

    // Phone and email contacts
    const phoneContacts = filteredReports.filter(r => {
        const action = String(r.行動内容 || '');
        return action.includes('電話');
    }).length;

    const emailContacts = filteredReports.filter(r => {
        const action = String(r.行動内容 || '');
        return action.includes('メール');
    }).length;

    // Trends by date (using unique design numbers for proposals)
    const trendMap = new Map<string, { visits: number; proposalNos: Set<string>; completed: number; rejected: number; phone: number; email: number }>();
    filteredReports.forEach(report => {
        // Normalize date string for grouping
        const reportDate = parseDate(report.日付);
        if (!reportDate) return;

        // Format as YYYY/MM/DD for consistent map keys
        const dateKey = `${reportDate.getFullYear()}/${String(reportDate.getMonth() + 1).padStart(2, '0')}/${String(reportDate.getDate()).padStart(2, '0')}`;

        const action = String(report.行動内容 || '');
        const status = String(report.デザイン進捗状況 || '');
        const designNo = report['システム確認用デザインNo.'] ? String(report['システム確認用デザインNo.']).trim() : '';

        if (!trendMap.has(dateKey)) {
            trendMap.set(dateKey, { visits: 0, proposalNos: new Set(), completed: 0, rejected: 0, phone: 0, email: 0 });
        }
        const trend = trendMap.get(dateKey)!;

        // Only increment visits if action includes '訪問'
        if (action.includes('訪問')) {
            trend.visits++;
        }

        // Count unique design numbers
        if (designNo) {
            trend.proposalNos.add(designNo);
        }
        if (status.includes('出稿')) {
            trend.completed++;
        }
        if (status.includes('不採用')) {
            trend.rejected++;
        }
        if (action.includes('電話')) {
            trend.phone++;
        }
        if (action.includes('メール')) {
            trend.email++;
        }
    });
    const trends = Array.from(trendMap.entries())
        .map(([date, data]) => ({ date, visits: data.visits, proposals: data.proposalNos.size, completed: data.completed, rejected: data.rejected, phone: data.phone, email: data.email }))
        .sort((a, b) => a.date.localeCompare(b.date));

    // By Area
    const areaMap = new Map<string, { count: number; proposals: number }>();
    filteredReports.forEach(report => {
        const area = report.エリア || '未設定';
        if (!areaMap.has(area)) {
            areaMap.set(area, { count: 0, proposals: 0 });
        }
        const areaData = areaMap.get(area)!;
        areaData.count++;
        if (report.デザイン提案有無 === 'あり') {
            areaData.proposals++;
        }
    });
    const byArea = Array.from(areaMap.entries())
        .map(([area, data]) => ({ area, ...data }))
        .sort((a, b) => b.count - a.count);

    // By Rank
    const rankMap = new Map<string, number>();
    filteredReports.forEach(report => {
        const rank = report.ランク || '未設定';
        rankMap.set(rank, (rankMap.get(rank) || 0) + 1);
    });
    const byRank = Array.from(rankMap.entries())
        .map(([rank, count]) => ({ rank, count }))
        .sort((a, b) => b.count - a.count);

    // By Action
    const actionMap = new Map<string, number>();
    filteredReports.forEach(report => {
        const action = report.行動内容 || '未設定';
        actionMap.set(action, (actionMap.get(action) || 0) + 1);
    });
    const byAction = Array.from(actionMap.entries())
        .map(([action, count]) => ({ action, count }))
        .sort((a, b) => b.count - a.count);

    // By Interviewer
    const interviewerMap = new Map<string, { visits: number; proposals: number; completed: number }>();
    filteredReports.forEach(report => {
        const interviewer = report.面談者 || '未設定';
        const status = String(report.デザイン進捗状況 || '');

        if (!interviewerMap.has(interviewer)) {
            interviewerMap.set(interviewer, { visits: 0, proposals: 0, completed: 0 });
        }
        const data = interviewerMap.get(interviewer)!;
        data.visits++;
        if (report.デザイン提案有無 === 'あり') {
            data.proposals++;
        }
        if (status.includes('出稿')) {
            data.completed++;
        }
    });
    const byInterviewer = Array.from(interviewerMap.entries())
        .map(([name, data]) => ({
            name,
            ...data,
            acceptanceRate: data.proposals > 0 ? Math.round((data.completed / data.proposals) * 100) : 0
        }))
        .sort((a, b) => b.visits - a.visits);

    // Design Progress: count by unique システム確認用デザインNo. using latest date record
    // First, get the latest record for each unique design number
    const latestDesignRecords = new Map<string, Report>();
    filteredReports
        .filter(r => r['システム確認用デザインNo.'] && r.デザイン進捗状況)
        .forEach(report => {
            const designNo = String(report['システム確認用デザインNo.']).trim();
            const existing = latestDesignRecords.get(designNo);
            if (!existing) {
                latestDesignRecords.set(designNo, report);
            } else {
                // Compare dates and keep the latest
                const existingDate = String(existing.日付 || '');
                const currentDate = String(report.日付 || '');
                if (currentDate > existingDate) {
                    latestDesignRecords.set(designNo, report);
                }
            }
        });

    // Now count by progress status using only the latest records
    const progressMap = new Map<string, number>();
    latestDesignRecords.forEach(report => {
        const status = String(report.デザイン進捗状況!);
        progressMap.set(status, (progressMap.get(status) || 0) + 1);
    });
    const designProgress = Array.from(progressMap.entries())
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count);

    const priorityCodes = new Set(priorityCustomers?.map(c => String(c.得意先CD || '').trim()));

    // Priority Customer Analysis - 得意先CDと直送先CDでユニークにカウント
    const priorityReports = filteredReports.filter(r => {
        const code = String(r.得意先CD || '').trim();
        if (priorityCodes.size > 0) {
            return priorityCodes.has(code);
        }
        // マスタリストがない場合のフォールバック（日報のフラグ）
        return r.重点顧客 && r.重点顧客 !== '-' && r.重点顧客 !== '';
    });

    // Use customer code + direct delivery code as unique key
    const priorityCustomerMap = new Map<string, {
        code: string;
        name: string;
        visits: number;
        calls: number;
        designNos: Set<string>;
        completed: number;
        rejected: number;
        lastVisit: string | null;
        isDirectDelivery: boolean;
    }>();

    priorityReports.forEach(report => {
        const customerCode = String(report.得意先CD || '');
        const customerName = report.訪問先名 || '不明';
        const ddCode = report.直送先CD ? String(report.直送先CD) : '';
        const ddName = report.直送先名 ? String(report.直送先名) : '';

        // 直送先がある場合は直送先をキーに、なければ得意先をキーにする
        const uniqueKey = ddCode ? `${customerCode}-${ddCode}` : customerCode;
        const displayName = ddCode ? (ddName || customerName) : customerName;
        const isDD = !!ddCode;

        const action = String(report.行動内容 || '');
        const status = String(report.デザイン進捗状況 || '');
        const date = report.日付 || null;
        const designNo = report['システム確認用デザインNo.'] ? String(report['システム確認用デザインNo.']).trim() : '';

        if (!priorityCustomerMap.has(uniqueKey)) {
            priorityCustomerMap.set(uniqueKey, {
                code: uniqueKey,
                name: displayName,
                visits: 0,
                calls: 0,
                designNos: new Set(),
                completed: 0,
                rejected: 0,
                lastVisit: null,
                isDirectDelivery: isDD
            });
        }
        const data = priorityCustomerMap.get(uniqueKey)!;

        if (action.includes('訪問')) {
            data.visits++;
            if (date) {
                if (!data.lastVisit || date > data.lastVisit) {
                    data.lastVisit = date;
                }
            }
        }
        if (action.includes('電話')) {
            data.calls++;
        }
        // Count unique design numbers per customer
        if (designNo) {
            data.designNos.add(designNo);
        }
        if (status.includes('出稿')) {
            data.completed++;
        }
        if (status.includes('不採用')) {
            data.rejected++;
        }
    });

    const priorityByCustomer = Array.from(priorityCustomerMap.entries())
        .map(([key, data]) => ({
            name: data.isDirectDelivery ? `【直送】${data.name}` : data.name,
            visits: data.visits,
            calls: data.calls,
            proposals: data.designNos.size,
            completed: data.completed,
            rejected: data.rejected,
            lastVisit: data.lastVisit
        }))
        .sort((a, b) => b.visits - a.visits);

    const totalPriorityVisits = priorityByCustomer.reduce((sum, c) => sum + c.visits, 0);
    const totalPriorityCalls = priorityByCustomer.reduce((sum, c) => sum + c.calls, 0);
    // Count unique design requests for priority customers (same logic as design search)
    const uniquePriorityDesignNos = new Set(
        priorityReports
            .filter(r => r['システム確認用デザインNo.'] && String(r['システム確認用デザインNo.']).trim() !== '')
            .map(r => String(r['システム確認用デザインNo.']).trim())
    );
    const totalPriorityProposals = uniquePriorityDesignNos.size;
    const totalPriorityCompleted = priorityByCustomer.reduce((sum, c) => sum + c.completed, 0);
    const totalPriorityRejected = priorityByCustomer.reduce((sum, c) => sum + c.rejected, 0);
    const priorityAcceptanceRate = totalPriorityProposals > 0
        ? Math.round((totalPriorityCompleted / totalPriorityProposals) * 100)
        : 0;
    const uniquePriorityCustomers = priorityCustomerMap.size;

    const priority = {
        totalCustomers: uniquePriorityCustomers,
        totalVisits: totalPriorityVisits,
        totalCalls: totalPriorityCalls,
        totalProposals: totalPriorityProposals,
        completedDesigns: totalPriorityCompleted,
        rejectedDesigns: totalPriorityRejected,
        acceptanceRate: priorityAcceptanceRate,
        coverageRate: 0, // Placeholder
        byCustomer: priorityByCustomer
    };

    return {
        kpis: {
            totalVisits,
            totalProposals,
            activeProjects,
            completedDesigns,
            rejectedDesigns,
            acceptanceRate,
            phoneContacts,
            emailContacts
        },
        trends,
        byArea,
        byRank,
        byAction,
        byInterviewer,
        designProgress,
        priority
    };
}

export function getDateRange(period: 'today' | 'week' | 'month' | 'quarter' | 'year'): { start: Date; end: Date } {
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const start = new Date();
    start.setHours(0, 0, 0, 0);

    switch (period) {
        case 'today':
            // Already set
            break;
        case 'week':
            start.setDate(start.getDate() - 7);
            break;
        case 'month':
            start.setMonth(start.getMonth() - 1);
            break;
        case 'quarter':
            start.setMonth(start.getMonth() - 3);
            break;
        case 'year':
            start.setFullYear(start.getFullYear() - 1);
            break;
    }

    return { start, end };
}

// 重点顧客マトリクスデータの型（@/types/analytics よりインポート）

// 週番号を取得（ISO週番号）
function getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// 週の開始日を取得（月曜日）
function getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

// 重点顧客の週別・月別マトリクス集計
export function aggregatePriorityMatrix(
    reports: Report[],
    priorityCustomers: { 得意先CD: string; 得意先名: string }[],
    mode: 'weekly' | 'monthly',
    metric: 'visits' | 'calls' | 'total'
): PriorityMatrixData {
    const now = new Date();
    const periods: string[] = [];
    const periodKeys: string[] = [];

    // 期間ラベルとキーを生成
    if (mode === 'monthly') {
        // 過去6ヶ月
        for (let i = 5; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const month = date.getMonth() + 1;
            const year = date.getFullYear();
            periods.push(`${month}月`);
            periodKeys.push(`${year}-${String(month).padStart(2, '0')}`);
        }
    } else {
        // 過去8週間
        for (let i = 7; i >= 0; i--) {
            const weekStart = getWeekStart(new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000));
            const month = weekStart.getMonth() + 1;
            const day = weekStart.getDate();
            periods.push(`${month}/${day}週`);
            periodKeys.push(`${weekStart.getFullYear()}-W${String(getWeekNumber(weekStart)).padStart(2, '0')}`);
        }
    }

    // 顧客ごとのデータを初期化
    const customerDataMap = new Map<string, {
        code: string;
        name: string;
        values: Map<string, number>;
        lastActivity: string | null;
    }>();

    // 重点顧客マスタがある場合はそれを使用、なければ日報から抽出
    let effectivePriorityCustomers = priorityCustomers;

    if (priorityCustomers.length === 0) {
        // 日報データから重点顧客を抽出（重点顧客フラグがあるもの）
        const priorityFromReports = new Map<string, string>();
        reports.forEach(report => {
            if (report.重点顧客 && report.重点顧客 !== '-' && report.重点顧客 !== '') {
                // 得意先CDをクリーンアップ（数値の場合は整数に変換）
                let code = report.得意先CD;
                if (typeof code === 'number') {
                    code = String(Math.floor(code));
                } else {
                    code = String(code || '').trim();
                }

                // 顧客名を取得（訪問先名 > 直送先名 > 得意先CDの順で優先）
                let name = report.訪問先名 || report.直送先名 || '';
                if (!name || name === 'nan' || name === 'undefined') {
                    name = `得意先${code}`;
                }

                if (code && code !== 'nan' && code !== 'undefined' && !priorityFromReports.has(code)) {
                    priorityFromReports.set(code, name);
                }
            }
        });
        effectivePriorityCustomers = Array.from(priorityFromReports.entries()).map(([code, name]) => ({
            得意先CD: code,
            得意先名: name
        }));
    }

    // 全重点顧客を初期化（活動なしでも0で表示）
    // 直送先がある場合は「得意先CD-直送先CD」をキーとして使用
    effectivePriorityCustomers.forEach(c => {
        const code = String(c.得意先CD).trim();
        if (!customerDataMap.has(code)) {
            customerDataMap.set(code, {
                code,
                name: c.得意先名,
                values: new Map(periodKeys.map(k => [k, 0])),
                lastActivity: null
            });
        }
    });

    // 日報データを集計（直送先がある場合は直送先単位で集計）
    reports.forEach(report => {
        const customerCode = String(report.得意先CD || '').trim();
        if (!customerCode) return;

        // 重点顧客マスタ（または日報から抽出した重点リスト）に得意先が存在するかチェック
        if (!customerDataMap.has(customerCode)) return;

        const directDeliveryCode = report.直送先CD ? String(report.直送先CD).replace(/\.0$/, '').trim() : '';
        const directDeliveryName = report.直送先名 || '';
        const customerName = report.訪問先名 || '';

        // 直送先がある場合は直送先でマッチング、なければ得意先でマッチング
        let matchKey = customerCode;
        let displayName = customerName;

        if (directDeliveryCode && directDeliveryCode !== 'nan' && directDeliveryCode !== '') {
            // 直送先がある場合は、得意先と直送先の組み合わせでキーを作成
            matchKey = `${customerCode}-${directDeliveryCode}`;
            displayName = directDeliveryName
                ? `${customerName} / ${directDeliveryName}`
                : customerName;
        }

        const reportDate = parseDate(report.日付);
        if (!reportDate) return;

        const action = String(report.行動内容 || '');
        const isVisit = action.includes('訪問');
        const isCall = action.includes('電話');

        // 指標に応じてカウント
        let shouldCount = false;
        if (metric === 'visits' && isVisit) shouldCount = true;
        if (metric === 'calls' && isCall) shouldCount = true;
        if (metric === 'total' && (isVisit || isCall)) shouldCount = true;

        if (!shouldCount) return;

        // 期間キーを計算
        let periodKey: string;
        if (mode === 'monthly') {
            periodKey = `${reportDate.getFullYear()}-${String(reportDate.getMonth() + 1).padStart(2, '0')}`;
        } else {
            const weekStart = getWeekStart(reportDate);
            periodKey = `${weekStart.getFullYear()}-W${String(getWeekNumber(weekStart)).padStart(2, '0')}`;
        }

        // 直送先がある場合は新しいエントリを作成（なければ）
        if (directDeliveryCode && directDeliveryCode !== 'nan' && directDeliveryCode !== '') {
            if (!customerDataMap.has(matchKey)) {
                customerDataMap.set(matchKey, {
                    code: matchKey,
                    name: displayName,
                    values: new Map(periodKeys.map(k => [k, 0])),
                    lastActivity: null
                });
            }
            // 元の得意先エントリは削除しない（両方表示）
        }

        // 1. 直送先（または得意先）の個別エントリを更新
        const customerData = customerDataMap.get(matchKey) || customerDataMap.get(customerCode);
        if (customerData && customerData.values.has(periodKey)) {
            customerData.values.set(periodKey, (customerData.values.get(periodKey) || 0) + 1);

            // 最終活動日を更新
            const dateStr = report.日付;
            if (dateStr && (!customerData.lastActivity || dateStr > customerData.lastActivity)) {
                customerData.lastActivity = dateStr;
            }
        }

        // 2. 直送先かつ、親の得意先が存在する場合は、親のエントリも同時に更新する
        if (matchKey !== customerCode) {
            const parentData = customerDataMap.get(customerCode);
            if (parentData && parentData.values.has(periodKey)) {
                parentData.values.set(periodKey, (parentData.values.get(periodKey) || 0) + 1);

                // 親の最終活動日も更新
                const dateStr = report.日付;
                if (dateStr && (!parentData.lastActivity || dateStr > parentData.lastActivity)) {
                    parentData.lastActivity = dateStr;
                }
            }
        }
    });

    // 結果を配列に変換
    const customers = Array.from(customerDataMap.values()).map(data => ({
        code: data.code,
        name: data.name,
        values: periodKeys.map(k => data.values.get(k) || 0),
        total: periodKeys.reduce((sum, k) => sum + (data.values.get(k) || 0), 0),
        lastActivity: data.lastActivity
    }));

    // 合計の降順でソート（0件の顧客は後ろに）
    customers.sort((a, b) => {
        if (a.total === 0 && b.total > 0) return 1;
        if (b.total === 0 && a.total > 0) return -1;
        return b.total - a.total;
    });

    return {
        periods,
        customers
    };
}

/**
 * 個人の月次目標ペースメーカー（月200点基準）を集計
 */
export function calculatePersonalMonthlyScore(
    reports: Report[],
    targetDate: Date = new Date(),
    targetPoints: number = 200
): PersonalScoreData {
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth() + 1;
    const yearShort = String(year).slice(-2);
    const monthStr = String(month).padStart(2, '0');
    const currentMonthCode = `${yearShort}/${monthStr}`; // 例: "26/09"
    const monthLabel = `${year}年${month}月`;

    // 月の日数と経過日数
    const daysInMonth = new Date(year, month, 0).getDate();
    const currentDay = Math.min(targetDate.getDate(), daysInMonth);
    const remainingDays = Math.max(0, daysInMonth - currentDay);

    let priorityVisits = 0;
    let generalVisits = 0;
    let priorityCalls = 0;
    let generalCalls = 0;

    reports.forEach(report => {
        if (!report.日付) return;
        const pDate = parseDate(report.日付);
        if (!pDate) return;

        // 対象月判定 (年と月が一致)
        if (pDate.getFullYear() !== year || pDate.getMonth() + 1 !== month) {
            return;
        }

        const action = String(report.行動内容 || '');
        const isVisit = action.includes('訪問');
        const isCall = action.includes('電話');
        if (!isVisit && !isCall) return;

        // 重点顧客判定
        const pVal = report.重点顧客;
        const isPriority = pVal !== null && pVal !== undefined && String(pVal).trim() !== '' && String(pVal).trim() !== '-';

        if (isVisit) {
            if (isPriority) priorityVisits++;
            else generalVisits++;
        }
        if (isCall) {
            if (isPriority) priorityCalls++;
            else generalCalls++;
        }
    });

    // 点数計算: 重点訪問*10 + 一般訪問*3 + 重点電話*1 + 一般電話*0.5
    const pvPoints = priorityVisits * 10;
    const gvPoints = generalVisits * 3;
    const pcPoints = priorityCalls * 1;
    const gcPoints = generalCalls * 0.5;
    const totalPoints = pvPoints + gvPoints + pcPoints + gcPoints;

    const achievementRate = targetPoints > 0 ? (totalPoints / targetPoints) * 100 : 0;

    // ペース・着地予測計算
    const progressPace = (targetPoints / daysInMonth) * currentDay;
    const paceDiff = totalPoints - progressPace;
    const projectedPoints = currentDay > 0 ? (totalPoints / currentDay) * daysInMonth : totalPoints;

    const remainingToTarget = Math.max(0, targetPoints - totalPoints);

    return {
        monthLabel,
        currentMonthCode,
        points: Math.round(totalPoints * 10) / 10,
        targetPoints,
        achievementRate: Math.round(achievementRate * 10) / 10,
        counts: {
            priorityVisits,
            generalVisits,
            priorityCalls,
            generalCalls,
            totalVisits: priorityVisits + generalVisits,
            totalCalls: priorityCalls + generalCalls,
        },
        pointsBreakdown: {
            priorityVisits: pvPoints,
            generalVisits: gvPoints,
            priorityCalls: pcPoints,
            generalCalls: gcPoints,
        },
        daysInfo: {
            daysInMonth,
            currentDay,
            remainingDays,
            progressPace: Math.round(progressPace * 10) / 10,
            paceDiff: Math.round(paceDiff * 10) / 10,
            projectedPoints: Math.round(projectedPoints * 10) / 10,
        },
        remainingToTarget: Math.round(remainingToTarget * 10) / 10,
        neededVisits: {
            priorityOnly: Math.ceil(remainingToTarget / 10),
            generalOnly: Math.ceil(remainingToTarget / 3),
        },
    };
}

/**
 * 重点顧客の中から要フォロー（ご無沙汰・当月未接触）顧客を抽出
 */
export function extractNeglectedPriorityCustomers(
    matrixData: PriorityMatrixData,
    reports: Report[],
    targetDate: Date = new Date()
): NeglectedCustomerAlert[] {
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth() + 1;
    const prevMonthDate = new Date(year, month - 2, 1);
    const prevYear = prevMonthDate.getFullYear();
    const prevMonth = prevMonthDate.getMonth() + 1;

    // 顧客コードごとに直近の日報情報を逆引きできるマップを作成
    const recentReportMap = new Map<string, {
        lastReportDate: Date | null;
        lastReportDateStr: string;
        businessContent: string;
        nextPlan: string;
        action: string;
        area: string;
        currentMonthCount: number;
        prevMonthCount: number;
    }>();

    reports.forEach(report => {
        const code = String(report.得意先CD || '').trim();
        if (!code) return;
        const directDeliveryCode = report.直送先CD ? String(report.直送先CD).replace(/\.0$/, '').trim() : '';

        const keys = [code];
        if (directDeliveryCode && directDeliveryCode !== 'nan') {
            keys.push(`${code}-${directDeliveryCode}`);
        }

        const pDate = parseDate(report.日付);
        const action = String(report.行動内容 || '');
        const isVisit = action.includes('訪問');
        const isCall = action.includes('電話');

        keys.forEach(key => {
            if (!recentReportMap.has(key)) {
                recentReportMap.set(key, {
                    lastReportDate: null,
                    lastReportDateStr: '',
                    businessContent: '',
                    nextPlan: '',
                    action: '',
                    area: '',
                    currentMonthCount: 0,
                    prevMonthCount: 0,
                });
            }
            const info = recentReportMap.get(key)!;

            if (pDate && (isVisit || isCall)) {
                // 当月・前月のカウント
                if (pDate.getFullYear() === year && pDate.getMonth() + 1 === month) {
                    info.currentMonthCount++;
                } else if (pDate.getFullYear() === prevYear && pDate.getMonth() + 1 === prevMonth) {
                    info.prevMonthCount++;
                }

                // 最新の活動情報を更新
                if (!info.lastReportDate || pDate.getTime() > info.lastReportDate.getTime()) {
                    info.lastReportDate = pDate;
                    info.lastReportDateStr = String(report.日付 || '');
                    info.businessContent = String(report.商談内容 || '');
                    info.nextPlan = String(report.次回プラン || '');
                    info.action = action;
                    info.area = String(report.エリア || '');
                }
            }
        });
    });

    const alerts: NeglectedCustomerAlert[] = [];

    matrixData.customers.forEach(customer => {
        const info = recentReportMap.get(customer.code) || recentReportMap.get(customer.code.split('-')[0]);

        const lastActivityStr = customer.lastActivity || info?.lastReportDateStr || null;
        let daysSince = 999;

        if (lastActivityStr) {
            const lastDate = parseDate(lastActivityStr);
            if (lastDate) {
                const diffTime = targetDate.getTime() - lastDate.getTime();
                daysSince = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
            }
        }

        const currentMonthCount = info ? info.currentMonthCount : 0;
        const previousMonthCount = info ? info.prevMonthCount : 0;

        let alertLevel: 'danger' | 'warning' | 'normal' = 'normal';
        if (daysSince >= 30) {
            alertLevel = 'danger'; // 30日以上未接触（赤）
        } else if (currentMonthCount === 0) {
            alertLevel = 'warning'; // 今月未接触（黄）
        }

        alerts.push({
            code: customer.code,
            name: customer.name,
            area: info?.area || '',
            lastActivityDate: lastActivityStr,
            daysSinceLastActivity: daysSince,
            alertLevel,
            currentMonthCount,
            previousMonthCount,
            lastBusinessContent: info?.businessContent || '',
            lastNextPlan: info?.nextPlan || '',
            lastAction: info?.action || '',
        });
    });

    // ソート: danger（放置日数の長い順） -> warning（前月訪問回数の多い順） -> normal
    alerts.sort((a, b) => {
        const levelWeight = { danger: 3, warning: 2, normal: 1 };
        if (levelWeight[a.alertLevel] !== levelWeight[b.alertLevel]) {
            return levelWeight[b.alertLevel] - levelWeight[a.alertLevel];
        }
        if (a.alertLevel === 'danger') {
            return b.daysSinceLastActivity - a.daysSinceLastActivity;
        }
        if (a.alertLevel === 'warning') {
            return b.previousMonthCount - a.previousMonthCount;
        }
        return b.daysSinceLastActivity - a.daysSinceLastActivity;
    });

    return alerts;
}

