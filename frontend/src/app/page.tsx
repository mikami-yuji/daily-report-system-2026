'use client';

import { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Report, getDesignImages, DesignImage, getImageUrl, updateReportReply, updateReportApproval } from '@/lib/api';
import { useFile } from '@/context/FileContext';
import { useReports } from '@/hooks/useQueryHooks';
import { useDashboardStats } from '@/hooks/useStatsHooks';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/hooks/useQueryHooks';
import { FileText, Calendar, Users, Phone, TrendingUp, Star, BarChart3, Image as ImageIcon, ChevronLeft, ChevronRight, Download, ChevronDown, ChevronUp } from 'lucide-react';
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
  const [allImages, setAllImages] = useState<DesignImage[]>([]);
  const [imageFolder, setImageFolder] = useState<string>('');
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [showAllNotifications, setShowAllNotifications] = useState(false);
  const [processingNotifications, setProcessingNotifications] = useState<Set<number>>(new Set());
  const [mounted, setMounted] = useState(false);

  // スプリットプレビュー用のステート
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [activePreviewImage, setActivePreviewImage] = useState<DesignImage | null>(null);

  // 同一デザインID（5桁以上の数字）の関連画像を抽出
  const relatedImages = useMemo((): DesignImage[] => {
    if (selectedImageIndex === null || images.length === 0 || !images[selectedImageIndex]) {
      return [];
    }
    const currentImg = images[selectedImageIndex];
    const match = currentImg.name.match(/\d{5,}/);
    if (!match) {
      return [currentImg];
    }
    const designId = match[0];
    const list = allImages.filter(img => {
      const m = img.name.match(/\d{5,}/);
      return m && m[0] === designId;
    });
    return list.sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
  }, [selectedImageIndex, images, allImages]);

  // 代表画像のインデックスが変更されたときにアクティブプレビューを初期化
  useEffect(() => {
    if (selectedImageIndex !== null && images[selectedImageIndex]) {
      setActivePreviewImage(images[selectedImageIndex]);
    } else {
      setActivePreviewImage(null);
    }
  }, [selectedImageIndex, images]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // モーダル表示時に背後のスクロールをロックする
  useEffect(() => {
    if (selectedImageIndex !== null) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedImageIndex]);

  useEffect(() => {
    if (selectedFile) {
      getDesignImages(selectedFile).then(data => {
        const rawImages = data.images || [];
        setAllImages(rawImages);

        // デザイン依頼番号（5桁以上の数字）ごとにグループ化し、最新の1枚のみを抽出
        const groupedMap = new Map<string, typeof rawImages[0]>();
        const nonGrouped: typeof rawImages = [];

        rawImages.forEach((img) => {
          const match = img.name.match(/\d{5,}/);
          if (match) {
            const designId = match[0];
            const existing = groupedMap.get(designId);
            if (!existing || (img.mtime || 0) > (existing.mtime || 0)) {
              groupedMap.set(designId, img);
            }
          } else {
            nonGrouped.push(img);
          }
        });

        // グループ化した最新画像とIDなし画像を統合し、mtime降順でソート
        const filteredImages = [...Array.from(groupedMap.values()), ...nonGrouped];
        filteredImages.sort((a, b) => (b.mtime || 0) - (a.mtime || 0));

        setImages(filteredImages);
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
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <Bell className="text-red-500 fill-red-500" size={24} />
              <h2 className="text-lg font-bold text-red-700">新着コメントがあります ({unreadComments.length}件)</h2>
            </div>
            {unreadComments.length > 3 && (
              <button
                type="button"
                onClick={(): void => setShowAllNotifications(!showAllNotifications)}
                className="flex items-center gap-1 text-xs font-semibold text-red-700 hover:text-red-900 bg-red-100/50 hover:bg-red-100 px-3 py-1 rounded transition-colors"
              >
                {showAllNotifications ? (
                  <>
                    <span>折りたたむ</span>
                    <ChevronUp size={14} />
                  </>
                ) : (
                  <>
                    <span>すべて表示</span>
                    <ChevronDown size={14} />
                  </>
                )}
              </button>
            )}
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
          <h2 className="font-semibold text-sm text-sf-text">デザインデータ一覧 ({imageFolder || 'フォルダ検索中...'})</h2>
        </div>
        <div className="p-6 bg-gray-50/30">
          {images.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImageIndex(i)}
                  className="group flex flex-col bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 text-left focus:outline-none cursor-pointer"
                >
                  <div className="w-full aspect-[3/4] bg-gray-50 flex items-center justify-center p-3 relative overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getImageUrl(img.path)}
                      alt={img.name}
                      className="max-w-full max-h-full object-contain group-hover:scale-[1.03] transition-transform duration-300"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-3 border-t border-gray-100 bg-white w-full">
                    <p className="text-xs font-semibold text-sf-text truncate" title={img.name}>
                      {img.name}
                    </p>
                    <p className="text-[10px] text-sf-text-weak mt-1">
                      {img.mtime ? new Date(img.mtime * 1000).toLocaleDateString() : ''}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300 text-sf-text-weak">
              {imageFolder ? '画像が見つかりませんでした' : '関連するデザインデータフォルダが見つかりません'}
            </div>
          )}
        </div>
      </div>

      {/* スプリットビュー・画像プレビューモーダル */}
      {selectedImageIndex !== null && activePreviewImage && createPortal(
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full h-[90vh] flex flex-col animate-fadeIn overflow-hidden">
            {/* モーダルヘッダー */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 flex-shrink-0">
              <div className="flex items-center gap-2">
                <ImageIcon size={20} className="text-pink-500" />
                <h3 className="font-bold text-sm text-sf-text truncate max-w-lg" title={activePreviewImage.name}>
                  {activePreviewImage.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedImageIndex(null)}
                className="text-gray-400 hover:text-gray-600 bg-gray-200/50 hover:bg-gray-200 rounded-full p-2 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* モーダルコンテンツ（左右スプリットビュー） */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-gray-100">
              {/* 左側：メインプレビュー（幅 2/3） */}
              <div className="flex-1 md:w-2/3 p-6 flex flex-col items-center justify-center relative bg-black/5 min-h-[350px]">
                {/* 左右切り替えボタン（代表画像単位） */}
                {selectedImageIndex > 0 && (
                  <button
                    onClick={() => setSelectedImageIndex(selectedImageIndex - 1)}
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-gray-800 shadow-md rounded-full p-2.5 transition-all z-10 cursor-pointer"
                    title="前の商品"
                  >
                    <ChevronLeft size={24} />
                  </button>
                )}
                
                {selectedImageIndex < images.length - 1 && (
                  <button
                    onClick={() => setSelectedImageIndex(selectedImageIndex + 1)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-gray-800 shadow-md rounded-full p-2.5 transition-all z-10 cursor-pointer"
                    title="次の商品"
                  >
                    <ChevronRight size={24} />
                  </button>
                )}

                {/* メイン画像 */}
                <div className="w-full h-full max-h-[60vh] flex items-center justify-center p-2">
                  {activePreviewImage.name.toLowerCase().endsWith('.pdf') ? (
                    <div className="flex flex-col items-center justify-center text-red-500 bg-white p-8 rounded-xl shadow border border-gray-200">
                      <FileText size={80} />
                      <span className="text-sm font-bold mt-4 text-gray-600">PDFファイルを別タブで開く</span>
                      <a
                        href={getImageUrl(activePreviewImage.path)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 px-6 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-bold rounded-lg shadow-sm transition-colors"
                      >
                        PDFを表示
                      </a>
                    </div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={getImageUrl(activePreviewImage.path)}
                      alt={activePreviewImage.name}
                      className="max-w-full max-h-[55vh] object-contain drop-shadow-lg animate-fadeIn"
                    />
                  )}
                </div>

                {/* アクションボタン */}
                <div className="absolute bottom-4 flex gap-3">
                  <a
                    href={getImageUrl(activePreviewImage.path)}
                    download={activePreviewImage.name}
                    className="flex items-center gap-1.5 px-4 py-2 bg-white/90 hover:bg-white hover:text-sf-light-blue shadow text-xs font-semibold rounded-lg text-gray-700 transition-colors border border-gray-200/50"
                  >
                    <Download size={14} /> ダウンロード
                  </a>
                </div>
              </div>

              {/* 右側：同一デザイン依頼番号のバリエーションリスト（幅 1/3） */}
              <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-gray-200 bg-white flex flex-col overflow-hidden max-h-[30vh] md:max-h-none flex-shrink-0">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center flex-shrink-0">
                  <span className="text-xs font-bold text-sf-text">バリエーション・履歴 ({relatedImages.length})</span>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {relatedImages.map((relImg, idx) => {
                    const isActive = relImg.path === activePreviewImage.path;
                    return (
                      <button
                        key={idx}
                        onClick={() => setActivePreviewImage(relImg)}
                        className={`w-full flex items-center gap-3 p-2 rounded-xl text-left border transition-all cursor-pointer ${
                          isActive 
                            ? 'border-sf-light-blue bg-blue-50/50 ring-1 ring-sf-light-blue' 
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="w-12 h-16 bg-gray-50 rounded border border-gray-200 overflow-hidden flex-shrink-0 flex items-center justify-center p-1">
                          {relImg.name.toLowerCase().endsWith('.pdf') ? (
                            <FileText size={20} className="text-red-500" />
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={getImageUrl(relImg.path)}
                              alt={relImg.name}
                              className="max-w-full max-h-full object-contain"
                              loading="lazy"
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-semibold text-sf-text truncate" title={relImg.name}>
                            {relImg.name}
                          </p>
                          <p className="text-[10px] text-sf-text-weak mt-1">
                            {relImg.mtime ? new Date(relImg.mtime * 1000).toLocaleString() : ''}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

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
