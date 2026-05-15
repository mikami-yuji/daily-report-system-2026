import { useQuery } from '@tanstack/react-query';
import { getDashboardStats, DashboardStats } from '@/lib/api';

export const statsQueryKeys = {
    all: ['stats'] as const,
    dashboard: (filename?: string) => [...statsQueryKeys.all, 'dashboard', filename || 'default'] as const,
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
