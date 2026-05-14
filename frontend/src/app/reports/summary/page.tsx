'use client';

import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useFile } from '@/context/FileContext';
import { useReports } from '@/hooks/useQueryHooks';
import { Report } from '@/lib/api';
import { ChevronLeft, ChevronRight, Printer, FileText, Users, Phone, MapPin, Palette, Star, TrendingUp, ChevronDown, ChevronUp, CornerDownRight } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import toast from 'react-hot-toast';
import { compareDates } from '@/lib/reportUtils';

// エリア別の集計データ
type AreaSummary = {
    area: string;
    visits: number;
    calls: number;
    priorityVisits: number;
    priorityCalls: number;
    designProposals: number;
    customers: Set<string>;
};

// 直送先の集計データ
type DirectDeliverySummary = {
    code: string;
    name: string;
    visits: number;
    calls: number;
    designProposals: number;
    lastDate: string;
    area: string;
    rank: string;
    isPriority: boolean;
};

// 重点顧客の集計データ
type PriorityCustomerSummary = {
    code: string;
    name: string;
    visits: number;
    calls: number;
    designProposals: number;
    total: number;
    lastDate: string;
    area: string;
    rank: string;
    isPriority: boolean;
    directDeliveries: DirectDeliverySummary[];
};

// デザイン案件の集計データ
type DesignSummary = {
    status: string;
    count: number;
};

type MonthlySummaryData = {
    totalReports: number;
    totalVisits: number;
    totalCalls: number;
    priorityVisits: number;
    priorityCalls: number;
    totalDesignProposals: number;
    totalDesignCompleted: number;
    totalDesignRejected: number;
    uniqueCustomers: number;
    activeDays: number;
    areaBreakdown: AreaSummary[];
    priorityCustomers: PriorityCustomerSummary[];
    designProgress: DesignSummary[];
    topCustomers: { name: string; count: number; details?: { name: string; count: number }[] }[];
    topCallCustomers: { name: string; count: number; details?: { name: string; count: number }[] }[];
    dailyActivity: { date: string; visits: number; calls: number }[];
};

