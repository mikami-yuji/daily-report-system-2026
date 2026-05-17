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
