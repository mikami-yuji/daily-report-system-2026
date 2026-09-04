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

// 個人用月次目標ペースメーカーデータ
export type PersonalScoreData = {
    monthLabel: string;             // 例: "2026年9月"
    currentMonthCode: string;       // 例: "26/09"
    points: number;                 // 現在の総得点 (重点訪問*10 + 一般訪問*3 + 重点電話*1 + 一般電話*0.5)
    targetPoints: number;           // 目標点数 (通常200)
    achievementRate: number;        // 達成率 (%)
    counts: {
        priorityVisits: number;     // 重点訪問件数
        generalVisits: number;      // 一般訪問件数
        priorityCalls: number;      // 重点電話件数
        generalCalls: number;       // 一般電話件数
        totalVisits: number;        // 総訪問件数
        totalCalls: number;         // 総電話件数
    };
    pointsBreakdown: {
        priorityVisits: number;     // 重点訪問得点
        generalVisits: number;      // 一般訪問得点
        priorityCalls: number;      // 重点電話得点
        generalCalls: number;       // 一般電話得点
    };
    daysInfo: {
        daysInMonth: number;        // 月の日数
        currentDay: number;         // 経過日数
        remainingDays: number;      // 残り日数
        progressPace: number;       // 期待ペース点数
        paceDiff: number;           // 計画比ペース差分 (+/-)
        projectedPoints: number;    // 着地予測点数
    };
    remainingToTarget: number;      // 達成まであと何点か (max(0, target - points))
    neededVisits: {
        priorityOnly: number;       // 重点訪問だけで達成する場合の必要件数 (ceil(rem / 10))
        generalOnly: number;        // 一般訪問だけで達成する場合の必要件数 (ceil(rem / 3))
    };
};

// 要フォロー重点顧客アラートデータ
export type NeglectedCustomerAlert = {
    code: string;                   // 得意先コード (または コード-直送先コード)
    name: string;                   // 得意先名
    area: string;                   // エリア
    lastActivityDate: string | null;// 最終活動日 (YYYY/MM/DD or YY/MM/DD)
    daysSinceLastActivity: number;  // 最終活動日からの経過日数
    alertLevel: 'danger' | 'warning' | 'normal'; // danger: 30日超, warning: 当月未接触, normal: 接触あり
    currentMonthCount: number;      // 当月の接触回数 (訪問+電話)
    previousMonthCount: number;     // 前月の接触回数
    lastBusinessContent: string;    // 直近の商談内容
    lastNextPlan: string;           // 直近の次回プラン
    lastAction: string;             // 直近の行動内容 (訪問, 電話等)
};

