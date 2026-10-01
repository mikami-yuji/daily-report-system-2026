'use client';

import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useFile } from '@/context/FileContext';
import { useMonthlySummaryStats } from '@/hooks/useStatsHooks';
import { ChevronLeft, ChevronRight, Printer, FileText, Users, Phone, MapPin, Palette, Star, TrendingUp, ChevronDown, ChevronUp, CornerDownRight, Image as ImageIcon, Loader2, ArrowUpRight, ArrowDownRight, Coins, Calendar, AlertTriangle, CheckCircle2, Clock, Sparkles, Layers } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import toast from 'react-hot-toast';
import { searchDesignImages, DesignImage } from '@/lib/api';
import DesignImagePreviewModal from '@/components/reports/DesignImagePreviewModal';
import DesignImageHoverButton, { prefetchDesignImagePresence } from '@/components/reports/DesignImageHoverButton';

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

// 得意先CD・直送先CDの整形（.0の除去、nan除外など）
function formatCustomerCode(code: string | number | undefined | null): string {
    if (!code) return '';
    const str = String(code).trim();
    if (str.toLowerCase() === 'nan' || str.toLowerCase() === 'none' || str === '-') return '';
    return str.replace(/\.0$/, '');
}

// ランク文字列のクリーンアップ（nan等の除外）
function formatRank(rank: string | undefined | null): string {
    if (!rank) return '';
    const str = String(rank).trim();
    if (str.toLowerCase() === 'nan' || str.toLowerCase() === 'none' || str === '-') return '';
    return str;
}

// 金額フォーマット (¥#,###)
function formatCurrency(val: number | null | undefined): string {
    if (val == null) return '-';
    return `¥${Math.round(val).toLocaleString()}`;
}

// 前年比フォーマット
function formatRatio(ratio: number | null | undefined): { text: string; color: string } {
    if (ratio == null) return { text: '-', color: 'text-gray-400' };
    const formatted = `${ratio.toFixed(1)}%`;
    if (ratio >= 100) {
        return { text: formatted, color: 'text-emerald-600 font-bold' };
    } else if (ratio > 0) {
        return { text: formatted, color: 'text-rose-600 font-bold' };
    } else {
        return { text: formatted, color: 'text-gray-500' };
    }
}

type SummaryTab = 'priority' | 'area' | 'timeline';

