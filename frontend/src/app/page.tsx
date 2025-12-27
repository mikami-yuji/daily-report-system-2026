'use client';

import { useEffect, useState } from 'react';
import { getReports, Report, getDesignImages, DesignImage, getImageUrl, updateReportReply } from '@/lib/api';
import { useFile } from '@/context/FileContext';
import { FileText, Calendar, Users, Phone, TrendingUp, Star, BarChart3, Image as ImageIcon } from 'lucide-react';
import EditReportModal from '../components/reports/EditReportModal';
import { MessageCircle, Bell, X, Send, Trash2 } from 'lucide-react';
import Link from 'next/link';
import LazyImage from '@/components/ui/LazyImage';
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

interface MonthlyStats {
  month: string;
  visits: number;
  calls: number;
  priorityVisits: number;
  priorityCalls: number;
}

export default function Home() {
  const { selectedFile } = useFile();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingReport, setEditingReport] = useState<Report | null>(null);
  const [images, setImages] = useState<DesignImage[]>([]);
  const [imageFolder, setImageFolder] = useState<string>('');
  // 通知返信用の状態
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [showAllNotifications, setShowAllNotifications] = useState(false);  // 通知一覧の展開状態

  useEffect(() => {
    if (selectedFile) {
      // Fetch Reports
      getReports(selectedFile).then(data => {
        const sortedData = data.sort((a, b) => {
          const dateA = String(a.日付 || '');
          const dateB = String(b.日付 || '');
          return dateB.localeCompare(dateA);
        });
        setReports(sortedData);
        setLoading(false);
      }).catch(err => {
        console.error(err);
        setLoading(false);
      });

      // Fetch Images
      getDesignImages(selectedFile).then(data => {
        setImages(data.images || []);
        setImageFolder(data.folder || '');
      });
    }
  }, [selectedFile]);

  // Handle Edit Success (Reload)
  const handleEditSuccess = () => {
    setEditingReport(null);
    setLoading(true);
    getReports(selectedFile).then(data => {
      const sortedData = data.sort((a, b) => {
        const dateA = String(a.日付 || '');
        const dateB = String(b.日付 || '');
        return dateB.localeCompare(dateA);
      });
      setReports(sortedData);
      setLoading(false);
    });
  };

  // 通知への返信を送信（楽観的UI更新）
  const handleSubmitReply = async (report: Report) => {
    if (!replyText.trim()) return;

    // 即座にUIを更新（楽観的更新）
    setReports(prev => prev.map(r =>
      r.管理番号 === report.管理番号
        ? { ...r, コメント返信欄: replyText.trim() }
        : r
    ));
    setReplyingTo(null);
    setReplyText('');

    // バックグラウンドでAPI呼び出し（エラー時のみ再読み込み）
    try {
      await updateReportReply(report.管理番号, replyText.trim(), selectedFile);
    } catch (error) {
      console.error('Failed to submit reply:', error);
      handleEditSuccess(); // エラー時は再読み込み
    }
  };

  // 通知を既読にする（楽観的UI更新）
  const handleDismissNotification = async (report: Report) => {
    // 即座にUIを更新（楽観的更新）
    setReports(prev => prev.map(r =>
      r.管理番号 === report.管理番号
        ? { ...r, コメント返信欄: '確認済み' }
        : r
    ));

    // バックグラウンドでAPI呼び出し（エラー時のみ再読み込み）
    try {
      await updateReportReply(report.管理番号, '確認済み', selectedFile);
    } catch (error) {
      console.error('Failed to dismiss notification:', error);
      handleEditSuccess(); // エラー時は再読み込み
    }
  };

  // --- Logic for Unread Comments ---
  // Criteria: Has Supervisor Comment AND No Reply
  const unreadComments = reports.filter(r => {
    const supervisorComment = r.上長コメント ? String(r.上長コメント).trim() : '';
    const replyComment = r.コメント返信欄 ? String(r.コメント返信欄).trim() : '';
    return supervisorComment !== '' && replyComment === '';
  });

  // 統計計算
  const totalReports = reports.length;

  // 現在の年月をデータ形式(YY/MM)に合わせて生成
  const now = new Date();
  const currentYearShort = String(now.getFullYear()).slice(-2);
  const currentMonthStr = String(now.getMonth() + 1).padStart(2, '0');
  const currentMonthPrefix = `${currentYearShort}/${currentMonthStr}`;

  const thisMonth = reports.filter(r => r.日付 && String(r.日付).startsWith(currentMonthPrefix)).length;

  // 訪問・電話の集計
  const visits = reports.filter(r => r.行動内容 && r.行動内容.includes('訪問')).length;
  const calls = reports.filter(r => r.行動内容 && r.行動内容.includes('電話')).length;

  // 重点顧客の集計
  const priorityCustomerActivities = reports.filter(r => r.重点顧客 && r.重点顧客 !== '-' && r.重点顧客 !== '');
  const priorityVisits = priorityCustomerActivities.filter(r => r.行動内容 && r.行動内容.includes('訪問')).length;
  const priorityCalls = priorityCustomerActivities.filter(r => r.行動内容 && r.行動内容.includes('電話')).length;

  // ユニークな重点顧客数を計算
  const uniquePriorityCustomers = new Set(
    priorityCustomerActivities
      .filter(r => r.得意先CD)
      .map(r => r.得意先CD)
  ).size;

  // 月別統計
  const monthlyStats: MonthlyStats[] = [];
  const monthsMap = new Map<string, MonthlyStats>();

  reports.forEach(report => {
    if (!report.日付) return;

    // 日付フォーマット (YY/MM/DD) から年月 (YY/MM) を抽出
    let month = '';
    const dateStr = String(report.日付);
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length >= 2) {
        month = `${parts[0]}/${parts[1]}`;
      }
    } else {
      // フォールバック: そのまま先頭7文字 (YYYY-MMなど)
      month = dateStr.slice(0, 7);
    }

    if (!monthsMap.has(month)) {
      monthsMap.set(month, {
        month,
        visits: 0,
        calls: 0,
        priorityVisits: 0,
        priorityCalls: 0
      });
    }

    const stats = monthsMap.get(month)!;
    const isPriority = report.重点顧客 && report.重点顧客 !== '-' && report.重点顧客 !== '';

    if (report.行動内容 && report.行動内容.includes('訪問')) {
      stats.visits++;
      if (isPriority) stats.priorityVisits++;
    }
    if (report.行動内容 && report.行動内容.includes('電話')) {
      stats.calls++;
      if (isPriority) stats.priorityCalls++;
    }
  });

  // 月別データをソート (新しい順)
  const sortedMonths = Array.from(monthsMap.values()).sort((a, b) => b.month.localeCompare(a.month));

  // グラフ用データ (古い順)
  const chartData = [...sortedMonths].reverse();

  // --- 得意先別活動ランキング集計 ---
  const customerStatsMap = new Map<string, { name: string, visits: number, calls: number, total: number }>();

  reports.forEach(report => {
    const name = report.訪問先名 || '名称不明';
    // 同じ名前で集計（コードが無くても名前で寄せる方針）
    if (!customerStatsMap.has(name)) {
      customerStatsMap.set(name, { name, visits: 0, calls: 0, total: 0 });
    }
    const stat = customerStatsMap.get(name)!;

    let isActivity = false;
    if (report.行動内容 && report.行動内容.includes('訪問')) {
      stat.visits++;
      isActivity = true;
    }
    if (report.行動内容 && report.行動内容.includes('電話')) {
      stat.calls++;
      isActivity = true;
    }

    if (isActivity) {
      stat.total = stat.visits + stat.calls;
    }
  });

  const topCustomers = Array.from(customerStatsMap.values())
    .filter(c => c.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-sf-text">ホーム</h1>
      </div>

      {/* Unread Comments Alert Section */}
      {unreadComments.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 animate-pulse-slow">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="text-red-500 fill-red-500" size={24} />
            <h2 className="text-lg font-bold text-red-700">新着コメントがあります ({unreadComments.length}件)</h2>
          </div>
          <div className="space-y-2">
            {(showAllNotifications ? unreadComments : unreadComments.slice(0, 5)).map((report) => (
              <div
                key={report.管理番号}
                className="bg-white p-3 rounded border border-red-100 shadow-sm"
              >
                {/* 通知ヘッダー */}
                <div className="flex justify-between items-start">
                  <div
                    className="flex-1 cursor-pointer hover:bg-red-50/50 transition-colors rounded p-1 -m-1"
                    onClick={() => setEditingReport(report)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-red-600">{report.日付}</span>
                      <span className="text-sf-text font-medium">{report.訪問先名 || '訪問先なし'}</span>
                      <span className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-500">No.{report.管理番号}</span>
                    </div>
                    <div className="text-sm text-gray-600 mt-1 line-clamp-2">
                      <span className="font-bold mr-1">上長:</span>
                      {report.上長コメント}
                    </div>
                  </div>

                  {/* ボタングループ */}
                  <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                    {replyingTo !== report.管理番号 && (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); setReplyingTo(report.管理番号); setReplyText(''); }}
                          className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded-full font-bold hover:bg-red-200 flex items-center gap-1"
                        >
                          <Send size={12} />
                          返信
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDismissNotification(report); }}
                          disabled={submittingReply}
                          className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full font-bold hover:bg-gray-200 flex items-center gap-1 disabled:opacity-50"
                        >
                          <Trash2 size={12} />
                          削除
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* インライン返信フォーム */}
                {replyingTo === report.管理番号 && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
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
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmitReply(report); } }}
                        placeholder="返信を入力..."
                        autoFocus
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-red-300"
                      />
                      <button
                        onClick={() => handleSubmitReply(report)}
                        disabled={submittingReply || !replyText.trim()}
                        className="px-4 py-2 bg-red-500 text-white text-sm rounded font-bold hover:bg-red-600 disabled:opacity-50 flex items-center gap-1"
                      >
                        <Send size={14} />
                        送信
                      </button>
                      <button
                        onClick={() => { setReplyingTo(null); setReplyText(''); }}
                        className="px-3 py-2 bg-gray-200 text-gray-600 text-sm rounded hover:bg-gray-300"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          {/* もっと見る / 折りたたむボタン */}
          {unreadComments.length > 5 && (
            <button
              onClick={() => setShowAllNotifications(!showAllNotifications)}
              className="mt-3 w-full py-2 text-sm text-red-600 hover:text-red-800 hover:bg-red-100 rounded transition-colors font-medium"
            >
              {showAllNotifications
                ? '▲ 折りたたむ'
                : `▼ 残り${unreadComments.length - 5}件を表示`}
            </button>
          )}
        </div>
      )}

      {/* サマリーカード */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card title="総日報数" value={totalReports} icon={<FileText className="text-sf-light-blue" />} />
        <Card title="今月の日報" value={thisMonth} icon={<Calendar className="text-green-600" />} />
        <Card title="累計訪問件数" value={visits} icon={<Users className="text-purple-600" />} />
        <Card title="累計電話件数" value={calls} icon={<Phone className="text-orange-500" />} />
      </div>


      {/* グラフセクション: 上段 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* メイン: 月別活動推移グラフ */}
        <div className="lg:col-span-2 bg-white rounded border border-sf-border shadow-sm p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="text-sf-light-blue" size={20} />
            <h2 className="font-semibold text-lg text-sf-text">活動推移 (月別)</h2>
          </div>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '4px', border: '1px solid #ddd' }}
                  itemStyle={{ fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="visits" name="訪問" fill="#8884d8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="calls" name="電話" fill="#82ca9d" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* サイド: 重点顧客サマリー (既存維持) */}
        <div className="bg-white rounded border border-sf-border shadow-sm p-4">
          <div className="flex items-center gap-2 mb-4">
            <Star className="text-yellow-500" size={20} />
            <h2 className="font-semibold text-lg text-sf-text">重点顧客状況</h2>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
              <span className="text-sm text-sf-text-weak">対象顧客数</span>
              <span className="text-xl font-bold text-sf-text">{uniquePriorityCustomers}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
              <span className="text-sm text-sf-text-weak">訪問件数</span>
              <span className="text-xl font-bold text-purple-600">{priorityVisits}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
              <span className="text-sm text-sf-text-weak">電話件数</span>
              <span className="text-xl font-bold text-orange-600">{priorityCalls}</span>
            </div>
            <div className="pt-2 border-t border-sf-border">
              <div className="flex justify-between text-xs text-sf-text-weak mb-1">
                <span>活動カバー率</span>
                <span>{(visits + calls) > 0 ? Math.round((priorityVisits + priorityCalls) / (visits + calls) * 100) : 0}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-yellow-500 h-2 rounded-full"
                  style={{ width: `${(visits + calls) > 0 ? Math.min(100, (priorityVisits + priorityCalls) / (visits + calls) * 100) : 0}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* グラフセクション: 中段 (得意先ランキング) */}
      <div className="bg-white rounded border border-sf-border shadow-sm p-4">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="text-sf-light-blue" size={20} />
          <h2 className="font-semibold text-lg text-sf-text">得意先別 活動ランキング (Top 10)</h2>
        </div>
        <div style={{ width: '100%', height: 400 }}>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart
              layout="vertical"
              data={topCustomers}
              margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis
                dataKey="name"
                type="category"
                width={150}
                tick={{ fontSize: 11 }}
                interval={0}
              />
              <Tooltip
                cursor={{ fill: 'transparent' }}
                contentStyle={{ backgroundColor: '#fff', borderRadius: '4px', border: '1px solid #ddd' }}
                itemStyle={{ fontSize: '12px' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="visits" name="訪問" fill="#8884d8" radius={[0, 4, 4, 0]} stackId="a" />
              <Bar dataKey="calls" name="電話" fill="#82ca9d" radius={[0, 4, 4, 0]} stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 月別統計テーブル */}
      <div className="bg-white rounded border border-sf-border shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-sf-border bg-gray-50 flex items-center gap-2">
          <BarChart3 size={20} className="text-sf-light-blue" />
          <h2 className="font-semibold text-sm text-sf-text">月別活動統計</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-sf-text-weak bg-gray-50 border-b border-sf-border">
              <tr>
                <th className="px-4 py-3 font-medium">月</th>
                <th className="px-4 py-3 font-medium text-center">訪問件数</th>
                <th className="px-4 py-3 font-medium text-center">電話件数</th>
                <th className="px-4 py-3 font-medium text-center">合計</th>
                <th className="px-4 py-3 font-medium text-center border-l-2 border-yellow-200 bg-yellow-50">重点顧客訪問</th>
                <th className="px-4 py-3 font-medium text-center bg-yellow-50">重点顧客電話</th>
                <th className="px-4 py-3 font-medium text-center bg-yellow-50">重点顧客合計</th>
              </tr>
            </thead>
            <tbody>
              {sortedMonths.map((stat, i) => (
                <tr key={stat.month} className="border-b border-sf-border hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-sf-text">{stat.month}</td>
                  <td className="px-4 py-3 text-center text-sf-text">{stat.visits}</td>
                  <td className="px-4 py-3 text-center text-sf-text">{stat.calls}</td>
                  <td className="px-4 py-3 text-center font-semibold text-sf-text">{stat.visits + stat.calls}</td>
                  <td className="px-4 py-3 text-center text-purple-600 border-l-2 border-yellow-200 bg-yellow-50">{stat.priorityVisits}</td>
                  <td className="px-4 py-3 text-center text-orange-600 bg-yellow-50">{stat.priorityCalls}</td>
                  <td className="px-4 py-3 text-center font-semibold text-yellow-700 bg-yellow-50">{stat.priorityVisits + stat.priorityCalls}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 最近の日報 */}
      <div className="bg-white rounded border border-sf-border shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-sf-border bg-gray-50 flex justify-between items-center">
          <h2 className="font-semibold text-sm text-sf-text">最近の日報</h2>
          <a href="/reports" className="text-sm text-sf-light-blue hover:underline">すべて表示</a>
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
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-4 text-center text-sf-text-weak">読み込み中...</td></tr>
              ) : reports.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-4 text-center text-sf-text-weak">日報が見つかりません</td></tr>
              ) : (
                reports.slice(0, 10).map((report, i) => (
                  <tr key={i} className="border-b border-sf-border hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sf-text">{report.日付}</td>
                    <td className="px-4 py-3 font-medium text-sf-light-blue">
                      {report.得意先CD ? (
                        <Link href={`/customers/${report.得意先CD}`} className="hover:underline">
                          {report.訪問先名}
                        </Link>
                      ) : (
                        report.訪問先名
                      )}
                    </td>
                    <td className="px-4 py-3 text-sf-text">{report.行動内容}</td>
                    <td className="px-4 py-3 text-center">
                      {report.重点顧客 && report.重点顧客 !== '-' && report.重点顧客 !== '' && (
                        <Star size={16} className="text-yellow-500 inline" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-sf-text">{report.面談者}</td>
                  </tr>
                ))
              )}
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
                    <LazyImage
                      src={getImageUrl(img.path)}
                      alt={img.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
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
      <div className="p-2 bg-gray-50 rounded-full border border-gray-200">
        {icon}
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string, value: number, color: string }) {
  return (
    <div className="text-center p-4 bg-gray-50 rounded border border-sf-border">
      <p className="text-xs text-sf-text-weak mb-1">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
