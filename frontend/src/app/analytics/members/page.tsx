'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Search, Download, ArrowUpDown, ChevronLeft, ChevronRight, Award, BarChart3, HelpCircle } from 'lucide-react';
import axios from 'axios';
import { PointsRecord, MonthlyActivity } from '@/types/analytics';

export default function DailyReportPointsTablePage() {
    const [loading, setLoading] = useState(false);
    const [hasFetched, setHasFetched] = useState(false);
    const [records, setRecords] = useState<PointsRecord[]>([]);
    const [targetMonths, setTargetMonths] = useState<number>(7); // デフォルト: 7ヶ月分 (月200点×7 = 1400点)
    const [searchTerm, setSearchTerm] = useState('');
    const [onlyShowActiveMonths, setOnlyShowActiveMonths] = useState(true); // 実績のある月のみ表示
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        // 初回ロード時に自動的にデータを取得
        fetchPointsTable(7);
    }, []);

    // データ取得処理
    const fetchPointsTable = async (monthsCount: number) => {
        setLoading(true);
        setHasFetched(true);
        try {
            const res = await axios.get(`/api/analytics/points-table`, {
                params: { target_months_count: monthsCount }
            });
            setRecords(res.data.records || []);
        } catch (error) {
            console.error('Failed to fetch points table:', error);
            setRecords([]);
        } finally {
            setTimeout(() => setLoading(false), 300);
        }
    };

    // 集計対象月数の変更ハンドラ
    const handleTargetMonthsChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = Number(e.target.value);
        setTargetMonths(val);
        fetchPointsTable(val);
    };

    // 検索フィルタ適用後のレコード
    const filteredRecords = useMemo(() => {
        return records.filter(r => 
            r.staff.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [records, searchTerm]);

    // 全12ヶ月の定義順
    const allMonths = useMemo(() => [
        "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月", "1月"
    ], []);

    // 実績がある月（全メンバーでいずれかの活動が1件以上ある月）のみを抽出
    const activeMonths = useMemo(() => {
        if (records.length === 0) return ["2月", "3月", "4月"]; // 初期フォールバック
        return allMonths.filter(month => {
            return records.some(r => {
                const m = r.monthly_data[month];
                return m && (m.priority_calls > 0 || m.general_calls > 0 || m.priority_visits > 0 || m.general_visits > 0);
            });
        });
    }, [records, allMonths]);

    // 表示対象の月リスト
    const displayMonths = useMemo(() => {
        return onlyShowActiveMonths ? activeMonths : allMonths;
    }, [onlyShowActiveMonths, activeMonths, allMonths]);

    // --- 各列の縦計・平均の算出 ---
    const summaryData = useMemo(() => {
        const count = filteredRecords.length;
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

        // 初期化
        displayMonths.forEach(m => {
            total.monthly[m] = { priority_calls: 0, general_calls: 0, priority_visits: 0, general_visits: 0 };
        });

        // 合計計算
        filteredRecords.forEach(r => {
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

        // 平均計算
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
    }, [filteredRecords, displayMonths, targetMonths]);

    // CSV出力処理
    const handleExportCSV = () => {
        if (filteredRecords.length === 0) return;

        const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
        
        // ヘッダー生成
        const row1 = ['営業名', '重点件数'];
        const row2 = ['', ''];
        
        displayMonths.forEach(m => {
            row1.push(m, '', '', '');
            row2.push('重点電話', '電話総数(一般)', '重点訪問', '訪問件数(一般)');
        });
        
        row1.push('累計', '', '', '', '', '', '点数', `月200点×${targetMonths}(${200 * targetMonths})`, '点数');
        row2.push('重点電話総数', '電話総件数(一般)', '総電話件数', '重点訪問総数', '訪問総件数(一般)', '総訪問件数', '総合点数', '達成率', '評価レート');

        const csvRows = [
            row1.join(','),
            row2.join(',')
        ];

        // データ行
        filteredRecords.forEach(r => {
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

        // 合計行
        const totalRow = [
            '"合計"',
            summaryData.total.priority_count
        ];
        displayMonths.forEach(m => {
            const t = summaryData.total.monthly[m];
            totalRow.push(String(t.priority_calls), String(t.general_calls), String(t.priority_visits), String(t.general_visits));
        });
        totalRow.push(
            String(summaryData.total.totals.priority_calls),
            String(summaryData.total.totals.general_calls),
            String(summaryData.total.totals.total_calls),
            String(summaryData.total.totals.priority_visits),
            String(summaryData.total.totals.general_visits),
            String(summaryData.total.totals.total_visits),
            String(summaryData.total.points),
            `"${summaryData.total.achievement_rate.toFixed(1)}%"`,
            String(summaryData.total.rating.toFixed(1))
        );
        csvRows.push(totalRow.join(','));

        // 平均行
        const avgRow = [
            '"平均点"',
            summaryData.avg.priority_count.toFixed(1)
        ];
        displayMonths.forEach(m => {
            const a = summaryData.avg.monthly[m];
            avgRow.push(a.priority_calls.toFixed(1), a.general_calls.toFixed(1), a.priority_visits.toFixed(1), a.general_visits.toFixed(1));
        });
        avgRow.push(
            summaryData.avg.totals.priority_calls.toFixed(1),
            summaryData.avg.totals.general_calls.toFixed(1),
            summaryData.avg.totals.total_calls.toFixed(1),
            summaryData.avg.totals.priority_visits.toFixed(1),
            summaryData.avg.totals.general_visits.toFixed(1),
            summaryData.avg.totals.total_visits.toFixed(1),
            summaryData.avg.points.toFixed(1),
            `"${summaryData.avg.achievement_rate.toFixed(1)}%"`,
            summaryData.avg.rating.toFixed(1)
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

    if (!mounted) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sf-light-blue"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50/50 p-6 pb-20">
            <div className="max-w-[98%] mx-auto">
                {/* Header */}
                <div className="mb-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">社内集計</span>
                            <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-0.5 rounded-full">実績連動</span>
                        </div>
                        <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                            <Award className="text-amber-500" size={26} />
                            日報点数表 2026
                        </h1>
                        <p className="text-xs text-gray-500 mt-1">全営業メンバーの日報データを点数化し、達成率および評価点をマトリクスで一覧表示します。</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                        {/* Target Months Multiplier */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-700">目標値設定 (月200点 × Nヶ月):</span>
                            <select
                                className="bg-gray-50 border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-bold text-blue-700 outline-none focus:ring-2 focus:ring-blue-500"
                                value={targetMonths}
                                onChange={handleTargetMonthsChange}
                            >
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                                    <option key={m} value={m}>{m}ヶ月分 ({200 * m}点目標)</option>
                                ))}
                            </select>
                        </div>

                        {/* Active Months Filter Toggle */}
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={onlyShowActiveMonths}
                                onChange={(e) => setOnlyShowActiveMonths(e.target.checked)}
                                className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer"
                            />
                            <span className="text-xs font-medium text-gray-600">実績のある月のみ表示</span>
                        </label>
                    </div>
                </div>

                {/* Actions & Filters Bar */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="relative w-full md:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="営業担当者名で検索..."
                            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                        <button
                            onClick={handleExportCSV}
                            disabled={filteredRecords.length === 0}
                            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-bold text-xs shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Download size={15} />
                            CSV出力
                        </button>
                        <button
                            onClick={() => fetchPointsTable(targetMonths)}
                            disabled={loading}
                            className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold text-xs shadow-sm transition-colors disabled:opacity-70"
                        >
                            {loading ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <BarChart3 size={15} />}
                            再集計
                        </button>
                    </div>
                </div>

                {/* Main Points Matrix Table */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-md overflow-hidden">
                    {loading ? (
                        <div className="py-40 flex flex-col items-center justify-center">
                            <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4" />
                            <p className="text-gray-500 animate-pulse text-xs font-semibold">全営業メンバーの活動実績を計算し、点数を算出しています...</p>
                        </div>
                    ) : filteredRecords.length === 0 ? (
                        <div className="py-32 text-center">
                            <p className="text-gray-400 text-sm">該当する営業担当者のデータが見つかりませんでした。</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto max-w-full">
                            <table className="w-full text-left text-xs border-collapse table-fixed min-w-[1200px]">
                                <thead>
                                    {/* Row 1: Months and Major Groups */}
                                    <tr className="bg-gray-100 text-gray-700 font-bold text-center border-b border-gray-200">
                                        <th rowSpan={2} className="sticky left-0 bg-gray-100 z-30 px-4 py-3 text-left font-black border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] w-[100px] min-w-[100px]">営業名</th>
                                        <th rowSpan={2} className="sticky left-[100px] bg-gray-100 z-30 px-3 py-3 text-center border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] w-[70px] min-w-[70px] text-xs">重点件数</th>
                                        
                                        {displayMonths.map(m => (
                                            <th key={`group-${m}`} colSpan={4} className="border-r border-gray-200 bg-blue-50/50 py-2 text-blue-900 border-b border-gray-300 font-black text-sm">
                                                {m}
                                            </th>
                                        ))}

                                        <th colSpan={6} className="border-r border-gray-200 bg-gray-200 py-2 text-gray-800 border-b border-gray-300 font-black text-sm">
                                            計
                                        </th>

                                        <th rowSpan={2} className="bg-amber-50 text-amber-950 font-black px-3 py-3 text-right border-r border-gray-200 w-[80px] min-w-[80px] text-xs shadow-inner">
                                            点数
                                        </th>
                                        <th rowSpan={2} className="bg-blue-50 text-blue-950 font-black px-3 py-3 text-right border-r border-gray-200 w-[120px] min-w-[120px] text-xs">
                                            月200点×{targetMonths}<br />
                                            <span className="text-[10px] font-medium opacity-80">({200 * targetMonths}点満点)</span>
                                        </th>
                                        <th rowSpan={2} className="bg-emerald-50 text-emerald-950 font-black px-3 py-3 text-right w-[80px] min-w-[80px] text-xs">
                                            評価点
                                        </th>
                                    </tr>

                                    {/* Row 2: Sub-headers */}
                                    <tr className="bg-gray-50 text-gray-600 font-bold text-center border-b border-gray-200 text-[10px]">
                                        {displayMonths.map(m => (
                                            <React.Fragment key={`sub-${m}`}>
                                                <th className="bg-blue-50/30 px-1 py-2 border-r border-gray-100 w-[55px] min-w-[55px]">重点電</th>
                                                <th className="bg-blue-50/30 px-1 py-2 border-r border-gray-100 w-[55px] min-w-[55px]">電話総</th>
                                                <th className="bg-blue-50/30 px-1 py-2 border-r border-gray-100 w-[55px] min-w-[55px]">重点訪</th>
                                                <th className="bg-blue-50/30 px-1 py-2 border-r border-gray-200 w-[55px] min-w-[55px]">訪問件</th>
                                            </React.Fragment>
                                        ))}

                                        <th className="bg-gray-100 px-1 py-2 border-r border-gray-200 w-[60px] min-w-[60px]">重点電話</th>
                                        <th className="bg-gray-100 px-1 py-2 border-r border-gray-200 w-[60px] min-w-[60px]">電話総</th>
                                        <th className="bg-gray-100 px-1 py-2 border-r border-gray-200 w-[60px] min-w-[60px]">総電話</th>
                                        <th className="bg-gray-100 px-1 py-2 border-r border-gray-200 w-[60px] min-w-[60px]">重点訪</th>
                                        <th className="bg-gray-100 px-1 py-2 border-r border-gray-200 w-[60px] min-w-[60px]">訪問件</th>
                                        <th className="bg-gray-100 px-1 py-2 border-r border-gray-200 w-[60px] min-w-[60px]">総訪問</th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-gray-100 text-gray-700">
                                    {/* Data Rows */}
                                    {filteredRecords.map((r) => {
                                        return (
                                            <tr key={r.staff} className="hover:bg-blue-50/10 transition-colors">
                                                {/* Sticky Name */}
                                                <td className="sticky left-0 bg-white z-20 px-4 py-3 font-bold text-gray-900 border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                                    {r.staff}
                                                </td>
                                                {/* Sticky Priority count */}
                                                <td className="sticky left-[100px] bg-white z-20 text-center border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] font-semibold text-gray-600">
                                                    {r.priority_count || '-'}
                                                </td>

                                                {/* Monthly breakdown */}
                                                {displayMonths.map(m => {
                                                    const act = r.monthly_data[m] || { priority_calls: 0, general_calls: 0, priority_visits: 0, general_visits: 0 };
                                                    return (
                                                        <React.Fragment key={`data-${r.staff}-${m}`}>
                                                            <td className={`text-right px-2 py-2 border-r border-gray-100 ${act.priority_calls > 0 ? 'text-gray-900 font-semibold' : 'text-gray-300'}`}>{act.priority_calls}</td>
                                                            <td className={`text-right px-2 py-2 border-r border-gray-100 ${act.general_calls > 0 ? 'text-gray-900 font-semibold' : 'text-gray-300'}`}>{act.general_calls}</td>
                                                            <td className={`text-right px-2 py-2 border-r border-gray-100 ${act.priority_visits > 0 ? 'text-gray-900 font-semibold' : 'text-gray-300'}`}>{act.priority_visits}</td>
                                                            <td className={`text-right px-2 py-2 border-r border-gray-200 ${act.general_visits > 0 ? 'text-gray-900 font-semibold' : 'text-gray-300'}`}>{act.general_visits}</td>
                                                        </React.Fragment>
                                                    );
                                                })}

                                                {/* Summed Columns under "計" */}
                                                <td className="text-right px-2 py-2 border-r border-gray-150 font-bold text-gray-800 bg-gray-50/50">{r.totals.priority_calls}</td>
                                                <td className="text-right px-2 py-2 border-r border-gray-150 font-bold text-gray-800 bg-gray-50/50">{r.totals.general_calls}</td>
                                                <td className="text-right px-2 py-2 border-r border-gray-150 font-black text-blue-700 bg-blue-50/20">{r.totals.total_calls}</td>
                                                <td className="text-right px-2 py-2 border-r border-gray-150 font-bold text-gray-800 bg-gray-50/50">{r.totals.priority_visits}</td>
                                                <td className="text-right px-2 py-2 border-r border-gray-150 font-bold text-gray-800 bg-gray-50/50">{r.totals.general_visits}</td>
                                                <td className="text-right px-2 py-2 border-r border-gray-200 font-black text-emerald-700 bg-emerald-50/20">{r.totals.total_visits}</td>

                                                {/* Scoring & Achievement Cells */}
                                                <td className="text-right px-3 py-2 border-r border-gray-200 font-black text-amber-700 bg-amber-50/30 text-sm">{r.points}</td>
                                                <td className="text-right px-3 py-2 border-r border-gray-200 font-black text-blue-700 bg-blue-50/30 text-sm">
                                                    {r.achievement_rate}%
                                                    <div className="w-full bg-gray-200 rounded-full h-1 mt-1 overflow-hidden">
                                                        <div 
                                                            className={`h-full ${r.achievement_rate >= 100 ? 'bg-emerald-500' : r.achievement_rate >= 50 ? 'bg-blue-500' : 'bg-red-400'}`} 
                                                            style={{ width: `${Math.min(r.achievement_rate, 100)}%` }} 
                                                        />
                                                    </div>
                                                </td>
                                                <td className="text-right px-3 py-2 font-black text-emerald-700 bg-emerald-50/30 text-sm">{r.rating}</td>
                                            </tr>
                                        );
                                    })}

                                    {/* Summary Row 1: Total (計) */}
                                    <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                                        <td className="sticky left-0 bg-gray-100 z-20 px-4 py-3 font-black text-gray-900 border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">計</td>
                                        <td className="sticky left-[100px] bg-gray-100 z-20 text-center border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] font-bold text-gray-800">
                                            {summaryData.total.priority_count}
                                        </td>

                                        {displayMonths.map(m => {
                                            const t = summaryData.total.monthly[m];
                                            return (
                                                <React.Fragment key={`total-${m}`}>
                                                    <td className="text-right px-2 py-2 border-r border-gray-100 font-bold text-gray-900">{t.priority_calls}</td>
                                                    <td className="text-right px-2 py-2 border-r border-gray-100 font-bold text-gray-900">{t.general_calls}</td>
                                                    <td className="text-right px-2 py-2 border-r border-gray-100 font-bold text-gray-900">{t.priority_visits}</td>
                                                    <td className="text-right px-2 py-2 border-r border-gray-200 font-bold text-gray-900">{t.general_visits}</td>
                                                </React.Fragment>
                                            );
                                        })}

                                        <td className="text-right px-2 py-2 border-r border-gray-150 font-bold text-gray-900">{summaryData.total.totals.priority_calls}</td>
                                        <td className="text-right px-2 py-2 border-r border-gray-150 font-bold text-gray-900">{summaryData.total.totals.general_calls}</td>
                                        <td className="text-right px-2 py-2 border-r border-gray-150 font-black text-blue-700 bg-blue-100/10">{summaryData.total.totals.total_calls}</td>
                                        <td className="text-right px-2 py-2 border-r border-gray-150 font-bold text-gray-900">{summaryData.total.totals.priority_visits}</td>
                                        <td className="text-right px-2 py-2 border-r border-gray-150 font-bold text-gray-900">{summaryData.total.totals.general_visits}</td>
                                        <td className="text-right px-2 py-2 border-r border-gray-200 font-black text-emerald-700 bg-emerald-100/10">{summaryData.total.totals.total_visits}</td>

                                        <td className="text-right px-3 py-2 border-r border-gray-200 font-black text-amber-700 bg-amber-100/20 text-sm">{summaryData.total.points.toFixed(1)}</td>
                                        <td className="text-right px-3 py-2 border-r border-gray-200 font-black text-blue-700 bg-blue-100/20 text-sm">{summaryData.total.achievement_rate.toFixed(1)}%</td>
                                        <td className="text-right px-3 py-2 font-black text-emerald-700 bg-emerald-100/20 text-sm">{summaryData.total.rating.toFixed(1)}</td>
                                    </tr>

                                    {/* Summary Row 2: Average Points (平均点) */}
                                    <tr className="bg-gray-50 font-bold border-t border-gray-200">
                                        <td className="sticky left-0 bg-gray-50 z-20 px-4 py-3 font-black text-gray-700 border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">平均点</td>
                                        <td className="sticky left-[100px] bg-gray-50 z-20 text-center border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] font-bold text-gray-600">
                                            {summaryData.avg.priority_count.toFixed(1)}
                                        </td>

                                        {displayMonths.map(m => {
                                            const a = summaryData.avg.monthly[m];
                                            return (
                                                <React.Fragment key={`avg-${m}`}>
                                                    <td className="text-right px-2 py-2 border-r border-gray-100 font-semibold text-gray-600">{a.priority_calls.toFixed(1)}</td>
                                                    <td className="text-right px-2 py-2 border-r border-gray-100 font-semibold text-gray-600">{a.general_calls.toFixed(1)}</td>
                                                    <td className="text-right px-2 py-2 border-r border-gray-100 font-semibold text-gray-600">{a.priority_visits.toFixed(1)}</td>
                                                    <td className="text-right px-2 py-2 border-r border-gray-200 font-semibold text-gray-600">{a.general_visits.toFixed(1)}</td>
                                                </React.Fragment>
                                            );
                                        })}

                                        <td className="text-right px-2 py-2 border-r border-gray-150 font-semibold text-gray-600">{summaryData.avg.totals.priority_calls.toFixed(1)}</td>
                                        <td className="text-right px-2 py-2 border-r border-gray-150 font-semibold text-gray-600">{summaryData.avg.totals.general_calls.toFixed(1)}</td>
                                        <td className="text-right px-2 py-2 border-r border-gray-150 font-black text-blue-600">{summaryData.avg.totals.total_calls.toFixed(1)}</td>
                                        <td className="text-right px-2 py-2 border-r border-gray-150 font-semibold text-gray-600">{summaryData.avg.totals.priority_visits.toFixed(1)}</td>
                                        <td className="text-right px-2 py-2 border-r border-gray-150 font-semibold text-gray-600">{summaryData.avg.totals.general_visits.toFixed(1)}</td>
                                        <td className="text-right px-2 py-2 border-r border-gray-200 font-black text-emerald-600">{summaryData.avg.totals.total_visits.toFixed(1)}</td>

                                        <td className="text-right px-3 py-2 border-r border-gray-200 font-black text-amber-700 bg-amber-100/10 text-sm">{summaryData.avg.points.toFixed(1)}</td>
                                        <td className="text-right px-3 py-2 border-r border-gray-200 font-black text-blue-700 bg-blue-100/10 text-sm">{summaryData.avg.achievement_rate.toFixed(1)}%</td>
                                        <td className="text-right px-3 py-2 font-black text-emerald-700 bg-emerald-100/10 text-sm">{summaryData.avg.rating.toFixed(1)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Calculation Methodology Info Alert */}
                <div className="mt-4 bg-amber-50/50 border border-amber-200/80 rounded-xl p-4 shadow-sm flex items-start gap-3">
                    <HelpCircle className="text-amber-600 shrink-0 mt-0.5" size={18} />
                    <div>
                        <h4 className="text-xs font-bold text-amber-900 mb-1">【計算式】活動点数および評価点について</h4>
                        <ul className="list-disc pl-4 space-y-1 text-[11px] text-amber-800">
                            <li><strong>点数の計算方法:</strong> <code>重点電話総数 × 1 ＋ 電話総数(一般) ÷ 2 ＋ 重点訪問総数 × 10 ＋ 訪問件数(一般) × 3</code></li>
                            <li><strong>達成率の計算方法:</strong> <code>総合点数 ÷ (月200点 × 集計対象月数) × 100%</code></li>
                            <li><strong>評価点の計算方法:</strong> <code>総合点数 ÷ 140</code> （10点満点の評価点レートに標準化）</li>
                            <li>※テーブル内の各営業名の左側の「営業名」「重点件数」列は、横スクロール時も左端に固定表示されます。</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
