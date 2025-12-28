'use client';

import { useEffect, useState } from 'react';
import { useFile } from '@/context/FileContext';
import { getReports, Report } from '@/lib/api';
import { aggregateAnalytics, getDateRange, AnalyticsData } from '@/lib/analytics';
import KPICard from '@/components/KPICard';
import { Users, FileText, Briefcase, CheckCircle, XCircle, TrendingUp, Phone, Mail, LayoutDashboard, MessageSquare, Palette, Star } from 'lucide-react';
import {
    ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, Area, BarChart
} from 'recharts';
import toast from 'react-hot-toast';

type Period = 'today' | 'week' | 'month' | 'quarter' | 'year';
type Tab = 'overview' | 'business' | 'design' | 'priority';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export default function AnalyticsPage() {
    const { selectedFile } = useFile();
    const [reports, setReports] = useState<Report[]>([]);
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
    const [period, setPeriod] = useState<Period>('month');
    const [activeTab, setActiveTab] = useState<Tab>('overview');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadReports();
    }, [selectedFile]);

    useEffect(() => {
        if (reports.length > 0) {
            calculateAnalytics();
        }
    }, [reports, period]);

    const loadReports = async () => {
        if (!selectedFile) return;
        try {
            setLoading(true);
            const data = await getReports(selectedFile);
            setReports(data);
        } catch (error) {
            console.error('Failed to load reports:', error);
            toast.error('分析データの読み込みに失敗しました');
        } finally {
            setLoading(false);
        }
    };

    const calculateAnalytics = () => {
        const { start, end } = getDateRange(period);
        const analyticsData = aggregateAnalytics(reports, start, end);
        setAnalytics(analyticsData);
    };

    if (loading) {
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
                </div>
            )}

            {activeTab === 'design' && (
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
            )}

            {activeTab === 'priority' && (
                <div className="space-y-8 animate-fadeIn">
                    {/* Priority KPIs */}
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        <KPICard title="重点顧客数" value={analytics.priority.totalCustomers} icon={Star} color="yellow" />
                        <KPICard title="訪問数" value={analytics.priority.totalVisits} icon={Users} color="blue" />
                        <KPICard title="電話数" value={analytics.priority.totalCalls} icon={Phone} color="orange" />
                        <KPICard title="デザイン依頼" value={analytics.priority.totalProposals} icon={FileText} color="purple" />
                        <KPICard title="出稿" value={analytics.priority.completedDesigns} icon={CheckCircle} color="green" />
                        <KPICard title="出稿率" value={`${analytics.priority.acceptanceRate}%`} icon={TrendingUp} color="red" />
                    </div>

                    {/* Priority Customer List */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">重点顧客別活動状況</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3">顧客名</th>
                                        <th className="px-6 py-3 text-center">訪問</th>
                                        <th className="px-6 py-3 text-center">電話</th>
                                        <th className="px-6 py-3 text-center">依頼</th>
                                        <th className="px-6 py-3 text-center">出稿</th>
                                        <th className="px-6 py-3 text-center">不採用</th>
                                        <th className="px-6 py-3 text-right">最終訪問日</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {analytics.priority.byCustomer.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                                                データがありません
                                            </td>
                                        </tr>
                                    ) : (
                                        analytics.priority.byCustomer.map((customer, index) => (
                                            <tr key={index} className="bg-white border-b hover:bg-gray-50">
                                                <td className="px-6 py-4 font-medium text-gray-900">
                                                    {customer.name}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium ${customer.visits > 0 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                                                        }`}>
                                                        {customer.visits}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium ${customer.calls > 0 ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-800'
                                                        }`}>
                                                        {customer.calls}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium ${customer.proposals > 0 ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                                                        }`}>
                                                        {customer.proposals}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium ${customer.completed > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                                        }`}>
                                                        {customer.completed}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium ${customer.rejected > 0 ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                                                        }`}>
                                                        {customer.rejected}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right text-gray-500">
                                                    {customer.lastVisit || '-'}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
