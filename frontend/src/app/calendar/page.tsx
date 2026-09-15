'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useFile } from '@/context/FileContext';
import { useReports } from '@/hooks/useQueryHooks';
import { generateMonthCalendar, getDayName, getMonthName } from '@/lib/calendar';
import { MonthData, CalendarDay } from '@/types/calendar';
import { 
    ChevronLeft, 
    ChevronRight, 
    Calendar as CalendarIcon, 
    Printer, 
    Users, 
    MapPin, 
    Truck, 
    ChevronDown, 
    ChevronUp, 
    ChevronsUpDown, 
    ExternalLink, 
    FileText, 
    X 
} from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import toast from 'react-hot-toast';
import ReportDetailModal from '@/components/reports/ReportDetailModal';
import EditReportModal from '@/components/reports/EditReportModal';
import { Report } from '@/types/report';

export default function CalendarPage(): React.JSX.Element {
    const { selectedFile } = useFile();

    // React Queryでデータ取得（自動キャッシュ）
    const { data: reports = [], isLoading, error, refetch } = useReports(selectedFile || undefined);

    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
    const printRef = useRef<HTMLDivElement>(null);

    // 案1: 商談内容の展開状態（管理番号 -> boolean）
    const [expandedVisits, setExpandedVisits] = useState<Record<number, boolean>>({});

    // 案3: 日報詳細モーダル・編集モーダルの状態
    const [selectedDetailIndex, setSelectedDetailIndex] = useState<number | null>(null);
    const [editingReport, setEditingReport] = useState<Report | null>(null);

    // エラー時のtoast表示
    useEffect(() => {
        if (error) {
            toast.error('カレンダーデータの読み込みに失敗しました');
        }
    }, [error]);

    const monthData = useMemo((): MonthData | null => {
        if (reports.length === 0) return null;
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        return generateMonthCalendar(year, month, reports);
    }, [reports, currentDate]);

    // 商談内容が長文（3行以上または90文字以上）か判定
    const isLongContent = (text?: string): boolean => {
        if (!text) return false;
        const lines = text.trim().split('\n');
        return lines.length > 3 || text.length > 90;
    };

    // 選択中の日付における長文訪問記録
    const longVisits = useMemo(() => {
        if (!selectedDay) return [];
        return selectedDay.visits.filter(v => isLongContent(v.commercialContent));
    }, [selectedDay]);

    // すべて展開されているか
    const isAllExpanded = useMemo(() => {
        if (longVisits.length === 0) return false;
        return longVisits.every(v => !!expandedVisits[v.managementNumber]);
    }, [longVisits, expandedVisits]);

    // 個別の商談内容の展開・折りたたみ
    const handleToggleVisit = (mgmtNo: number) => {
        setExpandedVisits(prev => ({
            ...prev,
            [mgmtNo]: !prev[mgmtNo]
        }));
    };

    // すべて展開 / 折りたたみの切り替え
    const handleToggleAll = () => {
        if (isAllExpanded) {
            setExpandedVisits({});
        } else {
            const nextState: Record<number, boolean> = {};
            longVisits.forEach(v => {
                nextState[v.managementNumber] = true;
            });
            setExpandedVisits(nextState);
        }
    };

    const handleCloseDayModal = () => {
        setSelectedDay(null);
        setExpandedVisits({});
        setSelectedDetailIndex(null);
    };

    const handlePreviousMonth = () => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            newDate.setMonth(prev.getMonth() - 1);
            return newDate;
        });
        handleCloseDayModal();
    };

    const handleNextMonth = () => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            newDate.setMonth(prev.getMonth() + 1);
            return newDate;
        });
        handleCloseDayModal();
    };

    const handleToday = () => {
        setCurrentDate(new Date());
        handleCloseDayModal();
    };

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `訪問カレンダー_${currentDate.getFullYear()}年${getMonthName(currentDate.getMonth())}`,
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen flex-col">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sf-light-blue mx-auto mb-4"></div>
                    <p className="text-sf-text-weak">データを読み込んでいます...</p>
                </div>
            </div>
        );
    }

    if (!monthData) {
        return (
            <div className="flex items-center justify-center min-h-screen flex-col">
                <p className="text-sf-text-weak">データがありません</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">訪問カレンダー</h1>
                        <p className="text-gray-600">月次訪問履歴の確認とレポート出力</p>
                    </div>
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-4 py-2 bg-sf-light-blue text-white rounded-lg hover:bg-blue-600 transition-colors print:hidden"
                    >
                        <Printer size={18} />
                        印刷
                    </button>
                </div>
            </div>

            {/* Controls */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6 print:hidden">
                <div className="flex items-center justify-between">
                    <button
                        onClick={handlePreviousMonth}
                        className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <ChevronLeft size={20} />
                        前月
                    </button>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleToday}
                            className="px-4 py-2 text-sm font-medium text-sf-light-blue hover:bg-blue-50 rounded-lg transition-colors"
                        >
                            今月
                        </button>
                        <div className="flex items-center gap-2">
                            <CalendarIcon size={20} className="text-gray-600" />
                            <h2 className="text-2xl font-bold text-gray-900">
                                {currentDate.getFullYear()}年 {getMonthName(currentDate.getMonth())}
                            </h2>
                        </div>
                    </div>

                    <button
                        onClick={handleNextMonth}
                        className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        次月
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 print:hidden">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-blue-50 rounded-lg">
                            <MapPin className="text-blue-600" size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">総訪問数</p>
                            <p className="text-2xl font-bold text-gray-900">{monthData.totalVisits}件</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-green-50 rounded-lg">
                            <Users className="text-green-600" size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">訪問先数</p>
                            <p className="text-2xl font-bold text-gray-900">{monthData.uniqueCustomers}社</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Calendar */}
            <div ref={printRef} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                {/* Print Header */}
                <div className="hidden print:block mb-6">
                    <h1 className="text-2xl font-bold text-center mb-2">
                        訪問カレンダー - {currentDate.getFullYear()}年 {getMonthName(currentDate.getMonth())}
                    </h1>
                    <div className="flex justify-center gap-8 text-sm text-gray-600">
                        <p>総訪問数: {monthData.totalVisits}件</p>
                        <p>訪問先数: {monthData.uniqueCustomers}社</p>
                    </div>
                </div>

                {/* Day Headers */}
                <div className="grid grid-cols-7 gap-2 mb-2">
                    {[0, 1, 2, 3, 4, 5, 6].map(day => (
                        <div
                            key={day}
                            className={`text-center font-bold py-2 ${day === 0 ? 'text-red-600' : day === 6 ? 'text-blue-600' : 'text-gray-700'
                                }`}
                        >
                            {getDayName(day)}
                        </div>
                    ))}
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-2">
                    {monthData.days.map((day, index) => {
                        const isToday = day.dateString === new Date().toISOString().split('T')[0].replace(/-/g, '/');
                        const dayOfWeek = day.date.getDay();

                        return (
                            <div
                                key={index}
                                onClick={() => day.isCurrentMonth && day.visits.length > 0 && setSelectedDay(day)}
                                className={`min-h-[120px] border rounded-lg p-2 transition-all print:min-h-[100px] print:break-inside-avoid ${day.isCurrentMonth
                                    ? 'bg-white border-gray-200 hover:border-sf-light-blue hover:shadow-md cursor-pointer'
                                    : 'bg-gray-50 border-gray-100'
                                    } ${isToday ? 'ring-2 ring-sf-light-blue' : ''} ${day.visits.length > 0 ? 'print:border-2 print:border-gray-400' : ''
                                    }`}
                            >
                                <div
                                    className={`text-sm font-semibold mb-1 ${!day.isCurrentMonth
                                        ? 'text-gray-400'
                                        : dayOfWeek === 0
                                            ? 'text-red-600'
                                            : dayOfWeek === 6
                                                ? 'text-blue-600'
                                                : 'text-gray-700'
                                        } ${isToday ? 'text-white bg-sf-light-blue rounded px-1' : ''}`}
                                >
                                    {day.date.getDate()}
                                </div>
                                <div className="space-y-1">
                                    {day.visits.map((visit, vIndex) => (
                                        <div
                                            key={vIndex}
                                            className="text-xs bg-blue-50 text-blue-800 px-2 py-1 rounded truncate print:bg-gray-100 print:text-gray-800"
                                            title={visit.directDeliveryName ? `${visit.customerName}（直送: ${visit.directDeliveryName}）` : visit.customerName}
                                        >
                                            {visit.hasDesign && <span className="text-purple-600 mr-1">★</span>}
                                            {visit.customerName}
                                            {visit.directDeliveryName && !visit.customerName.includes(visit.directDeliveryName) && (
                                                <span className="text-[10px] text-blue-600 ml-1">({visit.directDeliveryName})</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Print Legend */}
                <div className="hidden print:block mt-4 pt-4 border-t border-gray-200">
                    <p className="text-xs text-gray-600">★ = デザイン提案あり</p>
                </div>
            </div>

            {/* Visit Details Modal */}
            {selectedDay && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
                    onClick={handleCloseDayModal}
                >
                    <div
                        className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* ヘッダー */}
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white flex-shrink-0">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">
                                    {selectedDay.dateString} の訪問先
                                </h3>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    全 {selectedDay.visits.length} 件の訪問記録
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                {longVisits.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={handleToggleAll}
                                        className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors font-medium shadow-2xs"
                                        title={isAllExpanded ? "すべての商談内容を折りたたむ" : "すべての商談内容を展開する"}
                                    >
                                        <ChevronsUpDown size={13} className="text-gray-500" />
                                        <span>{isAllExpanded ? "すべて折りたたむ" : "すべて展開"}</span>
                                    </button>
                                )}
                                <button
                                    onClick={handleCloseDayModal}
                                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                    title="閉じる"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* 本文（スクロール領域） */}
                        <div className="p-6 overflow-y-auto space-y-4">
                            {selectedDay.visits.map((visit, index) => {
                                const isLong = isLongContent(visit.commercialContent);
                                const isExpanded = !!expandedVisits[visit.managementNumber];

                                return (
                                    <div
                                        key={index}
                                        className="border border-gray-200 rounded-xl p-4 bg-white hover:border-blue-200 hover:shadow-xs transition-all"
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h4
                                                        className="font-bold text-gray-900 text-base hover:text-sf-light-blue transition-colors cursor-pointer inline-flex items-center gap-1.5"
                                                        onClick={() => setSelectedDetailIndex(index)}
                                                        title="クリックして日報詳細を表示"
                                                    >
                                                        {visit.customerName}
                                                        <ExternalLink size={13} className="text-gray-400 hover:text-sf-light-blue" />
                                                    </h4>
                                                </div>
                                                {visit.directDeliveryName && (
                                                    <div className="flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 mt-1 mb-1.5 w-fit">
                                                        <Truck size={13} className="text-blue-500" />
                                                        <span>直送先: {visit.directDeliveryName}</span>
                                                    </div>
                                                )}
                                                <p className="text-xs font-medium text-gray-500 mt-0.5">{visit.action}</p>
                                            </div>
                                            <span className="text-xs font-mono text-gray-400 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                                                No. {visit.managementNumber}
                                            </span>
                                        </div>

                                        {/* 詳細情報（面談者・滞在時間） */}
                                        {(visit.interviewer || visit.stayTime) && (
                                            <div className="grid grid-cols-2 gap-2 text-sm mb-3 bg-gray-50/70 px-3 py-2 rounded-lg">
                                                {visit.interviewer ? (
                                                    <div className="flex items-center gap-1.5 text-gray-600 truncate">
                                                        <Users size={14} className="text-gray-400 flex-shrink-0" />
                                                        <span className="truncate">面談者: {visit.interviewer}</span>
                                                    </div>
                                                ) : <div />}
                                                {visit.stayTime && (
                                                    <div className="text-gray-600 text-right">
                                                        滞在時間: <span className="font-medium text-gray-700">{visit.stayTime}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* 商談内容（案1） */}
                                        {visit.commercialContent && (
                                            <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-700 mb-3 border border-gray-100">
                                                <div className="flex items-center justify-between font-medium text-gray-600 mb-1.5 text-xs">
                                                    <span>商談内容:</span>
                                                    {isLong && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleToggleVisit(visit.managementNumber);
                                                            }}
                                                            className="text-xs text-sf-light-blue hover:text-blue-700 flex items-center gap-0.5 font-medium transition-colors"
                                                        >
                                                            {isExpanded ? (
                                                                <>折りたたむ <ChevronUp size={13} /></>
                                                            ) : (
                                                                <>続きを読む <ChevronDown size={13} /></>
                                                            )}
                                                        </button>
                                                    )}
                                                </div>
                                                <div className={`whitespace-pre-wrap break-words text-gray-800 leading-relaxed ${!isExpanded && isLong ? 'line-clamp-3' : ''}`}>
                                                    {visit.commercialContent}
                                                </div>
                                                {isLong && !isExpanded && (
                                                    <div className="mt-1.5 text-right">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleToggleVisit(visit.managementNumber);
                                                            }}
                                                            className="text-xs text-sf-light-blue hover:text-blue-700 font-medium inline-flex items-center gap-0.5 hover:underline"
                                                        >
                                                            続きを読む <ChevronDown size={13} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* デザイン情報 */}
                                        {visit.hasDesign && (
                                            <div className="flex flex-wrap gap-1.5 mb-3">
                                                <span className="inline-block text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-medium">
                                                    デザイン提案あり
                                                </span>
                                                {visit.designType && (
                                                    <span className="inline-block text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                                                        {visit.designType}
                                                    </span>
                                                )}
                                                {visit.designName && (
                                                    <span className="inline-block text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded truncate max-w-xs">
                                                        {visit.designName}
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        {/* 日報詳細を開くアクションバー（案3） */}
                                        {visit.report && (
                                            <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between">
                                                <span className="text-xs text-gray-400">
                                                    {visit.report.提案物 || visit.report.次回プラン ? '提案物・次回プランあり' : ''}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedDetailIndex(index);
                                                    }}
                                                    className="inline-flex items-center gap-1.5 text-xs text-sf-light-blue hover:text-blue-700 hover:bg-blue-50 px-2.5 py-1 rounded-md transition-colors font-medium ml-auto"
                                                    title="日報の全項目・コメント・画像・承認状況を確認"
                                                >
                                                    <FileText size={13} />
                                                    <span>日報詳細を確認</span>
                                                    <ExternalLink size={12} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* 日報詳細モーダル (案3) */}
            {selectedDetailIndex !== null && selectedDay && selectedDay.visits[selectedDetailIndex]?.report && (
                <ReportDetailModal
                    report={selectedDay.visits[selectedDetailIndex].report!}
                    onClose={() => setSelectedDetailIndex(null)}
                    onNext={() => {
                        if (selectedDetailIndex > 0) {
                            setSelectedDetailIndex(selectedDetailIndex - 1);
                        }
                    }}
                    onPrev={() => {
                        if (selectedDetailIndex < selectedDay.visits.length - 1) {
                            setSelectedDetailIndex(selectedDetailIndex + 1);
                        }
                    }}
                    hasNext={selectedDetailIndex > 0}
                    hasPrev={selectedDetailIndex < selectedDay.visits.length - 1}
                    onEdit={() => {
                        const rep = selectedDay.visits[selectedDetailIndex].report!;
                        setSelectedDetailIndex(null);
                        setEditingReport(rep);
                    }}
                    onUpdate={() => {
                        refetch();
                    }}
                    allReports={reports}
                />
            )}

            {/* 日報編集モーダル */}
            {editingReport && (
                <EditReportModal
                    report={editingReport}
                    onClose={() => setEditingReport(null)}
                    onSuccess={() => {
                        setEditingReport(null);
                        refetch();
                        toast.success('日報を更新しました');
                    }}
                    selectedFile={selectedFile || ''}
                    reports={reports}
                />
            )}
        </div>
    );
}
