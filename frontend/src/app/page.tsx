'use client';

import { useEffect, useState, useMemo } from 'react';
import { Report, getDesignImages, DesignImage, getImageUrl, updateReportReply, updateReportApproval } from '@/lib/api';
import { useFile } from '@/context/FileContext';
import { useReports } from '@/hooks/useQueryHooks';
import { useDashboardStats } from '@/hooks/useStatsHooks';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/hooks/useQueryHooks';
import { FileText, Calendar, Users, Phone, TrendingUp, Star, BarChart3, Image as ImageIcon } from 'lucide-react';
import EditReportModal from '@/components/reports/EditReportModal';
import { MessageCircle, Bell, X, Send, Check } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { compareDates } from '@/lib/reportUtils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

export default function Home() {
  const { selectedFile } = useFile();
  const queryClient = useQueryClient();

  // 1. 全データ取得 (通知やリスト表示用)
  const { data: rawReports = [], isLoading: isReportsLoading } = useReports(selectedFile || undefined);
  
  // 2. バックエンド集計データ取得 (グラフや統計カード用)
  const { data: backendStats, isLoading: isStatsLoading } = useDashboardStats(selectedFile || undefined);

  const isLoading = isReportsLoading || isStatsLoading;

  // 日付でソート（通知や最近の日報リスト用）
  const reports = useMemo(() => {
    return [...rawReports].sort((a, b) => {
      return compareDates(String(b.日付 || ''), String(a.日付 || ''));
    });
  }, [rawReports]);

  // 統計データ: バックエンドのデータがあればそれを使用
  const dashboardData = useMemo(() => {
    if (!backendStats) return null;

    return {
      totalReports: backendStats.summary?.totalReports ?? 0,
      thisMonth: backendStats.summary?.thisMonth ?? 0,
      visits: backendStats.summary?.visits ?? 0,
      calls: backendStats.summary?.calls ?? 0,
      priority: {
        uniqueCustomers: backendStats.priority?.uniqueCustomers ?? 0,
        visits: backendStats.priority?.visits ?? 0,
        calls: backendStats.priority?.calls ?? 0,
      },
      chartData: backendStats.monthly ? [...backendStats.monthly].reverse() : [],
      topCustomers: backendStats.ranking ?? [],
      monthlyStats: backendStats.monthly ?? []
    };
  }, [backendStats]);

  const [editingReport, setEditingReport] = useState<Report | null>(null);
  const [images, setImages] = useState<DesignImage[]>([]);
  const [imageFolder, setImageFolder] = useState<string>('');
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [showAllNotifications, setShowAllNotifications] = useState(false);
  const [processingNotifications, setProcessingNotifications] = useState<Set<number>>(new Set());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (selectedFile) {
      getDesignImages(selectedFile).then(data => {
        setImages(data.images || []);
        setImageFolder(data.folder || '');
      });
    }
  }, [selectedFile]);

  const handleEditSuccess = () => {
    setEditingReport(null);
    queryClient.invalidateQueries({ queryKey: queryKeys.reports(selectedFile || undefined) });
    // 統計データも更新
    queryClient.invalidateQueries({ queryKey: ['stats'] });
  };

  const handleSubmitReply = async (report: Report): Promise<void> => {
    if (!replyText.trim()) return;
    const replyContent = replyText.trim();
    setReplyingTo(null);
    setReplyText('');
    setProcessingNotifications(prev => new Set(prev).add(report.管理番号));
    try {
      await updateReportReply(report.管理番号, replyContent, selectedFile);
      await queryClient.invalidateQueries({ queryKey: queryKeys.reports(selectedFile || undefined) });
      await queryClient.invalidateQueries({ queryKey: ['stats'] });
      toast.success('返信を送信しました');
    } catch (error) {
      toast.error('返信の送信に失敗しました');
    } finally {
      setProcessingNotifications(prev => {
        const next = new Set(prev);
        next.delete(report.管理番号);
        return next;
      });
    }
  };

  const handleDismissNotification = async (report: Report): Promise<void> => {
    setProcessingNotifications(prev => new Set(prev).add(report.管理番号));
    try {
      await updateReportApproval(report.管理番号, { 既読チェック: 'ü' }, selectedFile);
      await queryClient.invalidateQueries({ queryKey: queryKeys.reports(selectedFile || undefined) });
      await queryClient.invalidateQueries({ queryKey: ['stats'] });
      toast.success('既読にしました');
    } catch (error) {
      toast.error('既読処理に失敗しました');
    } finally {
      setProcessingNotifications(prev => {
        const next = new Set(prev);
        next.delete(report.管理番号);
        return next;
      });
    }
  };

  const unreadComments = reports.filter(r => {
    const supervisorCommentRaw = r.上長コメント || r.コメント;
    const supervisorComment = supervisorCommentRaw ? String(supervisorCommentRaw).trim() : '';
    const replyComment = r.コメント返信欄 ? String(r.コメント返信欄).trim() : '';
    const kidoku = r.既読チェック ? String(r.既読チェック).trim() : '';
    return supervisorComment !== '' && replyComment === '' && kidoku === '';
  });

  if (!mounted || !dashboardData) {
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

      {unreadComments.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 animate-pulse-slow">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="text-red-500 fill-red-500" size={24} />
            <h2 className="text-lg font-bold text-red-700">新着コメントがあります ({unreadComments.length}件)</h2>
          </div>
          <div className="space-y-2">
            {(showAllNotifications ? unreadComments : unreadComments.slice(0, 3)).map((report) => (
              <div key={report.管理番号} className="bg-white p-3 rounded border border-red-100 shadow-sm">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-red-600">{report.日付}</span>
                      <span className="text-sf-text font-medium">{report.訪問先名 || '訪問先なし'}</span>
                      <span className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-500">No.{report.管理番号}</span>
                    </div>
                    <div className="text-sm text-gray-600 mt-1 line-clamp-2">
                      <span className="font-bold mr-1">上長:</span>
                      {report.上長コメント || report.コメント}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                    {processingNotifications.has(report.管理番号) ? (
                      <span className="text-xs text-sf-light-blue font-bold animate-pulse">保存中...</span>
                    ) : replyingTo !== report.管理番号 && (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); setReplyingTo(report.管理番号); setReplyText(''); }}
                          disabled={processingNotifications.size > 0}
                          className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded-full font-bold hover:bg-red-200 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Send size={12} />返信
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDismissNotification(report); }}
                          disabled={processingNotifications.size > 0}
                          className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-bold hover:bg-green-200 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Check size={12} />既読
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {replyingTo === report.管理番号 && (
                  <div className="mt-3 pt-3 border-t border-gray-200" onClick={(e) => e.stopPropagation()}>
                    {/* 商談内容の表示 */}
                    {report.商談内容 && (
                      <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                        <div className="font-bold text-blue-700 mb-1">📝 商談内容:</div>
                        <div className="text-gray-700 whitespace-pre-wrap">{report.商談内容}</div>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        disabled={processingNotifications.has(report.管理番号)}
                        placeholder="返信を入力..."
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded disabled:opacity-50"
                      />
                      <button
                        onClick={() => handleSubmitReply(report)}
                        disabled={!replyText.trim() || processingNotifications.has(report.管理番号)}
                        className="px-4 py-2 bg-red-500 text-white text-sm rounded font-bold disabled:opacity-50 flex items-center gap-2"
                      >
                        {processingNotifications.has(report.管理番号) ? (
                          <>
                            <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            送信中...
                          </>
                        ) : '送信'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setReplyingTo(null); setReplyText(''); }}
                        disabled={processingNotifications.has(report.管理番号)}
                        className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm rounded font-bold disabled:opacity-50"
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card title="総日報数" value={dashboardData.totalReports} icon={<FileText className="text-sf-light-blue" />} />
        <Card title="今月の日報" value={dashboardData.thisMonth} icon={<Calendar className="text-green-600" />} />
        <Card title="累計訪問件数" value={dashboardData.visits} icon={<Users className="text-purple-600" />} />
        <Card title="累計電話件数" value={dashboardData.calls} icon={<Phone className="text-orange-500" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded border border-sf-border shadow-sm p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="text-sf-light-blue" size={20} />
            <h2 className="font-semibold text-lg text-sf-text">活動推移 (月別)</h2>
          </div>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dashboardData.chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="visits" name="訪問" fill="#8884d8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="calls" name="電話" fill="#82ca9d" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded border border-sf-border shadow-sm p-4">
          <div className="flex items-center gap-2 mb-4">
            <Star className="text-yellow-500" size={20} />
            <h2 className="font-semibold text-lg text-sf-text">重点顧客状況</h2>
          </div>
          <div className="space-y-4">
            <StatRow label="対象顧客数" value={dashboardData.priority.uniqueCustomers} />
            <StatRow label="訪問件数" value={dashboardData.priority.visits} color="text-purple-600" />
            <StatRow label="電話件数" value={dashboardData.priority.calls} color="text-orange-600" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded border border-sf-border shadow-sm p-4">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="text-sf-light-blue" size={20} />
          <h2 className="font-semibold text-lg text-sf-text">得意先別 活動ランキング (Top 10)</h2>
        </div>
        <div style={{ width: '100%', height: 400 }}>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart layout="vertical" data={dashboardData.topCustomers} margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="visits" name="訪問" fill="#8884d8" stackId="a" />
              <Bar dataKey="calls" name="電話" fill="#82ca9d" stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 最近の日報 */}
      <div className="bg-white rounded border border-sf-border shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-sf-border bg-gray-50 flex justify-between items-center">
          <h2 className="font-semibold text-sm text-sf-text">最近の日報</h2>
          <Link href="/reports" className="text-sm text-sf-light-blue hover:underline">すべて表示</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-sf-text-weak bg-gray-50 border-b border-sf-border">
              <tr>
                <th className="px-4 py-3 font-medium">日付</th>
                <th className="px-4 py-3 font-medium">訪問先</th>
                <th className="px-4 py-3 font-medium">行動内容</th>
                <th className="px-4 py-3 font-medium">重点</th>
                <th className="px-4 py-3 font-medium">面談者</th>
              </tr>
            </thead>
            <tbody>
              {reports.slice(0, 10).map((report, i) => (
                <tr key={i} className="border-b border-sf-border hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sf-text">{report.日付}</td>
                  <td className="px-4 py-3 font-medium text-sf-light-blue">
                    <Link href={`/customers/${report.得意先CD}`} className="hover:underline">{report.訪問先名}</Link>
                  </td>
                  <td className="px-4 py-3 text-sf-text">{report.行動内容}</td>
                  <td className="px-4 py-3 text-center">
                    {report.重点顧客 && report.重点顧客 !== '-' && <Star size={16} className="text-yellow-500 inline" />}
                  </td>
                  <td className="px-4 py-3 text-sf-text">{report.面談者}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 画像ギャラリー */}
      <div className="bg-white rounded border border-sf-border shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-sf-border bg-gray-50 flex items-center gap-2">
          <ImageIcon size={20} className="text-pink-500" />
          <h2 className="font-semibold text-sm text-sf-text">デザインデータ ({imageFolder || 'フォルダ検索中...'})</h2>
        </div>
        <div className="p-4">
          {images.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {images.map((img, i) => (
                <div key={i} className="group relative aspect-square bg-gray-100 rounded overflow-hidden border border-gray-200">
                  <a href={getImageUrl(img.path)} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getImageUrl(img.path)}
                      alt={img.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                      {img.name}
                    </div>
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              {imageFolder ? '画像が見つかりませんでした' : '関連するデザインデータフォルダが見つかりません'}
            </div>
          )}
        </div>
      </div>

      {editingReport && (
        <EditReportModal
          report={editingReport}
          onClose={() => setEditingReport(null)}
          onSuccess={handleEditSuccess}
          selectedFile={selectedFile || ''}
          reports={rawReports}
        />
      )}
    </div>
  );
}

function Card({ title, value, icon }: { title: string, value: string | number, icon: React.ReactNode }) {
  return (
    <div className="bg-white p-4 rounded border border-sf-border shadow-sm flex items-start justify-between">
      <div>
        <p className="text-sm text-sf-text-weak mb-1">{title}</p>
        <p className="text-2xl font-semibold text-sf-text">{value}</p>
      </div>
      <div className="p-2 bg-gray-50 rounded-full border border-gray-200">{icon}</div>
    </div>
  );
}

function StatRow({ label, value, color = "text-sf-text" }: { label: string, value: number, color?: string }) {
  return (
    <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
      <span className="text-sm text-sf-text-weak">{label}</span>
      <span className={`text-xl font-bold ${color}`}>{value}</span>
    </div>
  );
}
