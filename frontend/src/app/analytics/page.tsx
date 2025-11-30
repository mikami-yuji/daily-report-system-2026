'use client';

import { useEffect, useState } from 'react';
import { useFile } from '@/context/FileContext';
import { getReports, Report } from '@/lib/api';
import { aggregateAnalytics, getDateRange, AnalyticsData } from '@/lib/analytics';
import KPICard from '@/components/KPICard';
import { Users, FileText, Briefcase, AlertCircle, TrendingUp, PieChart } from 'lucide-react';

type Period = 'today' | 'week' | 'month' | 'quarter' | 'year';

export default function AnalyticsPage() {
    const { selectedFile } = useFile();
    const [reports, setReports] = useState<Report[]>([]);
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
    const [period, setPeriod] = useState<Period>('month');
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
        try {
            setLoading(true);
            const data = await getReports(selectedFile);
            setReports(data);
        } catch (error) {
            console.error('Failed to load reports:', error);
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
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sf-light-blue mx-auto mb-4"></div>
                    <p className="text-sf-text-weak">データを読み込んでいます...</p>
                </div>
            </div>
        );
    }

    if (!analytics) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p className="text-sf-text-weak">データがありません</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">営業分析ダッシュボード</h1>
                <p className="text-gray-600">営業活動の可視化と分析</p>
            </div>

            {/* Period Selector */}
            <div className="mb-6 flex gap-2">
                {(['today', 'week', 'month', 'quarter', 'year'] as Period[]).map(p => (
                    <button
                        key={p}
                        onClick={() => setPeriod(p)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${period === p
                                ? 'bg-sf-light-blue text-white'
                                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                            }`}
                    >
                        {p === 'today' && '今日'}
                        {p === 'week' && '過去7日'}
                        {p === 'month' && '過去30日'}
                        {p === 'quarter' && '過去3ヶ月'}
                        {p === 'year' && '過去1年'}
                    </button>
                ))}
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <KPICard
                    title="訪問件数"
                    value={analytics.kpis.totalVisits}
                    icon={Users}
                    color="blue"
                />
                <KPICard
                    title="デザイン提案"
                    value={analytics.kpis.totalProposals}
                    icon={FileText}
                    color="green"
                />
                <KPICard
                    title="進行中案件"
                    value={analytics.kpis.activeProjects}
                    icon={Briefcase}
                    color="purple"
                />
                <KPICard
                    title="クレーム対応"
                    value={analytics.kpis.complaints}
                    icon={AlertCircle}
                    color="orange"
                />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Trends Chart Placeholder */}
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <TrendingUp className="text-sf-light-blue" size={24} />
                        <h2 className="text-xl font-bold text-gray-900">訪問件数推移</h2>
                    </div>
                    <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-200 rounded">
                        <p className="text-gray-400">グラフを実装予定</p>
                    </div>
                </div>

                {/* Area Chart Placeholder */}
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <PieChart className="text-sf-light-blue" size={24} />
                        <h2 className="text-xl font-bold text-gray-900">エリア別分析</h2>
                    </div>
                    <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-200 rounded">
                        <p className="text-gray-400">グラフを実装予定</p>
                    </div>
                </div>
            </div>

            {/* Detail Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Top Areas */}
                <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">エリア別訪問数</h3>
                    <div className="space-y-3">
                        {analytics.byArea.slice(0, 5).map((item, index) => (
                            <div key={index} className="flex justify-between items-center">
                                <span className="text-sm text-gray-700">{item.area}</span>
                                <span className="text-sm font-semibold text-gray-900">{item.count}件</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Top Actions */}
                <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">行動内容別</h3>
                    <div className="space-y-3">
                        {analytics.byAction.slice(0, 5).map((item, index) => (
                            <div key={index} className="flex justify-between items-center">
                                <span className="text-sm text-gray-700">{item.action}</span>
                                <span className="text-sm font-semibold text-gray-900">{item.count}件</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Top Interviewers */}
                <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">面談者別実績</h3>
                    <div className="space-y-3">
                        {analytics.byInterviewer.slice(0, 5).map((item, index) => (
                            <div key={index} className="flex justify-between items-center">
                                <span className="text-sm text-gray-700">{item.name}</span>
                                <div className="text-right">
                                    <div className="text-sm font-semibold text-gray-900">{item.visits}件</div>
                                    <div className="text-xs text-gray-500">{item.proposals}提案</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
