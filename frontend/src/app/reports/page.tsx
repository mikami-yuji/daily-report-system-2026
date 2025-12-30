'use client';

import { useEffect, useState, useMemo } from 'react';
import { Report } from '@/lib/api';
import { useFile } from '@/context/FileContext';
import { useReports } from '@/hooks/useQueryHooks';
import { Plus, Filter, RefreshCw, FileText, LayoutList, Table } from 'lucide-react';
import toast from 'react-hot-toast';
import NewReportModal from '@/components/reports/NewReportModal';
import EditReportModal from '@/components/reports/EditReportModal';
import ReportDetailModal from '@/components/reports/ReportDetailModal';
import { cleanText } from '@/lib/reportUtils';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/hooks/useQueryHooks';

export default function ReportsPage() {
    const { files, selectedFile, setSelectedFile } = useFile();
    const queryClient = useQueryClient();

    // React Queryでデータ取得（自動キャッシュ）
    const { data: rawReports = [], isLoading, error, refetch } = useReports(selectedFile || undefined);

    const [selectedReportIndex, setSelectedReportIndex] = useState<number | null>(null);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [viewMode, setViewMode] = useState<'table' | 'timeline'>('table');
    const [showNewReportModal, setShowNewReportModal] = useState(false);
    const [showEditReportModal, setShowEditReportModal] = useState(false);
    const [editingReport, setEditingReport] = useState<Report | null>(null);

    // ページネーション
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;

    // エラー時のtoast表示
    useEffect(() => {
        if (error) {
            toast.error('日報データの読み込みに失敗しました');
        }
    }, [error]);

    // レポートのソートと有効データフィルタリング（useMemoでキャッシュ）
    const reports = useMemo(() => {
        // 日付があるレポートのみ
        const validData = rawReports.filter(report => report.日付 && report.日付.trim() !== '');
        // ソート
        return [...validData].sort((a, b) => {
            const dateA = String(a.日付 || '');
            const dateB = String(b.日付 || '');
            if (sortOrder === 'asc') {
                return dateA.localeCompare(dateB);
            } else {
                return dateB.localeCompare(dateA);
            }
        });
    }, [rawReports, sortOrder]);

    const totalPages = Math.ceil(reports.length / itemsPerPage);
    const paginatedReports = reports.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // データ更新時にキャッシュをリフレッシュ
    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.reports(selectedFile || undefined) });
        toast.success('データを更新しました');
    };

    const toggleSortOrder = () => {
        setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    };

    const handleRowClick = (index: number) => {
        setSelectedReportIndex(index);
    };

    const handleNextReport = () => {
        if (selectedReportIndex !== null && selectedReportIndex > 0) {
            setSelectedReportIndex(selectedReportIndex - 1);
        }
    };

    const handlePrevReport = () => {
        if (selectedReportIndex !== null && selectedReportIndex < reports.length - 1) {
            setSelectedReportIndex(selectedReportIndex + 1);
        }
    };

    return (
        <div className="space-y-4 h-[calc(100vh-8rem)] flex flex-col animate-fadeIn">
            <div className="flex justify-between items-center bg-white p-4 rounded border border-sf-border shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="bg-sf-light-blue p-2 rounded text-white shadow-sm">
                        <FileText size={20} />
                    </div>
                    <div>
                        <p className="text-xs text-sf-text-weak font-medium">オブジェクト</p>
                        <h1 className="text-xl font-bold text-sf-text">営業日報</h1>
                    </div>
                </div>
                <div className="flex gap-2 items-center">
                    {/* File Selector */}

                    <div className="flex bg-gray-100 p-1 rounded border border-sf-border">
                        <button
                            onClick={() => setViewMode('table')}
                            className={`p-1.5 rounded ${viewMode === 'table' ? 'bg-white shadow-sm text-sf-light-blue' : 'text-gray-400 hover:text-gray-600'}`}
                            title="テーブル表示"
                        >
                            <Table size={16} />
                        </button>
                        <button
                            onClick={() => setViewMode('timeline')}
                            className={`p-1.5 rounded ${viewMode === 'timeline' ? 'bg-white shadow-sm text-sf-light-blue' : 'text-gray-400 hover:text-gray-600'}`}
                            title="タイムライン表示"
                        >
                            <LayoutList size={16} />
                        </button>
                    </div>

                    <button
                        onClick={toggleSortOrder}
                        className="p-2 border border-sf-border rounded hover:bg-gray-50 text-sf-text-weak transition-colors flex items-center gap-2"
                        title={sortOrder === 'asc' ? "古い順" : "新しい順"}
                    >
                        <Filter size={16} />
                        <span className="text-sm hidden md:inline">
                            {sortOrder === 'asc' ? '昇順' : '降順'}
                        </span>
                    </button>
                    <button onClick={handleRefresh} className="p-2 border border-sf-border rounded hover:bg-gray-50 text-sf-text-weak transition-colors">
                        <RefreshCw size={16} />
                    </button>
                    <button
                        onClick={() => router.push('/reports/batch')}
                        className="bg-sf-light-blue text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 shadow-sm flex items-center gap-1 transition-colors"
                    >
                        <Plus size={16} />
                        新規作成
                    </button>
                </div>
            </div>

            <div className="bg-white border border-sf-border shadow-sm flex-1 overflow-auto rounded">
                {isLoading ? (
                    <div className="p-10 text-center text-sf-text-weak">読み込み中...</div>
                ) : reports.length === 0 ? (
                    <div className="p-10 text-center text-sf-text-weak">日報が見つかりません</div>
                ) : viewMode === 'table' ? (
                    <div className="divide-y divide-sf-border">

                        {paginatedReports.map((report, i) => (
                            <div
                                key={i}
                                className="hover:bg-gray-50 transition-colors cursor-pointer"
                                onClick={() => handleRowClick(i)}
                            >
                                <div className="p-4 flex items-center gap-4">
                                    <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-4">
                                        <div>
                                            <span className="text-xs text-sf-text-weak">管理番号</span>
                                            <p className="font-medium text-sf-text">{report.管理番号}</p>
                                        </div>
                                        <div>
                                            <span className="text-xs text-sf-text-weak">日付</span>
                                            <p className="text-sf-text">{report.日付}</p>
                                        </div>
                                        <div>
                                            <span className="text-xs text-sf-text-weak">訪問先名</span>
                                            <p className="font-medium text-sf-light-blue">{report.訪問先名}</p>
                                            {report.直送先名 && (
                                                <p className="text-xs text-sf-text-weak mt-1">直送: {report.直送先名}</p>
                                            )}
                                        </div>
                                        <div>
                                            <span className="text-xs text-sf-text-weak">行動内容</span>
                                            <p className="text-sf-text">{report.行動内容}</p>
                                        </div>
                                        <div>
                                            <span className="text-xs text-sf-text-weak">面談者</span>
                                            <p className="text-sf-text">{report.面談者}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-4 space-y-4">
                        {paginatedReports.map((report, i) => (
                            <div
                                key={i}
                                className="bg-white p-4 rounded border border-sf-border shadow-sm hover:shadow-md transition-shadow cursor-pointer hover:border-sf-light-blue"
                                onClick={() => handleRowClick(i)}
                            >
                                <div className="flex justify-between items-start mb-3 border-b border-gray-100 pb-2">
                                    <div className="flex items-center gap-3">
                                        <span className="font-bold text-sf-text">{report.日付}</span>
                                        <span className="text-sm px-2 py-0.5 rounded bg-gray-100 text-sf-text-weak">{report.行動内容}</span>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium text-sf-light-blue">{report.訪問先名}</span>
                                            {report.直送先名 && <span className="text-xs text-sf-text-weak">直送: {report.直送先名}</span>}
                                        </div>
                                    </div>
                                    <div className="text-sm text-sf-text-weak">
                                        面談者: {report.面談者 || '-'}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* 左カラム: デザイン情報、商談内容、次回プラン */}
                                    <div className="space-y-4">
                                        {/* デザイン情報（データがある場合のみ表示） */}
                                        {(report.デザイン進捗状況 || report['デザイン依頼No.'] || report.デザイン種別 || report.デザイン名 || report.デザイン提案有無) && (
                                            <div className="bg-purple-50 p-3 rounded border border-purple-100 space-y-2">
                                                <h4 className="text-xs font-semibold text-purple-800 border-b border-purple-200 pb-1 mb-2">デザイン情報</h4>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                                                    {report.デザイン進捗状況 && (
                                                        <div><span className="text-xs text-sf-text-weak">進捗:</span> <span className="font-medium text-sf-text">{report.デザイン進捗状況}</span></div>
                                                    )}
                                                    {report['デザイン依頼No.'] && (
                                                        <div><span className="text-xs text-sf-text-weak">No:</span> <span className="font-medium text-sf-text">{report['デザイン依頼No.']}</span></div>
                                                    )}
                                                    {report.デザイン種別 && (
                                                        <div><span className="text-xs text-sf-text-weak">種別:</span> <span className="text-sf-text">{report.デザイン種別}</span></div>
                                                    )}
                                                    {report.デザイン名 && (
                                                        <div><span className="text-xs text-sf-text-weak">名称:</span> <span className="text-sf-text">{report.デザイン名}</span></div>
                                                    )}
                                                    {report.デザイン提案有無 && (
                                                        <div className="col-span-full"><span className="text-xs text-sf-text-weak">提案有無:</span> <span className="text-sf-text">{report.デザイン提案有無}</span></div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        <div>
                                            <h4 className="text-xs font-semibold text-sf-text-weak mb-1">商談内容</h4>
                                            <p className="text-sm text-sf-text whitespace-pre-wrap bg-gray-50 p-3 rounded border border-gray-100 min-h-[80px]">
                                                {cleanText(report.商談内容) || 'なし'}
                                            </p>
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-semibold text-sf-text-weak mb-1">次回プラン</h4>
                                            <p className="text-sm text-sf-text whitespace-pre-wrap bg-gray-50 p-3 rounded border border-gray-100">
                                                {cleanText(report.次回プラン) || 'なし'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* 右カラム: 承認状況、上長コメント、コメント返信欄 */}
                                    <div className="space-y-4">
                                        {/* 承認・確認状況 */}
                                        <div className="border border-sf-border rounded overflow-hidden">
                                            <div className="flex text-center text-xs divide-x divide-sf-border bg-gray-50 font-medium text-sf-text-weak">
                                                <div className="flex-1 py-1">上長</div>
                                                <div className="flex-1 py-1">山澄常務</div>
                                                <div className="flex-1 py-1">岡本常務</div>
                                                <div className="flex-1 py-1">中野次長</div>
                                            </div>
                                            <div className="flex text-center text-sm divide-x divide-sf-border bg-white">
                                                <div className="flex-1 py-2 h-8 flex items-center justify-center">
                                                    {report.上長 ? <span className="text-sf-light-blue font-bold">✓</span> : <span className="text-gray-300">-</span>}
                                                </div>
                                                <div className="flex-1 py-2 h-8 flex items-center justify-center">
                                                    {report.山澄常務 ? <span className="text-sf-light-blue font-bold">✓</span> : <span className="text-gray-300">-</span>}
                                                </div>
                                                <div className="flex-1 py-2 h-8 flex items-center justify-center">
                                                    {report.岡本常務 ? <span className="text-sf-light-blue font-bold">✓</span> : <span className="text-gray-300">-</span>}
                                                </div>
                                                <div className="flex-1 py-2 h-8 flex items-center justify-center">
                                                    {report.中野次長 ? <span className="text-sf-light-blue font-bold">✓</span> : <span className="text-gray-300">-</span>}
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <h4 className="text-xs font-semibold text-sf-text-weak mb-1">上長コメント</h4>
                                            <p className="text-sm text-sf-text whitespace-pre-wrap bg-blue-50 p-3 rounded border border-blue-100 min-h-[80px]">
                                                {cleanText(report.上長コメント) || 'なし'}
                                            </p>
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-semibold text-sf-text-weak mb-1">コメント返信欄</h4>
                                            <p className="text-sm text-sf-text whitespace-pre-wrap bg-green-50 p-3 rounded border border-green-100">
                                                {cleanText(report.コメント返信欄) || 'なし'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* フッター + ページネーション */}
            <div className="p-2 bg-white border border-sf-border rounded text-xs text-sf-text-weak flex justify-between items-center">
                <span>{reports.length} 件 • {selectedFile}</span>
                {totalPages > 1 && (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage(1)}
                            disabled={currentPage === 1}
                            className="px-2 py-1 rounded border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                        >
                            ««
                        </button>
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="px-2 py-1 rounded border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                        >
                            «
                        </button>
                        <span className="px-2 text-sm text-sf-text">
                            {currentPage} / {totalPages}
                        </span>
                        <button
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            className="px-2 py-1 rounded border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                        >
                            »
                        </button>
                        <button
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={currentPage === totalPages}
                            className="px-2 py-1 rounded border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                        >
                            »»
                        </button>
                    </div>
                )}
                <span>並び順: {sortOrder === 'desc' ? '新しい順' : '古い順'}</span>
            </div>

            {/* 新規日報作成モーダル */}
            {showNewReportModal && (
                <NewReportModal
                    onClose={() => setShowNewReportModal(false)}
                    onSuccess={() => {
                        setShowNewReportModal(false);
                        handleRefresh();
                    }}
                    selectedFile={selectedFile}
                />
            )}

            {/* 日報編集モーダル */}
            {showEditReportModal && editingReport && (
                <EditReportModal
                    report={editingReport}
                    onClose={() => {
                        setShowEditReportModal(false);
                        setEditingReport(null);
                    }}
                    onSuccess={() => {
                        setShowEditReportModal(false);
                        setEditingReport(null);
                        handleRefresh();
                    }}
                    selectedFile={selectedFile}
                    reports={reports}
                />
            )}

            {/* 日報詳細モーダル */}
            {selectedReportIndex !== null && (
                <ReportDetailModal
                    report={reports[selectedReportIndex]}
                    onClose={() => setSelectedReportIndex(null)}
                    onNext={handleNextReport}
                    onPrev={handlePrevReport}
                    hasNext={selectedReportIndex > 0}
                    hasPrev={selectedReportIndex < reports.length - 1}
                    onEdit={() => {
                        setEditingReport(reports[selectedReportIndex]);
                        setSelectedReportIndex(null); // 詳細モーダルを閉じる
                        setShowEditReportModal(true);
                    }}
                    onUpdate={handleRefresh}
                />
            )}
        </div>
    );
}
