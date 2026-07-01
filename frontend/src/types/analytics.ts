import { Report } from './report';

// 全メンバー活動分析（日報点数表）用の型定義

export type MonthlyActivity = {
    priority_calls: number;  // 重点電話
    general_calls: number;   // 電話総数（一般電話）
    priority_visits: number; // 重点訪問
    general_visits: number;  // 訪問件数（一般訪問）
};

export type PointsRecord = {
    staff: string;           // 営業名
    priority_count: number;  // 重点件数
    monthly_data: Record<string, MonthlyActivity>;
    totals: {
        priority_calls: number;
        general_calls: number;
        total_calls: number;
        priority_visits: number;
        general_visits: number;
        total_visits: number;
    };
    points: number;           // 点数 (総得点)
    achievement_rate: number; // 達成率
    rating: number;           // 評価点 (評価レート)
    file: string;             // 対応するファイル名
};

export type PointsTableResponse = {
    months: string[];
    records: PointsRecord[];
    target_months_count: number;
};

export type TeamSummaryRecord = {
    staff: string;     // 担当者
    area: string;      // エエリア
    category: string;  // 区分
    visits: number;    // 訪問件数
    calls: number;     // 電話件数
    file: string;      // ファイル名
};

export type AnalyticsData = {
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
};

// 重点顧客マトリクスデータの型
export type PriorityMatrixData = {
    periods: string[];  // 期間ラベル（「1月」「12/2週」など）
    customers: {
        code: string;
        name: string;
        values: number[];  // 各期間の値
        total: number;
        lastActivity: string | null;
    }[];
};
