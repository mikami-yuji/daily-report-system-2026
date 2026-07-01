'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useFile } from '@/context/FileContext';
import { useReports } from '@/hooks/useQueryHooks';
import { useDashboardStats } from '@/hooks/useStatsHooks';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/hooks/useQueryHooks';
import EditReportModal from '@/components/reports/EditReportModal';
import { compareDates } from '@/lib/reportUtils';
import { Report } from '@/lib/api';

// 新規に作成したダッシュボード用分割コンポーネントのインポート
import UnreadComments from '@/components/dashboard/UnreadComments';
import KPICards from '@/components/dashboard/KPICards';
import DashboardCharts from '@/components/dashboard/DashboardCharts';
import RecentReportsTable from '@/components/dashboard/RecentReportsTable';
import DesignImageGallery from '@/components/dashboard/DesignImageGallery';

export default function Home(): React.JSX.Element {
  const { selectedFile } = useFile();
  const queryClient = useQueryClient();

  // 1. 全データ取得 (通知やリスト表示用)
  const { data: rawReports = [], isLoading: isReportsLoading } = useReports(selectedFile || undefined);
  
  // 2. バックエンド集計データ取得 (グラフや統計カード用)
  const { data: backendStats, isLoading: isStatsLoading } = useDashboardStats(selectedFile || undefined);

  const isLoading = isReportsLoading || isStatsLoading;

  // 日付でソート（通知や最近の日報リスト用）
  const reports = useMemo((): Report[] => {
    return [...rawReports].sort((a: Report, b: Report): number => {
      return compareDates(String(b.日付 || ''), String(a.日付 || ''));
    });
  }, [rawReports]);

  const [editingReport, setEditingReport] = useState<Report | null>(null);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect((): void => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const handleEditSuccess = (): void => {
    setEditingReport(null);
    queryClient.invalidateQueries({ queryKey: queryKeys.reports(selectedFile || undefined) });
    // 統計データも更新
    queryClient.invalidateQueries({ queryKey: ['stats'] });
  };

  if (!mounted || isLoading || !backendStats) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sf-light-blue"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-sf-text">ホーム</h1>
      </div>

      {/* 新着コメント通知 */}
      <UnreadComments reports={reports} selectedFile={selectedFile} />

      {/* KPI 統計カード */}
      <KPICards stats={backendStats.summary} />

      {/* 統計チャートおよび重点顧客ステータス */}
      <DashboardCharts backendStats={backendStats} />

      {/* 最近の日報テーブル */}
      <RecentReportsTable reports={reports} />

      {/* デザインデータ画像ギャラリー */}
      <DesignImageGallery selectedFile={selectedFile} />

      {/* 日報編集用モーダル */}
      {editingReport && (
        <EditReportModal
          report={editingReport}
          onClose={(): void => setEditingReport(null)}
          onSuccess={handleEditSuccess}
          selectedFile={selectedFile || ''}
          reports={rawReports}
        />
      )}
    </div>
  );
}
