'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useFile } from '@/context/FileContext';
import { useReports } from '@/hooks/useQueryHooks';
import {
    aggregateAnalytics,
    aggregatePriorityMatrix,
    parseDate,
    calculatePersonalMonthlyScore,
    extractNeglectedPriorityCustomers
} from '@/lib/analytics';
import { AnalyticsData, PriorityMatrixData, PersonalScoreData, NeglectedCustomerAlert } from '@/types/analytics';
import { getPriorityCustomers, PriorityCustomer, getCustomers } from '@/lib/api';
import KPICard from '@/components/KPICard';
import MonthlyScorePacer from '@/components/analytics/MonthlyScorePacer';
import NeglectedCustomersAlert from '@/components/analytics/NeglectedCustomersAlert';
import {
    Star, MapPin, Palette, BarChart3, Users,
    FileText, CheckCircle, XCircle, TrendingUp, Briefcase
} from 'lucide-react';
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, Cell, ComposedChart, Line
} from 'recharts';
import toast from 'react-hot-toast';

type Tab = 'priority' | 'area' | 'design';
type MatrixMode = 'weekly' | 'monthly';
type MatrixMetric = 'visits' | 'calls' | 'total';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export default function AnalyticsPage(): React.JSX.Element {
    const { selectedFile } = useFile();

    // React Queryで日報データ取得（自動キャッシュ）
    const { data: reports = [], isLoading, error } = useReports(selectedFile || undefined);

    const [activeTab, setActiveTab] = useState<Tab>('priority');

    // 重点顧客マトリクス用の状態
    const [matrixMode, setMatrixMode] = useState<MatrixMode>('monthly');
    const [matrixMetric, setMatrixMetric] = useState<MatrixMetric>('total');
    const [priorityCustomers, setPriorityCustomers] = useState<PriorityCustomer[]>([]);
    const [customerNameMap, setCustomerNameMap] = useState<Map<string, string>>(new Map());

    // エラー時のtoast表示
    useEffect(() => {
        if (error) {
            toast.error('分析データの読み込みに失敗しました');
        }
    }, [error]);

    // 重点顧客マスタを取得
    useEffect(() => {
        if (selectedFile) {
            getPriorityCustomers(selectedFile)
                .then(data => setPriorityCustomers(data))
                .catch(err => {
                    console.error('Failed to load priority customers:', err);
                    setPriorityCustomers([]);
                });

            // 得意先一覧から名前マッピングを取得
            getCustomers(selectedFile)
                .then(customers => {
                    const nameMap = new Map<string, string>();
                    customers.forEach(c => {
                        const code = String(c.得意先CD || '').replace(/\.0$/, '').trim();
                        const name = c.得意先名 || '';
                        if (code && name) {
                            nameMap.set(code, name);
                        }
                    });
                    setCustomerNameMap(nameMap);
                })
                .catch(err => console.error('Failed to load customers:', err));
        }
    }, [selectedFile]);

    // ファイル名から担当者名を抽出する関数
    const extractStaffNameFromFilename = (filename: string): string | null => {
        if (!filename) return null;
        const match = filename.match(/【(.+?)】/);
        if (!match) return null;
        const content = match[1];
        const nameWithParenMatch = content.match(/^(.+?)（(.+?)）/);
        if (nameWithParenMatch) {
            return nameWithParenMatch[1] + nameWithParenMatch[2];
        }
        const surnameMatch = content.match(/^([^\u4e00-\u9fa5]*[\u4e00-\u9fa5]+?)(?:課長|次長|部長|常務|社長|主任|係長|専務|取締役|マネージャー|リーダー|担当|氏)?$/);
        if (surnameMatch) {
            return surnameMatch[1];
        }
        return content.slice(0, 2);
    };

    const staffName = useMemo(() => {
        return selectedFile ? extractStaffNameFromFilename(selectedFile) : null;
    }, [selectedFile]);

    // 1. 今月の200点目標ペースメーカーの集計
    const personalScoreData = useMemo((): PersonalScoreData | null => {
        if (reports.length === 0) return null;
        return calculatePersonalMonthlyScore(reports, new Date(), 200);
    }, [reports]);

    // 2. 重点顧客マトリクスの集計（画像2のデータ）
    const matrixData = useMemo((): PriorityMatrixData | null => {
        if (reports.length === 0) return null;

        // 担当者でフィルタリング
        let filteredPriorityCustomers = priorityCustomers;
        if (staffName && priorityCustomers.length > 0) {
            filteredPriorityCustomers = priorityCustomers.filter(c => {
                const customerStaff = c.担当者 || '';
                return customerStaff.includes(staffName) || staffName.includes(customerStaff);
            });
        }

        return aggregatePriorityMatrix(reports, filteredPriorityCustomers, matrixMode, matrixMetric);
    }, [reports, priorityCustomers, matrixMode, matrixMetric, staffName]);

    // 3. 要フォロー重点顧客アラートの抽出（マトリクスデータから自動抽出）
    const neglectedAlerts = useMemo((): NeglectedCustomerAlert[] => {
        if (!matrixData || reports.length === 0) return [];
        return extractNeglectedPriorityCustomers(matrixData, reports, new Date());
    }, [matrixData, reports]);

    // 4. デザイン進捗等の一般分析データ
    const analytics = useMemo((): AnalyticsData | null => {
        if (reports.length === 0) return null;
        return aggregateAnalytics(reports, undefined, undefined, priorityCustomers);
    }, [reports, priorityCustomers]);

    // ヒートマップの背景色を取得（画像2と同一配色）
    const getHeatmapColor = (value: number): string => {
        if (value === 0) return 'bg-gray-100 text-gray-400';
        if (value <= 2) return 'bg-blue-100 text-blue-700';
        if (value <= 5) return 'bg-blue-300 text-blue-800';
        return 'bg-blue-500 text-white';
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen flex-col">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sf-light-blue mx-auto mb-4"></div>
                    <p className="text-sf-text-weak">データを読み込んでいます...</p>
                    <p className="text-xs text-gray-400 mt-2">File: {selectedFile || 'None'}</p>
                </div>
            </div>
        );
    }

    if (reports.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-screen flex-col">
                <p className="text-sf-text-weak">日報データがありません</p>
                <p className="text-xs text-gray-400 mt-2">File: {selectedFile || 'None'}</p>
            </div>
        );
    }

    const renderTabButton = (id: Tab, label: string, icon: React.ReactNode) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-5 py-3 font-bold text-sm transition-all border-b-2 ${
                activeTab === id
                    ? 'border-sf-light-blue text-sf-light-blue bg-blue-50/50'
                    : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50'
            }`}
        >
            {icon}
            {label}
        </button>
    );

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-6 animate-fadeIn">
            {/* ページタイトル */}
            <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900">営業分析・レポート</h1>
                    <p className="text-sm text-gray-600 mt-0.5">
                        重点顧客のフォロー管理、月次活動目標（200点）の進捗、およびエリア別活動統計
                    </p>
                </div>
            </div>

            {/* 🏆 【新設】上部固定：今月の200点目標ペースメーカー */}
            {personalScoreData && (
                <MonthlyScorePacer scoreData={personalScoreData} staffName={staffName} />
            )}

            {/* タブナビゲーション */}
            <div className="flex border-b border-gray-200 mb-6 bg-white rounded-t-xl px-2 shadow-sm">
                {renderTabButton('priority', '重点顧客フォロー・マトリクス', <Star size={18} className="text-amber-500" />)}
                {renderTabButton('area', '月別エリア別活動統計', <MapPin size={18} className="text-blue-500" />)}
                {renderTabButton('design', 'デザイン案件進捗', <Palette size={18} className="text-purple-500" />)}
            </div>

            {/* タブ1: 重点顧客フォロー・マトリクス */}
            {activeTab === 'priority' && (
                <div className="space-y-6 animate-fadeIn">
                    {/* 🚨 【新設】重点顧客フォロー推奨アラート（30日未接触・今月未接触リスト） */}
                    <NeglectedCustomersAlert alerts={neglectedAlerts} />

                    {/* 📊 【完全保持】重点顧客 活動マトリクス（画像2のテーブル） */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 md:p-6">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">重点顧客 活動マトリクス</h2>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    過去の接触実績と推移一覧（マス目の数字は活動件数を表します）
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                                {/* 月別 / 週別 切り替え */}
                                <div className="flex bg-gray-100 rounded-lg p-1">
                                    <button
                                        onClick={() => setMatrixMode('monthly')}
                                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                                            matrixMode === 'monthly'
                                                ? 'bg-white text-gray-900 shadow-sm'
                                                : 'text-gray-600 hover:text-gray-900'
                                        }`}
                                    >
                                        月別
                                    </button>
                                    <button
                                        onClick={() => setMatrixMode('weekly')}
                                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                                            matrixMode === 'weekly'
                                                ? 'bg-white text-gray-900 shadow-sm'
                                                : 'text-gray-600 hover:text-gray-900'
                                        }`}
                                    >
                                        週別
                                    </button>
                                </div>

                                {/* 合計 / 訪問 / 電話 切り替え */}
                                <div className="flex bg-gray-100 rounded-lg p-1">
                                    <button
                                        onClick={() => setMatrixMetric('total')}
                                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                                            matrixMetric === 'total'
                                                ? 'bg-blue-600 text-white shadow-sm'
                                                : 'text-gray-600 hover:text-gray-900'
                                        }`}
                                    >
                                        合計
                                    </button>
                                    <button
                                        onClick={() => setMatrixMetric('visits')}
                                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                                            matrixMetric === 'visits'
                                                ? 'bg-blue-600 text-white shadow-sm'
                                                : 'text-gray-600 hover:text-gray-900'
                                        }`}
                                    >
                                        訪問
                                    </button>
                                    <button
                                        onClick={() => setMatrixMetric('calls')}
                                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                                            matrixMetric === 'calls'
                                                ? 'bg-blue-600 text-white shadow-sm'
                                                : 'text-gray-600 hover:text-gray-900'
                                        }`}
                                    >
                                        電話
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* マトリクス テーブル（画像2のスタイル） */}
                        <div className="overflow-x-auto border border-gray-100 rounded-lg">
                            {matrixData && matrixData.customers.length > 0 ? (
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-gray-50/80 border-b border-gray-200">
                                            <th className="px-4 py-3 text-left font-semibold text-gray-700 sticky left-0 bg-gray-50 min-w-[200px]">
                                                顧客名
                                            </th>
                                            {matrixData.periods.map((period, idx) => (
                                                <th key={idx} className="px-2 py-3 text-center font-semibold text-gray-700 min-w-[55px]">
                                                    {period}
                                                </th>
                                            ))}
                                            <th className="px-3 py-3 text-center font-bold text-gray-900 bg-gray-100 min-w-[60px]">
                                                合計
                                            </th>
                                            <th className="px-3 py-3 text-right text-gray-700 min-w-[95px]">
                                                最終活動
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {matrixData.customers.map((customer, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50/80 transition-colors">
                                                <td className="px-4 py-2 font-medium text-gray-900 sticky left-0 bg-white">
                                                    <div className="min-w-[200px] max-w-[280px] text-sm leading-tight" title={customerNameMap.get(customer.code) || customer.name || customer.code}>
                                                        {customerNameMap.get(customer.code)
                                                            || (customer.name && customer.name !== 'nan' && customer.name !== 'undefined' ? customer.name : `得意先${customer.code}`)}
                                                    </div>
                                                </td>
                                                {customer.values.map((value, vIdx) => (
                                                    <td key={vIdx} className="px-2 py-2 text-center">
                                                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-md text-xs font-bold ${getHeatmapColor(value)}`}>
                                                            {value}
                                                        </span>
                                                    </td>
                                                ))}
                                                <td className="px-3 py-2 text-center bg-gray-50/50">
                                                    <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-bold ${
                                                        customer.total > 0 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
                                                    }`}>
                                                        {customer.total}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 text-right text-gray-600 text-xs">
                                                    {customer.lastActivity || '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="text-center py-8 text-gray-500">
                                    {priorityCustomers.length === 0
                                        ? '重点顧客マスタを読み込んでいます...'
                                        : '重点顧客データがありません'}
                                </div>
                            )}
                        </div>

                        {/* 凡例 */}
                        <div className="mt-4 flex items-center gap-4 text-xs text-gray-500 border-t border-gray-100 pt-3">
                            <span className="font-medium text-gray-700">凡例:</span>
                            <div className="flex items-center gap-1.5">
                                <span className="inline-block w-5 h-5 rounded bg-gray-100 border border-gray-200"></span>
                                <span>0</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="inline-block w-5 h-5 rounded bg-blue-100 border border-blue-200"></span>
                                <span>1-2</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="inline-block w-5 h-5 rounded bg-blue-300"></span>
                                <span>3-5</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="inline-block w-5 h-5 rounded bg-blue-500 text-white"></span>
                                <span>6+</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* タブ2: 月別エリア別活動統計 */}
            {activeTab === 'area' && (
                <div className="space-y-6 animate-fadeIn">
                    {/* 📋 【完全保持】月別エリア別活動統計（画像1のテーブル） */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 bg-white">
                            <h2 className="text-xl font-bold text-gray-900">月別エリア別活動統計</h2>
                            <p className="text-sm text-gray-500 mt-1">全期間の月ごと・エリアごとの訪問件数・電話件数を一覧表示</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-600 bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-4 py-3 font-bold">月</th>
                                        <th className="px-4 py-3 font-bold">エリア</th>
                                        <th className="px-4 py-3 font-bold text-center">訪問件数</th>
                                        <th className="px-4 py-3 font-bold text-center">電話件数</th>
                                        <th className="px-4 py-3 font-bold text-center">合計</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(() => {
                                        // 月別・エリア別の集計（画像1と同一ロジック）
                                        type AreaCount = { visits: number; calls: number };
                                        type MonthAreaData = { month: string; areas: Map<string, AreaCount>; totalVisits: number; totalCalls: number };
                                        const monthAreaMap = new Map<string, MonthAreaData>();

                                        reports.forEach(report => {
                                            if (!report.日付) return;
                                            const parsedDate = parseDate(String(report.日付));
                                            if (!parsedDate) return;
                                            const yy = String(parsedDate.getFullYear()).slice(-2);
                                            const mm = String(parsedDate.getMonth() + 1).padStart(2, '0');
                                            const month = `${yy}/${mm}`;

                                            const isVisit = report.行動内容 && report.行動内容.includes('訪問');
                                            const isCall = report.行動内容 && report.行動内容.includes('電話');
                                            if (!isVisit && !isCall) return;

                                            if (!monthAreaMap.has(month)) {
                                                monthAreaMap.set(month, { month, areas: new Map(), totalVisits: 0, totalCalls: 0 });
                                            }
                                            const monthData = monthAreaMap.get(month)!;
                                            const area = report.エリア && String(report.エリア).trim() ? String(report.エリア).trim() : '未設定';

                                            if (!monthData.areas.has(area)) {
                                                monthData.areas.set(area, { visits: 0, calls: 0 });
                                            }
                                            const areaStats = monthData.areas.get(area)!;
                                            if (isVisit) { areaStats.visits++; monthData.totalVisits++; }
                                            if (isCall) { areaStats.calls++; monthData.totalCalls++; }
                                        });

                                        const sortedMonthData = Array.from(monthAreaMap.values()).sort((a, b) => b.month.localeCompare(a.month));

                                        if (sortedMonthData.length === 0) {
                                            return (
                                                <tr>
                                                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                                                        データがありません
                                                    </td>
                                                </tr>
                                            );
                                        }

                                        return sortedMonthData.map((monthData) => {
                                            const areas = Array.from(monthData.areas.entries()).sort((a, b) => {
                                                if (a[0] === '未設定') return 1;
                                                if (b[0] === '未設定') return -1;
                                                return a[0].localeCompare(b[0]);
                                            });
                                            const rowCount = areas.length + 1;

                                            return (
                                                <React.Fragment key={`month-group-${monthData.month}`}>
                                                    {areas.map(([area, areaStats]: [string, AreaCount], areaIdx: number) => (
                                                        <tr key={`${monthData.month}-${area}`} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                                                            {areaIdx === 0 && (
                                                                <td className="px-4 py-3 font-bold text-gray-900 align-top border-r border-gray-200" rowSpan={rowCount}>
                                                                    {monthData.month}
                                                                </td>
                                                            )}
                                                            <td className="px-4 py-2 text-gray-700">{area}</td>
                                                            <td className="px-4 py-2 text-center text-gray-700">{areaStats.visits}</td>
                                                            <td className="px-4 py-2 text-center text-gray-700">{areaStats.calls}</td>
                                                            <td className="px-4 py-2 text-center font-bold text-gray-900">{areaStats.visits + areaStats.calls}</td>
                                                        </tr>
                                                    ))}
                                                    {/* 月合計行 */}
                                                    <tr key={`${monthData.month}-total`} className="border-b-2 border-gray-300 bg-blue-50 font-bold">
                                                        <td className="px-4 py-2 text-gray-800">合計</td>
                                                        <td className="px-4 py-2 text-center text-gray-800">{monthData.totalVisits}</td>
                                                        <td className="px-4 py-2 text-center text-gray-800">{monthData.totalCalls}</td>
                                                        <td className="px-4 py-2 text-center text-gray-900">{monthData.totalVisits + monthData.totalCalls}</td>
                                                    </tr>
                                                </React.Fragment>
                                            );
                                        });
                                    })()}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* エリア別訪問数ランキング（補足） */}
                    {analytics && analytics.byArea && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 md:p-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-4">累計エリア別活動ランキング</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                {analytics.byArea.filter(item => item.area !== '未設定').slice(0, 8).map((item, index) => (
                                    <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                                        <div className="flex items-center gap-2.5">
                                            <span className="w-6 h-6 flex items-center justify-center bg-blue-100 text-blue-800 rounded-full text-xs font-bold">
                                                {index + 1}
                                            </span>
                                            <span className="text-sm font-semibold text-gray-800">{item.area}</span>
                                        </div>
                                        <span className="text-sm font-bold text-blue-600">{item.count}件</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* タブ3: デザイン案件進捗 */}
            {activeTab === 'design' && analytics && (
                <div className="space-y-6 animate-fadeIn">
                    {/* デザインKPI */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
                        <KPICard title="デザイン依頼" value={analytics.kpis.totalProposals} icon={FileText} color="blue" />
                        <KPICard title="進行中案件" value={analytics.kpis.activeProjects} icon={Briefcase} color="purple" />
                        <KPICard title="出稿" value={analytics.kpis.completedDesigns} icon={CheckCircle} color="green" />
                        <KPICard title="不採用" value={analytics.kpis.rejectedDesigns} icon={XCircle} color="red" />
                        <KPICard title="出稿率" value={`${analytics.kpis.acceptanceRate}%`} icon={TrendingUp} color="orange" />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* デザイン進捗状況 */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 md:p-6">
                            <h2 className="text-lg font-bold text-gray-900 mb-4">デザイン進捗状況</h2>
                            <div style={{ width: '100%', height: 300 }}>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={analytics.designProgress} layout="vertical" margin={{ left: 40 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                        <XAxis type="number" />
                                        <YAxis dataKey="status" type="category" width={100} tick={{ fontSize: 11 }} />
                                        <Tooltip cursor={{ fill: 'transparent' }} />
                                        <Bar dataKey="count" name="件数" fill="#8884d8" radius={[0, 4, 4, 0]}>
                                            {analytics.designProgress.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* デザイン推移 */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 md:p-6">
                            <h2 className="text-lg font-bold text-gray-900 mb-4">デザイン依頼・出稿推移</h2>
                            <div style={{ width: '100%', height: 300 }}>
                                <ResponsiveContainer width="100%" height={300}>
                                    <ComposedChart data={analytics.trends}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        <Bar dataKey="proposals" name="デザイン依頼" fill="#8884d8" barSize={20} radius={[4, 4, 0, 0]} />
                                        <Line type="monotone" dataKey="completed" name="出稿数" stroke="#82ca9d" strokeWidth={3} />
                                        <Line type="monotone" dataKey="rejected" name="不採用数" stroke="#ff8042" strokeWidth={3} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
