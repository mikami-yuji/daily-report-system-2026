'use client';

import { useEffect, useState } from 'react';
import { getReports, uploadFile, Report } from '@/lib/api';
import { useFile } from '@/context/FileContext';
import { FileText, Calendar, Users, Phone, TrendingUp, Star, BarChart3, Upload } from 'lucide-react';
import Link from 'next/link';
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
  const { files, selectedFile, setSelectedFile, refreshFiles } = useFile();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (selectedFile) {
      getReports(selectedFile).then(data => {
        // 日付の降順（新しい順）にソート
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
    }
  }, [selectedFile]);

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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      await uploadFile(file);
      // ファイルリストを再読み込み
      await refreshFiles();
      setSelectedFile(file.name);
      alert(`ファイル「${file.name}」をアップロードしました`);
    } catch (error) {
      console.error('File upload failed:', error);
      alert('ファイルのアップロードに失敗しました');
    } finally {
      setUploading(false);
      // input要素をリセット
      event.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-sf-text">ホーム</h1>
        <div className="flex items-center gap-2">
          <label className={`flex items-center justify-center px-3 py-2 rounded border border-sf-border bg-white cursor-pointer hover:bg-gray-50 transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`} title="Excelファイルをアップロード">
            <input
              type="file"
              accept=".xlsx,.xlsm"
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading}
            />
            <Upload size={18} className="text-sf-text-weak mr-2" />
            <span className="text-sm text-sf-text">読込</span>
          </label>
          <select
            value={selectedFile}
            onChange={(e) => setSelectedFile(e.target.value)}
            className="text-sm text-sf-text bg-white border border-sf-border rounded px-3 py-2"
          >
            {files.map(file => (
              <option key={file.name} value={file.name}>{file.name}</option>
            ))}
          </select>

        </div>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card title="総日報数" value={totalReports} icon={<FileText className="text-sf-light-blue" />} />
        <Card title="今月の日報" value={thisMonth} icon={<Calendar className="text-green-600" />} />
        <Card title="累計訪問件数" value={visits} icon={<Users className="text-purple-600" />} />
        <Card title="累計電話件数" value={calls} icon={<Phone className="text-orange-500" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* メイン: 月別活動推移グラフ */}
        <div className="lg:col-span-2 bg-white rounded border border-sf-border shadow-sm p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="text-sf-light-blue" size={20} />
            <h2 className="font-semibold text-lg text-sf-text">活動推移</h2>
          </div>
          <div style={{ width: '100%', height: 256 }}>
            <ResponsiveContainer width="100%" height={256}>
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

        {/* サイド: 重点顧客サマリー */}
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
