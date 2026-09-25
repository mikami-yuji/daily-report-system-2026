'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Report, batchUpdateReportApproval, updateReportApproval, DesignImage } from '@/lib/api';
import { useFile } from '@/context/FileContext';
import { useOffline } from '@/context/OfflineContext';
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
    CheckCheck,
    MessageSquare, 
    Lightbulb, 
    Palette,
    Layers,
    AlignJustify,
    Loader2,
    CheckSquare,
    UserCheck,
    Search,
    X,
    AlertCircle,
    Star,
    Zap,
    RotateCcw,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import toast from 'react-hot-toast';
import NewReportModal from '@/components/reports/NewReportModal';
import EditReportModal from '@/components/reports/EditReportModal';
import ReportDetailModal from '@/components/reports/ReportDetailModal';
import DesignImagePreviewModal from '@/components/reports/DesignImagePreviewModal';
import DesignImageHoverButton, { prefetchDesignImagePresence } from '@/components/reports/DesignImageHoverButton';
import { cleanText, compareDates, isKidokuChecked, deduplicateReports } from '@/lib/reportUtils';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/hooks/useQueryHooks';

// 承認者役職定数
const APPROVER_ROLES = ['上長', '山澄常務', '岡本常務', '中野次長'] as const;
type ApproverRole = typeof APPROVER_ROLES[number];

// 表記ゆれ吸収（NFKC正規化、大文字小文字無視、ひらがな->カタカナ統一）
const normalizeSearchText = (text: string | number | undefined | null): string => {
    if (text === undefined || text === null) return '';
    let normalized = String(text).normalize('NFKC').toLowerCase();
    // ひらがなをカタカナに変換して比較
    normalized = normalized.replace(/[\u3041-\u3096]/g, (ch) =>
        String.fromCharCode(ch.charCodeAt(0) + 0x60)
    );
    return normalized;
};

// クレーム・要注意検知キーワード
const ATTENTION_KEYWORDS = ['クレーム', '不具合', '至急', 'トラブル', '事故', '返品', '誤納', '破損', 'ミス', 'NG', '緊急'];
const NORMALIZED_ATTENTION_KEYWORDS = ATTENTION_KEYWORDS.map(normalizeSearchText);

