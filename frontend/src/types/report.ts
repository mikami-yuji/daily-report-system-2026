export type Report = {
    管理番号: number;
    日付: string;
    行動内容: string;
    エリア: string;
    得意先CD: string;
    直送先CD: string;
    訪問先名: string;
    直送先名: string;
    重点顧客: string;
    ランク: string;
    得意先目標: string;
    面談者: string;
    滞在時間: string;
    デザイン提案有無: string;
    デザイン種別: string;
    デザイン名: string;
    デザイン進捗状況: string;
    'デザイン依頼No.': string;
    商談内容: string;
    提案物: string;
    次回プラン: string;
    競合他社情報: string;
    上長コメント: string;
    コメント?: string; // Excelヘッダーが「コメント」の場合のフォールバック
    コメント返信欄: string;
    上長: string;
    山澄常務: string;
    岡本常務: string;
    中野次長: string;
    既読チェック: string;
    'システム確認用デザインNo.': string;
    original_values?: Record<string, unknown>; // For optimistic locking
};

export type ExcelFile = {
    name: string;
    size: number;
    modified: string;
};

export type Customer = {
    得意先CD: string;
    得意先名: string;
    フリガナ: string;
    直送先CD?: string;
    直送先名?: string;
    エリア: string;
    重点顧客: string;
    ランク: string;
    [key: string]: unknown;
};

export type Design = {
    デザイン依頼No: number;
    デザイン名: string;
    デザイン種別: string;
    デザイン進捗状況: string;
    デザイン提案有無: string;
};

export type DesignImage = {
    name: string;
    path: string;
    folder: string;
    mtime?: number;
};

export type DashboardStats = {
    summary: {
        totalReports: number;
        thisMonth: number;
        visits: number;
        calls: number;
    };
    priority: {
        uniqueCustomers: number;
        visits: number;
        calls: number;
    };
    monthly: Array<{
        month: string;
        visits: number;
        calls: number;
        priorityVisits: number;
        priorityCalls: number;
        areaBreakdown: Array<{
            area: string;
            visits: number;
            calls: number;
            priorityVisits: number;
            priorityCalls: number;
        }>;
    }>;
    ranking: Array<{
        name: string;
        visits: number;
        calls: number;
        total: number;
    }>;
    updatedAt: string;
};

export type MonthlySummaryStats = {
    totalReports: number;
    totalVisits: number;
    totalCalls: number;
    priorityVisits: number;
    priorityCalls: number;
    totalDesignProposals: number;
    totalDesignCompleted: number;
    totalDesignRejected: number;
    uniqueCustomers: number;
    activeDays: number;
    areaBreakdown: Array<{
        area: string;
        visits: number;
        calls: number;
        priorityVisits: number;
        priorityCalls: number;
        designProposals: number;
    }>;
    priorityCustomers: Array<{
        code: string;
        name: string;
        visits: number;
        calls: number;
        designProposals: number;
        total: number;
        lastDate: string;
        area: string;
        rank: string;
        isPriority: boolean;
        directDeliveries: Array<{
            code: string;
            name: string;
            visits: number;
            calls: number;
            designProposals: number;
            lastDate: string;
            area: string;
            rank: string;
            isPriority: boolean;
        }>;
    }>;
    designProgress: Array<{
        status: string;
        count: number;
    }>;
    topCustomers: Array<{
        name: string;
        count: number;
        details?: Array<{ name: string; count: number }>;
    }>;
    topCallCustomers: Array<{
        name: string;
        count: number;
        details?: Array<{ name: string; count: number }>;
    }>;
    dailyActivity: Array<{
        date: string;
        visits: number;
        calls: number;
        activities?: Array<{
            customer_name: string | null;
            action: string | null;
            dd_name: string | null;
            is_priority: boolean;
            business_content: string | null;
            design_no: string | null;
            design_name: string | null;
            design_status: string | null;
        }>;
    }>;
};

export type SalesData = {
    rank: number;
    rank_class: string;
    customer_code: string;
    customer_name: string;
    sales_amount: number;
    gross_profit: number;
    sales_yoy: number;
    sales_last_year: number;
    profit_last_year: number;
    sales_2y_ago: number;
    profit_2y_ago: number;
    area?: string;
    sales_rep?: string; // 担当者
};

export type PriorityCustomer = {
    得意先CD: string;
    得意先名: string;
    担当者?: string;
};
