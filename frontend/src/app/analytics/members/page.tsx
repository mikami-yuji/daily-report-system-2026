'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Search, Download, ArrowUpDown, ChevronLeft, ChevronRight, Award, BarChart3, HelpCircle, Calendar, RefreshCw } from 'lucide-react';
import axios from 'axios';
import { PointsRecord, MonthlyActivity, TeamSummaryRecord } from '@/types/analytics';

export default function DailyReportPointsTablePage() {
    // 画面全体ステート
    const [activeTab, setActiveTab] = useState<'points' | 'summary'>('points');
    const [mounted, setMounted] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // --- Tab 1: 日報点数表用のステート ---
    const [loadingPoints, setLoadingPoints] = useState(false);
    const [pointsRecords, setPointsRecords] = useState<PointsRecord[]>([]);
    const [targetMonths, setTargetMonths] = useState<number>(7); // デフォルト: 7ヶ月分 (月200点×7 = 1400点)
    const [onlyShowActiveMonths, setOnlyShowActiveMonths] = useState(true); // 実績のある月のみ表示

    // --- Tab 2: 活動集計用のステート ---
    const [loadingSummary, setLoadingSummary] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState<string>('26/05'); // デフォルトは5月（26/05）
    const [teamSummaryRecords, setTeamSummaryRecords] = useState<TeamSummaryRecord[]>([]);
    const [sortField, setSortField] = useState<keyof TeamSummaryRecord | 'total'>('staff');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [downloadingExcel, setDownloadingExcel] = useState(false);

    // 月度のリスト定義
    const monthOptions = useMemo(() => [
        { code: '26/02', label: '2026年2月' },
        { code: '26/03', label: '2026年3月' },
        { code: '26/04', label: '2026年4月' },
        { code: '26/05', label: '2026年5月' },
        { code: '26/06', label: '2026年6月' },
        { code: '26/07', label: '2026年7月' },
        { code: '26/08', label: '2026年8月' },
        { code: '26/09', label: '2026年9月' },
        { code: '26/10', label: '2026年10月' },
        { code: '26/11', label: '2026年11月' },
        { code: '26/12', label: '2026年12月' },
        { code: '27/01', label: '2027年1月' }
    ], []);

    useEffect(() => {
        setMounted(true);
        // 初回ロード時に日報点数表と活動集計の両方をロード
        fetchPointsTable(7);
        fetchTeamSummary('26/05');
    }, []);

    // 日報点数表データ取得
    const fetchPointsTable = async (monthsCount: number): Promise<void> => {
        setLoadingPoints(true);
        try {
            const res = await axios.get(`/api/analytics/points-table`, {
                params: { target_months_count: monthsCount }
            });
            setPointsRecords(res.data.records || []);
        } catch (error) {
            console.error('Failed to fetch points table:', error);
            setPointsRecords([]);
        } finally {
            setTimeout(() => setLoadingPoints(false), 200);
        }
    };

    // 活動集計データ取得
    const fetchTeamSummary = async (monthCode: string): Promise<void> => {
        setLoadingSummary(true);
        try {
            const res = await axios.get('/api/analytics/team-summary', {
                params: { month: monthCode }
            });
            setTeamSummaryRecords(res.data.records || []);
        } catch (error) {
            console.error('Failed to fetch team summary:', error);
            setTeamSummaryRecords([]);
        } finally {
            setTimeout(() => setLoadingSummary(false), 200);
        }
    };

    // 再集計トリガー
    const handleRecalculate = (): void => {
        if (activeTab === 'points') {
            fetchPointsTable(targetMonths);
        } else {
            fetchTeamSummary(selectedMonth);
        }
    };

    // 集計対象月数（倍率）変更時
    const handleTargetMonthsChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
        const val = Number(e.target.value);
        setTargetMonths(val);
        fetchPointsTable(val);
    };

    // 活動集計の月度選択変更時
    const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
        const code = e.target.value;
        setSelectedMonth(code);
        fetchTeamSummary(code);
    };

    // --- Tab 1: 日報点数表の絞り込みと集計ロジック ---
    const filteredPointsRecords = useMemo((): PointsRecord[] => {
        return pointsRecords.filter(r => 
            r.staff.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [pointsRecords, searchTerm]);

    const allMonths = useMemo((): string[] => [
        "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月", "1月"
    ], []);

    const activeMonths = useMemo((): string[] => {
        if (pointsRecords.length === 0) return ["2月", "3月", "4月", "5月"];
        return allMonths.filter(month => {
            return pointsRecords.some(r => {
                const m = r.monthly_data[month];
                return m && (m.priority_calls > 0 || m.general_calls > 0 || m.priority_visits > 0 || m.general_visits > 0);
            });
        });
    }, [pointsRecords, allMonths]);

    const displayMonths = useMemo((): string[] => {
        return onlyShowActiveMonths ? activeMonths : allMonths;
    }, [onlyShowActiveMonths, activeMonths, allMonths]);

    const pointsSummaryData = useMemo(() => {
        const count = filteredPointsRecords.length;
        const total = {
            priority_count: 0,
            monthly: {} as Record<string, MonthlyActivity>,
            totals: {
                priority_calls: 0,
                general_calls: 0,
                total_calls: 0,
                priority_visits: 0,
                general_visits: 0,
                total_visits: 0
            },
            points: 0,
            achievement_rate: 0,
            rating: 0
        };

        displayMonths.forEach(m => {
            total.monthly[m] = { priority_calls: 0, general_calls: 0, priority_visits: 0, general_visits: 0 };
        });

        filteredPointsRecords.forEach(r => {
            total.priority_count += r.priority_count || 0;
            displayMonths.forEach(m => {
                const act = r.monthly_data[m];
                if (act) {
                    total.monthly[m].priority_calls += act.priority_calls;
                    total.monthly[m].general_calls += act.general_calls;
                    total.monthly[m].priority_visits += act.priority_visits;
                    total.monthly[m].general_visits += act.general_visits;
                }
            });

            total.totals.priority_calls += r.totals.priority_calls;
            total.totals.general_calls += r.totals.general_calls;
            total.totals.total_calls += r.totals.total_calls;
            total.totals.priority_visits += r.totals.priority_visits;
            total.totals.general_visits += r.totals.general_visits;
            total.totals.total_visits += r.totals.total_visits;

            total.points += r.points;
            total.achievement_rate += r.achievement_rate;
            total.rating += r.rating;
        });

        const avg = {
            priority_count: count > 0 ? total.priority_count / count : 0,
            monthly: {} as Record<string, { priority_calls: number; general_calls: number; priority_visits: number; general_visits: number }>,
            totals: {
                priority_calls: count > 0 ? total.totals.priority_calls / count : 0,
                general_calls: count > 0 ? total.totals.general_calls / count : 0,
                total_calls: count > 0 ? total.totals.total_calls / count : 0,
                priority_visits: count > 0 ? total.totals.priority_visits / count : 0,
                general_visits: count > 0 ? total.totals.general_visits / count : 0,
                total_visits: count > 0 ? total.totals.total_visits / count : 0
            },
            points: count > 0 ? total.points / count : 0,
            achievement_rate: count > 0 ? total.points / count / (200 * targetMonths) * 100 : 0,
            rating: count > 0 ? (total.points / count) / 140 : 0
        };

        displayMonths.forEach(m => {
            const t = total.monthly[m];
            avg.monthly[m] = {
                priority_calls: count > 0 ? t.priority_calls / count : 0,
                general_calls: count > 0 ? t.general_calls / count : 0,
                priority_visits: count > 0 ? t.priority_visits / count : 0,
                general_visits: count > 0 ? t.general_visits / count : 0
            };
        });

        return { total, avg };
    }, [filteredPointsRecords, displayMonths, targetMonths]);

    // CSV出力: 日報点数表
    const handleExportPointsCSV = (): void => {
        if (filteredPointsRecords.length === 0) return;
        const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
        
        const row1 = ['営業名', '重点件数'];
        const row2 = ['', ''];
        
        displayMonths.forEach(m => {
            row1.push(m, '', '', '');
            row2.push('重点電話', '一般電話', '重点訪問', '一般訪問');
        });
        
        row1.push('累計', '', '', '', '', '', '点数', `月200点×${targetMonths}(${200 * targetMonths})`, '点数');
        row2.push('重点電話総数', '一般電話総数', '総電話件数', '重点訪問総数', '一般訪問総数', '総訪問件数', '総合点数', '達成率', '評価レート');

        const csvRows = [
            row1.join(','),
            row2.join(',')
        ];

        filteredPointsRecords.forEach(r => {
            const dataRow = [
                `"${r.staff}"`,
                r.priority_count
            ];
            
            displayMonths.forEach(m => {
                const act = r.monthly_data[m] || { priority_calls: 0, general_calls: 0, priority_visits: 0, general_visits: 0 };
                dataRow.push(
                    String(act.priority_calls),
                    String(act.general_calls),
                    String(act.priority_visits),
                    String(act.general_visits)
                );
            });
            
            dataRow.push(
                String(r.totals.priority_calls),
                String(r.totals.general_calls),
                String(r.totals.total_calls),
                String(r.totals.priority_visits),
                String(r.totals.general_visits),
                String(r.totals.total_visits),
                String(r.points),
                `"${r.achievement_rate}%"`,
                String(r.rating)
            );
            csvRows.push(dataRow.join(','));
        });

        const totalRow = [`"合計"`, pointsSummaryData.total.priority_count];
        displayMonths.forEach(m => {
            const t = pointsSummaryData.total.monthly[m];
            totalRow.push(String(t.priority_calls), String(t.general_calls), String(t.priority_visits), String(t.general_visits));
        });
        totalRow.push(
            String(pointsSummaryData.total.totals.priority_calls),
            String(pointsSummaryData.total.totals.general_calls),
            String(pointsSummaryData.total.totals.total_calls),
            String(pointsSummaryData.total.totals.priority_visits),
            String(pointsSummaryData.total.totals.general_visits),
            String(pointsSummaryData.total.totals.total_visits),
            String(pointsSummaryData.total.points),
            `"${pointsSummaryData.total.achievement_rate.toFixed(1)}%"`,
            String(pointsSummaryData.total.rating.toFixed(1))
        );
        csvRows.push(totalRow.join(','));

        const avgRow = [`"平均点"`, pointsSummaryData.avg.priority_count.toFixed(1)];
        displayMonths.forEach(m => {
            const a = pointsSummaryData.avg.monthly[m];
            avgRow.push(a.priority_calls.toFixed(1), a.general_calls.toFixed(1), a.priority_visits.toFixed(1), a.general_visits.toFixed(1));
        });
        avgRow.push(
            pointsSummaryData.avg.totals.priority_calls.toFixed(1),
            pointsSummaryData.avg.totals.general_calls.toFixed(1),
            pointsSummaryData.avg.totals.total_calls.toFixed(1),
            pointsSummaryData.avg.totals.priority_visits.toFixed(1),
            pointsSummaryData.avg.totals.general_visits.toFixed(1),
            pointsSummaryData.avg.totals.total_visits.toFixed(1),
            pointsSummaryData.avg.points.toFixed(1),
            `"${pointsSummaryData.avg.achievement_rate.toFixed(1)}%"`,
            pointsSummaryData.avg.rating.toFixed(1)
        );
        csvRows.push(avgRow.join(','));

        const blob = new Blob([bom, csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `日報点数表_${targetMonths}ヶ月集計.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // --- Tab 2: 活動集計のフィルタ・ソート・集計ロジック ---
    const filteredTeamSummary = useMemo((): TeamSummaryRecord[] => {
        return teamSummaryRecords.filter(r => 
            r.staff.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.area.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.category.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [teamSummaryRecords, searchTerm]);

    const handleSort = (field: keyof TeamSummaryRecord | 'total'): void => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const sortedTeamSummary = useMemo((): TeamSummaryRecord[] => {
        const sorted = [...filteredTeamSummary];
        sorted.sort((a, b) => {
            const valA: string | number = sortField === 'total'
                ? a.visits + a.calls
                : (a[sortField as keyof TeamSummaryRecord] as string | number);
            const valB: string | number = sortField === 'total'
                ? b.visits + b.calls
                : (b[sortField as keyof TeamSummaryRecord] as string | number);

            if (typeof valA === 'string') {
                const strB = String(valB);
                return sortDirection === 'asc' 
                    ? valA.localeCompare(strB, 'ja') 
                    : strB.localeCompare(valA, 'ja');
            } else {
                return sortDirection === 'asc' 
                    ? (valA as number) - (valB as number) 
                    : (valB as number) - (valA as number);
            }
        });
        return sorted;
    }, [filteredTeamSummary, sortField, sortDirection]);

    const teamSummaryTotals = useMemo(() => {
        let visits = 0;
        let calls = 0;
        filteredTeamSummary.forEach(r => {
            visits += r.visits;
            calls += r.calls;
        });
        return { visits, calls, total: visits + calls };
    }, [filteredTeamSummary]);

    // CSV出力: 活動集計
    const handleExportTeamSummaryCSV = (): void => {
        if (filteredTeamSummary.length === 0) return;

        const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
        const headers = ['担当者', 'エリア', '区分', '訪問件数', '電話件数', '合計', 'ファイル名'];
        const csvRows = [headers.join(',')];

        sortedTeamSummary.forEach(r => {
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

        const totalRow = [
            '"合計"',
            '""',
            '""',
            teamSummaryTotals.visits,
            teamSummaryTotals.calls,
            teamSummaryTotals.total,
            '""'
        ];
        csvRows.push(totalRow.join(','));

        const blob = new Blob([bom, csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const monthStr = selectedMonth.replace('/', '');
        link.download = `活動集計_${monthStr}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Excel出力: 日報点数表 (.xlsx)
    const handleExportPointsExcel = async (): Promise<void> => {
        try {
            setDownloadingExcel(true);
            const res = await axios.get(`/api/analytics/export/points-table`, {
                params: { target_months_count: targetMonths },
                responseType: 'blob'
            });
            const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `DailyReportPointsTable_${targetMonths}months.xlsx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);
            alert('Excelファイルの出力に失敗しました。');
        } finally {
            setDownloadingExcel(false);
        }
    };

    // Excel出力: 活動集計 (.xlsx)
    const handleExportTeamSummaryExcel = async (): Promise<void> => {
        try {
            setDownloadingExcel(true);
            const res = await axios.get(`/api/analytics/export/team-summary`, {
                params: { month: selectedMonth },
                responseType: 'blob'
            });
            const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const monthStr = selectedMonth.replace('/', '');
            link.download = `ActivitySummary_${monthStr}.xlsx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);
            alert('Excelファイルの出力に失敗しました。');
        } finally {
            setDownloadingExcel(false);
        }
    };

    if (!mounted) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50/50 p-6 pb-20">
            <div className="max-w-[98%] mx-auto">
                
                {/* 1. Header with Tab Switcher */}
                <div className="mb-6 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="bg-blue-100 text-blue-700 text-[10px] font-black px-2.5 py-0.5 rounded-full">社内営業分析システム</span>
                            <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2.5 py-0.5 rounded-full">リアルタイムデータ</span>
                        </div>
                        <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                            {activeTab === 'points' ? <Award className="text-amber-500" size={26} /> : <BarChart3 className="text-blue-500" size={26} />}
                            全メンバー活動分析・日報点数表
                        </h1>
                        <p className="text-xs text-gray-500 mt-1">
                            {activeTab === 'points' 
                                ? '全営業メンバーの日報データを点数化し、達成率および評価点をマトリクスで一覧表示します。' 
                                : '指定された月度のエリア・区分ごとの訪問数および電話数の詳細なクロス集計を表示します。'}
                        </p>
                    </div>

                    {/* Tab Navigation */}
                    <div className="flex items-center bg-gray-200/60 p-1 rounded-xl border border-gray-200 shrink-0">
                        <button
                            onClick={() => { setActiveTab('points'); setSearchTerm(''); }}
                            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-black rounded-lg transition-all ${
                                activeTab === 'points' 
                                    ? 'bg-white text-gray-900 shadow-sm' 
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            <Award size={14} className={activeTab === 'points' ? 'text-amber-500' : ''} />
                            日報点数表 (得点分析)
                        </button>
                        <button
                            onClick={() => { setActiveTab('summary'); setSearchTerm(''); }}
                            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-black rounded-lg transition-all ${
                                activeTab === 'summary' 
                                    ? 'bg-white text-gray-900 shadow-sm' 
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            <BarChart3 size={14} className={activeTab === 'summary' ? 'text-blue-500' : ''} />
                            活動集計 (月別詳細)
                        </button>
                    </div>
                </div>

                {/* 2. Control & Options Panel */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 flex flex-col lg:flex-row items-center justify-between gap-4">
                    
                    {/* Leftside Controls (Context specific) */}
                    <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
                        {activeTab === 'points' ? (
                            <>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-gray-700">目標値倍率 (月200点×Nヶ月):</span>
                                    <select
                                        className="bg-gray-50 border border-gray-300 rounded-lg px-3 py-1.5 text-xs font-black text-blue-700 outline-none focus:ring-2 focus:ring-blue-500"
                                        value={targetMonths}
                                        onChange={handleTargetMonthsChange}
                                    >
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                                            <option key={m} value={m}>{m}ヶ月分 ({200 * m}点目標)</option>
                                        ))}
                                    </select>
                                </div>
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={onlyShowActiveMonths}
                                        onChange={(e) => setOnlyShowActiveMonths(e.target.checked)}
                                        className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer"
                                    />
                                    <span className="text-xs font-bold text-gray-600">実績のある月のみ表示</span>
                                </label>
                            </>
                        ) : (
                            <div className="flex items-center gap-2">
                                <Calendar className="text-blue-500" size={16} />
                                <span className="text-xs font-bold text-gray-700">集計対象月度:</span>
                                <select
                                    className="bg-gray-50 border border-gray-300 rounded-lg px-3 py-1.5 text-xs font-black text-blue-700 outline-none focus:ring-2 focus:ring-blue-500"
                                    value={selectedMonth}
                                    onChange={handleMonthChange}
                                >
                                    {monthOptions.map(opt => (
                                        <option key={opt.code} value={opt.code}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Filter and Output Bar */}
                    <div className="flex flex-col sm:flex-row items-center gap-2 w-full lg:w-auto justify-end">
                        {/* Search */}
                        <div className="relative w-full sm:w-60">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                            <input
                                type="text"
                                placeholder={activeTab === 'points' ? "営業担当者名で検索..." : "担当者名、エリア、区分で検索..."}
                                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {/* CSV Export */}
                        <button
                            onClick={activeTab === 'points' ? handleExportPointsCSV : handleExportTeamSummaryCSV}
                            disabled={activeTab === 'points' ? filteredPointsRecords.length === 0 : filteredTeamSummary.length === 0}
                            className="flex items-center gap-1.5 px-4 py-2 w-full sm:w-auto justify-center bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-black text-xs shadow-sm transition-colors disabled:opacity-50"
                        >
                            <Download size={14} />
                            CSV出力
                        </button>

                        {/* Excel Export */}
                        <button
                            onClick={activeTab === 'points' ? handleExportPointsExcel : handleExportTeamSummaryExcel}
                            disabled={downloadingExcel || (activeTab === 'points' ? filteredPointsRecords.length === 0 : filteredTeamSummary.length === 0)}
                            className="flex items-center gap-1.5 px-4 py-2 w-full sm:w-auto justify-center bg-emerald-50 border border-emerald-300 rounded-lg text-emerald-700 hover:bg-emerald-100/50 font-black text-xs shadow-sm transition-colors disabled:opacity-50"
                        >
                            {downloadingExcel ? (
                                <RefreshCw size={14} className="text-emerald-600 animate-spin" />
                            ) : (
                                <Download size={14} className="text-emerald-600" />
                            )}
                            {downloadingExcel ? '出力中...' : 'Excel出力 (.xlsx)'}
                        </button>

                        {/* Recalculate */}
                        <button
                            onClick={handleRecalculate}
                            disabled={loadingPoints || loadingSummary}
                            className="flex items-center gap-1.5 px-5 py-2 w-full sm:w-auto justify-center bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-black text-xs shadow-sm transition-colors disabled:opacity-70"
                        >
                            <RefreshCw size={14} className={(loadingPoints || loadingSummary) ? 'animate-spin' : ''} />
                            再集計
                        </button>
                    </div>
                </div>

                {/* 3. Data Tables */}
                {activeTab === 'points' ? (
                    /* TAB 1: 日報点数表 */
                    <div className="bg-white rounded-xl border border-gray-200 shadow-md overflow-hidden">
                        {loadingPoints ? (
                            <div className="py-40 flex flex-col items-center justify-center">
                                <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4" />
                                <p className="text-gray-500 animate-pulse text-xs font-semibold">全メンバーのデータを計算し、日報点数を算出しています...</p>
                            </div>
                        ) : filteredPointsRecords.length === 0 ? (
                            <div className="py-32 text-center">
                                <p className="text-gray-400 text-xs">該当する営業担当者のデータが見つかりませんでした。</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto max-w-full pb-2">
                                <table className="w-full text-left text-xs border-collapse table-auto whitespace-nowrap min-w-max">
                                    <thead>
                                        {/* Row 1: Groups */}
                                        <tr className="bg-gray-100 text-gray-700 font-bold text-center border-b border-gray-200">
                                            <th rowSpan={2} className="sticky left-0 bg-gray-100 z-30 px-3 py-3 text-left font-black border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[90px]">営業名</th>
                                            <th rowSpan={2} className="sticky left-[90px] bg-gray-100 z-30 px-2 py-3 text-center border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[65px] text-xs">重点件数</th>
                                            
                                            {displayMonths.map(m => (
                                                <th key={`grp-${m}`} colSpan={4} className="border-r border-gray-200 bg-blue-50/50 py-2 text-blue-900 border-b border-gray-300 font-black text-sm text-center min-w-[200px]">
                                                    {m}
                                                </th>
                                            ))}

                                            <th colSpan={6} className="border-r border-gray-200 bg-gray-200 py-2 text-gray-800 border-b border-gray-300 font-black text-sm text-center min-w-[420px]">
                                                計
                                            </th>

                                            <th rowSpan={2} className="bg-amber-50 text-amber-950 font-black px-3 py-3 text-right border-r border-gray-200 min-w-[85px] text-xs shadow-inner">
                                                点数
                                            </th>
                                            <th rowSpan={2} className="bg-blue-50 text-blue-950 font-black px-3 py-3 text-right border-r border-gray-200 min-w-[130px] text-xs">
                                                月200点×{targetMonths}<br />
                                                <span className="text-[10px] font-medium opacity-80">({200 * targetMonths}点満点)</span>
                                            </th>
                                            <th rowSpan={2} className="bg-emerald-50 text-emerald-950 font-black px-3 py-3 text-right min-w-[75px] text-xs">
                                                評価点
                                            </th>
                                        </tr>

                                        {/* Row 2: Sub Headers */}
                                        <tr className="bg-gray-50 text-gray-600 font-bold text-center border-b border-gray-200 text-[10px]">
                                            {displayMonths.map(m => (
                                                <React.Fragment key={`sub-${m}`}>
                                                    <th className="bg-blue-50/30 px-1 py-2 border-r border-gray-100 min-w-[50px] text-center">重点電</th>
                                                    <th className="bg-blue-50/30 px-1 py-2 border-r border-gray-100 min-w-[50px] text-center">一般電</th>
                                                    <th className="bg-blue-50/30 px-1 py-2 border-r border-gray-100 min-w-[50px] text-center">重点訪</th>
                                                    <th className="bg-blue-50/30 px-1 py-2 border-r border-gray-200 min-w-[50px] text-center">一般訪</th>
                                                </React.Fragment>
                                            ))}

                                            <th className="bg-gray-100 px-2 py-2 border-r border-gray-200 min-w-[70px] text-center font-bold">重点電話</th>
                                            <th className="bg-gray-100 px-2 py-2 border-r border-gray-200 min-w-[70px] text-center font-bold">一般電話</th>
                                            <th className="bg-blue-100/50 text-blue-900 px-2 py-2 border-r border-gray-200 min-w-[70px] text-center font-black">総電話</th>
                                            <th className="bg-gray-100 px-2 py-2 border-r border-gray-200 min-w-[70px] text-center font-bold">重点訪問</th>
                                            <th className="bg-gray-100 px-2 py-2 border-r border-gray-200 min-w-[70px] text-center font-bold">一般訪問</th>
                                            <th className="bg-emerald-100/50 text-emerald-900 px-2 py-2 border-r border-gray-200 min-w-[70px] text-center font-black">総訪問</th>
                                        </tr>
                                    </thead>

                                    <tbody className="divide-y divide-gray-100 text-gray-700">
                                        {filteredPointsRecords.map((r) => (
                                            <tr key={r.staff} className="hover:bg-blue-50/10 transition-colors">
                                                <td className="sticky left-0 bg-white z-20 px-3 py-3 font-bold text-gray-900 border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] min-w-[90px]">
                                                    {r.staff}
                                                </td>
                                                <td className="sticky left-[90px] bg-white z-20 text-center border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] font-semibold text-gray-600 min-w-[65px]">
                                                    {r.priority_count || '-'}
                                                </td>

                                                {displayMonths.map(m => {
                                                    const act = r.monthly_data[m] || { priority_calls: 0, general_calls: 0, priority_visits: 0, general_visits: 0 };
                                                    return (
                                                        <React.Fragment key={`cell-${r.staff}-${m}`}>
                                                            <td className={`text-right px-1.5 py-2 border-r border-gray-100 font-mono min-w-[50px] ${act.priority_calls > 0 ? 'text-gray-900 font-semibold' : 'text-gray-300'}`}>{act.priority_calls}</td>
                                                            <td className={`text-right px-1.5 py-2 border-r border-gray-100 font-mono min-w-[50px] ${act.general_calls > 0 ? 'text-gray-900 font-semibold' : 'text-gray-300'}`}>{act.general_calls}</td>
                                                            <td className={`text-right px-1.5 py-2 border-r border-gray-100 font-mono min-w-[50px] ${act.priority_visits > 0 ? 'text-gray-900 font-semibold' : 'text-gray-300'}`}>{act.priority_visits}</td>
                                                            <td className={`text-right px-1.5 py-2 border-r border-gray-200 font-mono min-w-[50px] ${act.general_visits > 0 ? 'text-gray-900 font-semibold' : 'text-gray-300'}`}>{act.general_visits}</td>
                                                        </React.Fragment>
                                                    );
                                                })}

                                                {/* Totals */}
                                                <td className="text-right px-2.5 py-2 border-r border-gray-150 font-bold text-gray-800 bg-gray-50/50 min-w-[70px] font-mono">{r.totals.priority_calls}</td>
                                                <td className="text-right px-2.5 py-2 border-r border-gray-150 font-bold text-gray-800 bg-gray-50/50 min-w-[70px] font-mono">{r.totals.general_calls}</td>
                                                <td className="text-right px-2.5 py-2 border-r border-gray-150 font-black text-blue-700 bg-blue-50/20 min-w-[70px] font-mono">{r.totals.total_calls}</td>
                                                <td className="text-right px-2.5 py-2 border-r border-gray-150 font-bold text-gray-800 bg-gray-50/50 min-w-[70px] font-mono">{r.totals.priority_visits}</td>
                                                <td className="text-right px-2.5 py-2 border-r border-gray-150 font-bold text-gray-800 bg-gray-50/50 min-w-[70px] font-mono">{r.totals.general_visits}</td>
                                                <td className="text-right px-2.5 py-2 border-r border-gray-200 font-black text-emerald-700 bg-emerald-50/20 min-w-[70px] font-mono">{r.totals.total_visits}</td>

                                                {/* Scores */}
                                                <td className="text-right px-3 py-2 border-r border-gray-200 font-black text-amber-700 bg-amber-50/30 text-sm min-w-[85px] font-mono">{r.points}</td>
                                                <td className="text-right px-3 py-2 border-r border-gray-200 font-black text-blue-700 bg-blue-50/30 text-sm min-w-[130px]">
                                                    <span className="font-mono">{r.achievement_rate}%</span>
                                                    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1 overflow-hidden">
                                                        <div 
                                                            className={`h-full ${r.achievement_rate >= 100 ? 'bg-emerald-500' : r.achievement_rate >= 50 ? 'bg-blue-500' : 'bg-red-400'}`} 
                                                            style={{ width: `${Math.min(r.achievement_rate, 100)}%` }} 
                                                        />
                                                    </div>
                                                </td>
                                                <td className="text-right px-3 py-2 font-black text-emerald-700 bg-emerald-50/30 text-sm min-w-[75px] font-mono">{r.rating}</td>
                                            </tr>
                                        ))}

                                        {/* Totals Row */}
                                        <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                                            <td className="sticky left-0 bg-gray-100 z-20 px-3 py-3 font-black text-gray-900 border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[90px]">計</td>
                                            <td className="sticky left-[90px] bg-gray-100 z-20 text-center border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] font-bold text-gray-800 min-w-[65px]">
                                                {pointsSummaryData.total.priority_count}
                                            </td>

                                            {displayMonths.map(m => {
                                                const t = pointsSummaryData.total.monthly[m];
                                                return (
                                                    <React.Fragment key={`total-${m}`}>
                                                        <td className="text-right px-1.5 py-2 border-r border-gray-100 font-bold text-gray-900 min-w-[50px] font-mono">{t.priority_calls}</td>
                                                        <td className="text-right px-1.5 py-2 border-r border-gray-100 font-bold text-gray-900 min-w-[50px] font-mono">{t.general_calls}</td>
                                                        <td className="text-right px-1.5 py-2 border-r border-gray-100 font-bold text-gray-900 min-w-[50px] font-mono">{t.priority_visits}</td>
                                                        <td className="text-right px-1.5 py-2 border-r border-gray-200 font-bold text-gray-900 min-w-[50px] font-mono">{t.general_visits}</td>
                                                    </React.Fragment>
                                                );
                                            })}

                                            <td className="text-right px-2.5 py-2 border-r border-gray-150 font-bold text-gray-900 min-w-[70px] font-mono">{pointsSummaryData.total.totals.priority_calls}</td>
                                            <td className="text-right px-2.5 py-2 border-r border-gray-150 font-bold text-gray-900 min-w-[70px] font-mono">{pointsSummaryData.total.totals.general_calls}</td>
                                            <td className="text-right px-2.5 py-2 border-r border-gray-150 font-black text-blue-700 bg-blue-100/10 min-w-[70px] font-mono">{pointsSummaryData.total.totals.total_calls}</td>
                                            <td className="text-right px-2.5 py-2 border-r border-gray-150 font-bold text-gray-900 min-w-[70px] font-mono">{pointsSummaryData.total.totals.priority_visits}</td>
                                            <td className="text-right px-2.5 py-2 border-r border-gray-150 font-bold text-gray-900 min-w-[70px] font-mono">{pointsSummaryData.total.totals.general_visits}</td>
                                            <td className="text-right px-2.5 py-2 border-r border-gray-200 font-black text-emerald-700 bg-emerald-100/10 min-w-[70px] font-mono">{pointsSummaryData.total.totals.total_visits}</td>

                                            <td className="text-right px-3 py-2 border-r border-gray-200 font-black text-amber-700 bg-amber-100/20 text-sm min-w-[85px] font-mono">{pointsSummaryData.total.points.toFixed(1)}</td>
                                            <td className="text-right px-3 py-2 border-r border-gray-200 font-black text-blue-700 bg-blue-100/20 text-sm min-w-[130px] font-mono">{pointsSummaryData.total.achievement_rate.toFixed(1)}%</td>
                                            <td className="text-right px-3 py-2 font-black text-emerald-700 bg-emerald-100/20 text-sm min-w-[75px] font-mono">{pointsSummaryData.total.rating.toFixed(1)}</td>
                                        </tr>

                                        {/* Averages Row */}
                                        <tr className="bg-gray-50 font-bold border-t border-gray-200">
                                            <td className="sticky left-0 bg-gray-50 z-20 px-3 py-3 font-black text-gray-700 border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[90px]">平均点</td>
                                            <td className="sticky left-[90px] bg-gray-50 z-20 text-center border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] font-bold text-gray-600 min-w-[65px]">
                                                {pointsSummaryData.avg.priority_count.toFixed(1)}
                                            </td>

                                            {displayMonths.map(m => {
                                                const a = pointsSummaryData.avg.monthly[m];
                                                return (
                                                    <React.Fragment key={`avg-${m}`}>
                                                        <td className="text-right px-1.5 py-2 border-r border-gray-100 font-semibold text-gray-600 min-w-[50px] font-mono">{a.priority_calls.toFixed(1)}</td>
                                                        <td className="text-right px-1.5 py-2 border-r border-gray-100 font-semibold text-gray-600 min-w-[50px] font-mono">{a.general_calls.toFixed(1)}</td>
                                                        <td className="text-right px-1.5 py-2 border-r border-gray-100 font-semibold text-gray-600 min-w-[50px] font-mono">{a.priority_visits.toFixed(1)}</td>
                                                        <td className="text-right px-1.5 py-2 border-r border-gray-200 font-semibold text-gray-600 min-w-[50px] font-mono">{a.general_visits.toFixed(1)}</td>
                                                    </React.Fragment>
                                                );
                                            })}

                                            <td className="text-right px-2.5 py-2 border-r border-gray-150 font-semibold text-gray-600 min-w-[70px] font-mono">{pointsSummaryData.avg.totals.priority_calls.toFixed(1)}</td>
                                            <td className="text-right px-2.5 py-2 border-r border-gray-150 font-semibold text-gray-600 min-w-[70px] font-mono">{pointsSummaryData.avg.totals.general_calls.toFixed(1)}</td>
                                            <td className="text-right px-2.5 py-2 border-r border-gray-150 font-black text-blue-600 min-w-[70px] font-mono">{pointsSummaryData.avg.totals.total_calls.toFixed(1)}</td>
                                            <td className="text-right px-2.5 py-2 border-r border-gray-150 font-semibold text-gray-600 min-w-[70px] font-mono">{pointsSummaryData.avg.totals.priority_visits.toFixed(1)}</td>
                                            <td className="text-right px-2.5 py-2 border-r border-gray-150 font-semibold text-gray-600 min-w-[70px] font-mono">{pointsSummaryData.avg.totals.general_visits.toFixed(1)}</td>
                                            <td className="text-right px-2.5 py-2 border-r border-gray-200 font-black text-emerald-600 min-w-[70px] font-mono">{pointsSummaryData.avg.totals.total_visits.toFixed(1)}</td>

                                            <td className="text-right px-3 py-2 border-r border-gray-200 font-black text-amber-700 bg-amber-100/10 text-sm min-w-[85px] font-mono">{pointsSummaryData.avg.points.toFixed(1)}</td>
                                            <td className="text-right px-3 py-2 border-r border-gray-200 font-black text-blue-700 bg-blue-100/10 text-sm min-w-[130px] font-mono">{pointsSummaryData.avg.achievement_rate.toFixed(1)}%</td>
                                            <td className="text-right px-3 py-2 font-black text-emerald-700 bg-emerald-100/10 text-sm min-w-[75px] font-mono">{pointsSummaryData.avg.rating.toFixed(1)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                ) : (
                    /* TAB 2: 活動集計 (Excelレイアウト) */
                    <div className="bg-white rounded-xl border border-gray-200 shadow-md overflow-hidden">
                        {loadingSummary ? (
                            <div className="py-40 flex flex-col items-center justify-center">
                                <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4" />
                                <p className="text-gray-500 animate-pulse text-xs font-semibold">全営業の日報ファイルを集計しています...</p>
                            </div>
                        ) : sortedTeamSummary.length === 0 ? (
                            <div className="py-32 text-center">
                                <p className="text-gray-400 text-xs">選択した月度のデータが見つかりませんでした。</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto max-w-full">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-gray-100 text-gray-700 font-black border-b border-gray-300">
                                            <th 
                                                onClick={() => handleSort('staff')}
                                                className="px-4 py-3 cursor-pointer hover:bg-gray-200 select-none w-[150px]"
                                            >
                                                <div className="flex items-center gap-1">
                                                    担当者 <ArrowUpDown size={12} className="text-gray-400" />
                                                </div>
                                            </th>
                                            <th 
                                                onClick={() => handleSort('area')}
                                                className="px-4 py-3 cursor-pointer hover:bg-gray-200 select-none w-[150px]"
                                            >
                                                <div className="flex items-center gap-1">
                                                    エリア <ArrowUpDown size={12} className="text-gray-400" />
                                                </div>
                                            </th>
                                            <th 
                                                onClick={() => handleSort('category')}
                                                className="px-4 py-3 cursor-pointer hover:bg-gray-200 select-none w-[120px]"
                                            >
                                                <div className="flex items-center gap-1">
                                                    区分 <ArrowUpDown size={12} className="text-gray-400" />
                                                </div>
                                            </th>
                                            <th 
                                                onClick={() => handleSort('visits')}
                                                className="px-4 py-3 text-right cursor-pointer hover:bg-gray-200 select-none w-[120px]"
                                            >
                                                <div className="flex items-center justify-end gap-1">
                                                    訪問件数 <ArrowUpDown size={12} className="text-gray-400" />
                                                </div>
                                            </th>
                                            <th 
                                                onClick={() => handleSort('calls')}
                                                className="px-4 py-3 text-right cursor-pointer hover:bg-gray-200 select-none w-[120px]"
                                            >
                                                <div className="flex items-center justify-end gap-1">
                                                    電話件数 <ArrowUpDown size={12} className="text-gray-400" />
                                                </div>
                                            </th>
                                            <th 
                                                onClick={() => handleSort('total')}
                                                className="px-4 py-3 text-right cursor-pointer hover:bg-gray-200 select-none w-[120px] bg-blue-50/20"
                                            >
                                                <div className="flex items-center justify-end gap-1 text-blue-900">
                                                    合計 <ArrowUpDown size={12} className="text-blue-500" />
                                                </div>
                                            </th>
                                            <th 
                                                onClick={() => handleSort('file')}
                                                className="px-4 py-3 cursor-pointer hover:bg-gray-200 select-none"
                                            >
                                                <div className="flex items-center gap-1">
                                                    ファイル名 <ArrowUpDown size={12} className="text-gray-400" />
                                                </div>
                                            </th>
                                        </tr>
                                    </thead>

                                    <tbody className="divide-y divide-gray-100 text-gray-700">
                                        {sortedTeamSummary.map((r, index) => (
                                            <tr key={index} className="hover:bg-gray-50/80 transition-colors">
                                                <td className="px-4 py-2.5 font-bold text-gray-900">{r.staff}</td>
                                                <td className="px-4 py-2.5">{r.area}</td>
                                                <td className="px-4 py-2.5">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                                        r.category === '重点' 
                                                            ? 'bg-amber-100 text-amber-800' 
                                                            : 'bg-gray-100 text-gray-600'
                                                    }`}>
                                                        {r.category}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2.5 text-right font-semibold text-gray-800">{r.visits}</td>
                                                <td className="px-4 py-2.5 text-right font-semibold text-gray-800">{r.calls}</td>
                                                <td className="px-4 py-2.5 text-right font-black text-blue-700 bg-blue-50/10">{r.visits + r.calls}</td>
                                                <td className="px-4 py-2.5 text-gray-400 font-mono text-[10px] truncate max-w-[300px]" title={r.file}>
                                                    {r.file}
                                                </td>
                                            </tr>
                                        ))}

                                        {/* Grand Totals */}
                                        <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                                            <td className="px-4 py-3 font-black text-gray-900">合計</td>
                                            <td className="px-4 py-3"></td>
                                            <td className="px-4 py-3"></td>
                                            <td className="px-4 py-3 text-right text-gray-900 font-black">{teamSummaryTotals.visits}</td>
                                            <td className="px-4 py-3 text-right text-gray-900 font-black">{teamSummaryTotals.calls}</td>
                                            <td className="px-4 py-3 text-right text-blue-700 font-black bg-blue-100/20">{teamSummaryTotals.total}</td>
                                            <td className="px-4 py-3"></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* 4. Methodology Info Alert */}
                <div className="mt-4 bg-amber-50/50 border border-amber-200/80 rounded-xl p-4 shadow-sm flex items-start gap-3">
                    <HelpCircle className="text-amber-600 shrink-0 mt-0.5" size={18} />
                    <div>
                        <h4 className="text-xs font-bold text-amber-900 mb-1">
                            {activeTab === 'points' ? '【集計方法】日報点数表の計算ルール' : '【集計方法】活動集計について'}
                        </h4>
                        {activeTab === 'points' ? (
                            <ul className="list-disc pl-4 space-y-1 text-[11px] text-amber-800">
                                <li><strong>得点式:</strong> <code>重点電話 × 1 ＋ 一般電話 ÷ 2 ＋ 重点訪問 × 10 ＋ 一般訪問 × 3</code></li>
                                <li><strong>達成率:</strong> <code>総合得点 ÷ (月200点 × 集計対象月数) × 100%</code></li>
                                <li><strong>評価点:</strong> <code>総合得点 ÷ 140</code> （10.0点満点評価点に換算）</li>
                                <li>※「営業名」と「重点件数」列は、横スクロール時も左端に固定されて残ります。</li>
                            </ul>
                        ) : (
                            <ul className="list-disc pl-4 space-y-1 text-[11px] text-amber-800">
                                <li><strong>集計対象:</strong> 選択された月度（例: 2026年5月）に含まれる全ての日報データを対象とし、営業名・エリア・区分（重点顧客か一般顧客か）の組み合わせでクロス集計します。</li>
                                <li><strong>項目の並べ替え:</strong> テーブルのヘッダー部分をクリックすることで、担当者、エリア、区分、訪問件数、電話件数、合計、ファイル名の各列で昇順・降順にソートできます。</li>
                                <li><strong>合計値の連動:</strong> 検索窓で絞り込みを行うと、最下部の合計値も絞り込まれた行のデータのみを対象としてリアルタイムに再集計されます。</li>
                            </ul>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
