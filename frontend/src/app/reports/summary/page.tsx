'use client';

import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useFile } from '@/context/FileContext';
import { useMonthlySummaryStats } from '@/hooks/useStatsHooks';
import { ChevronLeft, ChevronRight, Printer, FileText, Users, Phone, MapPin, Palette, Star, TrendingUp, ChevronDown, ChevronUp, CornerDownRight, Image as ImageIcon, Search, X, Download, Loader2 } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import toast from 'react-hot-toast';
import { searchDesignImages, getImageUrl, DesignImage } from '@/lib/api';

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
    const [currentDate, setCurrentDate] = useState(new Date());
    const [collapsedCustomers, setCollapsedCustomers] = useState<Set<string>>(new Set());
    const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
    const [mounted, setMounted] = useState(false);
    const printRef = useRef<HTMLDivElement>(null);

    // デザイン画像検索用ステート
    const [searchingImage, setSearchingImage] = useState(false);
    const [imageResults, setImageResults] = useState<DesignImage[]>([]);
    const [showImageModal, setShowImageModal] = useState(false);
    const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);

    // 画像検索アクション
    const handleImageSearch = async (designNo: string, e: React.MouseEvent): Promise<void> => {
        e.stopPropagation(); // アコーディオンの他部分のクリックイベントを防止
        if (!designNo) return;
        const cleanDesignNo = String(designNo).replace('.0', '').trim();
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
                                                            {isOfficeOnly && (
                                                                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 ml-1">
                                                                    一日社内
                                                                </span>
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
                                                                                        <button
                                                                                            onClick={(e): Promise<void> => handleImageSearch(act.design_no!, e)}
                                                                                            disabled={searchingImage}
                                                                                            className="ml-1 p-0.5 hover:bg-purple-100 rounded text-purple-700 hover:text-purple-900 transition-colors inline-flex items-center gap-0.5 print:hidden cursor-pointer"
                                                                                            title="デザイン画像を表示"
                                                                                        >
                                                                                            {searchingImage ? (
                                                                                                <Loader2 size={10} className="animate-spin" />
                                                                                            ) : (
                                                                                                <ImageIcon size={10} />
                                                                                            )}
                                                                                        </button>
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

                {/* 印刷フッター */}
                <div className="hidden print:block text-center text-xs text-gray-400 border-t border-gray-200 pt-3 mt-6">
                    <p>Sales Support — 月次活動サマリー — {monthLabel} — {staffName}</p>
                </div>
            </div>

            {/* Image Search Result Modal */}
            {showImageModal && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4 print:hidden" onClick={(): void => setShowImageModal(false)}>
                    <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] flex flex-col" onClick={(e): void => e.stopPropagation()}>
                        <div className="p-4 p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-lg">
                            <h3 className="font-bold text-lg text-sf-text flex items-center gap-2">
                                <Search size={20} className="text-pink-500" />
                                関連デザイン画像 ({imageResults.length}件)
                            </h3>
                            <button
                                onClick={(): void => setShowImageModal(false)}
                                className="text-gray-500 hover:text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-full p-1 transition-colors cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1 bg-gray-100">
                            {imageResults.length > 0 ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                    {imageResults.map((img, i): React.ReactElement => {
                                        const isPdf = img.name.toLowerCase().endsWith('.pdf');
                                        return (
                                            <div key={i} className="group relative bg-white rounded border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                                <button 
                                                    onClick={(e): void => {
                                                        e.preventDefault();
                                                        if (isPdf) {
                                                            window.open(getImageUrl(img.path), '_blank');
                                                        } else {
                                                            setSelectedImageIndex(i);
                                                        }
                                                    }} 
                                                    className="w-full block aspect-square overflow-hidden bg-gray-200 flex items-center justify-center cursor-pointer"
                                                >
                                                    {isPdf ? (
                                                        <div className="flex flex-col items-center justify-center text-red-500">
                                                            <FileText size={48} />
                                                            <span className="text-xs font-bold mt-2 text-gray-500">PDF</span>
                                                        </div>
                                                    ) : (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img
                                                            src={getImageUrl(img.path)}
                                                            alt={img.name}
                                                            className="w-full h-full object-contain p-1 group-hover:scale-105 transition-transform duration-300"
                                                            loading="lazy"
                                                        />
                                                    )}
                                                </button>
                                                <div className="p-2 text-xs flex justify-between items-start">
                                                    <div className="flex-1 overflow-hidden">
                                                        <div className="font-medium truncate text-sf-text" title={img.name}>{img.name}</div>
                                                        <div className="text-gray-400 truncate mt-0.5">{img.folder}</div>
                                                    </div>
                                                    <a 
                                                        href={getImageUrl(img.path)} 
                                                        download={img.name}
                                                        onClick={(e): void => e.stopPropagation()}
                                                        className="ml-2 p-1.5 bg-gray-100 hover:bg-sf-light-blue hover:text-white rounded text-gray-500 transition-colors"
                                                        title="ダウンロード"
                                                    >
                                                        <Download size={14} />
                                                    </a>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                                    <Search size={48} className="mb-4 text-gray-300" />
                                    <p>画像が見つかりませんでした</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Lightbox Viewer */}
            {selectedImageIndex !== null && (
                <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-[70] print:hidden" onClick={(): void => setSelectedImageIndex(null)}>
                    <div className="absolute top-4 right-4 flex gap-3 z-[80]" onClick={(e): void => e.stopPropagation()}>
                        <a
                            href={getImageUrl(imageResults[selectedImageIndex].path)}
                            download={imageResults[selectedImageIndex].name}
                            className="text-white hover:text-sf-light-blue bg-black bg-opacity-50 hover:bg-opacity-80 rounded-full p-2 transition-all flex items-center justify-center cursor-pointer"
                            title="画像をダウンロード"
                        >
                            <Download size={24} />
                        </a>
                        <button
                            onClick={(): void => setSelectedImageIndex(null)}
                            className="text-white hover:text-gray-300 bg-black bg-opacity-50 hover:bg-opacity-80 rounded-full p-2 transition-all cursor-pointer"
                            title="閉じる"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    {selectedImageIndex > 0 && (
                        <button
                            onClick={(e): void => {
                                e.stopPropagation();
                                setSelectedImageIndex(selectedImageIndex - 1);
                            }}
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 bg-black bg-opacity-50 hover:bg-opacity-80 rounded-full p-3 z-[80] cursor-pointer"
                        >
                            <ChevronLeft size={32} />
                        </button>
                    )}

                    <div className="w-full h-full p-8 flex items-center justify-center relative" onClick={(): void => setSelectedImageIndex(null)}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={getImageUrl(imageResults[selectedImageIndex].path)}
                            alt={imageResults[selectedImageIndex].name}
                            className="max-w-full max-h-full object-contain"
                            onClick={(e): void => e.stopPropagation()}
                        />
                        <div className="absolute bottom-4 left-0 right-0 text-center text-white text-sm bg-black bg-opacity-50 py-2">
                            {imageResults[selectedImageIndex].name} ({selectedImageIndex + 1} / {imageResults.length})
                        </div>
                    </div>

                    {selectedImageIndex < imageResults.length - 1 && (
                        <button
                            onClick={(e): void => {
                                e.stopPropagation();
                                setSelectedImageIndex(selectedImageIndex + 1);
                            }}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 bg-black bg-opacity-50 hover:bg-opacity-80 rounded-full p-3 z-[80] cursor-pointer"
                        >
                            <ChevronRight size={32} />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
