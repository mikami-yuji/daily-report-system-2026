'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
    PeriodComparisonResponse,
    PeriodComparisonItem,
    PeriodMetricValues,
    getPeriodCategoryComparison
} from '@/lib/api';
import {
    Calendar,
    ChevronDown,
    ChevronRight,
    Download,
    Search,
    TrendingUp,
    TrendingDown,
    Layers,
    User,
    CheckCircle2,
    BarChart3,
    Sparkles,
    Maximize2,
    Minimize2,
    Eye,
    Percent
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function PeriodCategoryComparison(): React.JSX.Element {
    // 過去期の表示モード: 'both' (同期日＆期総量の両方) | 'same_only' (同期日のみ) | 'full_only' (期総量のみ)
    const [pastPeriodView, setPastPeriodView] = useState<'both' | 'same_only' | 'full_only'>('both');

    // 担当営業フィルター
    const [selectedRep, setSelectedRep] = useState<string>('all');

    // 表示指標モード: 'both' (ｍ数＋枚数) | 'meters' (ｍ数のみ) | 'sheets' (枚数のみ) | 'with_amount' (数量＋金額)
    const [metricDisplay, setMetricDisplay] = useState<'both' | 'meters' | 'sheets' | 'with_amount'>('both');

    // テキスト検索フィルター
    const [searchTerm, setSearchTerm] = useState<string>('');

    // アコーディオン展開状態（IDのSet）
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    // APIデータ取得
    const [data, setData] = useState<PeriodComparisonResponse | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await getPeriodCategoryComparison({
                sales_rep: selectedRep !== 'all' ? selectedRep : undefined
            });
            setData(res);

            // 初期展開: 第1階層（種別）をデフォルト展開
            const initialExpanded = new Set<string>();
            res.categories.forEach(cat => initialExpanded.add(cat.id));
            setExpandedIds(initialExpanded);
        } catch {
            toast.error('3期比較データの取得に失敗しました');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [selectedRep]);

    // 展開・折りたたみのトグル
    const toggleExpand = (id: string) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    // すべて展開
    const expandAll = () => {
        if (!data) return;
        const allIds = new Set<string>();
        const traverse = (items: PeriodComparisonItem[]) => {
            items.forEach(item => {
                allIds.add(item.id);
                if (item.children && item.children.length > 0) {
                    traverse(item.children);
                }
            });
        };
        traverse(data.categories);
        setExpandedIds(allIds);
    };

    // すべて折りたたむ
    const collapseAll = () => {
        setExpandedIds(new Set());
    };

    // フォーマット用ヘルパー
    const formatNumber = (val: number | null | undefined): string => {
        if (val === null || val === undefined || isNaN(val)) return '-';
        return val.toLocaleString('ja-JP');
    };

    const formatRate = (rate: number | null | undefined): React.JSX.Element => {
        if (rate === null || rate === undefined || isNaN(rate)) {
            return <span className="text-gray-400 font-mono">-</span>;
        }
        const isUp = rate >= 100.0;
        return (
            <span
                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-bold font-mono ${
                    isUp ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' : 'text-amber-700 bg-amber-50 border border-amber-200'
                }`}
            >
                {isUp ? <TrendingUp size={11} className="text-emerald-600" /> : <TrendingDown size={11} className="text-amber-600" />}
                {rate.toFixed(1)}%
            </span>
        );
    };

    const formatProgressRate = (rate: number | null | undefined): React.JSX.Element => {
        if (rate === null || rate === undefined || isNaN(rate)) {
            return <span className="text-gray-400 font-mono">-</span>;
        }
        return (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium font-mono text-indigo-700 bg-indigo-50 border border-indigo-200" title="前期の通期総量に対する現時点の進捗率">
                進捗 {rate.toFixed(1)}%
            </span>
        );
    };

    const formatDiff = (diff: number, unit: string): React.JSX.Element => {
        if (!diff || diff === 0) return <span className="text-gray-400 font-mono">-</span>;
        const isPlus = diff > 0;
        return (
            <span className={`text-[11px] font-mono ${isPlus ? 'text-emerald-600 font-semibold' : 'text-rose-600 font-semibold'}`}>
                {isPlus ? `+${diff.toLocaleString()}` : diff.toLocaleString()} {unit}
            </span>
        );
    };

    // フィルタリング（検索語によるツリーの絞り込み）
    const filteredCategories = useMemo(() => {
        if (!data?.categories) return [];
        if (!searchTerm.trim()) return data.categories;

        const term = searchTerm.trim().toLowerCase();

        const filterTree = (items: PeriodComparisonItem[]): PeriodComparisonItem[] => {
            const result: PeriodComparisonItem[] = [];
            for (const item of items) {
                const nameMatches = item.name.toLowerCase().includes(term);
                const childrenMatches = item.children ? filterTree(item.children) : [];
                if (nameMatches || childrenMatches.length > 0) {
                    result.push({
                        ...item,
                        children: childrenMatches.length > 0 ? childrenMatches : item.children
                    });
                }
            }
            return result;
        };

        return filterTree(data.categories);
    }, [data, searchTerm]);

    // CSVエクスポート
    const handleExportCsv = () => {
        if (!data || !data.categories) return;

        const rows: string[][] = [
            [
                '大分類(種別)',
                '中分類(材質)',
                '小分類(量目)',
                '今期_ｍ数',
                '今期_枚数',
                '今期_売上金額',
                '前期同期_ｍ数',
                '前期同期_枚数',
                '前期同期_売上金額',
                '前期総量_ｍ数',
                '前期総量_枚数',
                '前期総量_売上金額',
                '前々期同期_ｍ数',
                '前々期同期_枚数',
                '前々期同期_売上金額',
                '前々期総量_ｍ数',
                '前々期総量_枚数',
                '前々期総量_売上金額',
                '対前期同期比_ｍ数%',
                '対前期同期比_枚数%',
                '対前期同期比_金額%',
                '対前期総量進捗率_ｍ数%',
                '対前期総量進捗率_枚数%',
                '対前期総量進捗率_金額%',
                '前期同期差分_ｍ数',
                '前期同期差分_枚数',
                '前期同期差分_金額'
            ]
        ];

        const escapeCsv = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;

        const traverse = (
            catName: string,
            matName: string,
            capName: string,
            item: PeriodComparisonItem
        ) => {
            if (item.level === 'category') {
                catName = item.name;
            } else if (item.level === 'material') {
                matName = item.name;
            } else if (item.level === 'capacity') {
                capName = item.name;
            }

            if (!item.children || item.children.length === 0) {
                rows.push([
                    escapeCsv(catName),
                    escapeCsv(matName),
                    escapeCsv(capName || (item.is_seal ? 'シール(量目なし)' : item.is_roll ? 'ロール(量目なし)' : '-')),
                    item.current.meters.toString(),
                    item.current.sheets.toString(),
                    item.current.amount.toString(),
                    item.previous_same.meters.toString(),
                    item.previous_same.sheets.toString(),
                    item.previous_same.amount.toString(),
                    item.previous_full.meters.toString(),
                    item.previous_full.sheets.toString(),
                    item.previous_full.amount.toString(),
                    item.two_years_ago_same.meters.toString(),
                    item.two_years_ago_same.sheets.toString(),
                    item.two_years_ago_same.amount.toString(),
                    item.two_years_ago_full.meters.toString(),
                    item.two_years_ago_full.sheets.toString(),
                    item.two_years_ago_full.amount.toString(),
                    item.growth_rate_meters !== null ? `${item.growth_rate_meters}%` : '-',
                    item.growth_rate_sheets !== null ? `${item.growth_rate_sheets}%` : '-',
                    item.growth_rate_amount !== null ? `${item.growth_rate_amount}%` : '-',
                    item.progress_rate_meters !== null ? `${item.progress_rate_meters}%` : '-',
                    item.progress_rate_sheets !== null ? `${item.progress_rate_sheets}%` : '-',
                    item.progress_rate_amount !== null ? `${item.progress_rate_amount}%` : '-',
                    item.diff_meters.toString(),
                    item.diff_sheets.toString(),
                    item.diff_amount.toString()
                ]);
            }

            if (item.children) {
                item.children.forEach(child => traverse(catName, matName, capName, child));
            }
        };

        data.categories.forEach(cat => traverse('', '', '', cat));

        const csvContent = '\uFEFF' + rows.map(r => r.join(',')).join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `売上3期数量比較_同期日と期総量_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        toast.success('3期比較CSVをダウンロードしました');
    };

    // レンダリング用再帰行コンポーネント
    const renderRow = (item: PeriodComparisonItem, depth: number = 0): React.JSX.Element => {
        const isExpanded = expandedIds.has(item.id);
        const hasChildren = item.children && item.children.length > 0;

        // 行のスタイル階層
        const rowBg =
            item.level === 'category'
                ? 'bg-slate-50/90 font-bold border-t-2 border-slate-300 text-slate-900 hover:bg-slate-100/90'
                : item.level === 'material'
                ? 'bg-white font-semibold border-t border-slate-200 text-slate-800 hover:bg-blue-50/40'
                : 'bg-white font-normal border-t border-slate-100 text-slate-700 hover:bg-gray-50';

        const indentPadding =
            depth === 0 ? 'pl-3' : depth === 1 ? 'pl-8' : 'pl-14';

        return (
            <React.Fragment key={item.id}>
                <tr className={`transition-colors text-xs ${rowBg}`}>
                    {/* 分類名 */}
                    <td className={`py-2 pr-3 ${indentPadding} whitespace-nowrap`}>
                        <div className="flex items-center gap-1.5">
                            {hasChildren ? (
                                <button
                                    type="button"
                                    onClick={() => toggleExpand(item.id)}
                                    className="p-0.5 rounded hover:bg-slate-200 text-slate-600 transition-transform cursor-pointer"
                                    title={isExpanded ? '折りたたむ' : '展開する'}
                                >
                                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </button>
                            ) : (
                                <span className="w-4 inline-block text-center text-slate-300">•</span>
                            )}

                            <span className="truncate flex items-center gap-1">
                                {item.name}
                                {item.is_seal && (
                                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 font-medium border border-amber-300">
                                        シール（量目なし）
                                    </span>
                                )}
                                {item.is_roll && (
                                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-cyan-100 text-cyan-800 font-medium border border-cyan-300">
                                        ロール（量目なし）
                                    </span>
                                )}
                            </span>
                        </div>
                    </td>

                    {/* 今期 (2026年度) */}
                    <td className="py-2 px-2 text-right font-mono">
                        {(metricDisplay === 'both' || metricDisplay === 'meters' || metricDisplay === 'with_amount') && (
                            <div className="font-bold text-slate-900">
                                {formatNumber(item.current.meters)} <span className="text-[10px] text-gray-500 font-normal">ｍ</span>
                            </div>
                        )}
                        {(metricDisplay === 'both' || metricDisplay === 'sheets' || metricDisplay === 'with_amount') && (
                            <div className="text-[11px] text-slate-800 font-semibold">
                                {formatNumber(item.current.sheets)} <span className="text-[10px] text-gray-500 font-normal">枚</span>
                            </div>
                        )}
                        {metricDisplay === 'with_amount' && (
                            <div className="text-[10px] text-indigo-700 font-medium">
                                ¥{formatNumber(item.current.amount)}
                            </div>
                        )}
                    </td>

                    {/* 前期 (2025年度): 同期日 & 期総量 */}
                    <td className="py-2 px-2 text-right font-mono bg-slate-50/40">
                        {/* 同期日 */}
                        {(pastPeriodView === 'both' || pastPeriodView === 'same_only') && (
                            <div className="space-y-0.5">
                                {pastPeriodView === 'both' && (
                                    <div className="text-[10px] text-cyan-700 font-medium border-b border-cyan-100 pb-0.5 mb-0.5">
                                        同期日 ({data?.period_info?.previous?.same_label?.replace('前期同期 ', '') || '同期'})
                                    </div>
                                )}
                                {(metricDisplay === 'both' || metricDisplay === 'meters' || metricDisplay === 'with_amount') && (
                                    <div className="text-slate-800">
                                        {formatNumber(item.previous_same.meters)} <span className="text-[10px] text-gray-500 font-normal">ｍ</span>
                                    </div>
                                )}
                                {(metricDisplay === 'both' || metricDisplay === 'sheets' || metricDisplay === 'with_amount') && (
                                    <div className="text-[11px] text-slate-700">
                                        {formatNumber(item.previous_same.sheets)} <span className="text-[10px] text-gray-500 font-normal">枚</span>
                                    </div>
                                )}
                                {metricDisplay === 'with_amount' && (
                                    <div className="text-[10px] text-slate-600">
                                        ¥{formatNumber(item.previous_same.amount)}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 期総量（通期） */}
                        {(pastPeriodView === 'both' || pastPeriodView === 'full_only') && (
                            <div className={`space-y-0.5 ${pastPeriodView === 'both' ? 'mt-2 pt-1 border-t border-slate-200/80 bg-slate-100/40 p-1 rounded' : ''}`}>
                                {pastPeriodView === 'both' && (
                                    <div className="text-[10px] text-slate-500 font-semibold flex items-center justify-end gap-1">
                                        <span>期総量 (年間)</span>
                                    </div>
                                )}
                                {(metricDisplay === 'both' || metricDisplay === 'meters' || metricDisplay === 'with_amount') && (
                                    <div className="text-slate-600 font-medium">
                                        {formatNumber(item.previous_full.meters)} <span className="text-[10px] text-gray-400 font-normal">ｍ</span>
                                    </div>
                                )}
                                {(metricDisplay === 'both' || metricDisplay === 'sheets' || metricDisplay === 'with_amount') && (
                                    <div className="text-[11px] text-slate-600">
                                        {formatNumber(item.previous_full.sheets)} <span className="text-[10px] text-gray-400 font-normal">枚</span>
                                    </div>
                                )}
                                {metricDisplay === 'with_amount' && (
                                    <div className="text-[10px] text-slate-500">
                                        ¥{formatNumber(item.previous_full.amount)}
                                    </div>
                                )}
                            </div>
                        )}
                    </td>

                    {/* 前々期 (2024年度): 同期日 & 期総量 */}
                    <td className="py-2 px-2 text-right font-mono bg-slate-50/70">
                        {/* 同期日 */}
                        {(pastPeriodView === 'both' || pastPeriodView === 'same_only') && (
                            <div className="space-y-0.5">
                                {pastPeriodView === 'both' && (
                                    <div className="text-[10px] text-cyan-700 font-medium border-b border-cyan-100 pb-0.5 mb-0.5">
                                        同期日 ({data?.period_info?.two_years_ago?.same_label?.replace('前々期同期 ', '') || '同期'})
                                    </div>
                                )}
                                {(metricDisplay === 'both' || metricDisplay === 'meters' || metricDisplay === 'with_amount') && (
                                    <div className="text-slate-700">
                                        {formatNumber(item.two_years_ago_same.meters)} <span className="text-[10px] text-gray-500 font-normal">ｍ</span>
                                    </div>
                                )}
                                {(metricDisplay === 'both' || metricDisplay === 'sheets' || metricDisplay === 'with_amount') && (
                                    <div className="text-[11px] text-slate-600">
                                        {formatNumber(item.two_years_ago_same.sheets)} <span className="text-[10px] text-gray-500 font-normal">枚</span>
                                    </div>
                                )}
                                {metricDisplay === 'with_amount' && (
                                    <div className="text-[10px] text-slate-500">
                                        ¥{formatNumber(item.two_years_ago_same.amount)}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 期総量（通期） */}
                        {(pastPeriodView === 'both' || pastPeriodView === 'full_only') && (
                            <div className={`space-y-0.5 ${pastPeriodView === 'both' ? 'mt-2 pt-1 border-t border-slate-200/80 bg-slate-100/40 p-1 rounded' : ''}`}>
                                {pastPeriodView === 'both' && (
                                    <div className="text-[10px] text-slate-500 font-semibold flex items-center justify-end gap-1">
                                        <span>期総量 (年間)</span>
                                    </div>
                                )}
                                {(metricDisplay === 'both' || metricDisplay === 'meters' || metricDisplay === 'with_amount') && (
                                    <div className="text-slate-500 font-medium">
                                        {formatNumber(item.two_years_ago_full.meters)} <span className="text-[10px] text-gray-400 font-normal">ｍ</span>
                                    </div>
                                )}
                                {(metricDisplay === 'both' || metricDisplay === 'sheets' || metricDisplay === 'with_amount') && (
                                    <div className="text-[11px] text-slate-500">
                                        {formatNumber(item.two_years_ago_full.sheets)} <span className="text-[10px] text-gray-400 font-normal">枚</span>
                                    </div>
                                )}
                                {metricDisplay === 'with_amount' && (
                                    <div className="text-[10px] text-slate-400">
                                        ¥{formatNumber(item.two_years_ago_full.amount)}
                                    </div>
                                )}
                            </div>
                        )}
                    </td>

                    {/* 対前期同期比 (%) & 前期総量進捗率 */}
                    <td className="py-2 px-2 text-center">
                        <div className="flex flex-col items-center gap-1">
                            <div className="text-[9px] text-gray-500 font-semibold">対同期比:</div>
                            {(metricDisplay === 'both' || metricDisplay === 'meters') && item.current.meters > 0 && (
                                <div className="flex items-center gap-1">
                                    <span className="text-[9px] text-gray-400">ｍ:</span>
                                    {formatRate(item.growth_rate_meters)}
                                </div>
                            )}
                            {(metricDisplay === 'both' || metricDisplay === 'sheets') && (item.current.sheets > 0 || item.current.meters === 0) && (
                                <div className="flex items-center gap-1">
                                    <span className="text-[9px] text-gray-400">枚:</span>
                                    {formatRate(item.growth_rate_sheets)}
                                </div>
                            )}
                            {metricDisplay === 'with_amount' && (
                                <div className="flex items-center gap-1">
                                    <span className="text-[9px] text-indigo-500">額:</span>
                                    {formatRate(item.growth_rate_amount)}
                                </div>
                            )}

                            {/* 前期総量に対する進捗率 */}
                            {pastPeriodView !== 'same_only' && (
                                <div className="pt-1 mt-0.5 border-t border-slate-100 flex flex-col items-center gap-0.5 w-full">
                                    {(metricDisplay === 'both' || metricDisplay === 'meters') && item.current.meters > 0 && (
                                        <div className="text-[10px] text-indigo-600 font-mono">
                                            ｍ {formatProgressRate(item.progress_rate_meters)}
                                        </div>
                                    )}
                                    {(metricDisplay === 'both' || metricDisplay === 'sheets') && (item.current.sheets > 0 || item.current.meters === 0) && (
                                        <div className="text-[10px] text-indigo-600 font-mono">
                                            枚 {formatProgressRate(item.progress_rate_sheets)}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </td>

                    {/* 対前々期同期比 (%) */}
                    <td className="py-2 px-2 text-center bg-slate-50/40">
                        <div className="flex flex-col items-center gap-1">
                            <div className="text-[9px] text-gray-500 font-semibold">対同期比:</div>
                            {(metricDisplay === 'both' || metricDisplay === 'meters') && item.current.meters > 0 && (
                                <div className="flex items-center gap-1">
                                    <span className="text-[9px] text-gray-400">ｍ:</span>
                                    {formatRate(item.two_years_growth_rate_meters)}
                                </div>
                            )}
                            {(metricDisplay === 'both' || metricDisplay === 'sheets') && (item.current.sheets > 0 || item.current.meters === 0) && (
                                <div className="flex items-center gap-1">
                                    <span className="text-[9px] text-gray-400">枚:</span>
                                    {formatRate(item.two_years_growth_rate_sheets)}
                                </div>
                            )}
                            {metricDisplay === 'with_amount' && (
                                <div className="flex items-center gap-1">
                                    <span className="text-[9px] text-indigo-500">額:</span>
                                    {formatRate(item.two_years_growth_rate_amount)}
                                </div>
                            )}
                        </div>
                    </td>

                    {/* 前期同期差分 */}
                    <td className="py-2 px-2 text-right">
                        <div className="flex flex-col items-end gap-1">
                            {(metricDisplay === 'both' || metricDisplay === 'meters') && item.diff_meters !== 0 && (
                                <div>{formatDiff(item.diff_meters, 'ｍ')}</div>
                            )}
                            {(metricDisplay === 'both' || metricDisplay === 'sheets') && (item.diff_sheets !== 0 || item.diff_meters === 0) && (
                                <div>{formatDiff(item.diff_sheets, '枚')}</div>
                            )}
                            {metricDisplay === 'with_amount' && (
                                <div className="text-[10px] text-indigo-700">
                                    {formatDiff(item.diff_amount, '円')}
                                </div>
                            )}
                        </div>
                    </td>
                </tr>

                {/* 子階層の再帰レンダリング */}
                {isExpanded && item.children && item.children.map(child => renderRow(child, depth + 1))}
            </React.Fragment>
        );
    };

    return (
        <div className="space-y-4 animate-fadeIn">
            {/* 1. ヘッダーカード */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-5 shadow-lg border border-slate-700/50">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-xs font-bold border border-amber-400/30 flex items-center gap-1">
                                <Sparkles size={12} />
                                3期数量比較分析（今期・前期・前々期）
                            </span>
                            <span className="text-xs text-slate-300 font-mono">
                                会計年度: 2月1日〜翌年1月31日
                            </span>
                        </div>
                        <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
                            <BarChart3 className="text-cyan-400" size={24} />
                            種別・材質別・量目別 数量（ｍ数・枚数）比較
                        </h2>
                        <p className="text-xs text-slate-300 leading-relaxed">
                            確定売上データをもとに、前期・前々期の「<strong className="text-cyan-300">同期日実績</strong>」と「<strong className="text-cyan-300">その期の総量（通期実績）</strong>」を並記比較。
                            <span className="text-amber-300 font-medium ml-1">※シール・ロールは量目区分なし（一括集計）／ソフクラは独立中分類</span>
                        </p>
                    </div>

                    {/* 過去期表示切り替えトグル */}
                    <div className="flex flex-wrap items-center gap-1.5 bg-slate-800/80 p-1.5 rounded-xl border border-slate-700 text-xs">
                        <span className="text-slate-400 font-medium px-2 flex items-center gap-1">
                            <Eye size={13} />
                            過去期の表示:
                        </span>
                        <button
                            type="button"
                            onClick={() => setPastPeriodView('both')}
                            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                                pastPeriodView === 'both'
                                    ? 'bg-cyan-500 text-white shadow-md'
                                    : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                            }`}
                        >
                            同期日 ＋ 期総量（両方）
                        </button>
                        <button
                            type="button"
                            onClick={() => setPastPeriodView('same_only')}
                            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                                pastPeriodView === 'same_only'
                                    ? 'bg-cyan-500 text-white shadow-md'
                                    : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                            }`}
                        >
                            同期日のみ
                        </button>
                        <button
                            type="button"
                            onClick={() => setPastPeriodView('full_only')}
                            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                                pastPeriodView === 'full_only'
                                    ? 'bg-cyan-500 text-white shadow-md'
                                    : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                            }`}
                        >
                            期総量のみ
                        </button>
                    </div>
                </div>

                {/* 期間範囲インジケーター */}
                {data?.period_info && (
                    <div className="mt-4 pt-3 border-t border-slate-700/60 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
                        <div className="flex flex-wrap items-center gap-3">
                            <span className="font-semibold text-cyan-300">集計期間定義:</span>
                            {data.period_info.current && (
                                <span className="bg-slate-800 px-2 py-0.5 rounded text-[11px] font-mono border border-slate-700">
                                    {data.period_info.current.name}: {data.period_info.current.start} 〜 {data.period_info.current.end}
                                </span>
                            )}
                            {data.period_info.previous && (
                                <span className="bg-slate-800 px-2 py-0.5 rounded text-[11px] font-mono border border-slate-700">
                                    {data.period_info.previous.name}: 同期 {data.period_info.previous.same_start} 〜 {data.period_info.previous.same_end} | 通期 {data.period_info.previous.full_start} 〜 {data.period_info.previous.full_end}
                                </span>
                            )}
                            {data.period_info.two_years_ago && (
                                <span className="bg-slate-800 px-2 py-0.5 rounded text-[11px] font-mono border border-slate-700">
                                    {data.period_info.two_years_ago.name}: 同期 {data.period_info.two_years_ago.same_start} 〜 {data.period_info.two_years_ago.same_end} | 通期 {data.period_info.two_years_ago.full_start} 〜 {data.period_info.two_years_ago.full_end}
                                </span>
                            )}
                        </div>
                        <div className="text-[11px] text-slate-400">
                            最新売上日: <strong className="text-white font-mono">{data.period_info.latest_sales_date || '-'}</strong>
                        </div>
                    </div>
                )}
            </div>

            {/* 2. サマリー指標カード（3枚） */}
            {data?.summary && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* ロール数量 (ｍ数) */}
                    <div className="bg-white rounded-xl p-4 shadow-xs border border-sf-border flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                                <Layers size={16} className="text-cyan-600" />
                                <span>総ロール数量 (ｍ数)</span>
                            </div>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-700 font-medium">
                                ロール原反
                            </span>
                        </div>
                        <div className="mt-3 flex items-baseline justify-between">
                            <div>
                                <span className="text-2xl font-extrabold font-mono text-slate-900">
                                    {formatNumber(data.summary.current.meters)}
                                </span>
                                <span className="text-xs text-gray-500 ml-1">ｍ</span>
                            </div>
                            <div className="text-right">
                                <div className="text-[11px] text-gray-500">
                                    前期同期: {formatNumber(data.summary.previous_same.meters)} ｍ
                                </div>
                                <div className="text-[10px] text-slate-400">
                                    前期総量: {formatNumber(data.summary.previous_full.meters)} ｍ
                                </div>
                                <div className="mt-1 flex items-center justify-end gap-1.5">
                                    <span className="text-[10px] text-gray-400">対同期:</span>
                                    {formatRate(data.summary.growth_rate_meters)}
                                    <span className="text-[10px] text-indigo-600 font-mono font-medium ml-1">
                                        (進捗: {data.summary.progress_rate_meters}%)
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 単袋・シール数量 (枚数) */}
                    <div className="bg-white rounded-xl p-4 shadow-xs border border-sf-border flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                                <CheckCircle2 size={16} className="text-emerald-600" />
                                <span>総単袋・シール数量 (枚数)</span>
                            </div>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">
                                袋・シール
                            </span>
                        </div>
                        <div className="mt-3 flex items-baseline justify-between">
                            <div>
                                <span className="text-2xl font-extrabold font-mono text-slate-900">
                                    {formatNumber(data.summary.current.sheets)}
                                </span>
                                <span className="text-xs text-gray-500 ml-1">枚</span>
                            </div>
                            <div className="text-right">
                                <div className="text-[11px] text-gray-500">
                                    前期同期: {formatNumber(data.summary.previous_same.sheets)} 枚
                                </div>
                                <div className="text-[10px] text-slate-400">
                                    前期総量: {formatNumber(data.summary.previous_full.sheets)} 枚
                                </div>
                                <div className="mt-1 flex items-center justify-end gap-1.5">
                                    <span className="text-[10px] text-gray-400">対同期:</span>
                                    {formatRate(data.summary.growth_rate_sheets)}
                                    <span className="text-[10px] text-indigo-600 font-mono font-medium ml-1">
                                        (進捗: {data.summary.progress_rate_sheets}%)
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 売上金額合計 */}
                    <div className="bg-white rounded-xl p-4 shadow-xs border border-sf-border flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                                <TrendingUp size={16} className="text-indigo-600" />
                                <span>売上金額合計</span>
                            </div>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-medium">
                                確定売上
                            </span>
                        </div>
                        <div className="mt-3 flex items-baseline justify-between">
                            <div>
                                <span className="text-2xl font-extrabold font-mono text-indigo-900">
                                    ¥{formatNumber(data.summary.current.amount)}
                                </span>
                            </div>
                            <div className="text-right">
                                <div className="text-[11px] text-gray-500">
                                    前期同期: ¥{formatNumber(data.summary.previous_same.amount)}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                    前期総量: ¥{formatNumber(data.summary.previous_full.amount)}
                                </div>
                                <div className="mt-1 flex items-center justify-end gap-1.5">
                                    <span className="text-[10px] text-gray-400">対同期:</span>
                                    {formatRate(data.summary.growth_rate_amount)}
                                    <span className="text-[10px] text-indigo-600 font-mono font-medium ml-1">
                                        (進捗: {data.summary.progress_rate_amount}%)
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 3. ツールバー（フィルター＆表示切替） */}
            <div className="bg-white rounded-xl p-3 shadow-xs border border-sf-border flex flex-wrap items-center justify-between gap-3">
                {/* 左側: 担当者 & 検索 & 指標切替 */}
                <div className="flex flex-wrap items-center gap-2.5">
                    {/* 担当営業セレクター */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-sf-border bg-gray-50 text-xs">
                        <User size={14} className="text-gray-500" />
                        <span className="text-gray-500 font-medium">担当営業:</span>
                        <select
                            value={selectedRep}
                            onChange={e => setSelectedRep(e.target.value)}
                            className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
                        >
                            <option value="all">全営業担当</option>
                            {(data?.sales_reps || []).map(r => (
                                <option key={r} value={r}>
                                    {r}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* 指標切り替えセレクター */}
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs">
                        <button
                            type="button"
                            onClick={() => setMetricDisplay('both')}
                            className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                                metricDisplay === 'both' ? 'bg-white text-slate-900 shadow-xs' : 'text-gray-600 hover:text-slate-900'
                            }`}
                        >
                            数量 (ｍ数 ＋ 枚数)
                        </button>
                        <button
                            type="button"
                            onClick={() => setMetricDisplay('meters')}
                            className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                                metricDisplay === 'meters' ? 'bg-white text-slate-900 shadow-xs' : 'text-gray-600 hover:text-slate-900'
                            }`}
                        >
                            ｍ数のみ
                        </button>
                        <button
                            type="button"
                            onClick={() => setMetricDisplay('sheets')}
                            className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                                metricDisplay === 'sheets' ? 'bg-white text-slate-900 shadow-xs' : 'text-gray-600 hover:text-slate-900'
                            }`}
                        >
                            枚数のみ
                        </button>
                        <button
                            type="button"
                            onClick={() => setMetricDisplay('with_amount')}
                            className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                                metricDisplay === 'with_amount' ? 'bg-white text-indigo-700 shadow-xs' : 'text-gray-600 hover:text-slate-900'
                            }`}
                        >
                            数量 ＋ 金額
                        </button>
                    </div>

                    {/* クイック検索 */}
                    <div className="relative">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="種別・材質・量目で検索..."
                            className="pl-8 pr-3 py-1.5 text-xs bg-gray-50 border border-sf-border rounded-lg text-slate-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-sf-light-blue w-48"
                        />
                    </div>
                </div>

                {/* 右側: 展開・折りたたみ & CSVダウンロード */}
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={expandAll}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        title="すべての分類を展開"
                    >
                        <Maximize2 size={13} />
                        すべて展開
                    </button>
                    <button
                        type="button"
                        onClick={collapseAll}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        title="すべての分類を折りたたむ"
                    >
                        <Minimize2 size={13} />
                        折りたたむ
                    </button>

                    <button
                        type="button"
                        onClick={handleExportCsv}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer ml-1"
                    >
                        <Download size={14} />
                        CSV出力
                    </button>
                </div>
            </div>

            {/* 4. メイン比較テーブル */}
            <div className="bg-white rounded-xl shadow-xs border border-sf-border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-800 text-white text-xs font-bold border-b border-slate-700">
                                <th className="py-3 px-3 w-1/4">
                                    分類（種別 ＞ 材質 ＞ 量目）
                                </th>
                                <th className="py-3 px-2 text-right w-36">
                                    <div>今期 (2026年度)</div>
                                    <div className="text-[10px] text-cyan-300 font-normal">
                                        {data?.period_info?.current?.label || '2/1 〜 本日'}
                                    </div>
                                </th>
                                <th className="py-3 px-2 text-right w-44 bg-slate-750">
                                    <div>前期 (2025年度)</div>
                                    <div className="text-[10px] text-cyan-200 font-normal">
                                        {pastPeriodView === 'both' ? '同期日 ＆ 期総量' : pastPeriodView === 'same_only' ? '同期日のみ' : '期総量のみ'}
                                    </div>
                                </th>
                                <th className="py-3 px-2 text-right w-44 bg-slate-700">
                                    <div>前々期 (2024年度)</div>
                                    <div className="text-[10px] text-cyan-200 font-normal">
                                        {pastPeriodView === 'both' ? '同期日 ＆ 期総量' : pastPeriodView === 'same_only' ? '同期日のみ' : '期総量のみ'}
                                    </div>
                                </th>
                                <th className="py-3 px-2 text-center w-32">
                                    <div>対前期同期比 (%)</div>
                                    <div className="text-[10px] text-slate-300 font-normal">（および進捗率）</div>
                                </th>
                                <th className="py-3 px-2 text-center w-28 bg-slate-750">
                                    <div>対前々期比 (%)</div>
                                    <div className="text-[10px] text-slate-300 font-normal">（同期比）</div>
                                </th>
                                <th className="py-3 px-2 text-right w-32">
                                    <div>前期比増減</div>
                                    <div className="text-[10px] text-slate-300 font-normal">（同期差分）</div>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="py-12 text-center text-gray-500">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <div className="w-6 h-6 border-2 border-sf-light-blue border-t-transparent rounded-full animate-spin" />
                                            <span className="text-xs">3期比較データを高速集計中...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredCategories.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-10 text-center text-gray-400 text-xs">
                                        該当する売上データが見つかりませんでした。
                                    </td>
                                </tr>
                            ) : (
                                filteredCategories.map(cat => renderRow(cat, 0))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* テーブルフッター補足 */}
                <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between text-[11px] text-gray-500">
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="font-semibold text-slate-700">注記:</span>
                        <span>・ロール製品はｍ数、単袋およびシール等は枚数で算出しています。</span>
                        <span className="text-cyan-700 font-medium">・ロール製品およびシール製品は量目区分なし（材質階層で一括集計）としています。</span>
                        <span className="text-amber-800 font-medium">・ソフクラは独立中分類とし、クラフトはバックポリ（BP）あり／なしを区別しています。</span>
                    </div>
                    <div>
                        行をクリックすると中分類（材質）・小分類（量目）にドリルダウンできます。
                    </div>
                </div>
            </div>
        </div>
    );
}
