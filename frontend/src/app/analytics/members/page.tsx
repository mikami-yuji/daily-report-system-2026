'use client';

import React, { useState, useMemo } from 'react';
import { useReports } from '@/hooks/useQueryHooks'; // Reuse existing hook or fetch directly
import { Search, MapPin, Users, Phone, Filter, Download, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import axios from 'axios';

type TeamRecord = {
    staff: string;
    area: string;
    category: string;
    visits: number;
    calls: number;
    file: string;
};

export default function TeamMemberAnalysisPage() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [loading, setLoading] = useState(false);
    const [hasFetched, setHasFetched] = useState(false);
    const [records, setRecords] = useState<TeamRecord[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [areaFilter, setAreaFilter] = useState('すべて');
    const [mounted, setMounted] = useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    const monthPrefix = useMemo(() => {
        const yearShort = String(currentDate.getFullYear()).slice(-2);
        const monthStr = String(currentDate.getMonth() + 1).padStart(2, '0');
        return `${yearShort}/${monthStr}`;
    }, [currentDate]);

    const monthLabel = `${currentDate.getFullYear()}年${currentDate.getMonth() + 1}月`;

    // Fetch data manually via click
    const fetchData = async () => {
        setLoading(true);
        setHasFetched(true);
        try {
            const res = await axios.get(`/api/analytics/team-summary`, {
                params: { month: monthPrefix }
            });
            setRecords(res.data.records || []);
        } catch (error) {
            console.error('Failed to fetch team summary:', error);
            setRecords([]);
        } finally {
            setTimeout(() => setLoading(false), 300);
        }
    };

    // Remove auto-useEffect for fetching. Reset fetched state when month changes so user knows to click again.
    React.useEffect(() => {
        setHasFetched(false);
        setRecords([]);
    }, [monthPrefix]);

    // Filters
    const filteredRecords = useMemo(() => {
        return records.filter(r => {
            const matchesSearch = r.staff.includes(searchTerm) || r.area.includes(searchTerm);
            const matchesArea = areaFilter === 'すべて' || r.area === areaFilter;
            return matchesSearch && matchesArea;
        });
    }, [records, searchTerm, areaFilter]);

    // Grouping by staff
    const groupedData = useMemo(() => {
        const groups: Record<string, TeamRecord[]> = {};
        filteredRecords.forEach(r => {
            if (!groups[r.staff]) groups[r.staff] = [];
            groups[r.staff].push(r);
        });

        // Sort each group so '重点' comes before '一般', and then by area alphabetically
        Object.keys(groups).forEach(staff => {
            groups[staff].sort((a, b) => {
                if (a.category === '重点' && b.category !== '重点') return -1;
                if (a.category !== '重点' && b.category === '重点') return 1;
                // Secondary sort by area name
                if (a.area < b.area) return -1;
                if (a.area > b.area) return 1;
                return 0;
            });
        });

        return groups;
    }, [filteredRecords]);

    // Averages calculation for the current filtered view
    const averages = useMemo(() => {
        if (filteredRecords.length === 0) return { visits: 0, calls: 0, total: 0 };
        const staffNames = Object.keys(groupedData);
        if (staffNames.length === 0) return { visits: 0, calls: 0, total: 0 };

        let totalVisits = 0;
        let totalCalls = 0;

        filteredRecords.forEach(r => {
            totalVisits += r.visits;
            totalCalls += r.calls;
        });

        const numStaff = staffNames.length;
        return {
            visits: totalVisits / numStaff,
            calls: totalCalls / numStaff,
            total: (totalVisits + totalCalls) / numStaff
        };
    }, [filteredRecords, groupedData]);

    const cellClass = (val: number, isVisit: boolean, isTotal: boolean = false) => {
        const avg = isTotal ? averages.total : (isVisit ? averages.visits : averages.calls);
        const base = "font-medium";
        if (val < avg) return `${base} text-red-500`; // Below average
        if (isTotal) return `${base} font-bold text-gray-900 text-base`;
        return `${base} ${isVisit ? 'text-blue-600' : 'text-green-600'}`;
    };

    // Unique areas for filter
    const uniqueAreas = useMemo(() => {
        const areas = new Set(records.map(r => r.area));
        return ['すべて', ...Array.from(areas)].sort();
    }, [records]);

    // Month navigation
    const handlePreviousMonth = () => {
        setCurrentDate(prev => {
            const d = new Date(prev);
            d.setMonth(d.getMonth() - 1);
            return d;
        });
    };
    const handleNextMonth = () => {
        setCurrentDate(prev => {
            const d = new Date(prev);
            d.setMonth(d.getMonth() + 1);
            return d;
        });
    };

    const handleExportCSV = () => {
        if (filteredRecords.length === 0) return;

        // BOM for Excel
        const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
        const headers = ['担当者', 'エリア', '区分', '訪問件数', '電話件数', '合計', 'ファイル名'];
        const csvRows = [headers.join(',')];

        // Format data
        Object.keys(groupedData).forEach(staff => {
            groupedData[staff].forEach(r => {
                const row = [
                    `"${r.staff}"`,
                    `"${r.area}"`,
                    `"${r.category}"`,
                    r.visits,
                    r.calls,
                    r.visits + r.calls,
                    `"${r.file}"`
                ];
                csvRows.push(row.join(','));
            });
        });

        const blob = new Blob([bom, csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `活動集計_${monthPrefix.replace('/', '')}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (!mounted) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sf-light-blue"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6 pb-20">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">全メンバー活動分析</h1>
                        <p className="text-sm text-gray-500">全部署・全担当者の日報データを一括集計</p>
                    </div>

                    <div className="flex items-center gap-3 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
                        <button onClick={handlePreviousMonth} className="p-2 hover:bg-gray-100 rounded-md transition-colors text-gray-600">
                            <ChevronLeft size={20} />
                        </button>
                        <span className="font-bold text-lg px-4 min-w-[120px] text-center">{monthLabel}</span>
                        <button onClick={handleNextMonth} className="p-2 hover:bg-gray-100 rounded-md transition-colors text-gray-600">
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>

                {/* Filters/Actions Bar */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-1 items-center gap-4 min-w-[300px]">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="担当者名またはエリアで検索..."
                                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-sf-light-blue outline-none text-sm"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <Filter size={18} className="text-gray-400" />
                            <select
                                className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sf-light-blue"
                                value={areaFilter}
                                onChange={(e) => setAreaFilter(e.target.value)}
                            >
                                {uniqueAreas.map(area => (
                                    <option key={area} value={area}>{area}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {hasFetched && filteredRecords.length > 0 && (
                            <button
                                onClick={handleExportCSV}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors text-sm font-medium shadow-sm"
                            >
                                <Download size={18} />
                                CSV出力
                            </button>
                        )}
                        <button
                            onClick={fetchData}
                            disabled={loading}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg transition-colors text-sm font-bold shadow-sm ${loading ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-sf-light-blue text-white hover:bg-blue-600'}`}
                        >
                            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ArrowUpDown size={18} />}
                            {loading ? '集計中...' : hasFetched ? '再集計' : '集計開始'}
                        </button>
                    </div>
                </div>

                {/* Main Content Table */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden min-h-[400px]">
                    {!hasFetched ? (
                        <div className="py-32 flex flex-col items-center justify-center text-center px-4">
                            <div className="w-16 h-16 bg-blue-50 text-sf-light-blue rounded-full flex items-center justify-center mb-4">
                                <ArrowUpDown size={32} strokeWidth={1.5} />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-2">集計データがありません</h3>
                            <p className="text-gray-500 max-w-sm">
                                「集計開始」ボタンをクリックすると、指定した月の全員の活動データが一括で読み込まれます。<br />
                                <span className="text-xs text-red-500 mt-2 block">※平均値を下回る数値は赤字で表示されます。</span>
                            </p>
                        </div>
                    ) : loading ? (
                        <div className="py-32 flex flex-col items-center justify-center">
                            <div className="w-12 h-12 border-4 border-gray-100 border-t-sf-light-blue rounded-full animate-spin mb-4" />
                            <p className="text-gray-500 animate-pulse text-sm">全エクセルファイルからデータを集計中...</p>
                        </div>
                    ) : filteredRecords.length === 0 ? (
                        <div className="py-32 text-center">
                            <p className="text-gray-400">データが見つかりませんでした。</p>
                        </div>
                    ) : (
                        <div className="overflow-auto max-h-[600px] relative border-t border-gray-200">
                            <table className="w-full text-left text-sm border-collapse">
                                <thead>
                                    <tr className="bg-gray-100 text-gray-600 font-bold sticky top-0 z-10 shadow-sm border-b border-gray-200">
                                        <th className="px-6 py-4 w-1/4 bg-gray-100">担当者 / エリア</th>
                                        <th className="px-6 py-4 text-center bg-gray-100">区分</th>
                                        <th className="px-6 py-4 text-right bg-gray-100">
                                            訪問件数
                                            <div className="text-[10px] font-normal text-gray-400 mt-0.5">平均: {averages.visits.toFixed(1)}</div>
                                        </th>
                                        <th className="px-6 py-4 text-right bg-gray-100">
                                            電話件数
                                            <div className="text-[10px] font-normal text-gray-400 mt-0.5">平均: {averages.calls.toFixed(1)}</div>
                                        </th>
                                        <th className="px-6 py-4 text-right bg-gray-100">
                                            総合計
                                            <div className="text-[10px] font-normal text-gray-400 mt-0.5">平均: {averages.total.toFixed(1)}</div>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(groupedData).map(([staff, staffRecords]) => {
                                        // Calculate subtotals
                                        const priorityTotal = { visits: 0, calls: 0 };
                                        const generalTotal = { visits: 0, calls: 0 };
                                        let staffFile = '';

                                        staffRecords.forEach(r => {
                                            staffFile = r.file; // usually same for all records of a staff
                                            if (r.category === '重点') {
                                                priorityTotal.visits += r.visits;
                                                priorityTotal.calls += r.calls;
                                            } else {
                                                generalTotal.visits += r.visits;
                                                generalTotal.calls += r.calls;
                                            }
                                        });

                                        const grandTotalVisits = priorityTotal.visits + generalTotal.visits;
                                        const grandTotalCalls = priorityTotal.calls + generalTotal.calls;

                                        return (
                                            <React.Fragment key={staff}>
                                                {/* Staff Header Row */}
                                                <tr className="bg-gray-50/50 border-t border-gray-200">
                                                    <td colSpan={5} className="px-6 py-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className="font-bold text-gray-900 text-base">{staff}</div>
                                                            <div className="text-xs text-gray-400 border border-gray-200 bg-white px-2 py-0.5 rounded-full">{staffFile}</div>
                                                        </div>
                                                    </td>
                                                </tr>

                                                {/* Individual Detail Rows and inline Subtotals */}
                                                {staffRecords.map((record, idx) => {
                                                    const isPriority = record.category === '重点';
                                                    const nextRecord = staffRecords[idx + 1];
                                                    const isLastPriority = isPriority && (!nextRecord || nextRecord.category !== '重点');
                                                    const isLastGeneral = !isPriority && (!nextRecord || nextRecord.category === '重点'); // Though sorted, just in case

                                                    return (
                                                        <React.Fragment key={`${staff}-${record.area}-${record.category}-${idx}`}>
                                                            <tr className="border-t border-gray-100 hover:bg-blue-50/20 transition-colors">
                                                                <td className="px-6 py-2.5 pl-10 text-gray-600">
                                                                    <div className="flex items-center gap-1.5 text-sm">
                                                                        <MapPin size={14} className="text-gray-300" />
                                                                        {record.area}
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-2.5 text-center">
                                                                    <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold ${record.category === '重点'
                                                                        ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                                                                        : 'bg-gray-50 text-gray-500 border border-gray-200'
                                                                        }`}>
                                                                        {record.category}
                                                                    </span>
                                                                </td>
                                                                <td className={`px-6 py-2.5 text-right font-medium text-gray-500`}>
                                                                    {record.visits}
                                                                </td>
                                                                <td className={`px-6 py-2.5 text-right font-medium text-gray-500`}>
                                                                    {record.calls}
                                                                </td>
                                                                <td className="px-6 py-2.5 text-right font-medium text-gray-600 bg-gray-50/30">
                                                                    {record.visits + record.calls}
                                                                </td>
                                                            </tr>

                                                            {/* Insert Priority Subtotal immediately after the last priority record */}
                                                            {isLastPriority && (priorityTotal.visits > 0 || priorityTotal.calls > 0) && (
                                                                <tr className="bg-yellow-50/30 border-t border-yellow-100 text-sm">
                                                                    <td className="px-6 py-2 pl-12 text-yellow-800 font-medium">重点 小計</td>
                                                                    <td className="px-6 py-2 text-center text-xs text-yellow-600">重点</td>
                                                                    <td className="px-6 py-2 text-right font-bold text-yellow-700">{priorityTotal.visits}</td>
                                                                    <td className="px-6 py-2 text-right font-bold text-yellow-700">{priorityTotal.calls}</td>
                                                                    <td className="px-6 py-2 text-right font-bold text-yellow-800 bg-yellow-100/30">{priorityTotal.visits + priorityTotal.calls}</td>
                                                                </tr>
                                                            )}

                                                            {/* Insert General Subtotal immediately after the last general record */}
                                                            {isLastGeneral && (generalTotal.visits > 0 || generalTotal.calls > 0) && (
                                                                <tr className="bg-gray-50 border-t border-gray-100 text-sm">
                                                                    <td className="px-6 py-2 pl-12 text-gray-600 font-medium">一般 小計</td>
                                                                    <td className="px-6 py-2 text-center text-xs text-gray-400">一般</td>
                                                                    <td className="px-6 py-2 text-right font-bold text-gray-600">{generalTotal.visits}</td>
                                                                    <td className="px-6 py-2 text-right font-bold text-gray-600">{generalTotal.calls}</td>
                                                                    <td className="px-6 py-2 text-right font-bold text-gray-700 bg-gray-100/50">{generalTotal.visits + generalTotal.calls}</td>
                                                                </tr>
                                                            )}
                                                        </React.Fragment>
                                                    );
                                                })}

                                                {/* Grand Total per staff (Calculates vs Average) */}
                                                <tr className="bg-blue-50/40 border-t-2 border-blue-100">
                                                    <td colSpan={2} className="px-6 py-3 font-bold text-blue-900 text-right">
                                                        {staff} 総合計
                                                    </td>
                                                    <td className={`px-6 py-3 text-right bg-white/50 ${cellClass(grandTotalVisits, true)}`}>
                                                        {grandTotalVisits}
                                                    </td>
                                                    <td className={`px-6 py-3 text-right bg-white/50 ${cellClass(grandTotalCalls, false)}`}>
                                                        {grandTotalCalls}
                                                    </td>
                                                    <td className={`px-6 py-3 text-right bg-blue-100/30 ${cellClass(grandTotalVisits + grandTotalCalls, true, true)}`}>
                                                        {grandTotalVisits + grandTotalCalls}
                                                    </td>
                                                </tr>
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Footer Tip */}
                <div className="mt-4 flex items-center gap-2 text-xs text-gray-400 bg-white border border-gray-200 p-3 rounded-lg w-fit shadow-sm">
                    <Filter size={14} className="text-sf-light-blue" />
                    <span>各担当者のファイルからデータを集計します。再集計するには常にボタンをクリックしてください。赤字は全体平均を下回る数値を示します。</span>
                </div>
            </div>
        </div>
    );
}
