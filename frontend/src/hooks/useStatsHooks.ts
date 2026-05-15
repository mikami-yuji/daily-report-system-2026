import { useQuery } from '@tanstack/react-query';
import { getDashboardStats, DashboardStats, getMonthlySummaryStats, MonthlySummaryStats } from '@/lib/api';

export const statsQueryKeys = {
    all: ['stats'] as const,
    dashboard: (filename?: string) => [...statsQueryKeys.all, 'dashboard', filename || 'default'] as const,
    monthlySummary: (month: string, filename?: string) => [...statsQueryKeys.all, 'monthly-summary', month, filename || 'default'] as const,
};

/**
 * バックエンドで集計済みのダッシュボード統計データを取得するHook
 */
export const useDashboardStats = (filename?: string) => {
    return useQuery<DashboardStats>({
        queryKey: statsQueryKeys.dashboard(filename),
        queryFn: () => getDashboardStats(filename),
        // 統計データは頻繁に変わるものではないため、キャッシュ時間を少し長めに設定
        staleTime: 1000 * 60 * 5, // 5分
    });
};

/**
 * バックエンドで集計済みの月別サマリーデータを取得するHook
 */
export const useMonthlySummaryStats = (month: string, filename?: string) => {
    return useQuery<MonthlySummaryStats>({
        queryKey: statsQueryKeys.monthlySummary(month, filename),
        queryFn: () => getMonthlySummaryStats(filename, month),
        staleTime: 1000 * 60 * 5, // 5分
    });
};