// 月次サマリーデータを生成する関数
function generateMonthlySummary(reports: Report[], monthPrefix: string): MonthlySummaryData {
    // 対象月のレポートをフィルタ
    const monthReports = reports.filter(r => r.日付 && String(r.日付).startsWith(monthPrefix));

    // 基本統計
    const visits = monthReports.filter(r => r.行動内容?.includes('訪問'));
    const calls = monthReports.filter(r => r.行動内容?.includes('電話'));
    const designProposals = monthReports.filter(r => r.デザイン進捗状況 === '新規' || r.デザイン提案有無 === '有' || r.デザイン提案有無 === 'あり');
    const designCompleted = monthReports.filter(r => r.デザイン進捗状況?.includes('出稿'));
    const designRejected = monthReports.filter(r => r.デザイン進捗状況?.includes('不採用'));

    // ユニーク顧客数
    const uniqueCustomerSet = new Set(
        monthReports.filter(r => r.訪問先名 && r.訪問先名.trim()).map(r => r.訪問先名)
    );

    // 活動日数
    const activeDaySet = new Set(monthReports.map(r => String(r.日付)));

    // エリア別集計
    const areaMap = new Map<string, AreaSummary>();
    monthReports.forEach(r => {
        const isVisit = r.行動内容?.includes('訪問');
        const isCall = r.行動内容?.includes('電話');
        if (!isVisit && !isCall) return;

        const isPriority = r.重点顧客 && r.重点顧客 !== '-' && r.重点顧客 !== '';
        const area = r.エリア && String(r.エリア).trim() ? String(r.エリア).trim() : '未設定';

        if (!areaMap.has(area)) {
            areaMap.set(area, {
                area,
                visits: 0,
                calls: 0,
                priorityVisits: 0,
                priorityCalls: 0,
                designProposals: 0,
                customers: new Set()
            });
        }
        const stats = areaMap.get(area)!;
        if (isVisit) {
            stats.visits++;
            if (isPriority) stats.priorityVisits++;
        }
        if (isCall) {
            stats.calls++;
            if (isPriority) stats.priorityCalls++;
        }
        if (r.デザイン提案有無 === '有' || r.デザイン提案有無 === 'あり') stats.designProposals++;
        if (r.訪問先名) stats.customers.add(r.訪問先名);
    });

    // 重点顧客の月全体集計（KPIカード用など適宜）
    const totalPriorityVisits = monthReports.filter(r =>
        r.重点顧客 && r.重点顧客 !== '-' && r.重点顧客 !== '' && r.行動内容?.includes('訪問')
    ).length;
    const totalPriorityCalls = monthReports.filter(r =>
        r.重点顧客 && r.重点顧客 !== '-' && r.重点顧客 !== '' && r.行動内容?.includes('電話')
    ).length;

    // 重点顧客集計（得意先CDでグループ化し、その中で直送先をネスト）
    const priorityGroupMap = new Map<string, PriorityCustomerSummary>();

    monthReports
        .filter(r => r.重点顧客 && r.重点顧客 !== '-' && r.重点顧客 !== '')
        .forEach(r => {
            const customerCode = r.得意先CD || '不明';
            const ddCode = r.直送先CD ? String(r.直送先CD).replace(/\.0$/, '').trim() : '';
            const ddName = r.直送先名 || '';

            // 親（得意先）のエントリを初期化
            if (!priorityGroupMap.has(customerCode)) {
                priorityGroupMap.set(customerCode, {
                    code: customerCode,
                    name: r.訪問先名 || '不明', // 親の名前
                    visits: 0,
                    calls: 0,
                    designProposals: 0,
                    total: 0,
                    lastDate: '',
                    area: r.エリア || '',
                    rank: r.ランク || '',
                    isPriority: true,
                    directDeliveries: []
                });
            }

            const parent = priorityGroupMap.get(customerCode)!;
            const isVisit = r.行動内容?.includes('訪問');
            const isCall = r.行動内容?.includes('電話');
            const isDesign = r.デザイン提案有無 === '有' || r.デザイン提案有無 === 'あり';
            const date = String(r.日付);

            // 親の集計を更新
            if (isVisit) parent.visits++;
            if (isCall) parent.calls++;
            if (isDesign) parent.designProposals++;
            if (isVisit || isCall) parent.total++;
            if (compareDates(date, parent.lastDate) > 0) parent.lastDate = date;

            // 直送先がある場合のみ子エントリを処理
            if (ddCode) {
                let child = parent.directDeliveries.find(d => d.code === ddCode);
                if (!child) {
                    child = {
                        code: ddCode,
                        name: ddName,
                        visits: 0,
                        calls: 0,
                        designProposals: 0,
                        lastDate: '',
                        area: r.エリア || '',
                        rank: r.ランク || '',
                        isPriority: true
                    };
                    parent.directDeliveries.push(child);
                }
                if (isVisit) child.visits++;
                if (isCall) child.calls++;
                if (isDesign) child.designProposals++;
                if (compareDates(date, child.lastDate) > 0) child.lastDate = date;
            }
        });

    // デザイン進捗集計
    const designStatusMap = new Map<string, number>();
    monthReports
        .filter(r => r.デザイン提案有無 === '有' || r.デザイン提案有無 === 'あり')
        .forEach(r => {
            const status = r.デザイン進捗状況 && r.デザイン進捗状況.trim() ? r.デザイン進捗状況.trim() : '未設定';
            designStatusMap.set(status, (designStatusMap.get(status) || 0) + 1);
        });

    // 訪問回数の多い顧客Top10
    const customerCountMap = new Map<string, { total: number; details: Map<string, number> }>();
    monthReports
        .filter(r => r.訪問先名 && r.行動内容?.includes('訪問'))
        .forEach(r => {
            const name = r.訪問先名;
            const ddName = r.直送先名 || '(直接)';
            if (!customerCountMap.has(name)) {
                customerCountMap.set(name, { total: 0, details: new Map() });
            }
            const stats = customerCountMap.get(name)!;
            stats.total++;
            stats.details.set(ddName, (stats.details.get(ddName) || 0) + 1);
        });

    // 電話回数の多い顧客Top10
    const callCountMap = new Map<string, { total: number; details: Map<string, number> }>();
    monthReports
        .filter(r => r.訪問先名 && r.行動内容?.includes('電話'))
        .forEach(r => {
            const name = r.訪問先名;
            const ddName = r.直送先名 || '(直接)';
            if (!callCountMap.has(name)) {
                callCountMap.set(name, { total: 0, details: new Map() });
            }
            const stats = callCountMap.get(name)!;
            stats.total++;
            stats.details.set(ddName, (stats.details.get(ddName) || 0) + 1);
        });

    // 日別活動集計
    const dailyMap = new Map<string, { visits: number; calls: number }>();
    monthReports.forEach(r => {
        const date = String(r.日付);
        if (!dailyMap.has(date)) dailyMap.set(date, { visits: 0, calls: 0 });
        const day = dailyMap.get(date)!;
        if (r.行動内容?.includes('訪問')) day.visits++;
        if (r.行動内容?.includes('電話')) day.calls++;
    });

    return {
        totalReports: monthReports.length,
        totalVisits: visits.length,
        totalCalls: calls.length,
        priorityVisits: totalPriorityVisits,
        priorityCalls: totalPriorityCalls,
        totalDesignProposals: designProposals.length,
        totalDesignCompleted: designCompleted.length,
        totalDesignRejected: designRejected.length,
        uniqueCustomers: uniqueCustomerSet.size,
        activeDays: activeDaySet.size,
        areaBreakdown: Array.from(areaMap.values()).sort((a, b) => {
            if (a.area === '未設定') return 1;
            if (b.area === '未設定') return -1;
            return (b.visits + b.calls) - (a.visits + a.calls);
        }),
        priorityCustomers: Array.from(priorityGroupMap.values()).sort((a, b) => b.total - a.total),
        designProgress: Array.from(designStatusMap.entries())
            .map(([status, count]) => ({ status, count }))
            .sort((a, b) => b.count - a.count),
        topCustomers: Array.from(customerCountMap.entries())
            .map(([name, stats]) => ({
                name,
                count: stats.total,
                details: Array.from(stats.details.entries())
                    .map(([dName, dCount]) => ({ name: dName, count: dCount }))
                    .sort((a, b) => b.count - a.count)
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10),
        topCallCustomers: Array.from(callCountMap.entries())
            .map(([name, stats]) => ({
                name,
                count: stats.total,
                details: Array.from(stats.details.entries())
                    .map(([dName, dCount]) => ({ name: dName, count: dCount }))
                    .sort((a, b) => b.count - a.count)
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10),
        dailyActivity: Array.from(dailyMap.entries())
            .map(([date, data]) => ({ date, ...data }))
            .sort((a, b) => compareDates(a.date, b.date)),
    };
}

// ファイル名から担当者名を抽出
function extractStaffName(filename: string | null): string {
    if (!filename) return '担当者';
    const match = filename.match(/【(.+?)】/);
    if (!match) return '担当者';
    const content = match[1];
    const nameWithParen = content.match(/^(.+?)（(.+?)）/);
    if (nameWithParen) return nameWithParen[1] + nameWithParen[2];
    const surname = content.match(/^([^\u4e00-\u9fa5]*[\u4e00-\u9fa5]+?)(?:課長|次長|部長|常務|社長|主任|係長|専務|取締役|マネージャー|リーダー|担当|氏)?$/);
    if (surname) return surname[1];
    return content.slice(0, 4);
}

export default function MonthlySummaryPage(): React.ReactElement {
    const { selectedFile } = useFile();
    const { data: reports = [], isLoading } = useReports(selectedFile || undefined);

    const [currentDate, setCurrentDate] = useState(new Date());
    const [collapsedCustomers, setCollapsedCustomers] = useState<Set<string>>(new Set());
    const [mounted, setMounted] = useState(false);
    const printRef = useRef<HTMLDivElement>(null);

    const toggleCustomerCollapse = (code: string): void => {
        setCollapsedCustomers(prev => {
            const next = new Set(prev);
            if (next.has(code)) next.delete(code);
            else next.add(code);
            return next;
        });
    };

    useEffect(() => {
        setMounted(true);
    }, []);

    // 選択中の年月パーツ
    const yearShort = String(currentDate.getFullYear()).slice(-2);
    const monthStr = String(currentDate.getMonth() + 1).padStart(2, '0');
    const monthPrefix = `${yearShort}/${monthStr}`;
    const monthLabel = `${currentDate.getFullYear()}年${currentDate.getMonth() + 1}月`;

    // 担当者名
    const staffName = useMemo(() => extractStaffName(selectedFile), [selectedFile]);

    // 月次サマリーデータをメモ化
    const summary = useMemo(() => generateMonthlySummary(reports, monthPrefix), [reports, monthPrefix]);

    // 月送り
    const handlePreviousMonth = (): void => {
        setCurrentDate(prev => {
            const d = new Date(prev);
            d.setMonth(d.getMonth() - 1);
            return d;
        });
    };
    const handleNextMonth = (): void => {
        setCurrentDate(prev => {
            const d = new Date(prev);
            d.setMonth(d.getMonth() + 1);
            return d;
        });
    };
    const handleThisMonth = (): void => setCurrentDate(new Date());

    // 印刷
    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `月次サマリー_${staffName}_${monthLabel}`,
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sf-light-blue mx-auto mb-4" />
                    <p className="text-sf-text-weak">データを読み込んでいます...</p>
                </div>
            </div>
        );
    }

    // 出稿率の計算
    const acceptanceRate = summary.totalDesignProposals > 0
        ? Math.round((summary.totalDesignCompleted / summary.totalDesignProposals) * 100)
        : 0;

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            {/* ヘッダー（印刷時非表示） */}
            <div className="mb-6 print:hidden">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-1">月次活動サマリー</h1>
                        <p className="text-gray-600">月間の営業活動を自動集計・レポート出力</p>
                    </div>
                    <button
                        onClick={() => handlePrint()}
                        className="flex items-center gap-2 px-5 py-2.5 bg-sf-light-blue text-white rounded-lg hover:bg-blue-600 transition-colors shadow-sm"
                    >
                        <Printer size={18} />
                        印刷 / PDF保存
                    </button>
                </div>
            </div>

            {/* 月選択コントロール（印刷時非表示） */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6 print:hidden">
                <div className="flex items-center justify-between">
                    <button onClick={handlePreviousMonth} className="flex items-center gap-1 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                        <ChevronLeft size={20} /> 前月
                    </button>
                    <div className="flex items-center gap-4">
                        <button onClick={handleThisMonth} className="px-4 py-2 text-sm font-medium text-sf-light-blue hover:bg-blue-50 rounded-lg transition-colors">
                            今月
                        </button>
                        <h2 className="text-2xl font-bold text-gray-900">{monthLabel}</h2>
                    </div>
                    <button onClick={handleNextMonth} className="flex items-center gap-1 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                        次月 <ChevronRight size={20} />
                    </button>
                </div>
            </div>

            {/* ===== 印刷対象エリア ===== */}
            <div ref={printRef} className="space-y-6 print:space-y-4">
                {/* 印刷用ヘッダー */}
                <div className="hidden print:block text-center mb-4">
                    <h1 className="text-2xl font-bold mb-1">月次活動サマリー — {monthLabel}</h1>
                    <p className="text-sm text-gray-600">担当者: {staffName}　｜　出力日: {mounted ? new Date().toLocaleDateString('ja-JP') : ''}</p>
                </div>

                {/* KPIカード群 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:grid-cols-4 print:gap-2">
                    {[
                        { label: '活動日数', value: `${summary.activeDays}日`, icon: FileText, color: 'bg-indigo-50 text-indigo-600' },
                        { label: '訪問件数', value: `${summary.totalVisits}件`, icon: Users, color: 'bg-blue-50 text-blue-600' },
                        { label: '電話件数', value: `${summary.totalCalls}件`, icon: Phone, color: 'bg-green-50 text-green-600' },
                        { label: 'デザイン依頼', value: `${summary.totalDesignProposals}件`, icon: Palette, color: 'bg-purple-50 text-purple-600' },
                        { label: '出稿', value: `${summary.totalDesignCompleted}件`, icon: TrendingUp, color: 'bg-emerald-50 text-emerald-600' },
                        { label: '出稿率', value: `${acceptanceRate}%`, icon: TrendingUp, color: 'bg-orange-50 text-orange-600' },
                        { label: '訪問先数', value: `${summary.uniqueCustomers}社`, icon: MapPin, color: 'bg-teal-50 text-teal-600' },
                        { label: '重点顧客対応', value: `${summary.priorityCustomers.length}社`, icon: Star, color: 'bg-yellow-50 text-yellow-600' },
                    ].map(kpi => (
                        <div key={kpi.label} className="bg-white rounded-lg border border-gray-200 p-4 print:p-2 print:border-gray-300">
                            <div className="flex items-center gap-3 print:gap-2">
                                <div className={`p-2 rounded-lg ${kpi.color} print:p-1`}>
                                    <kpi.icon size={18} className="print:w-4 print:h-4" />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">{kpi.label}</p>
                                    <p className="text-xl font-bold text-gray-900 print:text-lg">{kpi.value}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* エリア別実績テーブル */}
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden print:break-inside-avoid">
                    <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                        <h2 className="font-bold text-gray-900 flex items-center gap-2">
                            <MapPin size={18} className="text-blue-600" />
                            エリア別実績
                        </h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-xs text-gray-500 border-b border-gray-200">
                                <tr>
                                    <th className="px-4 py-3 text-left font-medium whitespace-nowrap">エリア</th>
                                    <th className="px-4 py-3 text-center font-medium whitespace-nowrap">一般訪問</th>
                                    <th className="px-4 py-3 text-center font-medium whitespace-nowrap">一般電話</th>
                                    <th className="px-4 py-3 text-center font-medium whitespace-nowrap">一般合計</th>
                                    <th className="px-4 py-3 text-center font-medium border-l-2 border-yellow-200 bg-yellow-50 whitespace-nowrap">重点顧客訪問</th>
                                    <th className="px-4 py-3 text-center font-medium bg-yellow-50 whitespace-nowrap">重点顧客電話</th>
                                    <th className="px-4 py-3 text-center font-medium bg-yellow-50 whitespace-nowrap">重点顧客合計</th>
                                    <th className="px-4 py-3 text-center font-medium whitespace-nowrap">デザイン依頼</th>
                                    <th className="px-4 py-3 text-center font-medium whitespace-nowrap">総合計<br /><span className="text-[10px] whitespace-nowrap">(デザイン依頼除く)</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {summary.areaBreakdown.map(area => {
                                    const generalVisits = area.visits - area.priorityVisits;
                                    const generalCalls = area.calls - area.priorityCalls;
                                    const generalTotal = generalVisits + generalCalls;
                                    const priorityTotal = area.priorityVisits + area.priorityCalls;

                                    return (
                                        <tr key={area.area} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-2 font-medium text-gray-900 whitespace-nowrap">{area.area}</td>
                                            <td className="px-4 py-2 text-center text-gray-700 whitespace-nowrap">{generalVisits}</td>
                                            <td className="px-4 py-2 text-center text-gray-700 whitespace-nowrap">{generalCalls}</td>
                                            <td className="px-4 py-2 text-center font-semibold text-gray-900 whitespace-nowrap">{generalTotal}</td>
                                            <td className="px-4 py-2 text-center text-purple-600 border-l-2 border-yellow-200 bg-yellow-50/50 whitespace-nowrap">{area.priorityVisits}</td>
                                            <td className="px-4 py-2 text-center text-orange-600 bg-yellow-50/50 whitespace-nowrap">{area.priorityCalls}</td>
                                            <td className="px-4 py-2 text-center font-semibold text-yellow-700 bg-yellow-50/50 whitespace-nowrap">{priorityTotal}</td>
                                            <td className="px-4 py-2 text-center text-purple-600 whitespace-nowrap">{area.designProposals}</td>
                                            <td className="px-4 py-2 text-center font-bold text-blue-700 bg-blue-50/50 whitespace-nowrap">{generalTotal + priorityTotal}</td>
                                        </tr>
                                    );
                                })}
                                {/* 合計行 */}
                                <tr className="bg-blue-50/60 font-semibold border-t-2 border-gray-300">
                                    <td className="px-4 py-2 text-gray-900 whitespace-nowrap">合計</td>
                                    {(() => {
                                        const totalGeneralVisits = summary.totalVisits - summary.priorityVisits;
                                        const totalGeneralCalls = summary.totalCalls - summary.priorityCalls;
                                        const totalGeneral = totalGeneralVisits + totalGeneralCalls;
                                        const totalPriority = summary.priorityVisits + summary.priorityCalls;
                                        return (
                                            <>
                                                <td className="px-4 py-2 text-center text-gray-900 whitespace-nowrap">{totalGeneralVisits}</td>
                                                <td className="px-4 py-2 text-center text-gray-900 whitespace-nowrap">{totalGeneralCalls}</td>
                                                <td className="px-4 py-2 text-center text-gray-900 whitespace-nowrap">{totalGeneral}</td>
                                            </>
                                        );
                                    })()}
                                    <td className="px-4 py-2 text-center text-purple-700 border-l-2 border-yellow-200 bg-yellow-100/60 whitespace-nowrap">{summary.priorityVisits}</td>
                                    <td className="px-4 py-2 text-center text-orange-700 bg-yellow-100/60 whitespace-nowrap">{summary.priorityCalls}</td>
                                    <td className="px-4 py-2 text-center text-yellow-800 bg-yellow-100/60 whitespace-nowrap">{summary.priorityVisits + summary.priorityCalls}</td>
                                    <td className="px-4 py-2 text-center text-purple-700 whitespace-nowrap">{summary.totalDesignProposals}</td>
                                    {(() => {
                                        const totalGeneralVisits = summary.totalVisits - summary.priorityVisits;
                                        const totalGeneralCalls = summary.totalCalls - summary.priorityCalls;
                                        const totalGeneral = totalGeneralVisits + totalGeneralCalls;
                                        const totalPriority = summary.priorityVisits + summary.priorityCalls;
                                        return (
                                            <td className="px-4 py-2 text-center font-bold text-blue-800 bg-blue-100/60 whitespace-nowrap">{totalGeneral + totalPriority}</td>
                                        );
                                    })()}
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 重点顧客活動 */}
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden print:break-inside-avoid">
                    <div className="px-5 py-3 border-b border-gray-200 bg-yellow-50">
                        <h2 className="font-bold text-gray-900 flex items-center gap-2">
                            <Star size={18} className="text-yellow-600" />
                            重点顧客活動 ({summary.priorityCustomers.length}社)
                        </h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-xs text-gray-500 border-b">
                                <tr>
                                    <th className="px-3 py-2 text-left font-semibold w-10 print:hidden"></th>
                                    <th className="px-3 py-2 text-left font-semibold">得意先CD</th>
                                    <th className="px-3 py-2 text-left font-semibold">顧客名</th>
                                    <th className="px-3 py-2 text-left font-semibold">エリア</th>
                                    <th className="px-3 py-2 text-center font-semibold">ランク</th>
                                    <th className="px-3 py-2 text-center font-semibold">重点</th>
                                    <th className="px-3 py-2 text-center font-semibold">合計</th>
                                    <th className="px-3 py-2 text-center font-semibold">訪問</th>
                                    <th className="px-3 py-2 text-center font-semibold">電話</th>
                                    <th className="px-3 py-2 text-center font-semibold">デザイン</th>
                                    <th className="px-3 py-2 text-center font-semibold">最終日</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {summary.priorityCustomers.map(pc => {
                                    const isCollapsed = collapsedCustomers.has(pc.code);
                                    const isExpanded = !isCollapsed;
                                    const hasDirectDeliveries = pc.directDeliveries.length > 0;

                                    return (
                                        <React.Fragment key={pc.code}>
                                            {/* 親行（得意先） */}
                                            <tr className="hover:bg-gray-50 group">
                                                <td className="px-3 py-2 text-center print:hidden">
                                                    {hasDirectDeliveries && (
                                                        <button
                                                            onClick={() => toggleCustomerCollapse(pc.code)}
                                                            className="p-1 hover:bg-gray-200 rounded transition-colors"
                                                        >
                                                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                        </button>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 text-gray-500 font-mono text-xs">{pc.code}</td>
                                                <td className="px-3 py-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-gray-900 font-bold">{pc.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2 text-gray-600 text-xs">{pc.area}</td>
                                                <td className="px-3 py-2 text-center">
                                                    {pc.rank && (
                                                        <span className="inline-block px-1.5 py-0.5 rounded border border-gray-300 text-[10px] font-bold text-gray-500 bg-gray-50">
                                                            {pc.rank}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-yellow-100 text-yellow-700">
                                                        重点
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 text-center font-bold text-gray-900">{pc.total}</td>
                                                <td className="px-3 py-2 text-center text-blue-600 font-medium">{pc.visits}</td>
                                                <td className="px-3 py-2 text-center text-green-600 font-medium">{pc.calls}</td>
                                                <td className="px-3 py-2 text-center text-purple-600 font-medium">{pc.designProposals}</td>
                                                <td className="px-3 py-2 text-center text-gray-500 text-[10px]">{pc.lastDate}</td>
                                            </tr>

                                            {/* 子行（直送先） - 展開時のみ表示 */}
                                            {(isExpanded || !mounted) && pc.directDeliveries.map(dd => (
                                                <tr key={`${pc.code}-${dd.code}`} className="bg-gray-50/50 border-l-4 border-gray-200">
                                                    <td className="px-3 py-1.5 print:hidden"></td>
                                                    <td className="px-3 py-1.5 text-gray-400 font-mono text-[10px] pl-6 flex items-center gap-1">
                                                        <CornerDownRight size={12} /> {dd.code}
                                                    </td>
                                                    <td className="px-3 py-1.5">
                                                        <div className="flex items-center gap-2">
                                                            <span className="px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded text-[10px] font-bold whitespace-nowrap">直送</span>
                                                            <span className="text-gray-700 text-sm">{dd.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-1.5 text-gray-500 text-[10px]">{dd.area}</td>
                                                    <td className="px-3 py-1.5 text-center">
                                                        {dd.rank && (
                                                            <span className="inline-block px-1 py-0.5 rounded border border-gray-200 text-[10px] font-bold text-gray-400">
                                                                {dd.rank}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-1.5 text-center">
                                                        <span className="inline-block px-1 py-0.5 rounded text-[10px] font-bold bg-yellow-50 text-yellow-600 opacity-70">
                                                            重点
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-1.5 text-center text-gray-400 text-xs">
                                                        {dd.visits + dd.calls}
                                                    </td>
                                                    <td className="px-3 py-1.5 text-center text-blue-400 text-xs">{dd.visits}</td>
                                                    <td className="px-3 py-1.5 text-center text-green-400 text-xs">{dd.calls}</td>
                                                    <td className="px-3 py-1.5 text-center text-purple-400 text-xs">{dd.designProposals}</td>
                                                    <td className="px-3 py-1.5 text-center text-gray-400 text-[10px]">{dd.lastDate}</td>
                                                </tr>
                                            ))}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* ランキングセクション */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-2 print:gap-4">
                    {/* 訪問回数Top10 */}
                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden print:break-inside-avoid">
                        <div className="px-5 py-3 border-b border-gray-200 bg-blue-50">
                            <h2 className="font-bold text-gray-900 flex items-center gap-2">
                                <Users size={18} className="text-blue-600" />
                                訪問回数ランキング (Top10)
                            </h2>
                        </div>
                        {summary.topCustomers.length === 0 ? (
                            <p className="p-4 text-gray-400 text-sm text-center">訪問データなし</p>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {summary.topCustomers.map((c, idx) => (
                                    <div key={c.name} className="px-4 py-2.5 hover:bg-gray-50 transition-colors">
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-3">
                                                <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${idx < 3 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                                                    }`}>
                                                    {idx + 1}
                                                </span>
                                                <span className="text-sm text-gray-900 font-bold truncate max-w-[200px]" title={c.name}>{c.name}</span>
                                            </div>
                                            <span className="text-sm font-bold text-sf-light-blue">{c.count}回</span>
                                        </div>
                                        {/* 直送先内訳 */}
                                        {c.details && c.details.length > 0 && !(c.details.length === 1 && c.details[0].name === '(直接)') && (
                                            <div className="ml-9 flex flex-wrap gap-x-3 gap-y-1">
                                                {c.details.map(d => (
                                                    <div key={d.name} className="flex items-center gap-1 text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                                        <span className="truncate max-w-[120px]">{d.name}</span>
                                                        <span className="font-bold text-gray-700">{d.count}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 電話回数Top10 */}
                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden print:break-inside-avoid">
                        <div className="px-5 py-3 border-b border-gray-200 bg-green-50">
                            <h2 className="font-bold text-gray-900 flex items-center gap-2">
                                <Phone size={18} className="text-green-600" />
                                電話回数ランキング (Top10)
                            </h2>
                        </div>
                        {summary.topCallCustomers.length === 0 ? (
                            <p className="p-4 text-gray-400 text-sm text-center">電話データなし</p>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {summary.topCallCustomers.map((c, idx) => (
                                    <div key={c.name} className="px-4 py-2.5 hover:bg-gray-50 transition-colors">
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-3">
                                                <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${idx < 3 ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'
                                                    }`}>
                                                    {idx + 1}
                                                </span>
                                                <span className="text-sm text-gray-900 font-bold truncate max-w-[200px]" title={c.name}>{c.name}</span>
                                            </div>
                                            <span className="text-sm font-bold text-green-600">{c.count}回</span>
                                        </div>
                                        {/* 直送先内訳 */}
                                        {c.details && c.details.length > 0 && !(c.details.length === 1 && c.details[0].name === '(直接)') && (
                                            <div className="ml-9 flex flex-wrap gap-x-3 gap-y-1">
                                                {c.details.map(d => (
                                                    <div key={d.name} className="flex items-center gap-1 text-[10px] text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                                                        <span className="truncate max-w-[120px]">{d.name}</span>
                                                        <span className="font-bold text-gray-700">{d.count}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* デザイン進捗状況 */}
                {summary.designProgress.length > 0 && (
                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden print:break-inside-avoid">
                        <div className="px-5 py-3 border-b border-gray-200 bg-purple-50">
                            <h2 className="font-bold text-gray-900 flex items-center gap-2">
                                <Palette size={18} className="text-purple-600" />
                                デザイン進捗状況
                            </h2>
                        </div>
                        <div className="p-4">
                            <div className="flex flex-wrap gap-3">
                                {summary.designProgress.map(dp => (
                                    <div key={dp.status} className="flex items-center gap-2 bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
                                        <span className="text-sm text-gray-700">{dp.status}</span>
                                        <span className="text-lg font-bold text-purple-600">{dp.count}件</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* 日別活動一覧 */}
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden print:break-inside-avoid">
                    <div className="px-5 py-3 border-b border-gray-200 bg-gray-50">
                        <h2 className="font-bold text-gray-900 flex items-center gap-2">
                            <FileText size={18} className="text-gray-600" />
                            日別活動一覧
                        </h2>
                    </div>
                    {summary.dailyActivity.length === 0 ? (
                        <p className="p-4 text-gray-400 text-sm text-center">この月のデータはありません</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-xs text-gray-500 border-b">
                                    <tr>
                                        <th className="px-4 py-2 text-left font-semibold">日付</th>
                                        <th className="px-4 py-2 text-center font-semibold">訪問</th>
                                        <th className="px-4 py-2 text-center font-semibold">電話</th>
                                        <th className="px-4 py-2 text-center font-semibold">合計</th>
                                        <th className="px-4 py-2 text-left font-semibold">活動バー</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {summary.dailyActivity.map(day => {
                                        const total = day.visits + day.calls;
                                        // 活動バーの最大幅計算（最大値を基準）
                                        const maxTotal = Math.max(...summary.dailyActivity.map(d => d.visits + d.calls), 1);
                                        const barWidth = Math.round((total / maxTotal) * 100);
                                        return (
                                            <tr key={day.date} className="border-b border-gray-100 hover:bg-gray-50">
                                                <td className="px-4 py-2 font-medium text-gray-900">{day.date}</td>
                                                <td className="px-4 py-2 text-center text-blue-600">{day.visits}</td>
                                                <td className="px-4 py-2 text-center text-green-600">{day.calls}</td>
                                                <td className="px-4 py-2 text-center font-semibold text-gray-900">{total}</td>
                                                <td className="px-4 py-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex h-4 rounded-full overflow-hidden" style={{ width: `${barWidth}%`, minWidth: total > 0 ? '8px' : '0' }}>
                                                            {day.visits > 0 && (
                                                                <div className="bg-blue-400 h-full" style={{ width: `${(day.visits / total) * 100}%` }} />
                                                            )}
                                                            {day.calls > 0 && (
                                                                <div className="bg-green-400 h-full" style={{ width: `${(day.calls / total) * 100}%` }} />
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* 印刷フッター */}
                <div className="hidden print:block text-center text-xs text-gray-400 border-t border-gray-200 pt-3 mt-6">
                    <p>Sales Support — 月次活動サマリー — {monthLabel} — {staffName}</p>
                </div>
            </div>
        </div>
    );
}
