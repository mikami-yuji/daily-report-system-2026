'use client';

import React, { useEffect, useState } from 'react';
import { useFile } from '@/context/FileContext';
import { useReports } from '@/hooks/useQueryHooks';
import { aggregateAnalytics, getDateRange, AnalyticsData, aggregatePriorityMatrix, PriorityMatrixData } from '@/lib/analytics';
import { getPriorityCustomers, PriorityCustomer, getCustomers, Customer } from '@/lib/api';
import KPICard from '@/components/KPICard';
import { Users, FileText, Briefcase, CheckCircle, XCircle, TrendingUp, Phone, Mail, LayoutDashboard, MessageSquare, Palette, Star } from 'lucide-react';
import {
    ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, Area, BarChart
} from 'recharts';
import toast from 'react-hot-toast';

type Period = 'today' | 'week' | 'month' | 'quarter' | 'year';
type Tab = 'overview' | 'business' | 'design' | 'priority';
type MatrixMode = 'weekly' | 'monthly';
type MatrixMetric = 'visits' | 'calls' | 'total';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export default function AnalyticsPage() {
    const { selectedFile } = useFile();

    // React Queryでデータ取得（自動キャッシュ）
    const { data: reports = [], isLoading, error } = useReports(selectedFile || undefined);

    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
    const [period, setPeriod] = useState<Period>('month');
    const [activeTab, setActiveTab] = useState<Tab>('overview');

    // 重点顧客マトリクス用の状態
    const [matrixMode, setMatrixMode] = useState<MatrixMode>('monthly');
    const [matrixMetric, setMatrixMetric] = useState<MatrixMetric>('total');
    const [priorityCustomers, setPriorityCustomers] = useState<PriorityCustomer[]>([]);
    const [matrixData, setMatrixData] = useState<PriorityMatrixData | null>(null);
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

    useEffect(() => {
        if (reports.length > 0) {
            calculateAnalytics();
        }
    }, [reports, period]);

    // ファイル名から担当者名を抽出する関数
    // 例: 「本社002　2025年度用日報【山下（尚）次長】.xlsm」→「山下尚」
    // 例: 「本社001　2025年度用日報【田中課長】.xlsm」→「田中」
    const extractStaffNameFromFilename = (filename: string): string | null => {
        if (!filename) return null;

        // 【...】の中身を抽出
        const match = filename.match(/【(.+?)】/);
        if (!match) return null;

        const content = match[1]; // 例: 「山下（尚）次長」or「田中課長」

        // 括弧内の名前を抽出
        const nameWithParenMatch = content.match(/^(.+?)（(.+?)）/);
        if (nameWithParenMatch) {
            // 「山下（尚）」→「山下尚」
            return nameWithParenMatch[1] + nameWithParenMatch[2];
        }

        // 括弧がない場合は、役職を除いた苗字のみ
        // 「田中課長」→「田中」（役職を除去）
        const surnameMatch = content.match(/^([^\u4e00-\u9fa5]*[\u4e00-\u9fa5]+?)(?:課長|次長|部長|常務|社長|主任|係長|専務|取締役|マネージャー|リーダー|担当|氏)?$/);
        if (surnameMatch) {
            return surnameMatch[1];
        }

        // フォールバック: 最初の2-4文字を苗字として扱う
        return content.slice(0, 2);
    };

    // マトリクスデータを更新（担当者でフィルタリング）
    useEffect(() => {
        if (reports.length > 0) {
            // ファイル名から担当者名を抽出
            const staffName = selectedFile ? extractStaffNameFromFilename(selectedFile) : null;

            // 担当者でフィルタリング
            let filteredPriorityCustomers = priorityCustomers;
            if (staffName && priorityCustomers.length > 0) {
                filteredPriorityCustomers = priorityCustomers.filter(c => {
                    const customerStaff = c.担当者 || '';
                    // 担当者名が含まれているかチェック（部分一致）
                    return customerStaff.includes(staffName) || staffName.includes(customerStaff);
                });
            }

            const data = aggregatePriorityMatrix(reports, filteredPriorityCustomers, matrixMode, matrixMetric);
            setMatrixData(data);
        }
    }, [reports, priorityCustomers, matrixMode, matrixMetric, selectedFile]);

    const calculateAnalytics = () => {
        const { start, end } = getDateRange(period);
        const analyticsData = aggregateAnalytics(reports, start, end);
        setAnalytics(analyticsData);
    };

    // ヒートマップの背景色を取得
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

    if (!analytics) {
        return (
            <div className="flex items-center justify-center min-h-screen flex-col">
                <p className="text-sf-text-weak">データがありません</p>
                <p className="text-xs text-gray-400 mt-2">File: {selectedFile || 'None'}</p>
            </div>
        );
    }

    const renderTabButton = (id: Tab, label: string, icon: React.ReactNode) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors border-b-2 ${activeTab === id
                ? 'border-sf-light-blue text-sf-light-blue'
                : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
        >
            {icon}
            {label}
        </button>
    );

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">営業分析ダッシュボード</h1>
                <p className="text-gray-600">営業活動の可視化と分析</p>
            </div>

            {/* Controls */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                {/* Tabs */}
                <div className="flex border-b border-gray-200 w-full md:w-auto overflow-x-auto">
                    {renderTabButton('overview', '全体概要', <LayoutDashboard size={18} />)}
                    {renderTabButton('business', '商談分析', <MessageSquare size={18} />)}
                    {renderTabButton('design', 'デザイン分析', <Palette size={18} />)}
                    {renderTabButton('priority', '重点顧客分析', <Star size={18} />)}
                </div>

                {/* Period Selector */}
                <div className="flex bg-white rounded-lg shadow-sm border border-gray-200 p-1 shrink-0">
                    {(['today', 'week', 'month', 'quarter', 'year'] as Period[]).map(p => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${period === p
                                ? 'bg-sf-light-blue text-white shadow-sm'
                                : 'text-gray-600 hover:bg-gray-50'
                                }`}
                        >
                            {p === 'today' && '今日'}
                            {p === 'week' && '7日間'}
                            {p === 'month' && '30日間'}
                            {p === 'quarter' && '3ヶ月'}
                            {p === 'year' && '1年間'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content based on active tab */}
            {activeTab === 'overview' && (
                <div className="space-y-8 animate-fadeIn">
                    {/* Overview KPIs */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <KPICard title="訪問件数" value={analytics.kpis.totalVisits} icon={Users} color="blue" />
                        <KPICard title="デザイン依頼" value={analytics.kpis.totalProposals} icon={FileText} color="green" />
                        <KPICard title="進行中案件" value={analytics.kpis.activeProjects} icon={Briefcase} color="purple" />
                        <KPICard title="出稿" value={analytics.kpis.completedDesigns} icon={CheckCircle} color="orange" />
                    </div>

                    {/* Mixed Analysis Chart */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">活動と成果の相関（混合分析）</h2>
                        <div style={{ width: '100%', height: 400 }}>
                            <ResponsiveContainer width="100%" height={400}>
                                <ComposedChart data={analytics.trends}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                                    <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                                    <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                    />
                                    <Legend />
                                    <Bar yAxisId="left" dataKey="visits" name="訪問件数" fill="#8884d8" barSize={20} radius={[4, 4, 0, 0]} />
                                    <Line yAxisId="right" type="monotone" dataKey="proposals" name="デザイン依頼" stroke="#82ca9d" strokeWidth={3} dot={{ r: 4 }} />
                                    <Line yAxisId="right" type="monotone" dataKey="completed" name="出稿" stroke="#ff7300" strokeWidth={3} dot={{ r: 4 }} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'business' && (
                <div className="space-y-8 animate-fadeIn">
                    {/* Business KPIs */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <KPICard title="訪問件数" value={analytics.kpis.totalVisits} icon={Users} color="blue" />
                        <KPICard title="電話商談" value={analytics.kpis.phoneContacts} icon={Phone} color="orange" />
                        <KPICard title="メール商談" value={analytics.kpis.emailContacts} icon={Mail} color="green" />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Contact Trends */}
                        <div className="bg-white rounded-lg shadow p-6">
                            <h2 className="text-xl font-bold text-gray-900 mb-4">商談活動推移</h2>
                            <div style={{ width: '100%', height: 300 }}>
                                <ResponsiveContainer width="100%" height={300}>
                                    <ComposedChart data={analytics.trends}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        <Area type="monotone" dataKey="visits" name="訪問" fill="#8884d8" stroke="#8884d8" fillOpacity={0.3} />
                                        <Line type="monotone" dataKey="phone" name="電話" stroke="#ffc658" strokeWidth={2} />
                                        <Line type="monotone" dataKey="email" name="メール" stroke="#82ca9d" strokeWidth={2} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Area Distribution */}
                        <div className="bg-white rounded-lg shadow p-6">
                            <h2 className="text-xl font-bold text-gray-900 mb-4">エリア別活動分布</h2>
                            <div style={{ width: '100%', height: 300 }}>
                                <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                        <Pie
                                            data={analytics.byArea.filter(item => item.area !== '未設定')}
                                            dataKey="count"
                                            nameKey="area"
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={100}
                                            paddingAngle={5}
                                            label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                                        >
                                            {analytics.byArea.filter(item => item.area !== '未設定').map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Top Lists */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white rounded-lg shadow p-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-4">エリア別訪問数ランキング</h3>
                            <div className="space-y-3">
                                {analytics.byArea.filter(item => item.area !== '未設定').slice(0, 5).map((item, index) => (
                                    <div key={index} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded">
                                        <div className="flex items-center gap-3">
                                            <span className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded-full text-xs font-bold text-gray-600">
                                                {index + 1}
                                            </span>
                                            <span className="text-sm text-gray-700">{item.area}</span>
                                        </div>
                                        <span className="text-sm font-bold text-sf-light-blue">{item.count}件</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white rounded-lg shadow p-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-4">行動内容別ランキング</h3>
                            <div className="space-y-3">
                                {analytics.byAction.filter(item => item.action !== '未設定').slice(0, 5).map((item, index) => (
                                    <div key={index} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded">
                                        <div className="flex items-center gap-3">
                                            <span className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded-full text-xs font-bold text-gray-600">
                                                {index + 1}
                                            </span>
                                            <span className="text-sm text-gray-700">{item.action}</span>
                                        </div>
                                        <span className="text-sm font-bold text-sf-light-blue">{item.count}件</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* 月別エリア別活動統計テーブル */}
                    <div className="bg-white rounded-lg shadow overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200">
                            <h2 className="text-xl font-bold text-gray-900">月別エリア別活動統計</h2>
                            <p className="text-sm text-gray-500 mt-1">全期間の月ごと・エリアごとの訪問件数・電話件数を一覧表示</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-500 bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold">月</th>
                                        <th className="px-4 py-3 font-semibold">エリア</th>
                                        <th className="px-4 py-3 font-semibold text-center">訪問件数</th>
                                        <th className="px-4 py-3 font-semibold text-center">電話件数</th>
                                        <th className="px-4 py-3 font-semibold text-center">合計</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(() => {
                                        // 月別・エリア別の集計
                                        type AreaCount = { visits: number; calls: number };
                                        type MonthAreaData = { month: string; areas: Map<string, AreaCount>; totalVisits: number; totalCalls: number };
                                        const monthAreaMap = new Map<string, MonthAreaData>();

                                        reports.forEach(report => {
                                            if (!report.日付) return;
                                            const dateStr = String(report.日付);
                                            let month = '';
                                            if (dateStr.includes('/')) {
                                                const parts = dateStr.split('/');
                                                if (parts.length >= 2) month = `${parts[0]}/${parts[1]}`;
                                            } else {
                                                month = dateStr.slice(0, 7);
                                            }
                                            if (!month) return;

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
                                                                <td className="px-4 py-3 font-semibold text-gray-900 align-top border-r border-gray-200" rowSpan={rowCount}>
                                                                    {monthData.month}
                                                                </td>
                                                            )}
                                                            <td className="px-4 py-2 text-gray-700">{area}</td>
                                                            <td className="px-4 py-2 text-center text-gray-700">{areaStats.visits}</td>
                                                            <td className="px-4 py-2 text-center text-gray-700">{areaStats.calls}</td>
                                                            <td className="px-4 py-2 text-center font-medium text-gray-900">{areaStats.visits + areaStats.calls}</td>
                                                        </tr>
                                                    ))}
                                                    {/* 月合計行 */}
                                                    <tr key={`${monthData.month}-total`} className="border-b-2 border-gray-300 bg-blue-50 font-semibold">
                                                        <td className="px-4 py-2 text-gray-800 font-bold">合計</td>
                                                        <td className="px-4 py-2 text-center text-gray-800">{monthData.totalVisits}</td>
                                                        <td className="px-4 py-2 text-center text-gray-800">{monthData.totalCalls}</td>
                                                        <td className="px-4 py-2 text-center font-bold text-gray-900">{monthData.totalVisits + monthData.totalCalls}</td>
                                                    </tr>
                                                </React.Fragment>
                                            );
                                        });
                                    })()}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )
            }

            {
                activeTab === 'design' && (
                    <div className="space-y-8 animate-fadeIn">
                        {/* Design KPIs */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                            <KPICard title="デザイン依頼" value={analytics.kpis.totalProposals} icon={FileText} color="blue" />
                            <KPICard title="進行中案件" value={analytics.kpis.activeProjects} icon={Briefcase} color="purple" />
                            <KPICard title="出稿" value={analytics.kpis.completedDesigns} icon={CheckCircle} color="green" />
                            <KPICard title="不採用" value={analytics.kpis.rejectedDesigns} icon={XCircle} color="red" />
                            <KPICard title="出稿率" value={`${analytics.kpis.acceptanceRate}%`} icon={TrendingUp} color="orange" />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Design Progress */}
                            <div className="bg-white rounded-lg shadow p-6">
                                <h2 className="text-xl font-bold text-gray-900 mb-4">デザイン進捗状況</h2>
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

                            {/* Design Trends */}
                            <div className="bg-white rounded-lg shadow p-6">
                                <h2 className="text-xl font-bold text-gray-900 mb-4">デザイン依頼・出稿・不採用推移</h2>
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
                )
            }

            {
                activeTab === 'priority' && (
                    <div className="space-y-6 animate-fadeIn">
                        {/* Priority KPIs */}
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                            <KPICard title="重点顧客数" value={matrixData?.customers.length || 0} icon={Star} color="yellow" />
                            <KPICard title="訪問数" value={analytics.priority.totalVisits} icon={Users} color="blue" />
                            <KPICard title="電話数" value={analytics.priority.totalCalls} icon={Phone} color="orange" />
                            <KPICard title="デザイン依頼" value={analytics.priority.totalProposals} icon={FileText} color="purple" />
                            <KPICard title="出稿" value={analytics.priority.completedDesigns} icon={CheckCircle} color="green" />
                            <KPICard title="出稿率" value={`${analytics.priority.acceptanceRate}%`} icon={TrendingUp} color="red" />
                        </div>

                        {/* Matrix Controls */}
                        <div className="bg-white rounded-lg shadow p-6">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                                <h2 className="text-xl font-bold text-gray-900">重点顧客 活動マトリクス</h2>

                                <div className="flex flex-wrap gap-4">
                                    {/* Mode Toggle */}
                                    <div className="flex bg-gray-100 rounded-lg p-1">
                                        <button
                                            onClick={() => setMatrixMode('monthly')}
                                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${matrixMode === 'monthly'
                                                ? 'bg-white text-gray-900 shadow-sm'
                                                : 'text-gray-600 hover:text-gray-900'
                                                }`}
                                        >
                                            月別
                                        </button>
                                        <button
                                            onClick={() => setMatrixMode('weekly')}
                                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${matrixMode === 'weekly'
                                                ? 'bg-white text-gray-900 shadow-sm'
                                                : 'text-gray-600 hover:text-gray-900'
                                                }`}
                                        >
                                            週別
                                        </button>
                                    </div>

                                    {/* Metric Toggle */}
                                    <div className="flex bg-gray-100 rounded-lg p-1">
                                        <button
                                            onClick={() => setMatrixMetric('total')}
                                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${matrixMetric === 'total'
                                                ? 'bg-blue-500 text-white shadow-sm'
                                                : 'text-gray-600 hover:text-gray-900'
                                                }`}
                                        >
                                            合計
                                        </button>
                                        <button
                                            onClick={() => setMatrixMetric('visits')}
                                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${matrixMetric === 'visits'
                                                ? 'bg-blue-500 text-white shadow-sm'
                                                : 'text-gray-600 hover:text-gray-900'
                                                }`}
                                        >
                                            訪問
                                        </button>
                                        <button
                                            onClick={() => setMatrixMetric('calls')}
                                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${matrixMetric === 'calls'
                                                ? 'bg-blue-500 text-white shadow-sm'
                                                : 'text-gray-600 hover:text-gray-900'
                                                }`}
                                        >
                                            電話
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Matrix Table */}
                            <div className="overflow-x-auto">
                                {matrixData && matrixData.customers.length > 0 ? (
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-gray-50">
                                                <th className="px-4 py-3 text-left font-semibold text-gray-700 sticky left-0 bg-gray-50 min-w-[180px]">
                                                    顧客名
                                                </th>
                                                {matrixData.periods.map((period, idx) => (
                                                    <th key={idx} className="px-2 py-3 text-center font-semibold text-gray-700 min-w-[60px]">
                                                        {period}
                                                    </th>
                                                ))}
                                                <th className="px-3 py-3 text-center font-bold text-gray-900 bg-gray-100 min-w-[60px]">
                                                    合計
                                                </th>
                                                <th className="px-3 py-3 text-right text-gray-700 min-w-[100px]">
                                                    最終活動
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {matrixData.customers.map((customer, idx) => (
                                                <tr key={idx} className="border-b hover:bg-gray-50">
                                                    <td className="px-4 py-2 font-medium text-gray-900 sticky left-0 bg-white">
                                                        <div className="min-w-[200px] max-w-[280px] text-sm leading-tight" title={customerNameMap.get(customer.code) || customer.name || customer.code}>
                                                            {customerNameMap.get(customer.code)
                                                                || (customer.name && customer.name !== 'nan' && customer.name !== 'undefined' ? customer.name : `得意先${customer.code}`)}
                                                        </div>
                                                    </td>
                                                    {customer.values.map((value, vIdx) => (
                                                        <td key={vIdx} className="px-2 py-3 text-center">
                                                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-md text-xs font-bold ${getHeatmapColor(value)}`}>
                                                                {value}
                                                            </span>
                                                        </td>
                                                    ))}
                                                    <td className="px-3 py-3 text-center bg-gray-50">
                                                        <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-sm font-bold ${customer.total > 0 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
                                                            }`}>
                                                            {customer.total}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-3 text-right text-gray-500 text-xs">
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
                                            : 'データがありません'}
                                    </div>
                                )}
                            </div>

                            {/* Legend */}
                            <div className="mt-4 flex items-center gap-4 text-xs text-gray-500 border-t pt-4">
                                <span>凡例:</span>
                                <div className="flex items-center gap-1">
                                    <span className="inline-block w-6 h-6 rounded bg-gray-100"></span>
                                    <span>0</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="inline-block w-6 h-6 rounded bg-blue-100"></span>
                                    <span>1-2</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="inline-block w-6 h-6 rounded bg-blue-300"></span>
                                    <span>3-5</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="inline-block w-6 h-6 rounded bg-blue-500"></span>
                                    <span>6+</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
