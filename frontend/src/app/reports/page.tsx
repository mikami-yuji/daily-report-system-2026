'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Report, searchDesignImages, DesignImage, batchUpdateReportApproval, updateReportApproval } from '@/lib/api';
import { useFile } from '@/context/FileContext';
import { useReports } from '@/hooks/useQueryHooks';
import { 
    Plus, 
    Filter, 
    RefreshCw, 
    FileText, 
    LayoutList, 
    Table, 
    Calendar, 
    Check, 
    MessageSquare, 
    Lightbulb, 
    Sparkles, 
    Palette,
    Layers,
    AlignJustify,
    Image as ImageIcon,
    Loader2,
    CheckSquare,
    Square,
    UserCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import NewReportModal from '@/components/reports/NewReportModal';
import EditReportModal from '@/components/reports/EditReportModal';
import ReportDetailModal from '@/components/reports/ReportDetailModal';
import DesignImagePreviewModal from '@/components/reports/DesignImagePreviewModal';
import DesignImageHoverButton from '@/components/reports/DesignImageHoverButton';
import { cleanText, compareDates } from '@/lib/reportUtils';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/hooks/useQueryHooks';

export default function ReportsPage(): React.JSX.Element {
    const router = useRouter();
    const { files, selectedFile, setSelectedFile } = useFile();
    const queryClient = useQueryClient();

    // React Queryでデータ取得（自動キャッシュ）
    const { data: rawReports = [], isLoading, error, refetch } = useReports(selectedFile || undefined);

    const [selectedReportIndex, setSelectedReportIndex] = useState<number | null>(null);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [viewMode, setViewMode] = useState<'table' | 'timeline'>('timeline');
    // タイムラインの表示密度（高密度・標準・詳細）
    const [density, setDensity] = useState<'compact' | 'normal' | 'detailed'>('normal');

    // 承認者役職
    const APPROVER_ROLES = ['上長', '山澄常務', '岡本常務', '中野次長'] as const;
    type ApproverRole = typeof APPROVER_ROLES[number];
    const [selectedApproverRole, setSelectedApproverRole] = useState<ApproverRole>('上長');

    // 一括選択・承認ステート
    const [selectedReportIds, setSelectedReportIds] = useState<Set<number>>(new Set());
    const [isBatchApproving, setIsBatchApproving] = useState(false);
    const [approvingSingleId, setApprovingSingleId] = useState<number | null>(null);

    // 複製作成用ステート
    const [duplicateReport, setDuplicateReport] = useState<Report | null>(null);

    // デザイン画像検索用ステート
    const [searchingImageNo, setSearchingImageNo] = useState<string | null>(null);
    const [imageResults, setImageResults] = useState<DesignImage[]>([]);
    const [showImageModal, setShowImageModal] = useState(false);
    const [currentSearchDesignNo, setCurrentSearchDesignNo] = useState<string>('');

    const [showNewReportModal, setShowNewReportModal] = useState(false);
    const [showEditReportModal, setShowEditReportModal] = useState(false);
    const [editingReport, setEditingReport] = useState<Report | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        requestAnimationFrame(() => {
            setMounted(true);
        });
        const savedDensity = localStorage.getItem('reports_timeline_density') as 'compact' | 'normal' | 'detailed' | null;
        if (savedDensity && ['compact', 'normal', 'detailed'].includes(savedDensity)) {
            setDensity(savedDensity);
        }
        const savedViewMode = localStorage.getItem('reports_view_mode') as 'table' | 'timeline' | null;
        if (savedViewMode && ['table', 'timeline'].includes(savedViewMode)) {
            setViewMode(savedViewMode);
        }
        const savedApproverRole = localStorage.getItem('reports_selected_approver_role') as ApproverRole | null;
        if (savedApproverRole && APPROVER_ROLES.includes(savedApproverRole)) {
            setSelectedApproverRole(savedApproverRole);
        }
    }, []);

    const handleApproverRoleChange = (role: ApproverRole) => {
        setSelectedApproverRole(role);
        localStorage.setItem('reports_selected_approver_role', role);
        toast.success(`承認者を「${role}」に切り替えました`);
    };

    const handleDensityChange = (newDensity: 'compact' | 'normal' | 'detailed') => {
        setDensity(newDensity);
        localStorage.setItem('reports_timeline_density', newDensity);
    };

    const handleViewModeChange = (newMode: 'table' | 'timeline') => {
        setViewMode(newMode);
        localStorage.setItem('reports_view_mode', newMode);
    };

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
            
            // 日付で比較
            const dateComp = compareDates(dateA, dateB);
            
            if (dateComp !== 0) {
                return sortOrder === 'asc' ? dateComp : -dateComp;
            }
            
            // 日付が同じ場合は管理番号で比較
            const numA = Number(a.管理番号) || 0;
            const numB = Number(b.管理番号) || 0;
            return sortOrder === 'asc' ? numA - numB : numB - numA;
        });
    }, [rawReports, sortOrder]);

    const totalPages = Math.ceil(reports.length / itemsPerPage);
    const paginatedReports = reports.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // 日付フォーマットと曜日算出
    const formatGroupDate = (dateStr: string) => {
        if (!dateStr) return { formatted: '', dayOfWeek: '', display: '日付未設定' };
        let y = 0, m = 0, d = 0;
        const parts = dateStr.includes('/') ? dateStr.split('/') : dateStr.split('-');
        if (parts.length === 3) {
            let yearPart = parseInt(parts[0], 10);
            if (yearPart < 100) yearPart += 2000;
            y = yearPart;
            m = parseInt(parts[1], 10);
            d = parseInt(parts[2], 10);
        }
        if (y && m && d) {
            const dateObj = new Date(y, m - 1, d);
            const days = ['日', '月', '火', '水', '木', '金', '土'];
            const dayOfWeek = days[dateObj.getDay()] || '';
            const formatted = `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
            return {
                formatted,
                dayOfWeek,
                display: `${formatted} (${dayOfWeek})`
            };
        }
        return { formatted: dateStr, dayOfWeek: '', display: dateStr };
    };

    // 有効データ有無判定（ゼロ・ウェイスト用）
    const hasContent = (val?: string | null): boolean => {
        if (!val) return false;
        const cleaned = cleanText(val).trim();
        return cleaned !== '' && cleaned !== 'なし' && cleaned !== '-' && cleaned !== '無' && cleaned !== '特になし';
    };

    // デザイン情報有無判定
    const hasDesignInfo = (r: Report) => {
        return !!(r.デザイン進捗状況 || r['デザイン依頼No.'] || r.デザイン種別 || r.デザイン名 || r.デザイン提案有無);
    };

    // 行動種別のバッジ色
    const getActionBadgeColor = (action?: string) => {
        if (!action) return 'bg-gray-100 text-gray-700 border-gray-200';
        if (action.includes('アポあり') || action.includes('アポ有')) {
            return 'bg-blue-50 text-blue-700 border-blue-200';
        }
        if (action.includes('アポなし') || action.includes('アポ無')) {
            return 'bg-purple-50 text-purple-700 border-purple-200';
        }
        if (action.includes('電話') || action.includes('TEL')) {
            return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        }
        if (action.includes('来客') || action.includes('来社')) {
            return 'bg-amber-50 text-amber-700 border-amber-200';
        }
        return 'bg-gray-50 text-gray-700 border-gray-200';
    };

    // 日付別グループ化データ
    const groupedReports = useMemo(() => {
        const groups: {
            dateKey: string;
            dateDisplay: string;
            dayOfWeek: string;
            items: { report: Report; originalIndex: number }[];
        }[] = [];

        paginatedReports.forEach((report, idx) => {
            const dateKey = String(report.日付 || '').trim();
            const globalIndex = (currentPage - 1) * itemsPerPage + idx;
            const lastGroup = groups[groups.length - 1];

            if (lastGroup && lastGroup.dateKey === dateKey) {
                lastGroup.items.push({ report, originalIndex: globalIndex });
            } else {
                const { display, dayOfWeek } = formatGroupDate(dateKey);
                groups.push({
                    dateKey,
                    dateDisplay: display,
                    dayOfWeek,
                    items: [{ report, originalIndex: globalIndex }]
                });
            }
        });

        return groups;
    }, [paginatedReports, currentPage, itemsPerPage]);

    // 行選択トグル
    const handleToggleSelect = (mgmtNo: number, e?: React.SyntheticEvent) => {
        if (e) e.stopPropagation();
        setSelectedReportIds(prev => {
            const next = new Set(prev);
            if (next.has(mgmtNo)) {
                next.delete(mgmtNo);
            } else {
                next.add(mgmtNo);
            }
            return next;
        });
    };

    // 現在ページの全選択・解除
    const handleSelectAllCurrentPage = () => {
        const pageMgmtNos = paginatedReports.map(r => Number(r.管理番号)).filter(Boolean);
        const allSelected = pageMgmtNos.length > 0 && pageMgmtNos.every(id => selectedReportIds.has(id));
        setSelectedReportIds(prev => {
            const next = new Set(prev);
            if (allSelected) {
                pageMgmtNos.forEach(id => next.delete(id));
            } else {
                pageMgmtNos.forEach(id => next.add(id));
            }
            return next;
        });
    };

    // 一括承認アクション
    const handleBatchApprove = async (fieldName: '上長' | '山澄常務' | '岡本常務' | '中野次長' = '上長') => {
        const ids = Array.from(selectedReportIds);
        if (ids.length === 0) return;
        setIsBatchApproving(true);
        try {
            const res = await batchUpdateReportApproval(ids, fieldName, '✓', selectedFile || undefined);
            if (res.success) {
                toast.success(`${res.updated_count}件の日報を「${fieldName}」として一括承認しました`);
                setSelectedReportIds(new Set());
                queryClient.invalidateQueries({ queryKey: queryKeys.reports(selectedFile || undefined) });
            }
        } catch (err) {
            console.error('Batch approval failed:', err);
            toast.error('一括承認に失敗しました');
        } finally {
            setIsBatchApproving(false);
        }
    };

    // 一覧からのクイック承認トグル
    const handleQuickApprove = async (
        report: Report,
        fieldName: '上長' | '山澄常務' | '岡本常務' | '中野次長' = '上長',
        e?: React.MouseEvent
    ) => {
        if (e) e.stopPropagation();
        const mgmtNo = Number(report.管理番号);
        if (!mgmtNo) return;

        const isCurrentlyApproved = !!report[fieldName];
        const nextVal = isCurrentlyApproved ? '' : '✓';

        setApprovingSingleId(mgmtNo);
        try {
            await updateReportApproval(mgmtNo, { [fieldName]: nextVal }, selectedFile || undefined);
            toast.success(`No.${mgmtNo} を「${fieldName}」${nextVal ? '承認' : '解除'}しました`);
            queryClient.invalidateQueries({ queryKey: queryKeys.reports(selectedFile || undefined) });
        } catch (err) {
            console.error('Quick approval failed:', err);
            toast.error('承認ステータスの更新に失敗しました');
        } finally {
            setApprovingSingleId(null);
        }
    };

    // 承認状況バッジ（クリックでクイック承認可能）
    const renderApprovalBadges = (report: Report) => {
        const mgmtNo = Number(report.管理番号);
        const isApprovingThis = approvingSingleId === mgmtNo;
        const approvers = [
            { label: '上長' as const, approved: !!report.上長 },
            { label: '山澄常務' as const, approved: !!report.山澄常務 },
            { label: '岡本常務' as const, approved: !!report.岡本常務 },
            { label: '中野次長' as const, approved: !!report.中野次長 },
        ];
        const approvedList = approvers.filter(a => a.approved);

        if (approvedList.length === 0) {
            return (
                <button
                    type="button"
                    onClick={(e) => handleQuickApprove(report, selectedApproverRole, e)}
                    disabled={isApprovingThis}
                    className="group inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-gray-100 hover:bg-blue-50 text-gray-400 hover:text-blue-700 border border-gray-200 hover:border-blue-300 font-medium transition cursor-pointer"
                    title={`クリックして「${selectedApproverRole}」として承認`}
                >
                    {isApprovingThis ? (
                        <Loader2 size={11} className="animate-spin text-blue-600" />
                    ) : (
                        <span className="group-hover:hidden">未承認</span>
                    )}
                    <span className="hidden group-hover:inline font-bold">✓ {selectedApproverRole}承認</span>
                </button>
            );
        }

        return (
            <div className="flex items-center gap-1 flex-wrap">
                {approvedList.map(a => (
                    <button
                        key={a.label}
                        type="button"
                        onClick={(e) => handleQuickApprove(report, a.label, e)}
                        disabled={isApprovingThis}
                        className="inline-flex items-center gap-0.5 text-[11px] px-1.5 py-0.5 rounded bg-blue-50 hover:bg-rose-50 text-blue-700 hover:text-rose-700 border border-blue-200 hover:border-rose-300 font-medium transition cursor-pointer"
                        title={`${a.label} 承認済（クリックで承認解除）`}
                    >
                        {isApprovingThis ? (
                            <Loader2 size={11} className="animate-spin text-blue-600" />
                        ) : (
                            <Check size={11} className="stroke-[2.5]" />
                        )}
                        {a.label}
                    </button>
                ))}
                {/* 選択中の役職がまだ未承認の場合、1クリックで追加承認できるボタン */}
                {!report[selectedApproverRole] && (
                    <button
                        type="button"
                        onClick={(e) => handleQuickApprove(report, selectedApproverRole, e)}
                        disabled={isApprovingThis}
                        className="inline-flex items-center gap-0.5 text-[10px] px-1 py-0.5 rounded bg-gray-50 hover:bg-blue-50 text-gray-400 hover:text-blue-600 border border-dashed border-gray-300 hover:border-blue-300 font-medium transition cursor-pointer"
                        title={`クリックして「${selectedApproverRole}」承認を追加`}
                    >
                        + {selectedApproverRole}
                    </button>
                )}
            </div>
        );
    };

    // デザイン画像検索アクション
    const handleImageSearch = async (designNo: string, e: React.MouseEvent) => {
        e.stopPropagation(); // 行やカード全体のクリックモーダル発火を防止
        if (!designNo) return;
        const cleanNo = cleanText(designNo).replace('.0', '').trim();
        if (!cleanNo) return;

        setCurrentSearchDesignNo(cleanNo);
        setSearchingImageNo(cleanNo);
        try {
            const result = await searchDesignImages(cleanNo, selectedFile || undefined);
            if (result.images && result.images.length > 0) {
                setImageResults(result.images);
                setShowImageModal(true);
                toast.success(`${result.images.length}件のデザイン画像が見つかりました`);
            } else {
                setImageResults([]);
                toast.error('関連するデザイン画像が見つかりませんでした');
            }
        } catch (error) {
            console.error('Failed to search design images:', error);
            toast.error('画像検索中にエラーが発生しました');
        } finally {
            setSearchingImageNo(null);
        }
    };

    // デザインNoと画像表示アイコンのレンダリング（ホバープレビュー対応）
    const renderDesignNoWithImage = (designNo?: string | null) => {
        if (!designNo) return null;
        const cleanNo = cleanText(designNo).replace('.0', '').trim();
        if (!cleanNo) return null;

        return (
            <span className="inline-flex items-center gap-1.5 font-semibold">
                <span className="text-slate-700 font-mono">No.{cleanNo}</span>
                <DesignImageHoverButton
                    designNo={cleanNo}
                    selectedFile={selectedFile || undefined}
                    onOpenModal={(imgs, dNo) => {
                        setImageResults(imgs);
                        setCurrentSearchDesignNo(dNo);
                        setShowImageModal(true);
                    }}
                    size="sm"
                />
            </span>
        );
    };

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

    if (!mounted) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sf-light-blue"></div>
            </div>
        );
    }

    return (
        <div className="space-y-4 h-[calc(100vh-8rem)] flex flex-col animate-fadeIn">
            {/* 上部コントロールバー */}
            <div className="flex flex-wrap justify-between items-center bg-white p-3.5 rounded border border-sf-border shadow-sm gap-3">
                <div className="flex items-center gap-3">
                    <div className="bg-sf-light-blue p-2 rounded text-white shadow-sm">
                        <FileText size={20} />
                    </div>
                    <div>
                        <p className="text-xs text-sf-text-weak font-medium">オブジェクト</p>
                        <h1 className="text-xl font-bold text-sf-text">営業日報</h1>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                    {/* ビュー切替（テーブル / タイムライン） */}
                    <div className="flex bg-gray-100 p-1 rounded border border-sf-border">
                        <button
                            onClick={() => handleViewModeChange('timeline')}
                            className={`p-1.5 rounded transition-all flex items-center gap-1 text-xs ${viewMode === 'timeline' ? 'bg-white shadow-sm text-sf-light-blue font-semibold' : 'text-gray-500 hover:text-gray-800'}`}
                            title="タイムライン表示（日別カード形式）"
                        >
                            <LayoutList size={16} />
                            <span className="hidden sm:inline">タイムライン</span>
                        </button>
                        <button
                            onClick={() => handleViewModeChange('table')}
                            className={`p-1.5 rounded transition-all flex items-center gap-1 text-xs ${viewMode === 'table' ? 'bg-white shadow-sm text-sf-light-blue font-semibold' : 'text-gray-500 hover:text-gray-800'}`}
                            title="テーブル表示（表形式）"
                        >
                            <Table size={16} />
                            <span className="hidden sm:inline">テーブル</span>
                        </button>
                    </div>

                    {/* タイムライン時のみ表示：密度切替（案D） */}
                    {viewMode === 'timeline' && (
                        <div className="flex items-center bg-gray-100 p-0.5 rounded border border-sf-border text-xs">
                            <button
                                onClick={() => handleDensityChange('compact')}
                                className={`px-2 py-1 rounded transition-all flex items-center gap-1 ${density === 'compact' ? 'bg-white shadow-sm font-semibold text-sf-light-blue' : 'text-gray-500 hover:text-gray-800'}`}
                                title="高密度表示（Excel同等のコンパクト行形式、1画面に多数表示）"
                            >
                                <AlignJustify size={14} />
                                <span>高密度</span>
                            </button>
                            <button
                                onClick={() => handleDensityChange('normal')}
                                className={`px-2 py-1 rounded transition-all flex items-center gap-1 ${density === 'normal' ? 'bg-white shadow-sm font-semibold text-sf-light-blue' : 'text-gray-500 hover:text-gray-800'}`}
                                title="標準表示（スマートカード・おすすめ）"
                            >
                                <Layers size={14} />
                                <span>標準</span>
                            </button>
                            <button
                                onClick={() => handleDensityChange('detailed')}
                                className={`px-2 py-1 rounded transition-all flex items-center gap-1 ${density === 'detailed' ? 'bg-white shadow-sm font-semibold text-sf-light-blue' : 'text-gray-500 hover:text-gray-800'}`}
                                title="詳細表示（余白広め）"
                            >
                                <span>詳細</span>
                            </button>
                        </div>
                    )}

                    <button
                        onClick={toggleSortOrder}
                        className="p-2 border border-sf-border rounded hover:bg-gray-50 text-sf-text-weak transition-colors flex items-center gap-1.5 text-xs font-medium"
                        title={sortOrder === 'asc' ? "古い順" : "新しい順"}
                    >
                        <Filter size={15} />
                        <span className="hidden md:inline">
                            {sortOrder === 'asc' ? '昇順' : '降順'}
                        </span>
                    </button>

                    <button
                        onClick={handleRefresh}
                        className="p-2 border border-sf-border rounded hover:bg-gray-50 text-sf-text-weak transition-colors"
                        title="再読み込み"
                        aria-label="再読み込み"
                    >
                        <RefreshCw size={15} />
                    </button>

                    {/* 操作・承認者役職セレクター */}
                    <div className="flex items-center gap-1.5 bg-gray-50 border border-sf-border rounded px-2.5 py-1.5 text-xs">
                        <UserCheck size={14} className="text-blue-600 flex-shrink-0" />
                        <span className="text-sf-text-weak text-[11px] font-medium whitespace-nowrap">承認役職:</span>
                        <select
                            value={selectedApproverRole}
                            onChange={(e) => handleApproverRoleChange(e.target.value as ApproverRole)}
                            className="bg-transparent text-sf-text font-bold text-xs focus:outline-none cursor-pointer pr-1"
                            title="現在操作中の承認者役職（クイック承認および一括承認に適用されます）"
                        >
                            {APPROVER_ROLES.map(role => (
                                <option key={role} value={role}>
                                    {role}
                                </option>
                            ))}
                        </select>
                    </div>

                    <button
                        onClick={() => router.push('/reports/batch')}
                        className="bg-sf-light-blue text-white px-3.5 py-1.5 rounded text-xs font-medium hover:bg-blue-700 shadow-sm flex items-center gap-1 transition-colors"
                    >
                        <Plus size={15} />
                        新規作成
                    </button>
                </div>
            </div>

            {/* メインコンテンツ領域 */}
            <div className="bg-white border border-sf-border shadow-sm flex-1 overflow-auto rounded">
                {isLoading ? (
                    <div className="p-10 text-center text-sf-text-weak flex flex-col items-center gap-2">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sf-light-blue"></div>
                        <span>日報を読み込み中...</span>
                    </div>
                ) : reports.length === 0 ? (
                    <div className="p-10 text-center text-sf-text-weak">日報が見つかりません</div>
                ) : viewMode === 'table' ? (
                    /* 強化版テーブル表示（Excel風） */
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-sf-text border-collapse">
                            <thead className="bg-gray-50 text-sf-text-weak border-b border-sf-border sticky top-0 z-10">
                                <tr>
                                    <th className="py-2.5 px-3 font-semibold w-10 text-center">
                                        <input
                                            type="checkbox"
                                            checked={paginatedReports.length > 0 && paginatedReports.every(r => selectedReportIds.has(Number(r.管理番号)))}
                                            onChange={handleSelectAllCurrentPage}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                            title="すべて選択 / 選択解除"
                                        />
                                    </th>
                                    <th className="py-2.5 px-3 font-semibold w-16">管理No.</th>
                                    <th className="py-2.5 px-3 font-semibold w-24">日付</th>
                                    <th className="py-2.5 px-3 font-semibold w-28">行動種別</th>
                                    <th className="py-2.5 px-3 font-semibold w-56">訪問先 / 直送先</th>
                                    <th className="py-2.5 px-3 font-semibold w-24">面談者</th>
                                    <th className="py-2.5 px-3 font-semibold">商談内容</th>
                                    <th className="py-2.5 px-3 font-semibold w-36">承認状況</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {paginatedReports.map((report, i) => {
                                    const globalIndex = (currentPage - 1) * itemsPerPage + i;
                                    const isSelected = selectedReportIds.has(Number(report.管理番号));
                                    return (
                                        <tr
                                            key={i}
                                            onClick={() => handleRowClick(globalIndex)}
                                            className={`hover:bg-blue-50/50 transition-colors cursor-pointer ${isSelected ? 'bg-blue-50/50' : ''}`}
                                        >
                                            <td className="py-2.5 px-3 text-center align-top" onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={(e) => handleToggleSelect(Number(report.管理番号), e)}
                                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                />
                                            </td>
                                            <td className="py-2.5 px-3 text-sf-text-weak font-mono align-top">{report.管理番号}</td>
                                            <td className="py-2.5 px-3 font-medium whitespace-nowrap align-top">{report.日付}</td>
                                            <td className="py-2.5 px-3 align-top">
                                                <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] border font-medium whitespace-nowrap ${getActionBadgeColor(report.行動内容)}`}>
                                                    {report.行動内容 || '-'}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3 align-top">
                                                <div className="font-medium text-sf-light-blue truncate max-w-xs">{report.訪問先名}</div>
                                                {report.直送先名 && (
                                                    <div className="text-[11px] text-sf-text-weak truncate max-w-xs">直送: {report.直送先名}</div>
                                                )}
                                            </td>
                                            <td className="py-2.5 px-3 text-sf-text-weak whitespace-nowrap align-top">{report.面談者 || '-'}</td>
                                            <td className="py-2.5 px-3 max-w-lg align-top">
                                                {/* デザイン情報（あれば1行チップで表示） */}
                                                {hasDesignInfo(report) && (
                                                    <div className="flex items-center gap-1.5 text-[11px] bg-slate-50 text-slate-700 px-2 py-0.5 rounded border border-slate-200 mb-1.5 flex-wrap">
                                                        <span className="font-semibold text-slate-700 flex items-center gap-1 flex-shrink-0">
                                                            <Palette size={11} className="text-slate-500" /> デザイン:
                                                        </span>
                                                        {report.デザイン名 && <span>名称: <strong className="text-slate-800 font-medium">{report.デザイン名}</strong></span>}
                                                        {report.デザイン進捗状況 && <span className="bg-slate-200 text-slate-700 px-1 rounded text-[10px] font-medium border border-slate-300/60">{report.デザイン進捗状況}</span>}
                                                        {(report['デザイン依頼No.'] || report['システム確認用デザインNo.']) && (
                                                            renderDesignNoWithImage(report['デザイン依頼No.'] || report['システム確認用デザインNo.'])
                                                        )}
                                                        {report.デザイン種別 && <span className="text-slate-500">({report.デザイン種別})</span>}
                                                        {report.デザイン提案有無 && <span className="text-slate-500">提案:{report.デザイン提案有無}</span>}
                                                    </div>
                                                )}

                                                {/* 商談内容（折り返してすべて表示） */}
                                                <div className="text-sf-text whitespace-pre-wrap break-words leading-relaxed text-xs">
                                                    {cleanText(report.商談内容) || <span className="text-gray-400 italic">（未記入）</span>}
                                                </div>

                                                {/* 次回プラン（あれば折り返して表示） */}
                                                {hasContent(report.次回プラン) && (
                                                    <div className="text-[11px] text-amber-900 whitespace-pre-wrap break-words leading-relaxed mt-1 flex items-start gap-1 bg-amber-50/70 p-1.5 rounded border border-amber-200/70">
                                                        <Lightbulb size={12} className="text-amber-600 flex-shrink-0 mt-0.5" />
                                                        <div className="flex-1">
                                                            <span className="font-semibold text-amber-800 mr-1">次回プラン:</span>
                                                            {cleanText(report.次回プラン)}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* 上長コメント（折り返してすべて表示） */}
                                                {hasContent(report.上長コメント) && (
                                                    <div className="text-[11px] text-blue-900 whitespace-pre-wrap break-words leading-relaxed mt-1 flex items-start gap-1 bg-blue-50/80 p-1.5 rounded border border-blue-200/80">
                                                        <MessageSquare size={12} className="text-blue-600 flex-shrink-0 mt-0.5" />
                                                        <div className="flex-1">
                                                            <span className="font-semibold text-blue-800 mr-1">上長コメント:</span>
                                                            {cleanText(report.上長コメント)}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* コメント返信欄（あれば折り返して表示） */}
                                                {hasContent(report.コメント返信欄) && (
                                                    <div className="text-[11px] text-emerald-900 whitespace-pre-wrap break-words leading-relaxed mt-1 flex items-start gap-1 bg-emerald-50/80 p-1.5 rounded border border-emerald-200/80">
                                                        <div className="flex-1">
                                                            <span className="font-semibold text-emerald-800 mr-1">コメント返信:</span>
                                                            {cleanText(report.コメント返信欄)}
                                                        </div>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-2.5 px-3 align-top">
                                                {renderApprovalBadges(report)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    /* 案A：スマート・タイムライン（日別グループ化 ＋ 密度切り替え対応） */
                    <div className="p-4 space-y-6 bg-gray-50/50 min-h-full">
                        {groupedReports.map((group) => (
                            <div key={group.dateKey} className="space-y-2.5">
                                {/* デイリーヘッダー */}
                                <div className="flex items-center gap-2 px-1 pt-1 sticky top-0 bg-gray-50/95 backdrop-blur-sm z-10 py-1.5 border-b border-gray-200/80">
                                    <div className="h-4 w-1 bg-sf-light-blue rounded-full"></div>
                                    <div className="flex items-baseline gap-2">
                                        <span className="font-bold text-sm text-sf-text flex items-center gap-1.5">
                                            <Calendar size={14} className="text-sf-light-blue" />
                                            {group.dateDisplay}
                                        </span>
                                        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full font-semibold text-[11px]">
                                            {group.items.length}件の活動
                                        </span>
                                    </div>
                                    <div className="flex-1"></div>
                                </div>

                                {/* 日報リスト */}
                                <div className={density === 'compact' ? 'space-y-1.5' : density === 'normal' ? 'space-y-3' : 'space-y-4'}>
                                    {group.items.map(({ report, originalIndex }) => {
                                        // -------------------------------------------------------------
                                        // 1. 高密度モード（Compact: 余白最小限で商談内容・コメント・デザイン詳細を全文表示）
                                        // -------------------------------------------------------------
                                        if (density === 'compact') {
                                            const isSelected = selectedReportIds.has(Number(report.管理番号));
                                            return (
                                                <div
                                                    key={originalIndex}
                                                    onClick={() => handleRowClick(originalIndex)}
                                                    className={`bg-white px-3.5 py-2.5 rounded border transition-all cursor-pointer space-y-1.5 ${
                                                        isSelected ? 'border-blue-400 bg-blue-50/20 shadow-xs' : 'border-sf-border hover:border-sf-light-blue hover:shadow-xs'
                                                    }`}
                                                >
                                                    {/* ヘッダー行 */}
                                                    <div className="flex items-center justify-between gap-2 text-xs">
                                                        <div className="flex items-center gap-2 min-w-0 flex-wrap">
                                                            <div 
                                                                className="flex items-center justify-center shrink-0"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isSelected}
                                                                    onChange={(e) => handleToggleSelect(Number(report.管理番号), e)}
                                                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer w-3.5 h-3.5"
                                                                    title="選択"
                                                                />
                                                            </div>
                                                            <span className={`px-1.5 py-0.5 rounded text-[11px] border font-medium whitespace-nowrap ${getActionBadgeColor(report.行動内容)}`}>
                                                                {report.行動内容 || '訪問'}
                                                            </span>
                                                            <span className="font-bold text-sf-text text-sm">
                                                                {report.訪問先名}
                                                            </span>
                                                            {report.直送先名 && (
                                                                <span className="text-[11px] text-sf-text-weak bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                                                                    直送: {report.直送先名}
                                                                </span>
                                                            )}
                                                            {report.面談者 && (
                                                                <span className="text-[11px] text-sf-text-weak whitespace-nowrap">
                                                                    面談: <span className="text-sf-text">{report.面談者}</span>
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex-shrink-0">
                                                            {renderApprovalBadges(report)}
                                                        </div>
                                                    </div>

                                                    {/* デザイン情報（詳細を1行で記載） */}
                                                    {hasDesignInfo(report) && (
                                                        <div className="flex items-center gap-2 text-[11px] bg-slate-50 text-slate-700 px-2 py-0.5 rounded border border-slate-200 flex-wrap">
                                                            <span className="font-semibold text-slate-700 flex items-center gap-1 flex-shrink-0">
                                                                <Palette size={11} className="text-slate-500" /> デザイン:
                                                            </span>
                                                            {report.デザイン名 && <span>名称: <strong className="text-slate-800 font-medium">{report.デザイン名}</strong></span>}
                                                            {report.デザイン進捗状況 && <span className="bg-slate-200 text-slate-700 px-1 rounded font-medium border border-slate-300/60">{report.デザイン進捗状況}</span>}
                                                            {(report['デザイン依頼No.'] || report['システム確認用デザインNo.']) && (
                                                                renderDesignNoWithImage(report['デザイン依頼No.'] || report['システム確認用デザインNo.'])
                                                            )}
                                                            {report.デザイン種別 && <span className="text-slate-500">({report.デザイン種別})</span>}
                                                            {report.デザイン提案有無 && <span className="text-slate-500">提案:{report.デザイン提案有無}</span>}
                                                        </div>
                                                    )}

                                                    {/* 商談内容（折り返してすべて表示） */}
                                                    <div className="text-xs text-sf-text leading-relaxed whitespace-pre-wrap break-words pl-2 border-l-2 border-sf-light-blue/40 py-0.5">
                                                        {cleanText(report.商談内容) || <span className="text-gray-400 italic">（商談内容未記入）</span>}
                                                    </div>

                                                    {/* 次回プラン（あれば折り返して表示） */}
                                                    {hasContent(report.次回プラン) && (
                                                        <div className="text-[11px] bg-amber-50/70 border border-amber-200/70 rounded px-2 py-1 text-amber-950 flex items-start gap-1.5">
                                                            <Lightbulb size={12} className="text-amber-600 flex-shrink-0 mt-0.5" />
                                                            <div className="flex-1 whitespace-pre-wrap break-words leading-relaxed">
                                                                <span className="font-semibold text-amber-800 mr-1">次回プラン:</span>
                                                                {cleanText(report.次回プラン)}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* 上長コメント（折り返してすべて表示） */}
                                                    {hasContent(report.上長コメント) && (
                                                        <div className="text-[11px] bg-blue-50/80 border border-blue-200/80 rounded px-2 py-1 text-blue-950 flex items-start gap-1.5">
                                                            <MessageSquare size={12} className="text-blue-600 flex-shrink-0 mt-0.5" />
                                                            <div className="flex-1 whitespace-pre-wrap break-words leading-relaxed">
                                                                <span className="font-semibold text-blue-800 mr-1">上長コメント:</span>
                                                                {cleanText(report.上長コメント)}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* コメント返信（あれば折り返して表示） */}
                                                    {hasContent(report.コメント返信欄) && (
                                                        <div className="text-[11px] bg-emerald-50/80 border border-emerald-200/80 rounded px-2 py-1 text-emerald-950 flex items-start gap-1.5">
                                                            <div className="flex-1 whitespace-pre-wrap break-words leading-relaxed">
                                                                <span className="font-semibold text-emerald-800 mr-1">コメント返信:</span>
                                                                {cleanText(report.コメント返信欄)}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        }

                                        // -------------------------------------------------------------
                                        // 2. 標準モード（Normal: スマート・タイムライン ★おすすめ）
                                        // -------------------------------------------------------------
                                        if (density === 'normal') {
                                            const isSelected = selectedReportIds.has(Number(report.管理番号));
                                            return (
                                                <div
                                                    key={originalIndex}
                                                    onClick={() => handleRowClick(originalIndex)}
                                                    className={`bg-white p-3.5 rounded-lg border transition-all cursor-pointer space-y-2.5 ${
                                                        isSelected ? 'border-blue-400 bg-blue-50/20 shadow-xs' : 'border-sf-border hover:border-sf-light-blue hover:shadow-md'
                                                    }`}
                                                >
                                                    {/* ヘッダー */}
                                                    <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-2">
                                                        <div className="flex items-center gap-2.5 flex-wrap">
                                                            <div 
                                                                className="flex items-center justify-center shrink-0"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isSelected}
                                                                    onChange={(e) => handleToggleSelect(Number(report.管理番号), e)}
                                                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4"
                                                                    title="選択"
                                                                />
                                                            </div>
                                                            <span className={`px-2 py-0.5 rounded text-xs border font-medium ${getActionBadgeColor(report.行動内容)}`}>
                                                                {report.行動内容 || '訪問'}
                                                            </span>
                                                            <span className="font-bold text-sm sm:text-base text-sf-text hover:text-sf-light-blue transition-colors">
                                                                {report.訪問先名}
                                                            </span>
                                                            {report.直送先名 && (
                                                                <span className="text-xs text-sf-text-weak bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
                                                                    直送: {report.直送先名}
                                                                </span>
                                                            )}
                                                            <span className="text-xs text-sf-text-weak">
                                                                面談者: <span className="text-sf-text font-medium">{report.面談者 || '-'}</span>
                                                            </span>
                                                        </div>
                                                        <div className="flex-shrink-0">
                                                            {renderApprovalBadges(report)}
                                                        </div>
                                                    </div>

                                                    {/* デザイン情報（詳細を1行で記載） */}
                                                    {hasDesignInfo(report) && (
                                                        <div className="flex items-center gap-2 text-xs bg-slate-50 text-slate-700 px-2.5 py-1.5 rounded border border-slate-200 flex-wrap">
                                                            <span className="font-semibold text-slate-700 flex items-center gap-1 flex-shrink-0">
                                                                <Palette size={13} className="text-slate-500" /> デザイン情報:
                                                            </span>
                                                            {report.デザイン名 && <span>名称: <strong className="text-slate-800">{report.デザイン名}</strong></span>}
                                                            {report.デザイン進捗状況 && <span className="bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded text-[11px] font-medium border border-slate-300/60">{report.デザイン進捗状況}</span>}
                                                            {(report['デザイン依頼No.'] || report['システム確認用デザインNo.']) && (
                                                                renderDesignNoWithImage(report['デザイン依頼No.'] || report['システム確認用デザインNo.'])
                                                            )}
                                                            {report.デザイン種別 && <span className="text-slate-500">({report.デザイン種別})</span>}
                                                            {report.デザイン提案有無 && <span className="text-slate-500">提案: {report.デザイン提案有無}</span>}
                                                        </div>
                                                    )}

                                                    {/* 商談内容（本文: 折り返して全文表示） */}
                                                    <div className="text-sm text-sf-text leading-relaxed whitespace-pre-wrap break-words pl-2.5 border-l-2 border-sf-light-blue/50 py-0.5">
                                                        {cleanText(report.商談内容) || <span className="text-gray-400 italic">（商談内容未記入）</span>}
                                                    </div>

                                                    {/* 次回プラン（データがある場合のみ表示） */}
                                                    {hasContent(report.次回プラン) && (
                                                        <div className="text-xs bg-amber-50/70 border border-amber-200/80 rounded px-2.5 py-1.5 text-amber-950 flex items-start gap-2">
                                                            <Lightbulb size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
                                                            <div className="flex-1 whitespace-pre-wrap break-words leading-relaxed">
                                                                <span className="font-semibold text-amber-800 mr-1.5">次回プラン:</span>
                                                                {cleanText(report.次回プラン)}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* 上長コメント（データがある場合のみ表示: 折り返して全文表示） */}
                                                    {hasContent(report.上長コメント) && (
                                                        <div className="text-xs bg-blue-50/80 border border-blue-200 rounded px-3 py-2 text-blue-950 flex items-start gap-2">
                                                            <MessageSquare size={14} className="text-blue-600 flex-shrink-0 mt-0.5" />
                                                            <div className="flex-1 whitespace-pre-wrap break-words leading-relaxed">
                                                                <span className="font-semibold text-blue-800 mr-1.5">上長コメント:</span>
                                                                {cleanText(report.上長コメント)}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* コメント返信（データがある場合のみ表示: 折り返して全文表示） */}
                                                    {hasContent(report.コメント返信欄) && (
                                                        <div className="text-xs bg-emerald-50/80 border border-emerald-200 rounded px-3 py-2 text-emerald-950 flex items-start gap-2">
                                                            <div className="flex-1 whitespace-pre-wrap break-words leading-relaxed">
                                                                <span className="font-semibold text-emerald-800 mr-1.5">コメント返信:</span>
                                                                {cleanText(report.コメント返信欄)}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        }

                                        // -------------------------------------------------------------
                                        // 3. 詳細モード（Detailed: 従来のセクション分けを洗練）
                                        // -------------------------------------------------------------
                                        const isSelectedDetailed = selectedReportIds.has(Number(report.管理番号));
                                        return (
                                            <div
                                                key={originalIndex}
                                                onClick={() => handleRowClick(originalIndex)}
                                                className={`bg-white p-5 rounded-lg border transition-all cursor-pointer space-y-4 ${
                                                    isSelectedDetailed ? 'border-blue-400 bg-blue-50/20 shadow-xs' : 'border-sf-border hover:border-sf-light-blue hover:shadow-md'
                                                }`}
                                            >
                                                <div className="flex justify-between items-start border-b border-gray-100 pb-3">
                                                    <div className="flex items-center gap-3 flex-wrap">
                                                        <div 
                                                            className="flex items-center justify-center shrink-0 pt-0.5"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelectedDetailed}
                                                                onChange={(e) => handleToggleSelect(Number(report.管理番号), e)}
                                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4"
                                                                title="選択"
                                                            />
                                                        </div>
                                                        <span className={`px-2.5 py-1 rounded text-xs border font-medium ${getActionBadgeColor(report.行動内容)}`}>
                                                            {report.行動内容 || '訪問'}
                                                        </span>
                                                        <span className="text-lg font-bold text-sf-text hover:text-sf-light-blue">
                                                            {report.訪問先名}
                                                        </span>
                                                        {report.直送先名 && (
                                                            <span className="text-xs text-sf-text-weak bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
                                                                直送: {report.直送先名}
                                                            </span>
                                                        )}
                                                        <span className="text-xs text-sf-text-weak">
                                                            面談者: <span className="text-sf-text font-medium">{report.面談者 || '-'}</span>
                                                        </span>
                                                    </div>
                                                    <div className="flex-shrink-0">
                                                        {renderApprovalBadges(report)}
                                                    </div>
                                                </div>

                                                {/* デザイン情報 */}
                                                {hasDesignInfo(report) && (
                                                    <div className="bg-slate-50 p-3 rounded border border-slate-200 space-y-2">
                                                        <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5 border-b border-slate-200 pb-1">
                                                            <Palette size={14} className="text-slate-500" /> デザイン情報
                                                        </h4>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                                            {report.デザイン名 && <div><span className="text-slate-500">名称:</span> <span className="font-semibold text-slate-800">{report.デザイン名}</span></div>}
                                                            {report.デザイン進捗状況 && <div><span className="text-slate-500">進捗:</span> <span className="font-semibold text-slate-800">{report.デザイン進捗状況}</span></div>}
                                                            {(report['デザイン依頼No.'] || report['システム確認用デザインNo.']) && (
                                                                <div>
                                                                    <span className="text-slate-500">No:</span>{' '}
                                                                    {renderDesignNoWithImage(report['デザイン依頼No.'] || report['システム確認用デザインNo.'])}
                                                                </div>
                                                            )}
                                                            {report.デザイン種別 && <div><span className="text-slate-500">種別:</span> <span className="text-slate-700">{report.デザイン種別}</span></div>}
                                                            {report.デザイン提案有無 && <div><span className="text-slate-500">提案有無:</span> <span className="text-slate-700">{report.デザイン提案有無}</span></div>}
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <h4 className="text-xs font-semibold text-sf-text-weak mb-1">商談内容</h4>
                                                        <p className="text-sm text-sf-text whitespace-pre-wrap bg-gray-50 p-3 rounded border border-gray-100 min-h-[70px]">
                                                            {cleanText(report.商談内容) || <span className="text-gray-400 italic">（商談内容なし）</span>}
                                                        </p>
                                                    </div>
                                                    {hasContent(report.次回プラン) && (
                                                        <div>
                                                            <h4 className="text-xs font-semibold text-sf-text-weak mb-1">次回プラン</h4>
                                                            <p className="text-sm text-sf-text whitespace-pre-wrap bg-amber-50/50 p-3 rounded border border-amber-200/60 min-h-[70px]">
                                                                {cleanText(report.次回プラン)}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>

                                                {(hasContent(report.上長コメント) || hasContent(report.コメント返信欄)) && (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                                                        {hasContent(report.上長コメント) && (
                                                            <div>
                                                                <h4 className="text-xs font-semibold text-blue-800 mb-1 flex items-center gap-1">
                                                                    <MessageSquare size={12} /> 上長コメント
                                                                </h4>
                                                                <p className="text-sm text-sf-text whitespace-pre-wrap bg-blue-50 p-3 rounded border border-blue-100">
                                                                    {cleanText(report.上長コメント)}
                                                                </p>
                                                            </div>
                                                        )}
                                                        {hasContent(report.コメント返信欄) && (
                                                            <div>
                                                                <h4 className="text-xs font-semibold text-emerald-800 mb-1">コメント返信欄</h4>
                                                                <p className="text-sm text-sf-text whitespace-pre-wrap bg-emerald-50 p-3 rounded border border-emerald-100">
                                                                    {cleanText(report.コメント返信欄)}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* フッター + ページネーション */}
            <div className="p-2.5 bg-white border border-sf-border rounded text-xs text-sf-text-weak flex flex-wrap justify-between items-center gap-2">
                <span>{reports.length} 件 • {selectedFile}</span>
                {totalPages > 1 && (
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => setCurrentPage(1)}
                            disabled={currentPage === 1}
                            className="px-2 py-1 rounded border border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100"
                            title="最初へ"
                        >
                            ««
                        </button>
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="px-2 py-1 rounded border border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100"
                            title="前へ"
                        >
                            «
                        </button>
                        <span className="px-2 text-xs font-medium text-sf-text">
                            {currentPage} / {totalPages}
                        </span>
                        <button
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            className="px-2 py-1 rounded border border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100"
                            title="次へ"
                        >
                            »
                        </button>
                        <button
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={currentPage === totalPages}
                            className="px-2 py-1 rounded border border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100"
                            title="最後へ"
                        >
                            »»
                        </button>
                    </div>
                )}
                <span>並び順: {sortOrder === 'desc' ? '新しい順' : '古い順'}</span>
            </div>

            {/* 一括承認フローティングバー */}
            {selectedReportIds.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 text-white px-4 py-2.5 sm:px-5 sm:py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 backdrop-blur-md animate-in slide-in-from-bottom-4 duration-200 flex-wrap justify-center">
                    <span className="text-xs sm:text-sm font-bold text-slate-200 flex items-center gap-1.5 whitespace-nowrap">
                        <CheckSquare size={16} className="text-blue-400" />
                        <span>{selectedReportIds.size} 件選択中</span>
                    </span>
                    <div className="h-4 w-px bg-slate-700 hidden sm:block" />

                    {/* 承認者選択プルダウン */}
                    <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-600 rounded-xl px-2.5 py-1 text-xs">
                        <UserCheck size={13} className="text-blue-400 flex-shrink-0" />
                        <span className="text-slate-400 text-[11px] font-medium whitespace-nowrap">承認者:</span>
                        <select
                            value={selectedApproverRole}
                            onChange={(e) => handleApproverRoleChange(e.target.value as ApproverRole)}
                            className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer pr-1"
                            title="一括承認を行う役職を選択"
                        >
                            {APPROVER_ROLES.map(role => (
                                <option key={role} value={role} className="bg-slate-900 text-white">
                                    {role}
                                </option>
                            ))}
                        </select>
                    </div>

                    <button
                        type="button"
                        onClick={() => handleBatchApprove(selectedApproverRole)}
                        disabled={isBatchApproving}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs shadow-sm transition cursor-pointer disabled:opacity-50 whitespace-nowrap"
                        title={`選択したすべての日報を「${selectedApproverRole}」として承認`}
                    >
                        {isBatchApproving ? (
                            <Loader2 size={13} className="animate-spin" />
                        ) : (
                            <Check size={13} className="stroke-[2.5]" />
                        )}
                        <span>{selectedApproverRole}として一括承認</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setSelectedReportIds(new Set())}
                        className="text-xs text-slate-400 hover:text-white px-2 py-1 transition cursor-pointer whitespace-nowrap"
                        title="選択を解除"
                    >
                        解除
                    </button>
                </div>
            )}

            {/* 新規日報作成モーダル */}
            {showNewReportModal && (
                <NewReportModal
                    onClose={() => {
                        setShowNewReportModal(false);
                        setDuplicateReport(null);
                    }}
                    onSuccess={() => {
                        setShowNewReportModal(false);
                        setDuplicateReport(null);
                        handleRefresh();
                    }}
                    selectedFile={selectedFile}
                    initialReportData={duplicateReport || undefined}
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
                        setSelectedReportIndex(null);
                        setShowEditReportModal(true);
                    }}
                    onUpdate={handleRefresh}
                    onDuplicate={(rep) => {
                        setSelectedReportIndex(null);
                        setDuplicateReport(rep);
                        setShowNewReportModal(true);
                    }}
                    allReports={reports}
                />
            )}

            {/* デザイン画像プレビューモーダル */}
            {showImageModal && (
                <DesignImagePreviewModal
                    isOpen={showImageModal}
                    onClose={() => setShowImageModal(false)}
                    images={imageResults}
                    targetDesignNo={currentSearchDesignNo}
                />
            )}
        </div>
    );
}