export default function ReportsPage(): React.JSX.Element {
    const router = useRouter();
    const { selectedFile } = useFile();
    const { offlineReports } = useOffline();
    const queryClient = useQueryClient();

    // React Queryでデータ取得（自動キャッシュ）
    const { data: rawReports = [], isLoading, error } = useReports(selectedFile || undefined);

    const [selectedReportIndex, setSelectedReportIndex] = useState<number | null>(null);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [viewMode, setViewMode] = useState<'table' | 'timeline'>('timeline');
    // タイムラインの表示密度（高密度・標準・詳細）
    const [density, setDensity] = useState<'compact' | 'normal' | 'detailed'>('normal');

    const [selectedApproverRole, setSelectedApproverRole] = useState<ApproverRole>('上長');

    // 一括選択・承認ステート
    const [selectedReportIds, setSelectedReportIds] = useState<Set<number>>(new Set());
    const [isBatchApproving, setIsBatchApproving] = useState(false);
    const [approvingSingleId, setApprovingSingleId] = useState<number | null>(null);

    // 複製作成用ステート
    const [duplicateReport, setDuplicateReport] = useState<Report | null>(null);

    // デザイン画像モーダル用ステート
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

    // 検索・クイックフィルター用ステート
    const [searchKeyword, setSearchKeyword] = useState<string>('');
    const [searchAllPeriods, setSearchAllPeriods] = useState<boolean>(true); // 検索入力時は全期間から探す
    const [filterUnapproved, setFilterUnapproved] = useState<boolean>(false); // 未承認のみ（選択中役職）
    const [filterPriority, setFilterPriority] = useState<boolean>(false); // 重点顧客のみ
    const [filterDesign, setFilterDesign] = useState<boolean>(false); // デザイン案件のみ
    const [filterAttention, setFilterAttention] = useState<boolean>(false); // クレーム・要注意
    const [filterComment, setFilterComment] = useState<boolean>(false); // コメントあり
    const [isSearchExpanded, setIsSearchExpanded] = useState<boolean>(true); // 検索バーの展開・折りたたみ（本文エリア最大化用）

    const hasActiveFilters = Boolean(
        searchKeyword.trim() ||
        filterUnapproved ||
        filterPriority ||
        filterDesign ||
        filterAttention ||
        filterComment
    );

    const handleClearAllFilters = () => {
        setSearchKeyword('');
        setFilterUnapproved(false);
        setFilterPriority(false);
        setFilterDesign(false);
        setFilterAttention(false);
        setFilterComment(false);
        setCurrentPage(1);
    };

    // 検索・フィルター条件変更時にページを先頭に戻す
    useEffect(() => {
        setCurrentPage(1);
    }, [searchKeyword, searchAllPeriods, filterUnapproved, filterPriority, filterDesign, filterAttention, filterComment]);

    // エラー時のtoast表示
    useEffect(() => {
        if (error) {
            toast.error('日報データの読み込みに失敗しました');
        }
    }, [error]);

    // レポートのソートと有効データフィルタリング（useMemoでキャッシュ）
    const reports = useMemo(() => {
        // ブラウザローカル未送信データがあれば合成
        const browserPendingReports: Report[] = (offlineReports || [])
            .filter(r => !selectedFile || r.filename === selectedFile)
            .filter(r => r.status === 'pending' || r.status === 'error')
            .map((r, idx) => ({
                管理番号: -(900000 + idx),
                日付: (r.data as Report).日付 || '',
                得意先CD: (r.data as Report).得意先CD || '',
                訪問先名: (r.data as Report).訪問先名 || '',
                直送先CD: (r.data as Report).直送先CD || '',
                直送先名: (r.data as Report).直送先名 || '',
                行動内容: (r.data as Report).行動内容 || '',
                面談者: (r.data as Report).面談者 || '',
                滞在時間: (r.data as Report).滞在時間 || '',
                商談内容: (r.data as Report).商談内容 || '',
                提案物: (r.data as Report).提案物 || '',
                次回プラン: (r.data as Report).次回プラン || '',
                競合他社情報: (r.data as Report).競合他社情報 || '',
                エリア: (r.data as Report).エリア || '',
                ランク: (r.data as Report).ランク || '',
                重点顧客: (r.data as Report).重点顧客 || '',
                デザイン提案有無: (r.data as Report).デザイン提案有無 || '',
                デザイン種別: (r.data as Report).デザイン種別 || '',
                デザイン名: (r.data as Report).デザイン名 || '',
                デザイン進捗状況: (r.data as Report).デザイン進捗状況 || '',
                'デザイン依頼No.': (r.data as Report)['デザイン依頼No.'] || '',
                'システム確認用デザインNo.': (r.data as Report)['システム確認用デザインNo.'] || '',
                上長コメント: '',
                コメント返信欄: '',
                上長: '',
                山澄常務: '',
                岡本常務: '',
                中野次長: '',
                既読チェック: '',
                得意先目標: '',
                _is_pending_sync: true
            }));

        // 未送信データと原本データをマージし、同一管理番号の重複を完全排除
        const combined = deduplicateReports([...browserPendingReports, ...rawReports]);
        const validData = combined.filter(report => report.日付 && report.日付.trim() !== '');
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
    }, [rawReports, offlineReports, selectedFile, sortOrder]);

    // 月別フィルタ用ステート
    const [selectedMonth, setSelectedMonth] = useState<string>('all');

    // ファイル変更時に選択月を'all'にリセット
    useEffect(() => {
        setSelectedMonth('all');
        setCurrentPage(1);
    }, [selectedFile]);

    // 日報データ取得時に含まれるデザインNoの画像有無を一括プリフェッチ
    useEffect(() => {
        if (!reports || reports.length === 0) return;
        const nos = reports
            .map(r => r['デザイン依頼No.'] || r['システム確認用デザインNo.'])
            .filter(Boolean) as string[];
        if (nos.length > 0) {
            prefetchDesignImagePresence(nos, selectedFile || undefined);
        }
    }, [reports, selectedFile]);

    // 年月（YYYY/MM）抽出ヘルパー
    const getYearMonth = (dateStr?: string): string => {
        if (!dateStr) return '';
        const parts = dateStr.includes('/') ? dateStr.split('/') : dateStr.split('-');
        if (parts.length >= 2) {
            let yearPart = parseInt(parts[0], 10);
            if (!isNaN(yearPart)) {
                if (yearPart < 100) yearPart += 2000;
                const m = parseInt(parts[1], 10);
                if (!isNaN(m)) {
                    return `${yearPart}/${String(m).padStart(2, '0')}`;
                }
            }
        }
        return '';
    };

    // 月別集計（年月降順）
    const monthOptions = useMemo(() => {
        const counts: { [key: string]: number } = {};
        for (const r of reports) {
            const ym = getYearMonth(r.日付);
            if (ym) {
                counts[ym] = (counts[ym] || 0) + 1;
            }
        }
        const sortedMonths = Object.keys(counts).sort((a, b) => b.localeCompare(a));
        return sortedMonths.map(ym => {
            const [y, m] = ym.split('/');
            return {
                key: ym,
                label: `${y}年${parseInt(m, 10)}月`,
                shortLabel: `${parseInt(m, 10)}月`,
                count: counts[ym]
            };
        });
    }, [reports]);

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

    // 現在の対象範囲での各クイックフィルター件数（リアルタイムバッジ用）
    const quickFilterCounts = useMemo(() => {
        let baseReports = reports;
        const isPeriodOverridden = Boolean(searchKeyword.trim() && searchAllPeriods);
        if (!isPeriodOverridden && selectedMonth !== 'all') {
            baseReports = baseReports.filter(r => getYearMonth(r.日付) === selectedMonth);
        }

        let unapproved = 0;
        let priority = 0;
        let design = 0;
        let attention = 0;
        let comment = 0;

        baseReports.forEach(r => {
            if (!r[selectedApproverRole]) unapproved++;
            const p = String(r.重点顧客 || '').trim();
            if (p !== '' && p !== '-' && p !== '無' && p !== 'なし') priority++;
            if (hasDesignInfo(r)) design++;
            const combined = normalizeSearchText(
                `${r.商談内容 || ''} ${r.行動内容 || ''} ${r.次回プラン || ''} ${r.提案物 || ''} ${r.上長コメント || ''}`
            );
            if (NORMALIZED_ATTENTION_KEYWORDS.some(kw => combined.includes(kw))) attention++;
            if (hasContent(r.上長コメント) || hasContent(r.コメント返信欄)) comment++;
        });

        return { unapproved, priority, design, attention, comment };
    }, [reports, selectedMonth, selectedApproverRole, searchKeyword, searchAllPeriods]);

    // フィルタ適用後のレポート一覧
    const filteredReports = useMemo(() => {
        let result = reports;

        // 1. 月別フィルタ（検索キーワード入力時かつ全期間検索ONならスキップ）
        const isPeriodOverridden = Boolean(searchKeyword.trim() && searchAllPeriods);
        if (!isPeriodOverridden && selectedMonth !== 'all') {
            result = result.filter(r => getYearMonth(r.日付) === selectedMonth);
        }

        // 2. クイックフィルター: 未承認のみ（現在選択中の承認者役職）
        if (filterUnapproved) {
            result = result.filter(r => !r[selectedApproverRole]);
        }

        // 3. クイックフィルター: 重点顧客のみ
        if (filterPriority) {
            result = result.filter(r => {
                const p = String(r.重点顧客 || '').trim();
                return p !== '' && p !== '-' && p !== '無' && p !== 'なし';
            });
        }

        // 4. クイックフィルター: デザイン案件のみ
        if (filterDesign) {
            result = result.filter(r => hasDesignInfo(r));
        }

        // 5. クイックフィルター: クレーム・要注意
        if (filterAttention) {
            result = result.filter(r => {
                const combined = normalizeSearchText(
                    `${r.商談内容 || ''} ${r.行動内容 || ''} ${r.次回プラン || ''} ${r.提案物 || ''} ${r.上長コメント || ''}`
                );
                return NORMALIZED_ATTENTION_KEYWORDS.some(kw => combined.includes(kw));
            });
        }

        // 6. クイックフィルター: コメントあり
        if (filterComment) {
            result = result.filter(r => hasContent(r.上長コメント) || hasContent(r.コメント返信欄));
        }

        // 7. 全文キーワードAND検索（スペース区切り・表記ゆれ吸収）
        if (searchKeyword.trim()) {
            const terms = searchKeyword
                .trim()
                .split(/\s+/)
                .filter(Boolean)
                .map(normalizeSearchText);

            result = result.filter(r => {
                const targetValues = [
                    r.日付,
                    r.得意先CD,
                    r.訪問先名,
                    r.直送先CD,
                    r.直送先名,
                    r.行動内容,
                    r.面談者,
                    r.滞在時間,
                    r.商談内容,
                    r.提案物,
                    r.次回プラン,
                    r.競合他社情報,
                    r.エリア,
                    r.ランク,
                    r.デザイン名,
                    r['デザイン依頼No.'],
                    r['システム確認用デザインNo.'],
                    r.デザイン進捗状況,
                    r.デザイン種別,
                    r.上長コメント,
                    r.コメント返信欄
                ].map(normalizeSearchText);

                return terms.every(term =>
                    targetValues.some(val => val.includes(term))
                );
            });
        }

        return result;
    }, [
        reports,
        selectedMonth,
        searchKeyword,
        searchAllPeriods,
        filterUnapproved,
        filterPriority,
        filterDesign,
        filterAttention,
        filterComment,
        selectedApproverRole
    ]);

    const totalPages = Math.ceil(filteredReports.length / itemsPerPage);
    const paginatedReports = filteredReports.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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
        if (selectedReportIndex !== null && selectedReportIndex < filteredReports.length - 1) {
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
        <div className="flex-1 min-h-0 flex flex-col gap-2 animate-fadeIn">
            {/* 上部コントロールバー */}
            <div className="flex flex-wrap justify-between items-center bg-white px-3.5 py-2 rounded border border-sf-border shadow-2xs gap-2 shrink-0">
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                        <div className="bg-sf-light-blue p-1.5 rounded text-white shadow-xs">
                            <FileText size={18} />
                        </div>
                        <div>
                            <h1 className="text-base font-bold text-sf-text leading-tight">営業日報</h1>
                        </div>
                    </div>

                    {/* 月別セレクター（ドロップダウン） */}
                    {reports.length > 0 && monthOptions.length > 0 && (
                        <div className="flex items-center gap-1.5 bg-blue-50/70 border border-blue-200/80 rounded px-2 py-0.5 text-xs shadow-2xs">
                            <Calendar size={13} className="text-sf-light-blue shrink-0" />
                            <span className="text-sf-text-weak text-[11px] font-medium whitespace-nowrap">対象月:</span>
                            <select
                                value={selectedMonth}
                                onChange={(e) => {
                                    setSelectedMonth(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="bg-transparent text-sf-text font-bold text-xs focus:outline-none cursor-pointer pr-1 hover:text-blue-700 transition-colors"
                                title="表示する日報の対象月を選択"
                            >
                                <option value="all">全期間 ({reports.length}件)</option>
                                {monthOptions.map((m) => (
                                    <option key={m.key} value={m.key}>
                                        {m.label} ({m.count}件)
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap gap-1.5 items-center">
                    {/* 検索バー開閉トグルボタン（本文スペース最大化） */}
                    <button
                        type="button"
                        onClick={() => setIsSearchExpanded(!isSearchExpanded)}
                        className={`px-2.5 py-1 rounded border text-xs font-medium transition-colors flex items-center gap-1 ${
                            isSearchExpanded 
                                ? 'bg-gray-50 hover:bg-gray-100 border-sf-border text-gray-600' 
                                : 'bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700 font-bold'
                        }`}
                        title={isSearchExpanded ? "検索バーをたたんで本文表示スペースを広げる" : "検索・フィルターを展開"}
                    >
                        <Search size={13} className={isSearchExpanded ? "text-gray-500" : "text-blue-600"} />
                        <span>{isSearchExpanded ? "検索をたたむ" : "検索を開く"}</span>
                        {isSearchExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        {!isSearchExpanded && hasActiveFilters && (
                            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse ml-0.5" title="条件適用中" />
                        )}
                    </button>

                    {/* ビュー切替（テーブル / タイムライン） */}
                    <div className="flex bg-gray-100 p-0.5 rounded border border-sf-border">
                        <button
                            onClick={() => handleViewModeChange('timeline')}
                            className={`px-2 py-1 rounded transition-all flex items-center gap-1 text-xs ${viewMode === 'timeline' ? 'bg-white shadow-xs text-sf-light-blue font-semibold' : 'text-gray-500 hover:text-gray-800'}`}
                            title="タイムライン表示（日別カード形式）"
                        >
                            <LayoutList size={14} />
                            <span className="hidden sm:inline">タイムライン</span>
                        </button>
                        <button
                            onClick={() => handleViewModeChange('table')}
                            className={`px-2 py-1 rounded transition-all flex items-center gap-1 text-xs ${viewMode === 'table' ? 'bg-white shadow-xs text-sf-light-blue font-semibold' : 'text-gray-500 hover:text-gray-800'}`}
                            title="テーブル表示（表形式）"
                        >
                            <Table size={14} />
                            <span className="hidden sm:inline">テーブル</span>
                        </button>
                    </div>

                    {/* タイムライン時のみ表示：密度切替（案D） */}
                    {viewMode === 'timeline' && (
                        <div className="flex items-center bg-gray-100 p-0.5 rounded border border-sf-border text-xs">
                            <button
                                onClick={() => handleDensityChange('compact')}
                                className={`px-2 py-0.5 rounded transition-all flex items-center gap-1 ${density === 'compact' ? 'bg-white shadow-xs font-semibold text-sf-light-blue' : 'text-gray-500 hover:text-gray-800'}`}
                                title="高密度表示（Excel同等のコンパクト行形式、1画面に多数表示）"
                            >
                                <AlignJustify size={13} />
                                <span>高密度</span>
                            </button>
                            <button
                                onClick={() => handleDensityChange('normal')}
                                className={`px-2 py-0.5 rounded transition-all flex items-center gap-1 ${density === 'normal' ? 'bg-white shadow-xs font-semibold text-sf-light-blue' : 'text-gray-500 hover:text-gray-800'}`}
                                title="標準表示（スマートカード・おすすめ）"
                            >
                                <Layers size={13} />
                                <span>標準</span>
                            </button>
                            <button
                                onClick={() => handleDensityChange('detailed')}
                                className={`px-2 py-0.5 rounded transition-all flex items-center gap-1 ${density === 'detailed' ? 'bg-white shadow-xs font-semibold text-sf-light-blue' : 'text-gray-500 hover:text-gray-800'}`}
                                title="詳細表示（余白広め）"
                            >
                                <span>詳細</span>
                            </button>
                        </div>
                    )}

                    <button
                        onClick={toggleSortOrder}
                        className="px-2 py-1 border border-sf-border rounded hover:bg-gray-50 text-sf-text-weak transition-colors flex items-center gap-1 text-xs font-medium"
                        title={sortOrder === 'asc' ? "古い順" : "新しい順"}
                    >
                        <Filter size={13} />
                        <span className="hidden md:inline">
                            {sortOrder === 'asc' ? '昇順' : '降順'}
                        </span>
                    </button>

                    <button
                        onClick={handleRefresh}
                        className="p-1.5 border border-sf-border rounded hover:bg-gray-50 text-sf-text-weak transition-colors"
                        title="再読み込み"
                        aria-label="再読み込み"
                    >
                        <RefreshCw size={14} />
                    </button>

                    {/* 操作・承認者役職セレクター */}
                    <div className="flex items-center gap-1.5 bg-gray-50 border border-sf-border rounded px-2 py-1 text-xs">
                        <UserCheck size={13} className="text-blue-600 flex-shrink-0" />
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
                        className="bg-sf-light-blue text-white px-3 py-1 rounded text-xs font-medium hover:bg-blue-700 shadow-xs flex items-center gap-1 transition-colors"
                    >
                        <Plus size={14} />
                        新規作成
                    </button>
                </div>
            </div>

            {/* 検索 ＆ クイックフィルターバー */}
            {isSearchExpanded ? (
                <div className="bg-white px-3.5 py-2 rounded border border-sf-border shadow-2xs space-y-1.5 shrink-0 animate-in fade-in duration-150">
                    {/* 1段目: 全文キーワード検索バー + 全期間検索トグル + 該当件数 + クリアボタン */}
                    <div className="flex flex-wrap items-center gap-2">
                        {/* 検索入力欄 */}
                        <div className="relative flex-1 min-w-[260px]">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                            <input
                                type="text"
                                placeholder="訪問先・商談・面談者・次回プラン・デザイン名等で検索（スペース区切りAND検索）..."
                                value={searchKeyword}
                                onChange={(e) => setSearchKeyword(e.target.value)}
                                className="w-full pl-8 pr-7 py-1 text-xs border border-sf-border rounded bg-gray-50/50 hover:bg-white focus:bg-white focus:outline-none focus:ring-1 focus:ring-sf-light-blue focus:border-sf-light-blue placeholder-gray-400 text-sf-text transition-colors"
                            />
                            {searchKeyword && (
                                <button
                                    type="button"
                                    onClick={() => setSearchKeyword('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded-full hover:bg-gray-100 cursor-pointer"
                                    title="検索キーワードをクリア"
                                >
                                    <X size={13} />
                                </button>
                            )}
                        </div>

                        {/* 全期間検索トグル（キーワード入力時用） */}
                        <label 
                            className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded border cursor-pointer select-none transition-colors ${
                                searchAllPeriods 
                                    ? 'bg-blue-50/90 border-blue-200 text-blue-800 font-medium' 
                                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                            }`}
                            title="チェックを入れると、選択中の対象月に関係なく全期間から横断検索します"
                        >
                            <input
                                type="checkbox"
                                checked={searchAllPeriods}
                                onChange={(e) => setSearchAllPeriods(e.target.checked)}
                                className="rounded border-gray-300 text-sf-light-blue focus:ring-sf-light-blue h-3.5 w-3.5 cursor-pointer"
                            />
                            <span>全期間から検索</span>
                        </label>

                        {/* 該当件数表示 */}
                        <div className="text-xs text-sf-text-weak whitespace-nowrap px-1 font-medium">
                            {hasActiveFilters ? (
                                <span>
                                    表示: <strong className="text-sf-light-blue font-bold text-xs">{filteredReports.length}</strong> / {reports.length} 件
                                </span>
                            ) : (
                                <span>
                                    表示: <strong className="text-sf-text font-bold text-xs">{filteredReports.length}</strong> 件
                                </span>
                            )}
                        </div>

                        {/* 条件クリアボタン */}
                        {hasActiveFilters && (
                            <button
                                type="button"
                                onClick={handleClearAllFilters}
                                className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/80 border border-rose-200 px-2 py-1 rounded transition-colors font-medium cursor-pointer"
                                title="検索キーワードとクイックフィルターをすべて解除"
                            >
                                <RotateCcw size={12} />
                                <span>条件クリア</span>
                            </button>
                        )}
                    </div>

                    {/* 2段目: 業務特化型クイックフィルターチップ */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-gray-100 text-xs">
                        <span className="text-[11px] font-bold text-gray-400 flex items-center gap-1 shrink-0 mr-0.5">
                            <Filter size={11} />
                            <span>クイック抽出:</span>
                        </span>

                        {/* ⚠️ 未承認のみ */}
                        <button
                            type="button"
                            onClick={() => setFilterUnapproved(!filterUnapproved)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium transition cursor-pointer shadow-2xs ${
                                filterUnapproved
                                    ? 'bg-amber-100 border-amber-400 text-amber-950 ring-1 ring-amber-400 font-bold'
                                    : 'bg-gray-50 hover:bg-amber-50/60 border-gray-200 text-gray-700 hover:border-amber-300'
                            }`}
                            title={`現在選択中の承認役職「${selectedApproverRole}」が未承認の日報のみを抽出`}
                        >
                            <AlertCircle size={11} className={filterUnapproved ? 'text-amber-700' : 'text-amber-500'} />
                            <span>未承認（{selectedApproverRole}）</span>
                            <span className={`text-[10px] px-1 rounded-full font-bold ${
                                filterUnapproved ? 'bg-amber-200 text-amber-950' : 'bg-gray-200 text-gray-600'
                            }`}>
                                {quickFilterCounts.unapproved}
                            </span>
                        </button>

                        {/* ★ 重点顧客のみ */}
                        <button
                            type="button"
                            onClick={() => setFilterPriority(!filterPriority)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium transition cursor-pointer shadow-2xs ${
                                filterPriority
                                    ? 'bg-yellow-100 border-yellow-400 text-yellow-950 ring-1 ring-yellow-400 font-bold'
                                    : 'bg-gray-50 hover:bg-yellow-50/60 border-gray-200 text-gray-700 hover:border-yellow-300'
                            }`}
                            title="重点顧客フラグがある日報のみを抽出"
                        >
                            <Star size={11} className={filterPriority ? 'text-yellow-700 fill-yellow-500' : 'text-yellow-500'} />
                            <span>重点顧客</span>
                            <span className={`text-[10px] px-1 rounded-full font-bold ${
                                filterPriority ? 'bg-yellow-200 text-yellow-950' : 'bg-gray-200 text-gray-600'
                            }`}>
                                {quickFilterCounts.priority}
                            </span>
                        </button>

                        {/* 🎨 デザインあり */}
                        <button
                            type="button"
                            onClick={() => setFilterDesign(!filterDesign)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium transition cursor-pointer shadow-2xs ${
                                filterDesign
                                    ? 'bg-indigo-100 border-indigo-400 text-indigo-950 ring-1 ring-indigo-400 font-bold'
                                    : 'bg-gray-50 hover:bg-indigo-50/60 border-gray-200 text-gray-700 hover:border-indigo-300'
                            }`}
                            title="デザイン提案・進捗・依頼情報が含まれる日報のみを抽出"
                        >
                            <Palette size={11} className={filterDesign ? 'text-indigo-700' : 'text-indigo-500'} />
                            <span>デザイン案件</span>
                            <span className={`text-[10px] px-1 rounded-full font-bold ${
                                filterDesign ? 'bg-indigo-200 text-indigo-950' : 'bg-gray-200 text-gray-600'
                            }`}>
                                {quickFilterCounts.design}
                            </span>
                        </button>

                        {/* ⚡ クレーム・要注意 */}
                        <button
                            type="button"
                            onClick={() => setFilterAttention(!filterAttention)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium transition cursor-pointer shadow-2xs ${
                                filterAttention
                                    ? 'bg-rose-100 border-rose-400 text-rose-950 ring-1 ring-rose-400 font-bold'
                                    : 'bg-gray-50 hover:bg-rose-50/60 border-gray-200 text-gray-700 hover:border-rose-300'
                            }`}
                            title="クレーム、トラブル、不具合、至急、事故等の文言が含まれる要注意日報を抽出"
                        >
                            <Zap size={11} className={filterAttention ? 'text-rose-700' : 'text-rose-500'} />
                            <span>クレーム・要注意</span>
                            <span className={`text-[10px] px-1 rounded-full font-bold ${
                                filterAttention ? 'bg-rose-200 text-rose-950' : 'bg-gray-200 text-gray-600'
                            }`}>
                                {quickFilterCounts.attention}
                            </span>
                        </button>

                        {/* 💬 コメントあり */}
                        <button
                            type="button"
                            onClick={() => setFilterComment(!filterComment)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium transition cursor-pointer shadow-2xs ${
                                filterComment
                                    ? 'bg-emerald-100 border-emerald-400 text-emerald-950 ring-1 ring-emerald-400 font-bold'
                                    : 'bg-gray-50 hover:bg-emerald-50/60 border-gray-200 text-gray-700 hover:border-emerald-300'
                            }`}
                            title="上長コメントまたはコメント返信が記載されている日報を抽出"
                        >
                            <MessageSquare size={11} className={filterComment ? 'text-emerald-700' : 'text-emerald-500'} />
                            <span>コメントあり</span>
                            <span className={`text-[10px] px-1 rounded-full font-bold ${
                                filterComment ? 'bg-emerald-200 text-emerald-950' : 'bg-gray-200 text-gray-600'
                            }`}>
                                {quickFilterCounts.comment}
                            </span>
                        </button>
                    </div>
                </div>
            ) : (
                /* 折りたたみ時の極小ステータスバー（本文スペース最大化） */
                <div className="bg-white px-3 py-1 rounded border border-sf-border shadow-2xs flex items-center justify-between gap-2 text-xs shrink-0 animate-in fade-in duration-150">
                    <div className="flex items-center gap-2 overflow-x-auto py-0.5">
                        <span className="text-[11px] font-bold text-gray-400 flex items-center gap-1 shrink-0">
                            <Search size={12} />
                            <span>検索:</span>
                        </span>
                        {searchKeyword ? (
                            <span className="bg-blue-50 text-blue-800 px-2 py-0.5 rounded border border-blue-200 font-medium text-[11px]">
                                &ldquo;{searchKeyword}&rdquo;
                            </span>
                        ) : (
                            <span className="text-gray-400 text-[11px]">全件対象</span>
                        )}
                        {filterUnapproved && (
                            <span className="bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded border border-amber-300 text-[10px] font-bold">
                                未承認
                            </span>
                        )}
                        {filterPriority && (
                            <span className="bg-yellow-100 text-yellow-900 px-1.5 py-0.5 rounded border border-yellow-300 text-[10px] font-bold">
                                ★重点
                            </span>
                        )}
                        {filterDesign && (
                            <span className="bg-indigo-100 text-indigo-900 px-1.5 py-0.5 rounded border border-indigo-300 text-[10px] font-bold">
                                🎨デザイン
                            </span>
                        )}
                        {filterAttention && (
                            <span className="bg-rose-100 text-rose-900 px-1.5 py-0.5 rounded border border-rose-300 text-[10px] font-bold">
                                ⚡要注意
                            </span>
                        )}
                        {filterComment && (
                            <span className="bg-emerald-100 text-emerald-900 px-1.5 py-0.5 rounded border border-emerald-300 text-[10px] font-bold">
                                💬コメント
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sf-text-weak text-xs">
                            表示: <strong className="text-sf-text font-bold">{filteredReports.length}</strong> 件
                        </span>
                        {hasActiveFilters && (
                            <button
                                type="button"
                                onClick={handleClearAllFilters}
                                className="text-rose-600 hover:text-rose-700 text-xs font-medium cursor-pointer"
                            >
                                クリア
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => setIsSearchExpanded(true)}
                            className="text-sf-light-blue hover:text-blue-700 font-medium text-xs flex items-center gap-0.5 cursor-pointer bg-blue-50 px-2 py-0.5 rounded border border-blue-200"
                        >
                            <span>展開</span>
                            <ChevronDown size={12} />
                        </button>
                    </div>
                </div>
            )}

            {/* メインコンテンツ領域 */}
            <div className="bg-white border border-sf-border shadow-2xs flex-1 min-h-0 overflow-auto rounded">
                {isLoading ? (
                    <div className="p-10 text-center text-sf-text-weak flex flex-col items-center gap-2">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sf-light-blue"></div>
                        <span>日報を読み込み中...</span>
                    </div>
                ) : filteredReports.length === 0 ? (
                    <div className="p-10 text-center text-sf-text-weak space-y-2">
                        <p className="text-base font-semibold text-gray-700">該当する営業日報が見つかりませんでした</p>
                        {hasActiveFilters ? (
                            <div className="space-y-2">
                                <p className="text-xs text-gray-500">検索キーワードやクイックフィルターを変更するか、条件をリセットしてください。</p>
                                <button
                                    type="button"
                                    onClick={handleClearAllFilters}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded text-xs font-medium transition cursor-pointer"
                                >
                                    <RotateCcw size={13} />
                                    <span>条件をリセットして全件表示</span>
                                </button>
                            </div>
                        ) : (
                            <p className="text-xs text-gray-500">
                                {selectedMonth === 'all' ? '日報データが登録されていません' : `${selectedMonth.replace('/', '年')}月の日報データはありません`}
                            </p>
                        )}
                    </div>
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
                                            <td className="py-2.5 px-3 text-sf-text-weak font-mono align-top">
                                                {Number(report.管理番号) < 0 ? (
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                                                        ☁️ 未同期
                                                    </span>
                                                ) : (
                                                    <>
                                                        {report.管理番号}
                                                        {report._is_pending_sync && (
                                                            <span className="block text-[10px] text-amber-700 font-sans font-semibold">☁️未同期</span>
                                                        )}
                                                    </>
                                                )}
                                            </td>
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
                                                {hasContent(report.上長コメント) && (() => {
                                                    const isKidoku = isKidokuChecked(report.既読チェック);
                                                    return (
                                                        <div className={`text-[11px] whitespace-pre-wrap break-words leading-relaxed mt-1 flex items-start gap-1 p-1.5 rounded border ${
                                                            isKidoku 
                                                                ? 'bg-blue-50/70 border-blue-200/90 border-l-3 border-l-emerald-500 text-blue-950' 
                                                                : 'bg-blue-50/80 border-blue-200/80 text-blue-900'
                                                        }`}>
                                                            <MessageSquare size={12} className="text-blue-600 flex-shrink-0 mt-0.5" />
                                                            <div className="flex-1">
                                                                <div className="flex items-center justify-between gap-1 mb-0.5 flex-wrap">
                                                                    <span className="font-semibold text-blue-800">上長コメント:</span>
                                                                    {isKidoku && (
                                                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 text-[10px] font-bold text-emerald-800 bg-emerald-100/90 border border-emerald-300 rounded shadow-2xs">
                                                                            <CheckCheck size={11} className="stroke-[2.5] text-emerald-600" />
                                                                            既読チェック済
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {cleanText(report.上長コメント)}
                                                            </div>
                                                        </div>
                                                    );
                                                })()}

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
                    <div className="p-3 sm:p-3.5 space-y-3.5 bg-gray-50/50 min-h-full">
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
                                                            {report._is_pending_sync && (
                                                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                                                    ☁️ 未同期
                                                                </span>
                                                            )}
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
                                                    {hasContent(report.上長コメント) && (() => {
                                                        const isKidoku = isKidokuChecked(report.既読チェック);
                                                        return (
                                                            <div className={`text-[11px] border rounded px-2 py-1 text-blue-950 flex items-start gap-1.5 ${
                                                                isKidoku
                                                                    ? 'bg-blue-50/70 border-blue-200/90 border-l-3 border-l-emerald-500'
                                                                    : 'bg-blue-50/80 border-blue-200/80'
                                                            }`}>
                                                                <MessageSquare size={12} className="text-blue-600 flex-shrink-0 mt-0.5" />
                                                                <div className="flex-1 whitespace-pre-wrap break-words leading-relaxed">
                                                                    <div className="flex items-center justify-between gap-1.5 mb-0.5 flex-wrap">
                                                                        <span className="font-semibold text-blue-800">上長コメント:</span>
                                                                        {isKidoku && (
                                                                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 text-[10px] font-bold text-emerald-800 bg-emerald-100/90 border border-emerald-300 rounded shadow-2xs">
                                                                                <CheckCheck size={11} className="stroke-[2.5] text-emerald-600" />
                                                                                既読チェック済
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    {cleanText(report.上長コメント)}
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}

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
                                                            {report._is_pending_sync && (
                                                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                                                    ☁️ 一時退避中（未同期）
                                                                </span>
                                                            )}
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
                                                    {hasContent(report.上長コメント) && (() => {
                                                        const isKidoku = isKidokuChecked(report.既読チェック);
                                                        return (
                                                            <div className={`text-xs border rounded px-3 py-2 text-blue-950 flex items-start gap-2 ${
                                                                isKidoku
                                                                    ? 'bg-blue-50/70 border-blue-200/90 border-l-4 border-l-emerald-500'
                                                                    : 'bg-blue-50/80 border-blue-200'
                                                            }`}>
                                                                <MessageSquare size={14} className="text-blue-600 flex-shrink-0 mt-0.5" />
                                                                <div className="flex-1 whitespace-pre-wrap break-words leading-relaxed">
                                                                    <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                                                                        <span className="font-semibold text-blue-800">上長コメント:</span>
                                                                        {isKidoku && (
                                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold text-emerald-800 bg-emerald-100/90 border border-emerald-300 rounded-full shadow-2xs">
                                                                                <CheckCheck size={12} className="stroke-[2.5] text-emerald-600" />
                                                                                既読チェック済
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    {cleanText(report.上長コメント)}
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}

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
                                                        {report._is_pending_sync && (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                                                ☁️ 一時退避中（未同期）
                                                            </span>
                                                        )}
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
                                                        {hasContent(report.上長コメント) && (() => {
                                                            const isKidoku = isKidokuChecked(report.既読チェック);
                                                            return (
                                                                <div>
                                                                    <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                                                                        <h4 className="text-xs font-semibold text-blue-800 flex items-center gap-1">
                                                                            <MessageSquare size={12} /> 上長コメント
                                                                        </h4>
                                                                        {isKidoku && (
                                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold text-emerald-800 bg-emerald-100/90 border border-emerald-300 rounded-full shadow-2xs">
                                                                                <CheckCheck size={12} className="stroke-[2.5] text-emerald-600" />
                                                                                既読チェック済
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <p className={`text-sm text-sf-text whitespace-pre-wrap p-3 rounded border ${
                                                                        isKidoku
                                                                            ? 'bg-blue-50/70 border-blue-200 border-l-4 border-l-emerald-500'
                                                                            : 'bg-blue-50 border-blue-100'
                                                                    }`}>
                                                                        {cleanText(report.上長コメント)}
                                                                    </p>
                                                                </div>
                                                            );
                                                        })()}
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
            <div className="px-3 py-1.5 bg-white border border-sf-border rounded text-xs text-sf-text-weak flex flex-wrap justify-between items-center gap-2 shrink-0">
                <span>
                    {selectedMonth === 'all'
                        ? `${filteredReports.length} 件 • ${selectedFile}`
                        : `${filteredReports.length} 件（全 ${reports.length} 件中） • ${selectedFile}`}
                </span>
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
                    report={filteredReports[selectedReportIndex]}
                    onClose={() => setSelectedReportIndex(null)}
                    onNext={handleNextReport}
                    onPrev={handlePrevReport}
                    hasNext={selectedReportIndex > 0}
                    hasPrev={selectedReportIndex < filteredReports.length - 1}
                    onEdit={() => {
                        setEditingReport(filteredReports[selectedReportIndex]);
                        setSelectedReportIndex(null);
                        setShowEditReportModal(true);
                    }}
                    onUpdate={handleRefresh}
                    onDuplicate={(rep) => {
                        setSelectedReportIndex(null);
                        setDuplicateReport(rep);
                        setShowNewReportModal(true);
                    }}
                    allReports={filteredReports}
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