export default function MonthlySummaryPage(): React.ReactElement {
    const { selectedFile } = useFile();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [activeTab, setActiveTab] = useState<SummaryTab>('priority');
    const [collapsedCustomers, setCollapsedCustomers] = useState<Set<string>>(new Set());
    const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
    const [mounted, setMounted] = useState(false);
    const printRef = useRef<HTMLDivElement>(null);

    // デザイン画像検索用ステート
    const [searchingImage, setSearchingImage] = useState(false);
    const [imageResults, setImageResults] = useState<DesignImage[]>([]);
    const [showImageModal, setShowImageModal] = useState(false);
    const [currentSearchDesignNo, setCurrentSearchDesignNo] = useState<string>('');

    // 画像検索アクション
    const handleImageSearch = async (designNo: string, e: React.MouseEvent): Promise<void> => {
        e.stopPropagation(); // アコーディオンの他部分のクリックイベントを防止
        if (!designNo) return;
        const cleanDesignNo = String(designNo).replace('.0', '').trim();
        setCurrentSearchDesignNo(cleanDesignNo);
        setSearchingImage(true);
        try {
            const result = await searchDesignImages(cleanDesignNo, selectedFile || undefined);
            if (result.images && result.images.length > 0) {
                setImageResults(result.images);
                setShowImageModal(true);
                toast.success(`${result.images.length}件の画像が見つかりました`);
            } else {
                setImageResults([]);
                toast.error('関連するデザイン画像が見つかりませんでした');
            }
        } catch (error) {
            console.error('Failed to search design images:', error);
            toast.error('画像検索中にエラーが発生しました');
        } finally {
            setSearchingImage(false);
        }
    };

    const toggleCustomerCollapse = (code: string): void => {
        setCollapsedCustomers(prev => {
            const next = new Set(prev);
            if (next.has(code)) next.delete(code);
            else next.add(code);
            return next;
        });
    };

    const toggleDateExpand = (date: string): void => {
        setExpandedDates(prev => {
            const next = new Set(prev);
            if (next.has(date)) next.delete(date);
            else next.add(date);
            return next;
        });
    };

    useEffect(() => {
        requestAnimationFrame(() => {
            setMounted(true);
        });
    }, []);

    // 選択中の年月パーツ
    const yearShort = String(currentDate.getFullYear()).slice(-2);
    const monthStr = String(currentDate.getMonth() + 1).padStart(2, '0');
    const monthPrefix = `${yearShort}/${monthStr}`;
    const monthLabel = `${currentDate.getFullYear()}年${currentDate.getMonth() + 1}月`;

    // 担当者名
    const staffName = useMemo(() => extractStaffName(selectedFile), [selectedFile]);

    // 月次サマリーデータをバックエンドから取得
    const { data: summary, isLoading } = useMonthlySummaryStats(monthPrefix, selectedFile || undefined);

    // デザイン画像有無の一括事前チェック
    useEffect(() => {
        if (!summary?.dailyActivity) return;
        const designNos: string[] = [];
        summary.dailyActivity.forEach(day => {
            day.activities?.forEach(act => {
                if (act.design_no) designNos.push(String(act.design_no).replace('.0', '').trim());
            });
        });
        if (designNos.length > 0) {
            prefetchDesignImagePresence(designNos, selectedFile || undefined);
        }
    }, [summary, selectedFile]);

    // 初回に最新データが存在する月への自動遷移フラグ
    const hasAutoNavigatedRef = useRef(false);

    // 月送り
    const handlePreviousMonth = (): void => {
        hasAutoNavigatedRef.current = true;
        setCurrentDate(prev => {
            const d = new Date(prev);
            d.setMonth(d.getMonth() - 1);
            return d;
        });
    };
    const handleNextMonth = (): void => {
        hasAutoNavigatedRef.current = true;
        setCurrentDate(prev => {
            const d = new Date(prev);
            d.setMonth(d.getMonth() + 1);
            return d;
        });
    };
    const handleThisMonth = (): void => {
        hasAutoNavigatedRef.current = true;
        setCurrentDate(new Date());
    };
    const handleSelectMonth = (yyMm: string): void => {
        if (!yyMm) return;
        hasAutoNavigatedRef.current = true;
        const [yy, mm] = yyMm.split('/');
        const fullYear = 2000 + parseInt(yy, 10);
        const monthNum = parseInt(mm, 10) - 1;
        setCurrentDate(new Date(fullYear, monthNum, 1));
    };

    // 初期表示時：当月が0件で、かつ直近データがある月に自動フォールバック
    useEffect(() => {
        if (!summary || hasAutoNavigatedRef.current) return;
        if (summary.totalReports === 0 && summary.latestMonth && summary.latestMonth !== monthPrefix) {
            hasAutoNavigatedRef.current = true;
            const [yy, mm] = summary.latestMonth.split('/');
            const fullYear = 2000 + parseInt(yy, 10);
            const monthNum = parseInt(mm, 10) - 1;
            setCurrentDate(new Date(fullYear, monthNum, 1));
        }
    }, [summary, monthPrefix]);

    // 印刷
    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `月次サマリー_${staffName}_${monthLabel}`,
    });

    if (isLoading || !summary) {
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
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <button onClick={handlePreviousMonth} className="flex items-center gap-1 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium">
                            <ChevronLeft size={18} /> 前月
                        </button>
                        <button onClick={handleNextMonth} className="flex items-center gap-1 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium">
                            次月 <ChevronRight size={18} />
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{monthLabel}</h2>
                        
                        {/* 実績月セレクトドロップダウン */}
                        {summary.availableMonths && summary.availableMonths.length > 0 && (
                            <select
                                value={summary.availableMonths.includes(monthPrefix) ? monthPrefix : ''}
                                onChange={(e) => handleSelectMonth(e.target.value)}
                                className="text-xs bg-gray-50 border border-gray-300 text-gray-700 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-sf-light-blue"
                            >
                                <option value="" disabled>月度を選択...</option>
                                {summary.availableMonths.map(m => (
                                    <option key={m} value={m}>
                                        20{m.replace('/', '年')}月
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {summary.latestMonth && summary.latestMonth !== monthPrefix && (
                            <button
                                onClick={() => handleSelectMonth(summary.latestMonth!)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-sf-light-blue hover:bg-blue-100 rounded-lg transition-colors text-xs font-bold"
                            >
                                <Sparkles size={14} className="text-amber-500" />
                                最新実績（20{summary.latestMonth.replace('/', '年')}月）
                            </button>
                        )}
                        <button onClick={handleThisMonth} className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200">
                            今月（当月）
                        </button>
                    </div>
                </div>

                {/* 該当月データ未登録時のガイダンス通知 */}
                {summary.totalReports === 0 && (
                    <div className="mt-4 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                            <AlertTriangle size={18} className="text-amber-600 shrink-0" />
                            <div>
                                <p className="font-bold text-xs sm:text-sm">
                                    【{monthLabel}】の日報データはまだ登録されていません
                                </p>
                                <p className="text-[11px] text-amber-700 mt-0.5">
                                    過去の活動実績を確認するには、上の月送りボタンまたは最新実績月をお選びください。
                                </p>
                            </div>
                        </div>
                        {summary.latestMonth && (
                            <button
                                onClick={() => handleSelectMonth(summary.latestMonth!)}
                                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs rounded-lg transition-colors shadow-sm shrink-0 whitespace-nowrap"
                            >
                                最新実績（20{summary.latestMonth.replace('/', '年')}月）を表示
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* ===== 印刷対象エリア ===== */}
            <div ref={printRef} className="space-y-6 print:space-y-4">
                {/* 印刷用ヘッダー */}
                <div className="hidden print:block text-center mb-4">
                    <h1 className="text-2xl font-bold mb-1">月次活動サマリー — {monthLabel}</h1>
                    <p className="text-sm text-gray-600">担当者: {staffName}　｜　出力日: {mounted ? new Date().toLocaleDateString('ja-JP') : ''}</p>
                </div>

                {/* ①【10秒でわかる今月のヘルスチェック】（シグナルバナー） */}
                {(() => {
                    const ms = summary.salesSummary?.monthSales;
                    const isSalesUp = ms?.ratio != null && ms.ratio >= 100;
                    const uncontactedPriority = summary.priorityCustomers.filter(c => c.total === 0);
                    const uncontactedCount = uncontactedPriority.length;

                    return (
                        <div className="bg-white rounded-xl border border-gray-200/90 shadow-2xs overflow-hidden print:border-gray-300 print:break-inside-avoid">
                            <div className="px-4 py-2 bg-gradient-to-r from-slate-800 to-slate-900 text-white flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Sparkles size={14} className="text-amber-400" />
                                    <span className="font-bold text-xs tracking-wide">月次ハイライト & ヘルスチェック</span>
                                </div>
                                <span className="text-[11px] text-slate-300 font-mono">
                                    {monthLabel} 状況
                                </span>
                            </div>
                            <div className="p-3 grid grid-cols-1 md:grid-cols-3 gap-2.5 print:grid-cols-3 text-xs">
                                {/* 売上シグナル */}
                                <div className={`flex items-start gap-2.5 p-2.5 rounded-lg border ${
                                    ms ? (isSalesUp ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' : 'bg-amber-50/70 border-amber-200 text-amber-900') : 'bg-gray-50 border-gray-200 text-gray-700'
                                }`}>
                                    {ms ? (
                                        isSalesUp ? <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
                                    ) : <Clock size={16} className="text-gray-400 mt-0.5 shrink-0" />}
                                    <div className="min-w-0">
                                        <div className="font-bold flex items-center gap-1.5">
                                            <span>売上動向</span>
                                            {ms?.ratio != null && (
                                                <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${isSalesUp ? 'bg-emerald-200 text-emerald-800' : 'bg-amber-200 text-amber-800'}`}>
                                                    前年比 {ms.ratio}%
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[11px] mt-0.5 opacity-90 leading-tight">
                                            {ms ? (
                                                `当月 ${formatCurrency(ms.currentMonth)} (前年比 ${ms.diff >= 0 ? '+' : ''}${formatCurrency(ms.diff)})`
                                            ) : '基幹売上データ連携中'}
                                        </p>
                                    </div>
                                </div>

                                {/* デザインシグナル */}
                                <div className="flex items-start gap-2.5 p-2.5 rounded-lg border bg-purple-50/70 border-purple-200 text-purple-900">
                                    <Palette size={16} className="text-purple-600 mt-0.5 shrink-0" />
                                    <div className="min-w-0">
                                        <div className="font-bold flex items-center gap-1.5">
                                            <span>デザイン・案件</span>
                                            <span className="text-[10px] bg-purple-200 text-purple-800 px-1.5 py-0.2 rounded font-bold">
                                                出稿率 {acceptanceRate}%
                                            </span>
                                        </div>
                                        <p className="text-[11px] mt-0.5 text-purple-800 leading-tight">
                                            新規提案 {summary.totalDesignProposals}件 ｜ 出稿確定 {summary.totalDesignCompleted}件
                                        </p>
                                    </div>
                                </div>

                                {/* フォローシグナル */}
                                {(() => {
                                    const totalPriorityCount = summary.priorityCustomers.length;
                                    const isNoPriority = totalPriorityCount === 0;

                                    return (
                                        <div className={`flex items-start gap-2.5 p-2.5 rounded-lg border ${
                                            isNoPriority ? 'bg-gray-50 border-gray-200 text-gray-700' : (uncontactedCount > 0 ? 'bg-rose-50/70 border-rose-200 text-rose-900' : 'bg-blue-50/70 border-blue-200 text-blue-900')
                                        }`}>
                                            {isNoPriority ? (
                                                <Clock size={16} className="text-gray-400 mt-0.5 shrink-0" />
                                            ) : uncontactedCount > 0 ? (
                                                <AlertTriangle size={16} className="text-rose-600 mt-0.5 shrink-0" />
                                            ) : (
                                                <CheckCircle2 size={16} className="text-blue-600 mt-0.5 shrink-0" />
                                            )}
                                            <div className="min-w-0">
                                                <div className="font-bold flex items-center gap-1.5">
                                                    <span>重点顧客フォロー</span>
                                                    {isNoPriority ? (
                                                        <span className="text-[10px] bg-gray-200 text-gray-700 px-1.5 py-0.2 rounded font-medium">
                                                            今月活動なし
                                                        </span>
                                                    ) : uncontactedCount > 0 ? (
                                                        <span className="text-[10px] bg-rose-200 text-rose-800 px-1.5 py-0.2 rounded font-bold">
                                                            未接触 {uncontactedCount}社
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] bg-blue-200 text-blue-800 px-1.5 py-0.2 rounded font-bold">
                                                            全社接触済
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[11px] mt-0.5 opacity-90 leading-tight">
                                                    {isNoPriority
                                                        ? '当月は重点顧客への活動記録がありません'
                                                        : uncontactedCount > 0
                                                            ? `登録${totalPriorityCount}社中【${uncontactedCount}社】が今月未接触`
                                                            : `登録${totalPriorityCount}社すべてに今月訪問または電話を実施`}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    );
                })()}

                {/* 売上実績サマリー（AS/400 基幹確定売上） */}
                {summary.salesSummary && (
                    <div className="bg-gradient-to-r from-emerald-50/90 via-teal-50/60 to-indigo-50/70 rounded-xl border border-emerald-200/90 p-4 shadow-xs print:p-3 print:border-gray-300 print:break-inside-avoid">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-emerald-600 text-white shadow-2xs">
                                    <Coins size={16} />
                                </div>
                                <h2 className="font-bold text-gray-900 text-sm">売上実績サマリー</h2>
                                <span className="text-xs text-gray-500 font-medium">（AS/400 基幹確定売上）</span>
                            </div>
                            {summary.salesSummary.fiscalYearSales?.periodLabel && (
                                <span className="text-[11px] text-gray-500 bg-white/80 px-2 py-0.5 rounded-full border border-gray-200 font-mono">
                                    累計期間: {summary.salesSummary.fiscalYearSales.periodLabel}
                                </span>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 print:grid-cols-3 print:gap-2">
                            {/* 1. 当月売上 */}
                            {(() => {
                                const ms = summary.salesSummary.monthSales;
                                const { text: ratioText } = formatRatio(ms.ratio);
                                const isPositive = ms.ratio != null && ms.ratio >= 100;
                                return (
                                    <div className="bg-white rounded-lg border border-emerald-100 p-3 shadow-2xs">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-medium text-gray-600">{currentDate.getMonth() + 1}月度 売上</span>
                                            {ms.ratio != null && (
                                                <span className={`inline-flex items-center text-xs px-1.5 py-0.5 rounded-md font-bold ${isPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                                                    {isPositive ? <ArrowUpRight size={13} className="mr-0.5" /> : <ArrowDownRight size={13} className="mr-0.5" />}
                                                    前年同月比 {ratioText}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-2xl font-bold font-mono text-gray-900 tracking-tight print:text-xl">
                                            {formatCurrency(ms.currentMonth)}
                                        </div>
                                        <div className="flex items-center justify-between text-[11px] text-gray-500 mt-1.5 pt-1.5 border-t border-gray-100">
                                            <span>前年同月: <span className="font-mono">{formatCurrency(ms.prevYearMonth)}</span></span>
                                            <span className={`font-mono font-medium ${ms.diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {ms.diff >= 0 ? `+${formatCurrency(ms.diff)}` : `-${formatCurrency(Math.abs(ms.diff))}`}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* 2. 年度累計売上 */}
                            {(() => {
                                const fs = summary.salesSummary.fiscalYearSales;
                                const { text: ratioText } = formatRatio(fs.ratio);
                                const isPositive = fs.ratio != null && fs.ratio >= 100;
                                return (
                                    <div className="bg-white rounded-lg border border-teal-100 p-3 shadow-2xs">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-medium text-gray-600">今年度 累計売上</span>
                                            {fs.ratio != null && (
                                                <span className={`inline-flex items-center text-xs px-1.5 py-0.5 rounded-md font-bold ${isPositive ? 'bg-teal-50 text-teal-700' : 'bg-rose-50 text-rose-700'}`}>
                                                    {isPositive ? <ArrowUpRight size={13} className="mr-0.5" /> : <ArrowDownRight size={13} className="mr-0.5" />}
                                                    前年同期比 {ratioText}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-2xl font-bold font-mono text-gray-900 tracking-tight print:text-xl">
                                            {formatCurrency(fs.currentYear)}
                                        </div>
                                        <div className="flex items-center justify-between text-[11px] text-gray-500 mt-1.5 pt-1.5 border-t border-gray-100">
                                            <span>前年同期: <span className="font-mono">{formatCurrency(fs.prevYear)}</span></span>
                                            <span className={`font-mono font-medium ${fs.diff >= 0 ? 'text-teal-600' : 'text-rose-600'}`}>
                                                {fs.diff >= 0 ? `+${formatCurrency(fs.diff)}` : `-${formatCurrency(Math.abs(fs.diff))}`}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* 3. 重点顧客売上累計（全体に占めるシェアも表示） */}
                            {(() => {
                                const ps = summary.prioritySalesTotal;
                                const totalYear = summary.salesSummary.fiscalYearSales.currentYear;
                                const share = (ps && totalYear > 0) ? Math.round((ps.currentYear / totalYear) * 1000) / 10 : null;
                                const { text: ratioText } = formatRatio(ps?.ratio);
                                return (
                                    <div className="bg-white rounded-lg border border-indigo-100 p-3 shadow-2xs">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-medium text-gray-600 flex items-center gap-1">
                                                <Star size={13} className="text-yellow-500 fill-yellow-500" /> 重点顧客 累計売上
                                            </span>
                                            {share != null && (
                                                <span className="text-[11px] bg-yellow-50 text-yellow-800 border border-yellow-200 px-1.5 py-0.5 rounded font-semibold">
                                                    重点比率 {share}%
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-2xl font-bold font-mono text-gray-900 tracking-tight print:text-xl">
                                            {formatCurrency(ps?.currentYear ?? 0)}
                                        </div>
                                        <div className="flex items-center justify-between text-[11px] text-gray-500 mt-1.5 pt-1.5 border-t border-gray-100">
                                            <span>前年同期比: <span className="font-bold text-gray-700">{ratioText}</span></span>
                                            <span>前年: <span className="font-mono">{formatCurrency(ps?.prevYear ?? 0)}</span></span>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                )}

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

                {/* タブナビゲーション（印刷時非表示） */}
                {(() => {
                    const uncontactedCount = summary.priorityCustomers.filter(c => c.total === 0).length;
                    return (
                        <div className="flex items-center gap-2 border-b border-gray-200 pt-2 pb-0 print:hidden">
                            <button
                                type="button"
                                onClick={() => setActiveTab('priority')}
                                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-lg transition-all border-b-2 cursor-pointer ${
                                    activeTab === 'priority'
                                        ? 'bg-white border-sf-light-blue text-sf-light-blue shadow-2xs'
                                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/70 border-transparent'
                                }`}
                            >
                                <Star size={15} className={activeTab === 'priority' ? 'text-yellow-500 fill-yellow-500' : 'text-gray-400'} />
                                重点顧客・売上分析
                                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-gray-100 text-gray-700 font-mono">
                                    {summary.priorityCustomers.length}社
                                </span>
                                {uncontactedCount > 0 && (
                                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-800 font-bold border border-amber-200 flex items-center gap-0.5">
                                        未接触 {uncontactedCount}
                                    </span>
                                )}
                            </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('area')}
                        className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-lg transition-all border-b-2 cursor-pointer ${
                            activeTab === 'area'
                                ? 'bg-white border-sf-light-blue text-sf-light-blue shadow-2xs'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/70 border-transparent'
                        }`}
                    >
                        <MapPin size={15} className={activeTab === 'area' ? 'text-blue-500' : 'text-gray-400'} />
                        エリア・活動実績
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-gray-100 text-gray-700 font-mono">
                            {summary.areaBreakdown.length}エリア
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('timeline')}
                        className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-lg transition-all border-b-2 cursor-pointer ${
                            activeTab === 'timeline'
                                ? 'bg-white border-sf-light-blue text-sf-light-blue shadow-2xs'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/70 border-transparent'
                        }`}
                    >
                        <Calendar size={15} className={activeTab === 'timeline' ? 'text-purple-500' : 'text-gray-400'} />
                        日別活動タイムライン
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-gray-100 text-gray-700 font-mono">
                            {summary.dailyActivity.length}日
                        </span>
                    </button>
                        </div>
                    );
                })()}

                {/* ===== タブ1: 重点顧客・売上分析 ===== */}
                <div className={`${activeTab === 'priority' ? 'block' : 'hidden'} print:block space-y-6`}>
                    {/* 重点顧客活動 */}
                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden print:break-inside-avoid">
                        <div className="px-5 py-3 border-b border-gray-200 bg-yellow-50 flex items-center justify-between flex-wrap gap-2">
                            <h2 className="font-bold text-gray-900 flex items-center gap-2">
                                <Star size={18} className="text-yellow-600" />
                                重点顧客活動 ({summary.priorityCustomers.length}社)
                            </h2>
                            {summary.salesPeriodLabel && (
                                <span className="text-xs text-gray-500 font-medium">
                                    ※ 売上集計期間: {summary.salesPeriodLabel}
                                </span>
                            )}
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-xs border-b">
                                    <tr className="border-b text-gray-500">
                                        <th rowSpan={2} className="px-3 py-2 text-left font-semibold w-8 print:hidden"></th>
                                        <th rowSpan={2} className="px-3 py-2 text-left font-semibold">得意先CD</th>
                                        <th rowSpan={2} className="px-3 py-2 text-left font-semibold">顧客名</th>
                                        <th rowSpan={2} className="px-3 py-2 text-left font-semibold">エリア</th>
                                        <th rowSpan={2} className="px-3 py-2 text-center font-semibold">ランク</th>
                                        <th colSpan={4} className="px-3 py-1.5 text-center font-bold text-emerald-800 bg-emerald-50/70 border-x border-emerald-100">
                                            売上実績 (1期: 2月〜直近)
                                        </th>
                                        <th colSpan={5} className="px-3 py-1.5 text-center font-bold text-blue-800 bg-blue-50/70">
                                            月間活動実績
                                        </th>
                                    </tr>
                                    <tr className="text-gray-500 bg-gray-50/70">
                                        {/* 売上 4列 */}
                                        <th className="px-3 py-1.5 text-right font-semibold text-emerald-900 bg-emerald-50/30 border-l border-emerald-100 whitespace-nowrap">今年度</th>
                                        <th className="px-3 py-1.5 text-right font-semibold text-gray-600 bg-emerald-50/30 whitespace-nowrap">前年同期</th>
                                        <th className="px-3 py-1.5 text-right font-semibold text-gray-500 bg-emerald-50/30 whitespace-nowrap">前前年同期</th>
                                        <th className="px-3 py-1.5 text-right font-semibold text-emerald-900 bg-emerald-50/30 border-r border-emerald-100 whitespace-nowrap">前年比</th>
                                        {/* 活動 5列 */}
                                        <th className="px-3 py-1.5 text-center font-semibold text-gray-700 whitespace-nowrap">合計</th>
                                        <th className="px-3 py-1.5 text-center font-semibold text-blue-600 whitespace-nowrap">訪問</th>
                                        <th className="px-3 py-1.5 text-center font-semibold text-green-600 whitespace-nowrap">電話</th>
                                        <th className="px-3 py-1.5 text-center font-semibold text-purple-600 whitespace-nowrap">デザイン</th>
                                        <th className="px-3 py-1.5 text-center font-semibold text-gray-500 whitespace-nowrap">最終日</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {summary.priorityCustomers.map(pc => {
                                        const isCollapsed = collapsedCustomers.has(pc.code);
                                        const isExpanded = !isCollapsed;
                                        const hasDirectDeliveries = pc.directDeliveries.length > 0;
                                        const isUncontacted = pc.total === 0;

                                        return (
                                            <React.Fragment key={pc.code}>
                                                {/* 親行（得意先） */}
                                                <tr className={`hover:bg-gray-50 group ${isUncontacted ? 'bg-amber-50/30' : ''}`}>
                                                    <td className="px-3 py-2 text-center print:hidden">
                                                        {hasDirectDeliveries && (
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleCustomerCollapse(pc.code)}
                                                                className="p-1 hover:bg-gray-200 rounded transition-colors"
                                                            >
                                                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                            </button>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2 text-gray-500 font-mono text-xs">{formatCustomerCode(pc.code)}</td>
                                                    <td className="px-3 py-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-gray-900 font-bold">{pc.name}</span>
                                                            {isUncontacted && (
                                                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200 font-bold print:hidden">
                                                                    今月未接触
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2 text-gray-600 text-xs">{pc.area}</td>
                                                    <td className="px-3 py-2 text-center">
                                                        {formatRank(pc.rank) && (
                                                            <span className="inline-block px-1.5 py-0.5 rounded border border-gray-300 text-[10px] font-bold text-gray-500 bg-gray-50">
                                                                {formatRank(pc.rank)}
                                                            </span>
                                                        )}
                                                    </td>
                                                    {/* 売上実績 */}
                                                    <td className="px-3 py-2 text-right font-mono font-bold text-gray-900 bg-emerald-50/15 border-l border-emerald-100 whitespace-nowrap">
                                                        {formatCurrency(pc.salesComparison?.currentYear)}
                                                    </td>
                                                    <td className="px-3 py-2 text-right font-mono text-xs text-gray-600 bg-emerald-50/15 whitespace-nowrap">
                                                        {formatCurrency(pc.salesComparison?.prevYear)}
                                                    </td>
                                                    <td className="px-3 py-2 text-right font-mono text-xs text-gray-400 bg-emerald-50/15 whitespace-nowrap">
                                                        {formatCurrency(pc.salesComparison?.prev2Year)}
                                                    </td>
                                                    <td className="px-3 py-2 text-right font-mono text-xs bg-emerald-50/15 border-r border-emerald-100 whitespace-nowrap">
                                                        {(() => {
                                                            const { text, color } = formatRatio(pc.salesComparison?.ratio);
                                                            return <span className={color}>{text}</span>;
                                                        })()}
                                                    </td>
                                                    {/* 活動実績 */}
                                                    <td className="px-3 py-2 text-center font-bold text-gray-900">
                                                        {isUncontacted ? (
                                                            <span className="text-rose-600 font-semibold text-xs">0</span>
                                                        ) : (
                                                            pc.total
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2 text-center text-blue-600 font-medium">{pc.visits}</td>
                                                    <td className="px-3 py-2 text-center text-green-600 font-medium">{pc.calls}</td>
                                                    <td className="px-3 py-2 text-center text-purple-600 font-medium">{pc.designProposals}</td>
                                                    <td className="px-3 py-2 text-center text-gray-500 text-[10px]">{pc.lastDate || '-'}</td>
                                                </tr>

                                                {/* 子行（直送先） - 展開時のみ表示 */}
                                                {(isExpanded || !mounted) && pc.directDeliveries.map(dd => (
                                                    <tr key={`${pc.code}-${dd.code}`} className="bg-gray-50/50 border-l-4 border-gray-200">
                                                        <td className="px-3 py-1.5 print:hidden"></td>
                                                        <td className="px-3 py-1.5 text-gray-400 font-mono text-[10px] pl-6 flex items-center gap-1">
                                                            <CornerDownRight size={12} /> {formatCustomerCode(dd.code)}
                                                        </td>
                                                        <td className="px-3 py-1.5">
                                                            <div className="flex items-center gap-2">
                                                                <span className="px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded text-[10px] font-bold whitespace-nowrap">直送</span>
                                                                <span className="text-gray-700 text-sm">{dd.name}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-1.5 text-gray-500 text-[10px]">{dd.area}</td>
                                                        <td className="px-3 py-1.5 text-center">
                                                            {formatRank(dd.rank) && (
                                                                <span className="inline-block px-1 py-0.5 rounded border border-gray-200 text-[10px] font-bold text-gray-400">
                                                                    {formatRank(dd.rank)}
                                                                </span>
                                                            )}
                                                        </td>
                                                        {/* 直送先売上実績 */}
                                                        <td className="px-3 py-1.5 text-right font-mono text-xs text-gray-600 border-l border-gray-100 whitespace-nowrap">
                                                            {dd.salesComparison && dd.salesComparison.currentYear > 0 ? formatCurrency(dd.salesComparison.currentYear) : '-'}
                                                        </td>
                                                        <td className="px-3 py-1.5 text-right font-mono text-xs text-gray-500 whitespace-nowrap">
                                                            {dd.salesComparison && dd.salesComparison.prevYear > 0 ? formatCurrency(dd.salesComparison.prevYear) : '-'}
                                                        </td>
                                                        <td className="px-3 py-1.5 text-right font-mono text-xs text-gray-400 whitespace-nowrap">
                                                            {dd.salesComparison && dd.salesComparison.prev2Year > 0 ? formatCurrency(dd.salesComparison.prev2Year) : '-'}
                                                        </td>
                                                        <td className="px-3 py-1.5 text-right font-mono text-xs border-r border-gray-100 whitespace-nowrap">
                                                            {dd.salesComparison && dd.salesComparison.ratio != null ? (() => {
                                                                const { text, color } = formatRatio(dd.salesComparison.ratio);
                                                                return <span className={color}>{text}</span>;
                                                            })() : '-'}
                                                        </td>
                                                        {/* 直送先活動実績 */}
                                                        <td className="px-3 py-1.5 text-center text-gray-400 text-xs">
                                                            {dd.visits + dd.calls}
                                                        </td>
                                                        <td className="px-3 py-1.5 text-center text-blue-400 text-xs">{dd.visits}</td>
                                                        <td className="px-3 py-1.5 text-center text-green-400 text-xs">{dd.calls}</td>
                                                        <td className="px-3 py-1.5 text-center text-purple-400 text-xs">{dd.designProposals}</td>
                                                        <td className="px-3 py-1.5 text-center text-gray-400 text-[10px]">{dd.lastDate || '-'}</td>
                                                    </tr>
                                                ))}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                                {summary.priorityCustomers.length > 0 && (
                                    <tfoot className="bg-gray-100/90 font-bold border-t-2 border-gray-300 text-xs">
                                        <tr>
                                            <td className="px-3 py-2.5 print:hidden"></td>
                                            <td colSpan={4} className="px-3 py-2.5 text-gray-800 text-right">
                                                重点先 合計:
                                            </td>
                                            {/* 売上合計 */}
                                            <td className="px-3 py-2.5 text-right font-mono text-sm text-gray-900 bg-emerald-100/40 border-l border-emerald-200 whitespace-nowrap">
                                                {formatCurrency(summary.prioritySalesTotal?.currentYear ?? summary.priorityCustomers.reduce((acc, c) => acc + (c.salesComparison?.currentYear || 0), 0))}
                                            </td>
                                            <td className="px-3 py-2.5 text-right font-mono text-xs text-gray-700 bg-emerald-100/40 whitespace-nowrap">
                                                {formatCurrency(summary.prioritySalesTotal?.prevYear ?? summary.priorityCustomers.reduce((acc, c) => acc + (c.salesComparison?.prevYear || 0), 0))}
                                            </td>
                                            <td className="px-3 py-2.5 text-right font-mono text-xs text-gray-500 bg-emerald-100/40 whitespace-nowrap">
                                                {formatCurrency(summary.prioritySalesTotal?.prev2Year ?? summary.priorityCustomers.reduce((acc, c) => acc + (c.salesComparison?.prev2Year || 0), 0))}
                                            </td>
                                            <td className="px-3 py-2.5 text-right font-mono text-xs bg-emerald-100/40 border-r border-emerald-200 whitespace-nowrap">
                                                {(() => {
                                                    const ratio = summary.prioritySalesTotal?.ratio ?? (() => {
                                                        const cur = summary.priorityCustomers.reduce((acc, c) => acc + (c.salesComparison?.currentYear || 0), 0);
                                                        const prev = summary.priorityCustomers.reduce((acc, c) => acc + (c.salesComparison?.prevYear || 0), 0);
                                                        return prev > 0 ? (cur / prev) * 100 : null;
                                                    })();
                                                    const { text, color } = formatRatio(ratio);
                                                    return <span className={color}>{text}</span>;
                                                })()}
                                            </td>
                                            {/* 活動合計 */}
                                            <td className="px-3 py-2.5 text-center text-gray-900">
                                                {summary.priorityCustomers.reduce((acc, c) => acc + c.total, 0)}
                                            </td>
                                            <td className="px-3 py-2.5 text-center text-blue-700">
                                                {summary.priorityCustomers.reduce((acc, c) => acc + c.visits, 0)}
                                            </td>
                                            <td className="px-3 py-2.5 text-center text-green-700">
                                                {summary.priorityCustomers.reduce((acc, c) => acc + c.calls, 0)}
                                            </td>
                                            <td className="px-3 py-2.5 text-center text-purple-700">
                                                {summary.priorityCustomers.reduce((acc, c) => acc + c.designProposals, 0)}
                                            </td>
                                            <td className="px-3 py-2.5 text-center text-gray-400">-</td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>
                </div>

                {/* ===== タブ2: エリア・活動実績 ===== */}
                <div className={`${activeTab === 'area' ? 'block' : 'hidden'} print:block space-y-6`}>
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
                </div>

                {/* ===== タブ3: 日別タイムライン & デザイン進捗 ===== */}
                <div className={`${activeTab === 'timeline' ? 'block' : 'hidden'} print:block space-y-6`}>
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
                                        <th className="px-4 py-3 text-left font-semibold">日付</th>
                                        <th className="px-4 py-3 text-center font-semibold">訪問</th>
                                        <th className="px-4 py-3 text-center font-semibold">電話</th>
                                        <th className="px-4 py-3 text-center font-semibold">合計</th>
                                        <th className="px-4 py-3 text-left font-semibold">活動バー</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {summary.dailyActivity.map(day => {
                                        const total = day.visits + day.calls;
                                        // 活動バーの最大幅計算（最大値を基準）
                                        const maxTotal = Math.max(...summary.dailyActivity.map(d => d.visits + d.calls), 1);
                                        const barWidth = Math.round((total / maxTotal) * 100);
                                        const isOfficeOnly = day.visits === 0;
                                        const isExpanded = expandedDates.has(day.date);

                                        return (
                                            <React.Fragment key={day.date}>
                                                <tr className={`border-b border-gray-100 hover:bg-gray-50/80 transition-colors ${isOfficeOnly ? 'bg-amber-50/15' : ''}`}>
                                                    <td className="px-4 py-2.5 font-medium text-gray-900">
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => toggleDateExpand(day.date)}
                                                                className="p-1 hover:bg-gray-100 rounded transition-colors text-gray-400 hover:text-gray-600 print:hidden"
                                                                title="詳細を表示"
                                                            >
                                                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                            </button>
                                                            <span>{day.date}</span>
                                                            {isOfficeOnly ? (
                                                                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 ml-1 whitespace-nowrap">
                                                                    一日社内
                                                                </span>
                                                            ) : (
                                                                day.activities && Array.from(new Set(
                                                                    day.activities
                                                                        .filter(act => act.action && act.action.includes('訪問') && act.area)
                                                                        .map(act => act.area!)
                                                                )).map((area, idx) => (
                                                                    <span key={idx} className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 ml-1 whitespace-nowrap">
                                                                        {area}
                                                                    </span>
                                                                ))
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2.5 text-center text-blue-600 font-semibold">{day.visits}</td>
                                                    <td className="px-4 py-2.5 text-center text-green-600 font-semibold">{day.calls}</td>
                                                    <td className="px-4 py-2.5 text-center font-bold text-gray-900">{total}</td>
                                                    <td className="px-4 py-2.5">
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
                                                {isExpanded && day.activities && day.activities.length > 0 && (
                                                    <tr className="bg-gray-50/50 print:hidden">
                                                        <td colSpan={5} className="px-6 py-3 border-b border-gray-200">
                                                            <div className="space-y-2">
                                                                {day.activities.map((act, actIdx) => (
                                                                    <div key={actIdx} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex flex-col gap-2">
                                                                        <div className="flex flex-wrap items-center gap-2">
                                                                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                                                                act.action?.includes('訪問') ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                                                                                act.action?.includes('電話') ? 'bg-green-100 text-green-800 border border-green-200' :
                                                                                act.action?.includes('社内') ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                                                                                'bg-gray-100 text-gray-800 border border-gray-200'
                                                                            }`}>
                                                                                {act.action || 'その他'}
                                                                            </span>
                                                                            
                                                                            <span className="font-bold text-gray-900 text-sm">
                                                                                {act.customer_name || '社内業務等'}
                                                                            </span>

                                                                            {act.is_priority && (
                                                                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-yellow-100 text-yellow-800 border border-yellow-200">
                                                                                    <Star size={10} className="fill-yellow-500 text-yellow-500" />
                                                                                    重点
                                                                                </span>
                                                                            )}

                                                                            {act.dd_name && (
                                                                                <span className="text-[10px] text-sf-light-blue bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 font-medium">
                                                                                    直送先: {act.dd_name}
                                                                                </span>
                                                                            )}
                                                                        </div>

                                                                        {(act.design_no || act.design_name || act.design_status) && (
                                                                            <div className="text-xs text-purple-700 bg-purple-50 px-2 py-1 rounded border border-purple-100 inline-flex items-center gap-1.5 self-start">
                                                                                <Palette size={12} />
                                                                                <span className="font-semibold flex items-center gap-1.5">
                                                                                    デザイン提案: {act.design_name || '名称未設定'} 
                                                                                    {act.design_no ? ` (No.${act.design_no})` : ''} 
                                                                                    【{act.design_status || '進行中'}】
                                                                                    {act.design_no && (
                                                                                        <DesignImageHoverButton
                                                                                            designNo={act.design_no}
                                                                                            selectedFile={selectedFile || undefined}
                                                                                            onOpenModal={(images, no) => {
                                                                                                setImageResults(images);
                                                                                                setCurrentSearchDesignNo(no);
                                                                                                setShowImageModal(true);
                                                                                            }}
                                                                                        />
                                                                                    )}
                                                                                </span>
                                                                            </div>
                                                                        )}

                                                                        {act.business_content && (
                                                                            <div className="text-xs text-gray-700 border-t border-gray-100 pt-2 mt-1">
                                                                                <span className="font-bold text-gray-500 block mb-1">商談内容:</span>
                                                                                <p className="whitespace-pre-wrap pl-2.5 border-l-2 border-gray-300 text-gray-700 leading-relaxed font-normal">
                                                                                    {act.business_content}
                                                                                </p>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                </div>

                {/* 印刷フッター */}
                <div className="hidden print:block text-center text-xs text-gray-400 border-t border-gray-200 pt-3 mt-6">
                    <p>Sales Support — 月次活動サマリー — {monthLabel} — {staffName}</p>
                </div>
            </div>

            {/* Image Search Result Modal */}
            <DesignImagePreviewModal
                isOpen={showImageModal}
                onClose={(): void => setShowImageModal(false)}
                images={imageResults}
                targetDesignNo={currentSearchDesignNo}
            />
        </div>
    );
}
