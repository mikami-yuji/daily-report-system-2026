import { Report } from './api';

export interface AnalyticsData {
    kpis: {
        totalVisits: number;
        totalProposals: number;
        activeProjects: number;
        completedDesigns: number;
        rejectedDesigns: number;
        acceptanceRate: number;
        phoneContacts: number;
        emailContacts: number;
    };
    trends: {
        date: string;
        visits: number;
        proposals: number;
        completed: number;
        rejected: number;
        phone: number;
        email: number;
    }[];
    byArea: {
        area: string;
        count: number;
        proposals: number;
    }[];
    byRank: {
        rank: string;
        count: number;
    }[];
    byAction: {
        action: string;
        count: number;
    }[];
    byInterviewer: {
        name: string;
        visits: number;
        proposals: number;
        acceptanceRate: number;
    }[];
    designProgress: {
        status: string;
        count: number;
    }[];
    priority: {
        totalCustomers: number;
        totalVisits: number;
        totalCalls: number;
        totalProposals: number;
        completedDesigns: number;
        rejectedDesigns: number;
        acceptanceRate: number;
        coverageRate: number;
        byCustomer: {
            name: string;
            visits: number;
            calls: number;
            proposals: number;
            completed: number;
            rejected: number;
            lastVisit: string | null;
        }[];
    };
}

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

export function aggregateAnalytics(reports: Report[], startDate?: Date, endDate?: Date): AnalyticsData {
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

    // Count total design requests (records with デザイン依頼No.)
    const totalProposals = filteredReports.filter(r => r['デザイン依頼No.'] && String(r['デザイン依頼No.']).trim() !== '').length;

    // Active projects: デザイン進捗状況 that are not 出稿 or 不採用
    const activeProjects = filteredReports.filter(r => {
        if (!r.デザイン進捗状況) return false;
        const status = String(r.デザイン進捗状況);
        return !['出稿', '不採用（コンペ負け）', '不採用（企画倒れ）'].some(s => status.includes(s));
    }).length;

    // Completed designs: 出稿 status means design is finalized and published
    const completedDesigns = filteredReports.filter(r => {
        if (!r.デザイン進捗状況) return false;
        const status = String(r.デザイン進捗状況);
        return status.includes('出稿');
    }).length;

    // Rejected designs
    const rejectedDesigns = filteredReports.filter(r => {
        if (!r.デザイン進捗状況) return false;
        const status = String(r.デザイン進捗状況);
        return status.includes('不採用');
    }).length;

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

    // Trends by date
    const trendMap = new Map<string, { visits: number; proposals: number; completed: number; rejected: number; phone: number; email: number }>();
    filteredReports.forEach(report => {
        // Normalize date string for grouping
        const reportDate = parseDate(report.日付);
        if (!reportDate) return;

        // Format as YYYY/MM/DD for consistent map keys
        const dateKey = `${reportDate.getFullYear()}/${String(reportDate.getMonth() + 1).padStart(2, '0')}/${String(reportDate.getDate()).padStart(2, '0')}`;

        const action = String(report.行動内容 || '');
        const status = String(report.デザイン進捗状況 || '');

        if (!trendMap.has(dateKey)) {
            trendMap.set(dateKey, { visits: 0, proposals: 0, completed: 0, rejected: 0, phone: 0, email: 0 });
        }
        const trend = trendMap.get(dateKey)!;

        // Only increment visits if action includes '訪問'
        if (action.includes('訪問')) {
            trend.visits++;
        }

        if (report.デザイン提案有無 === 'あり') {
            trend.proposals++;
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
        .map(([date, data]) => ({ date, ...data }))
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

    // Design Progress
    const progressMap = new Map<string, number>();
    filteredReports
        .filter(r => r.デザイン進捗状況)
        .forEach(report => {
            const status = String(report.デザイン進捗状況!);
            progressMap.set(status, (progressMap.get(status) || 0) + 1);
        });
    const designProgress = Array.from(progressMap.entries())
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count);

    // Priority Customer Analysis
    const priorityReports = filteredReports.filter(r => r.重点顧客 && r.重点顧客 !== '-' && r.重点顧客 !== '');
    const priorityCustomerMap = new Map<string, { visits: number; calls: number; proposals: number; completed: number; rejected: number; lastVisit: string | null }>();

    priorityReports.forEach(report => {
        const customerName = report.訪問先名 || '不明';
        const action = String(report.行動内容 || '');
        const status = String(report.デザイン進捗状況 || '');
        const date = report.日付 || null;

        if (!priorityCustomerMap.has(customerName)) {
            priorityCustomerMap.set(customerName, { visits: 0, calls: 0, proposals: 0, completed: 0, rejected: 0, lastVisit: null });
        }
        const data = priorityCustomerMap.get(customerName)!;

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
        if (report.デザイン提案有無 === 'あり') {
            data.proposals++;
        }
        if (status.includes('出稿')) {
            data.completed++;
        }
        if (status.includes('不採用')) {
            data.rejected++;
        }
    });

    const priorityByCustomer = Array.from(priorityCustomerMap.entries())
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.visits - a.visits);

    const totalPriorityVisits = priorityByCustomer.reduce((sum, c) => sum + c.visits, 0);
    const totalPriorityCalls = priorityByCustomer.reduce((sum, c) => sum + c.calls, 0);
    const totalPriorityProposals = priorityByCustomer.reduce((sum, c) => sum + c.proposals, 0);
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
