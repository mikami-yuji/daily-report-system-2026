'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useFile } from '@/context/FileContext';
import { useReports, useViewerDesignRequests, useCustomers } from '@/hooks/useQueryHooks';
import { Report, searchDesignImages, DesignImage } from '@/lib/api';
import { Search, Calendar, User, FileText, ChevronDown, ChevronUp, Package, Layers, TrendingUp, Filter, Image as ImageIcon, PenSquare, Truck, ArrowUpDown, ArrowUp, ArrowDown, X, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import NewReportModal, { InitialDesignData } from '@/components/reports/NewReportModal';
import DesignImagePreviewModal from '@/components/reports/DesignImagePreviewModal';
import PdfPreviewModal, { PdfItem } from '@/components/reports/PdfPreviewModal';
import DesignImageHoverButton, { prefetchDesignImagePresence, imagePresenceCache } from '@/components/reports/DesignImageHoverButton';
import { ViewerDesignRequest, Customer } from '@/types/report';
import { isSalesPersonMatch, extractCleanCustomerName, deduplicateReports } from '@/lib/reportUtils';

type DesignRequest = {
    designNo: string;
    customerCode: string;
    customerName: string;
    deliveryCode?: string;
    deliveryName?: string;
    deliverySource?: 'report' | 'viewer';
    designProposal: string;
    designType: string;
    designName: string;
    designProgress: string;
    requests: Report[];
};

export default function DesignSearchPage() {
    const { selectedFile } = useFile();

    // React Queryでデータ取得（自動キャッシュ、重複を完全排除）
    const { data: rawReports = [], isLoading, error } = useReports(selectedFile || undefined);
    const reports = useMemo(() => deduplicateReports(rawReports), [rawReports]);

    // 企画課ビューワーからデザインデータ取得
    const { data: viewerData } = useViewerDesignRequests();

    // 得意先マスタ取得（正規の得意先名照合用）
    const { data: customerMaster = [] } = useCustomers(selectedFile || undefined);

    // 得意先コード -> 正規の得意先名のマッピング
    const customerCodeMap = useMemo(() => {
        const map = new Map<string, string>();
        customerMaster.forEach((c: Customer) => {
            if (c.得意先CD && c.得意先名) {
                map.set(String(c.得意先CD).trim(), String(c.得意先名).trim());
            }
        });
        return map;
    }, [customerMaster]);

    // PDFプレビュー用ステート (全版対応)
    const [isPdfModalOpen, setIsPdfModalOpen] = useState<boolean>(false);
    const [previewPdfItems, setPreviewPdfItems] = useState<PdfItem[]>([]);
    const [previewPdfTitle, setPreviewPdfTitle] = useState<string>('');
    const [previewPdfInitialIndex, setPreviewPdfInitialIndex] = useState<number>(0);

    // 自分の営業案件のビューワーデータマップを作成 (キー: 短縮されたrequestId, 値: 全件配列)
    const viewerMap = useMemo((): Map<string, ViewerDesignRequest[]> => {
        const map = new Map<string, ViewerDesignRequest[]>();
        if (!viewerData || !viewerData.documents || !selectedFile) return map;

        viewerData.documents.forEach((doc: ViewerDesignRequest): void => {
            if (!doc.salesPerson) return;
            
            if (isSalesPersonMatch(doc.salesPerson, selectedFile)) {
                // requestIdは "120451-01" 等。ハイフン前を取り出す
                const shortId = doc.requestId.split('-')[0].trim();
                if (!map.has(shortId)) {
                    map.set(shortId, []);
                }
                map.get(shortId)!.push(doc);
            }
        });

        // 各デザイン番号の依頼書を最新順（枝番の降順または日付の降順）にソート
        map.forEach((docs) => {
            docs.sort((a, b) => {
                const dateA = a.requestDate || a.requestedAt || '';
                const dateB = b.requestDate || b.requestedAt || '';
                const dateCmp = dateB.localeCompare(dateA);
                if (dateCmp !== 0) return dateCmp;
                return b.requestId.localeCompare(a.requestId, undefined, { numeric: true });
            });
        });

        return map;
    }, [viewerData, selectedFile]);

type StatusTab = 'all' | 'in_progress' | 'completed' | 'pending_rejected';
type SortKey = 'designNo' | 'customerCode' | 'customerName' | 'deliveryName' | 'designName' | 'designType' | 'designProgress' | 'requestsCount' | 'lastActivityDate';
type SortOrder = 'asc' | 'desc';

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

const isCompleted = (status: string) => status === '出稿';
const isPendingOrRejected = (status: string) =>
    ['保留', '不採用（コンペ負け）', '不採用（企画倒れ）'].includes(status);
const isInProgress = (status: string) => !isCompleted(status) && !isPendingOrRejected(status);

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState<string[]>([]);
    const [selectedType, setSelectedType] = useState<string[]>([]);
    const [selectedProgress, setSelectedProgress] = useState<string[]>([]);
    const [filteredRequests, setFilteredRequests] = useState<DesignRequest[]>([]);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [showCustomerFilter, setShowCustomerFilter] = useState(false); // 得意先フィルターの表示状態
    const [showTypeFilter, setShowTypeFilter] = useState(false); // 種別フィルターの表示状態
    const [showProgressFilter, setShowProgressFilter] = useState(false); // 進捗フィルターの表示状態

    // クイックフィルター & ソート用ステート
    const [statusTab, setStatusTab] = useState<StatusTab>('all');
    const [onlyWithImage, setOnlyWithImage] = useState<boolean>(false);
    const [onlyWithPdf, setOnlyWithPdf] = useState<boolean>(false);
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; order: SortOrder }>({
        key: 'lastActivityDate',
        order: 'desc'
    });

    // Image Search State
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [searchingImage, setSearchingImage] = useState(false);
    const [imageResults, setImageResults] = useState<DesignImage[]>([]);
    const [showImageModal, setShowImageModal] = useState(false);
    const [searchQueryDebug, setSearchQueryDebug] = useState('');

    // 新規日報作成モーダル連携用
    const [showNewReportModal, setShowNewReportModal] = useState(false);
    const [initialDesignData, setInitialDesignData] = useState<InitialDesignData | undefined>(undefined);

    const handleAddReport = (req: DesignRequest, e: React.MouseEvent) => {
        e.stopPropagation();
        setInitialDesignData({
            得意先CD: req.customerCode,
            得意先名: req.customerName,
            直送先CD: req.deliveryCode,
            直送先名: req.deliveryName,
            デザイン依頼No: req.designNo,
            デザイン名: req.designName,
            デザイン種別: req.designType,
            デザイン進捗状況: req.designProgress
        });
        setShowNewReportModal(true);
    };

    const handleImageSearch = async (designNo: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent row toggle
        if (!designNo) return;

        setSearchingImage(true);
        setSearchQueryDebug(String(designNo));
        try {
            const result = await searchDesignImages(String(designNo), selectedFile || undefined);
            if (result.images && result.images.length > 0) {
                setImageResults(result.images);
                setShowImageModal(true);
                toast.success(`${result.images.length}件の画像が見つかりました`);
            } else {
                toast.error('画像が見つかりませんでした');
                setImageResults([]);
            }
        } catch (error) {
            console.error('Search error:', error);
            toast.error('画像検索中にエラーが発生しました');
        } finally {
            setSearchingImage(false);
        }
    };

    // エラー時のtoast表示
    useEffect(() => {
        if (error) {
            toast.error('デザイン依頼データの読み込みに失敗しました');
        }
    }, [error]);

    const processDesignRequests = (
        data: Report[], 
        vMap?: Map<string, ViewerDesignRequest[]>,
        custMap?: Map<string, string>
    ): DesignRequest[] => {
        const designMap = new Map<string, DesignRequest>();

        data.forEach(report => {
            const designNo = report['システム確認用デザインNo.'];
            if (designNo) {
                const strDesignNo = String(designNo).trim();

                if (!designMap.has(strDesignNo)) {
                    designMap.set(strDesignNo, {
                        designNo: strDesignNo,
                        customerCode: String(report.得意先CD || ''),
                        customerName: String(report.訪問先名 || ''),
                        deliveryCode: String(report.直送先CD || ''),
                        deliveryName: String(report.直送先名 || ''),
                        designProposal: String(report['デザイン提案有無'] || ''),
                        designType: String(report['デザイン種別'] || ''),
                        designName: String(report['デザイン名'] || ''),
                        designProgress: String(report['デザイン進捗状況'] || ''),
                        requests: []
                    });
                }

                designMap.get(strDesignNo)!.requests.push(report);
            }
        });

        // 各デザイン依頼の日報を日付順にソート（昇順）し、最新の進捗状況および直送先情報を取得
        const requests = Array.from(designMap.values()).map(req => {
            const sortedRequests = req.requests.sort((a, b) => {
                const dateA = String(a.日付 || '');
                const dateB = String(b.日付 || '');
                return dateA.localeCompare(dateB);
            });

            // 最新のレポート（ソート後の最後）から進捗状況を取得
            const latestReport = sortedRequests[sortedRequests.length - 1];

            // 直送先情報の取得: 最新の日報から優先し、空なら過去の日報を探索
            let foundDeliveryName = '';
            let foundDeliveryCode = '';
            for (let i = sortedRequests.length - 1; i >= 0; i--) {
                const r = sortedRequests[i];
                if (r.直送先名 && String(r.直送先名).trim()) {
                    foundDeliveryName = String(r.直送先名).trim();
                    foundDeliveryCode = String(r.直送先CD || '').trim();
                    break;
                }
            }

            let deliverySource: 'report' | 'viewer' | undefined = foundDeliveryName ? 'report' : undefined;

            // 日報に直送先名がなく、企画課ビューワーに shippingAddress がある場合はフォールバック補完
            if (!foundDeliveryName && vMap) {
                const matchedViewerDocs = vMap.get(req.designNo);
                if (matchedViewerDocs && matchedViewerDocs.length > 0) {
                    const docWithShipping = matchedViewerDocs.find(d => d.shippingAddress && d.shippingAddress.trim() !== '');
                    if (docWithShipping) {
                        foundDeliveryName = docWithShipping.shippingAddress.trim();
                        deliverySource = 'viewer';
                    }
                }
            }

            // 得意先名・得意先CDの取得: 最新日報優先、空なら過去の日報を探索
            let customerName = req.customerName;
            let customerCode = req.customerCode;
            for (let i = sortedRequests.length - 1; i >= 0; i--) {
                const r = sortedRequests[i];
                if (!customerName && r.訪問先名 && String(r.訪問先名).trim()) {
                    customerName = String(r.訪問先名).trim();
                }
                if (!customerCode && r.得意先CD && String(r.得意先CD).trim()) {
                    customerCode = String(r.得意先CD).trim();
                }
            }

            // 得意先名が空で企画課ビューワーに customer がある場合も補完
            if (!customerName && vMap) {
                const matchedViewerDocs = vMap.get(req.designNo);
                if (matchedViewerDocs && matchedViewerDocs.length > 0) {
                    const docWithCustomer = matchedViewerDocs.find(d => d.customer && d.customer.trim() !== '');
                    if (docWithCustomer) {
                        customerName = docWithCustomer.customer.trim();
                    }
                }
            }

            // 得意先コードがある場合は得意先マスタから正規の得意先名を取得
            const custCode = String(customerCode || '').trim();
            const masterName = custCode && custMap ? custMap.get(custCode) : undefined;

            // 得意先名に直送先名が混ざっている場合のクリーンアップ
            const cleanCustomer = extractCleanCustomerName(customerName, foundDeliveryName, masterName);

            return {
                ...req,
                customerCode: customerCode,
                customerName: cleanCustomer,
                deliveryCode: foundDeliveryCode || req.deliveryCode,
                deliveryName: foundDeliveryName,
                deliverySource: deliverySource,
                designProgress: String(latestReport?.['デザイン進捗状況'] || req.designProgress || ''),
                requests: sortedRequests
            };
        });

        // 最終活動日（最新の日付）で降順にソートし、同日ならデザインNo.で降順
        requests.sort((a, b) => {
            const aLast = a.requests[a.requests.length - 1];
            const bLast = b.requests[b.requests.length - 1];
            const aDate = aLast?.日付 || '';
            const bDate = bLast?.日付 || '';

            // 日付の降順（新しい順）
            const dateCmp = bDate.localeCompare(aDate);
            if (dateCmp !== 0) return dateCmp;

            // 日付が同じ場合はデザインNo.の降順
            return String(b.designNo).localeCompare(String(a.designNo), undefined, { numeric: true });
        });

        return requests;
    };

    // レポートからデザイン依頼を抽出（useMemoでキャッシュ）
    const designRequests = useMemo(() => {
        return processDesignRequests(reports, viewerMap, customerCodeMap);
    }, [reports, viewerMap, customerCodeMap]);

    // デザイン依頼がある得意先一覧（useMemoでキャッシュ）
    const customers = useMemo(() => {
        const customerMap = new Map<string, string>();
        designRequests.forEach(req => {
            if (req.customerCode && req.customerName && !customerMap.has(req.customerCode)) {
                customerMap.set(req.customerCode, req.customerName);
            }
        });
        return Array.from(customerMap.entries())
            .map(([code, name]) => ({ code, name }))
            .sort((a, b) => a.code.localeCompare(b.code));
    }, [designRequests]);

    // フィルターされた状態での種別リスト
    const availableTypes = useMemo(() => {
        let requestsToCheck = designRequests;

        // 得意先でフィルター（複数選択対応）
        if (selectedCustomer.length > 0) {
            requestsToCheck = requestsToCheck.filter(req => selectedCustomer.includes(req.customerCode));
        }

        // 種別を抽出
        const types = new Set<string>();
        requestsToCheck.forEach(req => {
            if (req.designType) {
                types.add(req.designType);
            }
        });

        return Array.from(types).sort();
    }, [designRequests, selectedCustomer]);

    // フィルターされた状態での進捗状況リスト
    const availableProgress = useMemo(() => {
        let requestsToCheck = designRequests;

        // 得意先でフィルター（複数選択対応）
        if (selectedCustomer.length > 0) {
            requestsToCheck = requestsToCheck.filter(req => selectedCustomer.includes(req.customerCode));
        }

        // 種別でフィルター（複数選択対応）
        if (selectedType.length > 0) {
            requestsToCheck = requestsToCheck.filter(req => selectedType.includes(req.designType));
        }

        // 進捗状況を抽出
        const progressList = new Set<string>();
        requestsToCheck.forEach(req => {
            if (req.designProgress) {
                progressList.add(req.designProgress);
            }
        });

        return Array.from(progressList).sort();
    }, [designRequests, selectedCustomer, selectedType]);

    // 案件データ取得時に含まれるデザインNoの画像有無を一括プリフェッチ
    useEffect(() => {
        if (!designRequests || designRequests.length === 0) return;
        const nos = designRequests.map(r => r.designNo).filter(Boolean);
        if (nos.length > 0) {
            prefetchDesignImagePresence(nos, selectedFile || undefined);
        }
    }, [designRequests, selectedFile]);

    // 企画課ビューワーおよび営業部フォルダから画像の有無を判定するヘルパー
    const hasAnyDesignImage = (designNo: string) => {
        if (imagePresenceCache.has(designNo)) {
            return !!imagePresenceCache.get(designNo);
        }
        const docs = viewerMap.get(designNo);
        return !!docs?.some(d => !!d.compUrl || (d.compImages && d.compImages.length > 0));
    };

    const hasViewerImage = (designNo: string) => hasAnyDesignImage(designNo);

    const hasViewerPdf = (designNo: string) => {
        const docs = viewerMap.get(designNo);
        return !!docs?.some(d => !!d.pdfUrl);
    };

    // ステータスタブごとの件数集計
    const statusCounts = useMemo(() => {
        let inProgress = 0;
        let completed = 0;
        let pendingRejected = 0;

        designRequests.forEach(req => {
            const prog = req.designProgress;
            if (isCompleted(prog)) {
                completed++;
            } else if (isPendingOrRejected(prog)) {
                pendingRejected++;
            } else {
                inProgress++;
            }
        });

        return {
            all: designRequests.length,
            in_progress: inProgress,
            completed: completed,
            pending_rejected: pendingRejected,
        };
    }, [designRequests]);

    useEffect(() => {
        let filtered = designRequests;

        // 1. ステータスクイックタブ
        if (statusTab === 'in_progress') {
            filtered = filtered.filter(req => isInProgress(req.designProgress));
        } else if (statusTab === 'completed') {
            filtered = filtered.filter(req => isCompleted(req.designProgress));
        } else if (statusTab === 'pending_rejected') {
            filtered = filtered.filter(req => isPendingOrRejected(req.designProgress));
        }

        // 2. 得意先フィルター（複数選択対応）
        if (selectedCustomer.length > 0) {
            filtered = filtered.filter(req => selectedCustomer.includes(req.customerCode));
        }

        // 3. 種別フィルター（複数選択対応）
        if (selectedType.length > 0) {
            filtered = filtered.filter(req => selectedType.includes(req.designType));
        }

        // 4. 進捗状況フィルター（複数選択対応）
        if (selectedProgress.length > 0) {
            filtered = filtered.filter(req => selectedProgress.includes(req.designProgress));
        }

        // 5. クイックトグル（画像あり）
        if (onlyWithImage) {
            filtered = filtered.filter(req => hasViewerImage(req.designNo));
        }

        // 6. クイックトグル（仕様書あり）
        if (onlyWithPdf) {
            filtered = filtered.filter(req => hasViewerPdf(req.designNo));
        }

        // 7. スペース区切りANDキーワード検索（全角半角・かなカナ表記ゆれ吸収）
        if (searchTerm.trim()) {
            const terms = searchTerm
                .trim()
                .split(/\s+/)
                .filter(Boolean)
                .map(normalizeSearchText);

            filtered = filtered.filter(req => {
                const targetValues = [
                    req.designNo,
                    req.customerCode,
                    req.customerName,
                    req.deliveryName || '',
                    req.deliveryCode || '',
                    req.designName,
                    req.designType,
                ].map(normalizeSearchText);

                // 全ての単語がいずれかのフィールドに含まれること（AND条件）
                return terms.every(term =>
                    targetValues.some(val => val.includes(term))
                );
            });
        }

        setFilteredRequests(filtered);
    }, [
        searchTerm,
        selectedCustomer,
        selectedType,
        selectedProgress,
        statusTab,
        onlyWithImage,
        onlyWithPdf,
        designRequests,
        viewerMap
    ]);

    // ソート処理
    const sortedRequests = useMemo(() => {
        const list = [...filteredRequests];
        const { key, order } = sortConfig;
        const modifier = order === 'asc' ? 1 : -1;

        list.sort((a, b) => {
            if (key === 'lastActivityDate') {
                const aLast = a.requests[a.requests.length - 1];
                const bLast = b.requests[b.requests.length - 1];
                const aDate = aLast?.日付 || '';
                const bDate = bLast?.日付 || '';
                const cmp = aDate.localeCompare(bDate);
                if (cmp !== 0) return cmp * modifier;
                return String(a.designNo).localeCompare(String(b.designNo), undefined, { numeric: true }) * modifier;
            }
            if (key === 'requestsCount') {
                const diff = a.requests.length - b.requests.length;
                if (diff !== 0) return diff * modifier;
                return String(a.designNo).localeCompare(String(b.designNo), undefined, { numeric: true }) * modifier;
            }
            if (key === 'designNo') {
                return String(a.designNo).localeCompare(String(b.designNo), undefined, { numeric: true }) * modifier;
            }
            if (key === 'customerCode') {
                return String(a.customerCode || '').localeCompare(String(b.customerCode || ''), undefined, { numeric: true }) * modifier;
            }
            if (key === 'customerName') {
                return String(a.customerName || '').localeCompare(String(b.customerName || '')) * modifier;
            }
            if (key === 'deliveryName') {
                return String(a.deliveryName || '').localeCompare(String(b.deliveryName || '')) * modifier;
            }
            if (key === 'designName') {
                return String(a.designName || '').localeCompare(String(b.designName || '')) * modifier;
            }
            if (key === 'designType') {
                return String(a.designType || '').localeCompare(String(b.designType || '')) * modifier;
            }
            if (key === 'designProgress') {
                return String(a.designProgress || '').localeCompare(String(b.designProgress || '')) * modifier;
            }
            return 0;
        });

        return list;
    }, [filteredRequests, sortConfig]);

    const handleSort = (key: SortKey) => {
        setSortConfig(prev => {
            if (prev.key === key) {
                return { key, order: prev.order === 'asc' ? 'desc' : 'asc' };
            }
            // 日付・回数はデフォルト降順、それ以外は昇順
            const defaultOrder = (key === 'lastActivityDate' || key === 'requestsCount') ? 'desc' : 'asc';
            return { key, order: defaultOrder };
        });
    };

    const handleClearAllFilters = () => {
        setSearchTerm('');
        setSelectedCustomer([]);
        setSelectedType([]);
        setSelectedProgress([]);
        setStatusTab('all');
        setOnlyWithImage(false);
        setOnlyWithPdf(false);
    };

    const hasActiveFilters = Boolean(
        searchTerm.trim() ||
        selectedCustomer.length > 0 ||
        selectedType.length > 0 ||
        selectedProgress.length > 0 ||
        statusTab !== 'all' ||
        onlyWithImage ||
        onlyWithPdf
    );



    const toggleRow = (designNo: string) => {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(designNo)) {
            newExpanded.delete(designNo);
        } else {
            newExpanded.add(designNo);
        }
        setExpandedRows(newExpanded);
    };

    const getProgressBadge = (progress: string) => {
        if (!progress || progress === '-') return null;

        // 進捗状況に応じた色分け（実際のプルダウン選択肢に対応）
        const colorMap: Record<string, string> = {
            // 完了系 - 緑
            '出稿': 'bg-green-100 text-green-800',

            // 進行中 - 青（進捗度合いで濃淡）
            '新規': 'bg-blue-50 text-blue-700',
            '50％未満': 'bg-blue-100 text-blue-800',
            '80％未満': 'bg-blue-200 text-blue-900',
            '80％以上': 'bg-blue-300 text-blue-950',

            // 保留・待機 - 黄色
            '保留': 'bg-yellow-100 text-yellow-800',

            // 不採用 - 赤
            '不採用（コンペ負け）': 'bg-red-100 text-red-800',
            '不採用（企画倒れ）': 'bg-red-100 text-red-800',
        };

        const color = colorMap[progress] || 'bg-gray-100 text-gray-800';
        return (
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${color}`}>
                {progress}
            </span>
        );
    };

    return (
        <>
            <div className="space-y-6 animate-fadeIn">
            {/* ヘッダーエリア */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-sf-text">デザイン依頼検索</h1>
                    <p className="text-xs text-sf-text-weak mt-1">
                        デザイン依頼案件の進捗、カンプ画像、仕様書PDF、および商談履歴を横断検索できます
                    </p>
                </div>
                {hasActiveFilters && (
                    <button
                        type="button"
                        onClick={handleClearAllFilters}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-sf-light-blue bg-white hover:bg-blue-50 border border-gray-200 rounded-lg shadow-2xs transition-colors self-start sm:self-auto cursor-pointer"
                    >
                        <RotateCcw size={13} />
                        検索条件をすべてクリア
                    </button>
                )}
            </div>

            {/* ステータスクイックタブ（大分類） */}
            <div className="flex items-center gap-1.5 border-b border-sf-border pb-1 overflow-x-auto">
                <button
                    type="button"
                    onClick={() => setStatusTab('all')}
                    className={`px-3.5 py-2 text-sm font-semibold rounded-t-lg transition-all border-b-2 flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                        statusTab === 'all'
                            ? 'border-sf-light-blue text-sf-light-blue bg-blue-50/50'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                >
                    すべて
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusTab === 'all' ? 'bg-sf-light-blue text-white' : 'bg-gray-100 text-gray-600'}`}>
                        {statusCounts.all}
                    </span>
                </button>
                <button
                    type="button"
                    onClick={() => setStatusTab('in_progress')}
                    className={`px-3.5 py-2 text-sm font-semibold rounded-t-lg transition-all border-b-2 flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                        statusTab === 'in_progress'
                            ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                >
                    進行中
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusTab === 'in_progress' ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-800'}`}>
                        {statusCounts.in_progress}
                    </span>
                </button>
                <button
                    type="button"
                    onClick={() => setStatusTab('completed')}
                    className={`px-3.5 py-2 text-sm font-semibold rounded-t-lg transition-all border-b-2 flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                        statusTab === 'completed'
                            ? 'border-green-600 text-green-600 bg-green-50/50'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                >
                    出稿・完了
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusTab === 'completed' ? 'bg-green-600 text-white' : 'bg-green-100 text-green-800'}`}>
                        {statusCounts.completed}
                    </span>
                </button>
                <button
                    type="button"
                    onClick={() => setStatusTab('pending_rejected')}
                    className={`px-3.5 py-2 text-sm font-semibold rounded-t-lg transition-all border-b-2 flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                        statusTab === 'pending_rejected'
                            ? 'border-amber-600 text-amber-600 bg-amber-50/50'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                >
                    保留・失注
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusTab === 'pending_rejected' ? 'bg-amber-600 text-white' : 'bg-gray-200 text-gray-700'}`}>
                        {statusCounts.pending_rejected}
                    </span>
                </button>
            </div>

            {/* 検索・フィルターエリア */}
            <div className="bg-white rounded border border-sf-border shadow-sm p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* キーワード検索（スペース区切りAND対応） */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="No.、得意先、直送先、デザイン名（スペース区切りでAND検索）..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-8 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue focus:border-transparent text-sm"
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => setSearchTerm('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded-full hover:bg-gray-100 cursor-pointer"
                                title="キーワードをクリア"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {/* 得意先フィルター（複数選択） */}
                    <div className="relative">
                        <div
                            className="flex items-center justify-between gap-2 px-3 py-2 border border-sf-border rounded bg-white cursor-pointer hover:bg-gray-50 transition-colors"
                            onClick={() => setShowCustomerFilter(!showCustomerFilter)}
                        >
                            <div className="flex items-center gap-2">
                                <Filter className="text-gray-400" size={18} />
                                <span className="text-sm font-medium text-sf-text">
                                    得意先 {selectedCustomer.length > 0 && `(${selectedCustomer.length})`}
                                </span>
                            </div>
                            <ChevronDown
                                size={16}
                                className={`text-gray-400 transition-transform ${showCustomerFilter ? 'rotate-180' : ''}`}
                            />
                        </div>
                        {showCustomerFilter && (
                            <div className="absolute z-10 mt-2 w-full p-3 border border-sf-border rounded bg-white shadow-lg max-h-72 overflow-y-auto">
                                <div className="space-y-2">
                                    {customers.map(customer => (
                                        <label key={customer.code} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                                            <input
                                                type="checkbox"
                                                checked={selectedCustomer.includes(customer.code)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedCustomer([...selectedCustomer, customer.code]);
                                                    } else {
                                                        setSelectedCustomer(selectedCustomer.filter(c => c !== customer.code));
                                                    }
                                                }}
                                                className="w-4 h-4 text-sf-light-blue border-gray-300 rounded focus:ring-sf-light-blue"
                                            />
                                            <span className="text-sm text-sf-text flex-1">
                                                {customer.code} - {customer.name}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                                {selectedCustomer.length > 0 && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedCustomer([]);
                                        }}
                                        className="mt-2 text-xs text-sf-light-blue hover:underline cursor-pointer"
                                    >
                                        すべてクリア
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* 種別フィルター（複数選択） */}
                    <div className="relative">
                        <div
                            className="flex items-center justify-between gap-2 px-3 py-2 border border-sf-border rounded bg-white cursor-pointer hover:bg-gray-50 transition-colors"
                            onClick={() => setShowTypeFilter(!showTypeFilter)}
                        >
                            <div className="flex items-center gap-2">
                                <Layers className="text-gray-400" size={18} />
                                <span className="text-sm font-medium text-sf-text">
                                    種別 {selectedType.length > 0 && `(${selectedType.length})`}
                                </span>
                            </div>
                            <ChevronDown
                                size={16}
                                className={`text-gray-400 transition-transform ${showTypeFilter ? 'rotate-180' : ''}`}
                            />
                        </div>
                        {showTypeFilter && (
                            <div className="absolute z-10 mt-2 w-full p-3 border border-sf-border rounded bg-white shadow-lg max-h-72 overflow-y-auto">
                                <div className="space-y-2">
                                    {availableTypes.map(type => (
                                        <label key={type} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                                            <input
                                                type="checkbox"
                                                checked={selectedType.includes(type)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedType([...selectedType, type]);
                                                    } else {
                                                        setSelectedType(selectedType.filter(t => t !== type));
                                                    }
                                                }}
                                                className="w-4 h-4 text-sf-light-blue border-gray-300 rounded focus:ring-sf-light-blue"
                                            />
                                            <span className="text-sm text-sf-text flex-1">
                                                {type}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                                {selectedType.length > 0 && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedType([]);
                                        }}
                                        className="mt-2 text-xs text-sf-light-blue hover:underline cursor-pointer"
                                    >
                                        すべてクリア
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* 進捗状況フィルター（複数選択） */}
                    <div className="relative">
                        <div
                            className="flex items-center justify-between gap-2 px-3 py-2 border border-sf-border rounded bg-white cursor-pointer hover:bg-gray-50 transition-colors"
                            onClick={() => setShowProgressFilter(!showProgressFilter)}
                        >
                            <div className="flex items-center gap-2">
                                <TrendingUp className="text-gray-400" size={18} />
                                <span className="text-sm font-medium text-sf-text">
                                    進捗状況 {selectedProgress.length > 0 && `(${selectedProgress.length})`}
                                </span>
                            </div>
                            <ChevronDown
                                size={16}
                                className={`text-gray-400 transition-transform ${showProgressFilter ? 'rotate-180' : ''}`}
                            />
                        </div>
                        {showProgressFilter && (
                            <div className="absolute z-10 mt-2 w-full p-3 border border-sf-border rounded bg-white shadow-lg max-h-72 overflow-y-auto">
                                <div className="space-y-2">
                                    {availableProgress.map(progress => (
                                        <label key={progress} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                                            <input
                                                type="checkbox"
                                                checked={selectedProgress.includes(progress)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedProgress([...selectedProgress, progress]);
                                                    } else {
                                                        setSelectedProgress(selectedProgress.filter(p => p !== progress));
                                                    }
                                                }}
                                                className="w-4 h-4 text-sf-light-blue border-gray-300 rounded focus:ring-sf-light-blue"
                                            />
                                            <span className="text-sm text-sf-text flex-1">
                                                {getProgressBadge(progress) || progress}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                                {selectedProgress.length > 0 && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedProgress([]);
                                        }}
                                        className="mt-2 text-xs text-sf-light-blue hover:underline cursor-pointer"
                                    >
                                        すべてクリア
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* クイックトグル & アクティブフィルター一覧 */}
                <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2.5">
                    {/* トグルボタン群 */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-sf-text-weak font-medium">クイック絞り込み:</span>
                        <button
                            type="button"
                            onClick={() => setOnlyWithImage(!onlyWithImage)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border transition-all cursor-pointer ${
                                onlyWithImage
                                    ? 'bg-pink-50 border-pink-300 text-pink-700 font-semibold shadow-2xs'
                                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                            <ImageIcon size={13} className={onlyWithImage ? 'text-pink-600' : 'text-gray-400'} />
                            画像あり
                            {onlyWithImage && <X size={12} className="ml-0.5 hover:opacity-75" />}
                        </button>
                        <button
                            type="button"
                            onClick={() => setOnlyWithPdf(!onlyWithPdf)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border transition-all cursor-pointer ${
                                onlyWithPdf
                                    ? 'bg-red-50 border-red-300 text-red-700 font-semibold shadow-2xs'
                                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                            <FileText size={13} className={onlyWithPdf ? 'text-red-600' : 'text-gray-400'} />
                            仕様書PDFあり
                            {onlyWithPdf && <X size={12} className="ml-0.5 hover:opacity-75" />}
                        </button>
                    </div>

                    {/* アクティブフィルターチップ & リセット */}
                    {hasActiveFilters && (
                        <div className="flex items-center gap-1.5 flex-wrap ml-auto">
                            <span className="text-xs text-sf-text-weak">適用中:</span>
                            {searchTerm.trim() && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700 border border-blue-200">
                                    検索: {searchTerm}
                                    <button onClick={() => setSearchTerm('')} className="hover:text-blue-900 cursor-pointer"><X size={11} /></button>
                                </span>
                            )}
                            {statusTab !== 'all' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    {statusTab === 'in_progress' ? '進行中' : statusTab === 'completed' ? '出稿・完了' : '保留・失注'}
                                    <button onClick={() => setStatusTab('all')} className="hover:text-indigo-900 cursor-pointer"><X size={11} /></button>
                                </span>
                            )}
                            {selectedCustomer.length > 0 && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700 border border-gray-200">
                                    得意先 ({selectedCustomer.length})
                                    <button onClick={() => setSelectedCustomer([])} className="hover:text-gray-900 cursor-pointer"><X size={11} /></button>
                                </span>
                            )}
                            {selectedType.length > 0 && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700 border border-gray-200">
                                    種別 ({selectedType.length})
                                    <button onClick={() => setSelectedType([])} className="hover:text-gray-900 cursor-pointer"><X size={11} /></button>
                                </span>
                            )}
                            {selectedProgress.length > 0 && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700 border border-gray-200">
                                    進捗 ({selectedProgress.length})
                                    <button onClick={() => setSelectedProgress([])} className="hover:text-gray-900 cursor-pointer"><X size={11} /></button>
                                </span>
                            )}
                            <button
                                type="button"
                                onClick={handleClearAllFilters}
                                className="text-xs text-sf-light-blue hover:underline font-medium ml-1 cursor-pointer"
                            >
                                条件をクリア
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* 統計サマリー */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded border border-sf-border shadow-sm">
                    <p className="text-sm text-sf-text-weak mb-1">デザイン依頼（全体）</p>
                    <p className="text-2xl font-semibold text-sf-text">{designRequests.length}</p>
                </div>
                <div className="bg-white p-4 rounded border border-sf-border shadow-sm">
                    <p className="text-sm text-sf-text-weak mb-1">絞り込み結果</p>
                    <p className="text-2xl font-semibold text-sf-light-blue">{filteredRequests.length}</p>
                </div>
                <div className="bg-white p-4 rounded border border-sf-border shadow-sm">
                    <p className="text-sm text-sf-text-weak mb-1">総活動記録数</p>
                    <p className="text-2xl font-semibold text-green-600">
                        {filteredRequests.reduce((sum, req) => sum + req.requests.length, 0)}
                    </p>
                </div>
            </div>

            {/* 検索結果テーブル */}
            <div className="bg-white rounded border border-sf-border shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-sf-border bg-gray-50 flex items-center justify-between">
                    <h2 className="font-semibold text-sm text-sf-text">
                        デザイン依頼一覧 ({sortedRequests.length}件)
                    </h2>
                    {sortConfig.key && (
                        <span className="text-xs text-sf-text-weak">
                            並び順: {
                                sortConfig.key === 'lastActivityDate' ? '最終活動日' :
                                sortConfig.key === 'requestsCount' ? '活動回数' :
                                sortConfig.key === 'designNo' ? 'デザインNo.' :
                                sortConfig.key === 'customerName' ? '得意先名' :
                                sortConfig.key === 'customerCode' ? '得意先CD' :
                                sortConfig.key === 'deliveryName' ? '直送先' :
                                sortConfig.key === 'designName' ? 'デザイン名' :
                                sortConfig.key === 'designType' ? '種別' : '進捗状況'
                            } ({sortConfig.order === 'asc' ? '昇順 ▲' : '降順 ▼'})
                        </span>
                    )}
                </div>

                {isLoading ? (
                    <div className="p-8 text-center text-sf-text-weak">読み込み中...</div>
                ) : sortedRequests.length === 0 ? (
                    <div className="p-8 text-center text-sf-text-weak">
                        {hasActiveFilters ? '条件に一致するデザイン依頼が見つかりません' : 'デザイン依頼が見つかりません'}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="text-xs text-sf-text-weak bg-gray-50 border-b border-sf-border select-none">
                                <tr>
                                    <th className="px-4 py-3 text-left font-medium w-10"></th>
                                    <th
                                        className="px-4 py-3 text-left font-medium cursor-pointer hover:bg-gray-100 transition-colors group whitespace-nowrap"
                                        onClick={() => handleSort('designNo')}
                                        title="デザインNo.で並び替え"
                                    >
                                        <div className="inline-flex items-center gap-1.5 whitespace-nowrap">
                                            <span>デザインNo.</span>
                                            {sortConfig.key === 'designNo' ? (
                                                sortConfig.order === 'asc' ? <ArrowUp size={13} className="text-sf-light-blue" /> : <ArrowDown size={13} className="text-sf-light-blue" />
                                            ) : (
                                                <ArrowUpDown size={13} className="opacity-0 group-hover:opacity-40 transition-opacity" />
                                            )}
                                        </div>
                                    </th>
                                    <th
                                        className="px-4 py-3 text-left font-medium cursor-pointer hover:bg-gray-100 transition-colors group"
                                        onClick={() => handleSort('customerCode')}
                                        title="得意先CDで並び替え"
                                    >
                                        <div className="inline-flex items-center gap-1.5">
                                            <span>得意先CD</span>
                                            {sortConfig.key === 'customerCode' ? (
                                                sortConfig.order === 'asc' ? <ArrowUp size={13} className="text-sf-light-blue" /> : <ArrowDown size={13} className="text-sf-light-blue" />
                                            ) : (
                                                <ArrowUpDown size={13} className="opacity-0 group-hover:opacity-40 transition-opacity" />
                                            )}
                                        </div>
                                    </th>
                                    <th
                                        className="px-4 py-3 text-left font-medium cursor-pointer hover:bg-gray-100 transition-colors group"
                                        onClick={() => handleSort('customerName')}
                                        title="得意先名で並び替え"
                                    >
                                        <div className="inline-flex items-center gap-1.5">
                                            <span>得意先名</span>
                                            {sortConfig.key === 'customerName' ? (
                                                sortConfig.order === 'asc' ? <ArrowUp size={13} className="text-sf-light-blue" /> : <ArrowDown size={13} className="text-sf-light-blue" />
                                            ) : (
                                                <ArrowUpDown size={13} className="opacity-0 group-hover:opacity-40 transition-opacity" />
                                            )}
                                        </div>
                                    </th>
                                    <th
                                        className="px-4 py-3 text-left font-medium cursor-pointer hover:bg-gray-100 transition-colors group"
                                        onClick={() => handleSort('deliveryName')}
                                        title="直送先で並び替え"
                                    >
                                        <div className="inline-flex items-center gap-1.5">
                                            <span>直送先</span>
                                            {sortConfig.key === 'deliveryName' ? (
                                                sortConfig.order === 'asc' ? <ArrowUp size={13} className="text-sf-light-blue" /> : <ArrowDown size={13} className="text-sf-light-blue" />
                                            ) : (
                                                <ArrowUpDown size={13} className="opacity-0 group-hover:opacity-40 transition-opacity" />
                                            )}
                                        </div>
                                    </th>
                                    <th
                                        className="px-4 py-3 text-left font-medium cursor-pointer hover:bg-gray-100 transition-colors group"
                                        onClick={() => handleSort('designName')}
                                        title="デザイン名で並び替え"
                                    >
                                        <div className="inline-flex items-center gap-1.5">
                                            <span>デザイン名</span>
                                            {sortConfig.key === 'designName' ? (
                                                sortConfig.order === 'asc' ? <ArrowUp size={13} className="text-sf-light-blue" /> : <ArrowDown size={13} className="text-sf-light-blue" />
                                            ) : (
                                                <ArrowUpDown size={13} className="opacity-0 group-hover:opacity-40 transition-opacity" />
                                            )}
                                        </div>
                                    </th>
                                    <th
                                        className="px-4 py-3 text-left font-medium cursor-pointer hover:bg-gray-100 transition-colors group"
                                        onClick={() => handleSort('designType')}
                                        title="種別で並び替え"
                                    >
                                        <div className="inline-flex items-center gap-1.5">
                                            <span>種別</span>
                                            {sortConfig.key === 'designType' ? (
                                                sortConfig.order === 'asc' ? <ArrowUp size={13} className="text-sf-light-blue" /> : <ArrowDown size={13} className="text-sf-light-blue" />
                                            ) : (
                                                <ArrowUpDown size={13} className="opacity-0 group-hover:opacity-40 transition-opacity" />
                                            )}
                                        </div>
                                    </th>
                                    <th
                                        className="px-4 py-3 text-center font-medium cursor-pointer hover:bg-gray-100 transition-colors group"
                                        onClick={() => handleSort('designProgress')}
                                        title="進捗状況で並び替え"
                                    >
                                        <div className="inline-flex items-center justify-center gap-1.5 w-full">
                                            <span>進捗状況</span>
                                            {sortConfig.key === 'designProgress' ? (
                                                sortConfig.order === 'asc' ? <ArrowUp size={13} className="text-sf-light-blue" /> : <ArrowDown size={13} className="text-sf-light-blue" />
                                            ) : (
                                                <ArrowUpDown size={13} className="opacity-0 group-hover:opacity-40 transition-opacity" />
                                            )}
                                        </div>
                                    </th>
                                    <th
                                        className="px-4 py-3 text-center font-medium cursor-pointer hover:bg-gray-100 transition-colors group"
                                        onClick={() => handleSort('requestsCount')}
                                        title="活動回数で並び替え"
                                    >
                                        <div className="inline-flex items-center justify-center gap-1.5 w-full">
                                            <span>活動回数</span>
                                            {sortConfig.key === 'requestsCount' ? (
                                                sortConfig.order === 'asc' ? <ArrowUp size={13} className="text-sf-light-blue" /> : <ArrowDown size={13} className="text-sf-light-blue" />
                                            ) : (
                                                <ArrowUpDown size={13} className="opacity-0 group-hover:opacity-40 transition-opacity" />
                                            )}
                                        </div>
                                    </th>
                                    <th
                                        className="px-4 py-3 text-left font-medium cursor-pointer hover:bg-gray-100 transition-colors group"
                                        onClick={() => handleSort('lastActivityDate')}
                                        title="最終活動日で並び替え"
                                    >
                                        <div className="inline-flex items-center gap-1.5">
                                            <span>最終活動日</span>
                                            {sortConfig.key === 'lastActivityDate' ? (
                                                sortConfig.order === 'asc' ? <ArrowUp size={13} className="text-sf-light-blue" /> : <ArrowDown size={13} className="text-sf-light-blue" />
                                            ) : (
                                                <ArrowUpDown size={13} className="opacity-0 group-hover:opacity-40 transition-opacity" />
                                            )}
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedRequests.map((req) => {
                                    const isExpanded = expandedRows.has(req.designNo);
                                    const lastActivity = req.requests[req.requests.length - 1];

                                    return (
                                        <React.Fragment key={req.designNo}>
                                            <tr
                                                key={req.designNo}
                                                className="border-b border-sf-border hover:bg-gray-50 transition-colors cursor-pointer"
                                                onClick={() => toggleRow(req.designNo)}
                                            >
                                                <td className="px-4 py-3">
                                                    {isExpanded ? (
                                                        <ChevronUp size={16} className="text-sf-light-blue" />
                                                    ) : (
                                                        <ChevronDown size={16} className="text-gray-400" />
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 font-medium text-sf-light-blue whitespace-nowrap">
                                                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                                                        <span className="font-mono font-semibold shrink-0">{req.designNo}</span>
                                                        <div onClick={(e) => e.stopPropagation()} className="inline-flex items-center shrink-0">
                                                            <DesignImageHoverButton
                                                                designNo={req.designNo}
                                                                selectedFile={selectedFile || undefined}
                                                                onOpenModal={(imgs, targetNo) => {
                                                                    setImageResults(imgs);
                                                                    setSearchQueryDebug(targetNo);
                                                                    setShowImageModal(true);
                                                                }}
                                                                size="sm"
                                                            />
                                                        </div>
                                                        {(() => {
                                                            const matchedDocs = viewerMap.get(req.designNo);
                                                            if (!matchedDocs || matchedDocs.length === 0) return null;
                                                            const docsWithPdf = matchedDocs.filter(d => !!d.pdfUrl);
                                                            if (docsWithPdf.length === 0) return null;

                                                            const items: PdfItem[] = docsWithPdf.map(doc => ({
                                                                title: `仕様書: ${doc.requestId} - ${doc.designContent || req.designName}`,
                                                                url: doc.pdfUrl!,
                                                                requestId: doc.requestId,
                                                                requestDate: doc.requestDate,
                                                                designContent: doc.designContent,
                                                                status: doc.status
                                                            }));

                                                            return (
                                                                <button
                                                                    onClick={(e: React.MouseEvent) => {
                                                                        e.stopPropagation();
                                                                        setPreviewPdfItems(items);
                                                                        setPreviewPdfTitle(`仕様書: ${req.designNo} - ${req.designName || ''}`);
                                                                        setPreviewPdfInitialIndex(0);
                                                                        setIsPdfModalOpen(true);
                                                                    }}
                                                                    className="p-1 rounded hover:bg-red-50 text-red-500 transition-colors inline-flex items-center gap-0.5 cursor-pointer shrink-0"
                                                                    title={`PDF仕様書をプレビュー (${docsWithPdf.length}件の依頼書あり)`}
                                                                >
                                                                    <FileText size={16} className="shrink-0" />
                                                                    {docsWithPdf.length > 1 && (
                                                                        <span className="text-[10px] font-black bg-red-100 text-red-700 px-1 py-0.2 rounded-full leading-tight shrink-0">
                                                                            {docsWithPdf.length}
                                                                        </span>
                                                                    )}
                                                                </button>
                                                            );
                                                        })()}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-sf-text">{req.customerCode}</td>
                                                <td className="px-4 py-3 text-sf-text font-medium">
                                                    {req.customerName}
                                                </td>
                                                <td className="px-4 py-3 text-sf-text">
                                                    {req.deliveryName ? (
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span className="font-medium text-sf-text">{req.deliveryName}</span>
                                                            {req.deliveryCode && (
                                                                <span className="text-[11px] text-sf-text-weak font-mono">({req.deliveryCode})</span>
                                                            )}
                                                            {req.deliverySource === 'viewer' && (
                                                                <span 
                                                                    className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200"
                                                                    title="企画課デザイン依頼書から補完された直送先です"
                                                                >
                                                                    依頼書
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-300">-</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-sf-text">{req.designName || '-'}</td>
                                                <td className="px-4 py-3 text-sf-text-weak text-xs">{req.designType || '-'}</td>
                                                <td className="px-4 py-3 text-center">
                                                    {getProgressBadge(req.designProgress)}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                        {req.requests.length}件
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sf-text">{lastActivity.日付}</td>
                                            </tr>

                                            {isExpanded && (
                                                <tr>
                                                    <td colSpan={10} className="bg-gray-50 p-0">
                                                        <div className="px-8 py-4">
                                                            {/* デザイン情報サマリー */}
                                                            <div className="mb-4 p-4 bg-white rounded border border-sf-border">
                                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                                                    <div className="flex items-start gap-2">
                                                                        <Package size={16} className="text-sf-light-blue mt-0.5" />
                                                                        <div>
                                                                            <p className="text-xs text-sf-text-weak">デザイン名</p>
                                                                            <p className="text-sm font-medium text-sf-text">{req.designName || '未設定'}</p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-start gap-2">
                                                                        <Layers size={16} className="text-purple-600 mt-0.5" />
                                                                        <div>
                                                                            <p className="text-xs text-sf-text-weak">デザイン種別</p>
                                                                            <p className="text-sm font-medium text-sf-text">{req.designType || '未設定'}</p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-start gap-2">
                                                                        <TrendingUp size={16} className="text-green-600 mt-0.5" />
                                                                        <div>
                                                                            <p className="text-xs text-sf-text-weak">進捗状況</p>
                                                                            <p className="text-sm font-medium text-sf-text">{req.designProgress || '未設定'}</p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-start gap-2">
                                                                        <Truck size={16} className="text-amber-600 mt-0.5" />
                                                                        <div>
                                                                            <p className="text-xs text-sf-text-weak">直送先</p>
                                                                            <p className="text-sm font-medium text-sf-text">
                                                                                {req.deliveryName ? (
                                                                                    <>
                                                                                        {req.deliveryName}
                                                                                        {req.deliveryCode ? <span className="text-xs text-gray-500 font-normal ml-1 font-mono">({req.deliveryCode})</span> : ''}
                                                                                        {req.deliverySource === 'viewer' && (
                                                                                            <span className="ml-1.5 text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-normal">
                                                                                                依頼書より
                                                                                            </span>
                                                                                        )}
                                                                                    </>
                                                                                ) : (
                                                                                    <span className="text-gray-400 font-normal">なし（本社納品等）</span>
                                                                                )}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* 企画課デザイン依頼書（枝番別履歴） */}
                                                            {(() => {
                                                                const matchedDocs = viewerMap.get(req.designNo);
                                                                if (!matchedDocs || matchedDocs.length === 0) return null;
                                                                return (
                                                                    <div className="mb-4 p-4 bg-amber-50/40 rounded-xl border border-amber-200/80 shadow-xs">
                                                                        <h4 className="text-xs font-black text-amber-900 mb-2.5 flex items-center gap-1.5">
                                                                            <FileText size={14} className="text-red-500" />
                                                                            企画課デザイン依頼書・仕様書PDF ({matchedDocs.length}件の依頼書履歴)
                                                                        </h4>
                                                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                                                            {matchedDocs.map((doc, docIdx) => (
                                                                                <div 
                                                                                    key={doc.requestId || docIdx}
                                                                                    className="bg-white p-3 rounded-lg border border-amber-200/60 shadow-2xs flex flex-col justify-between"
                                                                                >
                                                                                    <div>
                                                                                        <div className="flex items-center justify-between gap-1 mb-1">
                                                                                            <span className="font-bold text-xs text-sf-text">
                                                                                                {doc.requestId}
                                                                                            </span>
                                                                                            {doc.status && (
                                                                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                                                                                                    {doc.status === 'completed' ? '完了' : doc.status === 'inProgress' ? '作成中' : doc.status}
                                                                                                </span>
                                                                                            )}
                                                                                        </div>
                                                                                        {doc.requestDate && (
                                                                                            <p className="text-[10px] text-gray-500 flex items-center gap-1 mb-1">
                                                                                                <Calendar size={10} /> 依頼日: {doc.requestDate}
                                                                                            </p>
                                                                                        )}
                                                                                        {doc.designContent && (
                                                                                            <p className="text-xs text-gray-700 line-clamp-2 leading-relaxed mb-2" title={doc.designContent}>
                                                                                                {doc.designContent}
                                                                                            </p>
                                                                                        )}
                                                                                    </div>
                                                                                    {doc.pdfUrl ? (
                                                                                        <button
                                                                                            onClick={(e) => {
                                                                                                e.stopPropagation();
                                                                                                const allItems: PdfItem[] = matchedDocs.filter(d => !!d.pdfUrl).map(d => ({
                                                                                                    title: `仕様書: ${d.requestId} - ${d.designContent || req.designName}`,
                                                                                                    url: d.pdfUrl!,
                                                                                                    requestId: d.requestId,
                                                                                                    requestDate: d.requestDate,
                                                                                                    designContent: d.designContent,
                                                                                                    status: d.status
                                                                                                }));
                                                                                                const targetIdx = allItems.findIndex(item => item.requestId === doc.requestId);
                                                                                                setPreviewPdfItems(allItems);
                                                                                                setPreviewPdfTitle(`仕様書: ${doc.requestId} - ${doc.designContent || req.designName}`);
                                                                                                setPreviewPdfInitialIndex(targetIdx >= 0 ? targetIdx : 0);
                                                                                                setIsPdfModalOpen(true);
                                                                                            }}
                                                                                            className="w-full mt-1 px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded text-xs font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                                                                                        >
                                                                                            <FileText size={12} />
                                                                                            仕様書PDFをプレビュー
                                                                                        </button>
                                                                                    ) : (
                                                                                        <span className="text-[10px] text-gray-400 text-center py-1">PDF未生成</span>
                                                                                    )}
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })()}

                                                            <div className="flex justify-between items-end mb-3">
                                                                <h3 className="text-sm font-semibold text-sf-text flex items-center gap-2">
                                                                    <FileText size={16} className="text-sf-light-blue" />
                                                                    活動履歴（時系列）
                                                                </h3>
                                                                <button
                                                                    onClick={(e) => handleAddReport(req, e)}
                                                                    className="px-3 py-1.5 bg-sf-light-blue text-white rounded text-xs hover:bg-blue-700 transition-colors flex items-center gap-1 shadow-sm"
                                                                >
                                                                    <PenSquare size={14} />
                                                                    このデザインの日報を追加
                                                                </button>
                                                            </div>
                                                            <div className="space-y-3">
                                                                {req.requests.map((report, idx) => (
                                                                    <div
                                                                        key={idx}
                                                                        className="bg-white rounded border border-sf-border p-3 hover:shadow-sm transition-shadow"
                                                                    >
                                                                        <div className="flex items-start gap-3">
                                                                            <div className="flex-shrink-0 w-20 text-xs text-sf-text-weak">
                                                                                <Calendar size={14} className="inline mr-1" />
                                                                                {report.日付}
                                                                            </div>
                                                                            <div className="flex-1">
                                                                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                                                    <span className="text-xs font-medium text-sf-light-blue">
                                                                                        {report.行動内容}
                                                                                    </span>
                                                                                    {report.面談者 && (
                                                                                        <span className="text-xs text-sf-text-weak flex items-center gap-1">
                                                                                            <User size={12} />
                                                                                            {report.面談者}
                                                                                        </span>
                                                                                    )}
                                                                                    {report.直送先名 && (
                                                                                        <span className="text-xs text-sf-text-weak flex items-center gap-1 bg-gray-50 px-1.5 py-0.5 rounded border border-sf-border">
                                                                                            <Truck size={11} className="text-gray-400" />
                                                                                            直送: {report.直送先名}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                                {report.商談内容 && (
                                                                                    <p className="text-xs text-sf-text mt-1 leading-relaxed">
                                                                                        {report.商談内容}
                                                                                    </p>
                                                                                )}
                                                                                {report.提案物 && (
                                                                                    <div className="mt-2 text-xs">
                                                                                        <span className="text-sf-text-weak">提案物: </span>
                                                                                        <span className="text-sf-text">{report.提案物}</span>
                                                                                    </div>
                                                                                )}
                                                                                {report.次回プラン && (
                                                                                    <div className="mt-1 text-xs">
                                                                                        <span className="text-sf-text-weak">次回: </span>
                                                                                        <span className="text-sf-text">{report.次回プラン}</span>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
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

            {/* Image Search Result Modal */}
            <DesignImagePreviewModal
                isOpen={showImageModal}
                onClose={(): void => setShowImageModal(false)}
                images={imageResults}
                targetDesignNo={searchQueryDebug}
            />

            {/* 新規日報作成モーダル（デザイン情報引き継ぎ用） */}
            {showNewReportModal && selectedFile && (
                <NewReportModal
                    onClose={() => setShowNewReportModal(false)}
                    onSuccess={() => {
                        setShowNewReportModal(false);
                        // データ再取得などの処理は、SWR/React Queryなら自動で走るか、手動でトリガー
                        window.location.reload(); // 簡易的にリロードして最新データを反映
                    }}
                    selectedFile={selectedFile}
                    initialDesignData={initialDesignData}
                />
            )}
            {/* PDF仕様書プレビューモーダル */}
            <PdfPreviewModal
                isOpen={isPdfModalOpen}
                onClose={(): void => setIsPdfModalOpen(false)}
                items={previewPdfItems}
                title={previewPdfTitle}
                initialIndex={previewPdfInitialIndex}
            />
        </>
    );
}
