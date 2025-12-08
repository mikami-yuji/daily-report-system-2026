'use client';

import { useEffect, useState } from 'react';
import { getReports, Report, getCustomers, Customer, updateReport, deleteReport, getInterviewers, getDesigns, Design } from '@/lib/api';
import { useFile } from '@/context/FileContext';
import { Plus, Filter, RefreshCw, FileText, ChevronDown, ChevronUp, FolderOpen, LayoutList, Table, Edit, ChevronLeft, ChevronRight, X, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmationModal from '@/components/ConfirmationModal';
import { useOffline } from '@/context/OfflineContext';

// Helper to sanitize report object for API updates
const sanitizeReport = (report: any) => {
    const sanitized: any = {};
    for (const key in report) {
        if (report[key] === null || report[key] === undefined) {
            sanitized[key] = '';
        } else {
            sanitized[key] = report[key];
        }
    }
    return sanitized;
};

export default function ReportsPage() {
    const { files, selectedFile, setSelectedFile } = useFile();
    const { isOnline, saveOfflineReport, cachedCustomers, cacheCustomers, cachedReports, cacheReports, offlineReports } = useOffline();

    // Merge offline changes into reports
    const mergeOfflineReports = (baseReports: Report[]) => {
        let merged = [...baseReports];

        offlineReports.forEach(offlineReport => {
            if (offlineReport.type === 'update' && offlineReport.reportId) {
                const index = merged.findIndex(r => r.管理番号 === offlineReport.reportId);
                if (index !== -1) {
                    merged[index] = { ...merged[index], ...offlineReport.data };
                }
            } else if (offlineReport.type === 'create') {
                // For created reports, we might want to prepend them or handle them differently
                // For now, let's focus on updates as requested
            }
        });
        return merged;
    };
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedReportIndex, setSelectedReportIndex] = useState<number | null>(null);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [viewMode, setViewMode] = useState<'table' | 'timeline'>('table');
    const [showNewReportModal, setShowNewReportModal] = useState(false);
    const [showEditReportModal, setShowEditReportModal] = useState(false);
    const [editingReport, setEditingReport] = useState<Report | null>(null);



    useEffect(() => {
        if (selectedFile) {
            fetchData();
        }
    }, [selectedFile, isOnline]);

    const fetchData = () => {
        setLoading(true);
        getReports(selectedFile).then(data => {
            // Filter out reports with no date
            const validData = data.filter(report => report.日付 && report.日付.trim() !== '');
            // Sort data initially based on current sortOrder
            const sortedData = sortReports(validData, sortOrder);

            // Merge offline reports
            const mergedData = mergeOfflineReports(sortedData);

            setReports(mergedData);
            cacheReports(sortedData); // Cache the ORIGINAL successful response
            setLoading(false);
        }).catch(err => {
            console.error(err);
            // Fallback to cache if fetch fails (offline or server error)
            if (cachedReports.length > 0) {
                const mergedCached = mergeOfflineReports(cachedReports);
                setReports(mergedCached);
                toast('キャッシュされた日報を表示します', { icon: '📡' });
            }
            setLoading(false);

        });
    };

    const sortReports = (data: Report[], order: 'asc' | 'desc') => {
        return [...data].sort((a, b) => {
            const dateA = String(a.日付 || '');
            const dateB = String(b.日付 || '');
            if (order === 'asc') {
                return dateA.localeCompare(dateB);
            } else {
                return dateB.localeCompare(dateA);
            }
        });
    };

    const toggleSortOrder = () => {
        const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
        setSortOrder(newOrder);
        setReports(prev => sortReports(prev, newOrder));
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
        <div className="space-y-4 h-[calc(100vh-8rem)] flex flex-col">
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
                    <div className="flex items-center gap-2 border border-sf-border rounded px-3 py-2 bg-white">
                        <FolderOpen size={16} className="text-sf-text-weak" />
                        <select
                            value={selectedFile}
                            onChange={(e) => setSelectedFile(e.target.value)}
                            className="text-sm text-sf-text bg-transparent border-none outline-none cursor-pointer"
                        >
                            {files.map(file => (
                                <option key={file.name} value={file.name}>{file.name}</option>
                            ))}
                        </select>
                    </div>

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
                    <button onClick={fetchData} className="p-2 border border-sf-border rounded hover:bg-gray-50 text-sf-text-weak transition-colors">
                        <RefreshCw size={16} />
                    </button>
                    <button
                        onClick={() => setShowNewReportModal(true)}
                        className="bg-sf-light-blue text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 shadow-sm flex items-center gap-1 transition-colors"
                    >
                        <Plus size={16} />
                        新規作成
                    </button>
                </div>
            </div>

            <div className="bg-white border border-sf-border shadow-sm flex-1 overflow-auto rounded">
                {loading ? (
                    <div className="p-10 text-center text-sf-text-weak">読み込み中...</div>
                ) : reports.length === 0 ? (
                    <div className="p-10 text-center text-sf-text-weak">日報が見つかりません</div>
                ) : viewMode === 'table' ? (
                    <div className="divide-y divide-sf-border">

                        {reports.map((report, i) => (
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
                        {reports.map((report, i) => (
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

            <div className="p-2 bg-white border border-sf-border rounded text-xs text-sf-text-weak flex justify-between items-center">
                <span>{reports.length} 件 • {selectedFile}</span>
                <span>並び順: {sortOrder === 'desc' ? '新しい順' : '古い順'}</span>
            </div>

            {/* 新規日報作成モーダル */}
            {showNewReportModal && (
                <NewReportModal
                    onClose={() => setShowNewReportModal(false)}
                    onSuccess={() => {
                        setShowNewReportModal(false);
                        fetchData();
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
                        if (isOnline) fetchData(); // Only fetch if online, otherwise we handled it optimistically
                    }}
                    selectedFile={selectedFile}
                    isOnline={isOnline}
                    saveOfflineReport={saveOfflineReport}
                    setReports={setReports}
                    cacheReports={cacheReports}
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
                    onUpdate={fetchData}
                />
            )}
        </div>
    );
}

function cleanText(text: string | null | undefined): string {
    if (!text) return '';
    return String(text).replace(/_x000D_/g, '\n').replace(/\r/g, '');
}

function InfoRow({ label, value }: { label: string; value: any }) {
    return (
        <div className="flex justify-between items-start gap-2">
            <span className="text-xs text-sf-text-weak whitespace-nowrap">{label}:</span>
            <span className="text-sm text-sf-text text-right flex-1">{cleanText(value) || '-'}</span>
        </div>
    );
}

function LongTextRow({ label, value }: { label: string; value: any }) {
    return (
        <div className="flex flex-col gap-1">
            <span className="text-xs text-sf-text-weak">{label}:</span>
            <span className="text-sm text-sf-text whitespace-pre-wrap">{cleanText(value) || '-'}</span>
        </div>
    );
}
interface NewReportModalProps {
    onClose: () => void;
    onSuccess: () => void;
    selectedFile: string;
}

function NewReportModal({ onClose, onSuccess, selectedFile }: NewReportModalProps) {
    const [formData, setFormData] = useState({
        日付: new Date().toISOString().split('T')[0].replace(/-/g, '/').slice(2), // YY/MM/DD format
        行動内容: '',
        エリア: '',
        得意先CD: '',
        直送先CD: '',
        訪問先名: '',
        直送先名: '',
        面談者: '',
        滞在時間: '',
        商談内容: '',
        提案物: '',
        次回プラン: '',
        重点顧客: '',
        ランク: '',
        デザイン提案有無: '',
        デザイン種別: '',
        デザイン名: '',
        デザイン進捗状況: '',
        'デザイン依頼No.': '',
    });
    const [submitting, setSubmitting] = useState(false);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [interviewers, setInterviewers] = useState<string[]>([]);
    const [designMode, setDesignMode] = useState<'none' | 'new' | 'existing'>('none');
    const [designs, setDesigns] = useState<Design[]>([]);

    // Customer fetching moved to useEffect below with offline support

    // Handle customer name change with keyword search across all fields including kana
    const handleCustomerNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setFormData(prev => ({
            ...prev,
            訪問先名: value,
        }));

        filterCustomers(value);
    };

    const filterCustomers = (searchTerm: string) => {
        if (!searchTerm.trim()) {
            // Empty search: show top 50 customers
            setFilteredCustomers(customers.slice(0, 50));
            setShowSuggestions(true);
            return;
        }

        const lowerSearchTerm = searchTerm.toLowerCase();
        // Convert hiragana to katakana for kana search
        const katakanaSearchTerm = lowerSearchTerm.replace(/[\u3041-\u3096]/g, (match) => {
            const chr = match.charCodeAt(0) + 0x60;
            return String.fromCharCode(chr);
        });

        const filtered = customers.filter(c => {
            // Search in customer name
            if (c.得意先名 && c.得意先名.toLowerCase().includes(lowerSearchTerm)) {
                return true;
            }
            // Search in customer code
            if (c.得意先CD && String(c.得意先CD).includes(lowerSearchTerm)) {
                return true;
            }
            // Search in kana (フリガナ)
            if (c.フリガナ && c.フリガナ.toLowerCase().includes(katakanaSearchTerm)) {
                return true;
            }
            // Search in Direct Delivery Name
            if (c.直送先名 && c.直送先名.toLowerCase().includes(lowerSearchTerm)) {
                return true;
            }
            // Search in Direct Delivery Code
            if (c.直送先CD && String(c.直送先CD).includes(lowerSearchTerm)) {
                return true;
            }
            return false;
        }).slice(0, 50); // Limit to 50 results
        setFilteredCustomers(filtered);
        setShowSuggestions(filtered.length > 0);
    };

    const handleCustomerInputFocus = () => {
        if (!showSuggestions) {
            filterCustomers(formData.訪問先名);
        }
    };

    const selectCustomer = (customer: Customer) => {
        setFormData(prev => ({
            ...prev,
            訪問先名: customer.直送先名 ? `${customer.得意先名}　${customer.直送先名}` : (customer.得意先名 || ''),
            直送先名: customer.直送先名 || '',
            得意先CD: customer.得意先CD || '',
            直送先CD: customer.直送先CD || '',
            エリア: customer.エリア || '',
            重点顧客: customer.重点顧客 || '',
            ランク: customer.ランク || ''
        }));
        setShowSuggestions(false);

        // Fetch interviewers for this customer
        if (customer.得意先CD) {
            getInterviewers(customer.得意先CD, selectedFile, customer.得意先名, customer.直送先名).then(data => {
                setInterviewers(data);
            }).catch(err => {
                console.error('Failed to fetch interviewers:', err);
                setInterviewers([]);
            });

            // Fetch designs for this customer
            getDesigns(customer.得意先CD, selectedFile).then(data => {
                setDesigns(data);
            }).catch(err => {
                console.error('Failed to fetch designs:', err);
                setDesigns([]);
            });
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData(prev => ({
            ...prev,
            [e.target.name]: e.target.value
        }));
    };

    const handleDesignModeChange = (mode: 'none' | 'new' | 'existing') => {
        setDesignMode(mode);
        if (mode === 'none') {
            setFormData(prev => ({
                ...prev,
                デザイン提案有無: '',
                デザイン種別: '',
                デザイン名: '',
                デザイン進捗状況: '',
                'デザイン依頼No.': ''
            }));
        } else if (mode === 'new') {
            setFormData(prev => ({
                ...prev,
                デザイン提案有無: 'あり',
                デザイン種別: '',
                デザイン名: '',
                デザイン進捗状況: '新規',
                'デザイン依頼No.': ''
            }));
        } else if (mode === 'existing') {
            setFormData(prev => ({
                ...prev,
                デザイン提案有無: 'あり',
                デザイン種別: '',
                デザイン名: '',
                デザイン進捗状況: '',
                'デザイン依頼No.': ''
            }));
        }
    };

    const handleDesignSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const designNo = e.target.value;
        const selectedDesign = designs.find(d => String(d.デザイン依頼No) === designNo);
        if (selectedDesign) {
            setFormData(prev => ({
                ...prev,
                'デザイン依頼No.': String(selectedDesign.デザイン依頼No),
                デザイン種別: selectedDesign.デザイン種別,
                デザイン名: selectedDesign.デザイン名,
                デザイン進捗状況: selectedDesign.デザイン進捗状況
            }));
        }
    };

    const { isOnline, saveOfflineReport, cachedCustomers, cacheCustomers } = useOffline();

    useEffect(() => {
        // Fetch customer list
        getCustomers(selectedFile).then(data => {
            setCustomers(data);
            cacheCustomers(data); // Cache successful response
        }).catch(err => {
            console.error('Failed to fetch customers:', err);
            // Fallback to cache if fetch fails (offline or server error)
            if (cachedCustomers.length > 0) {
                setCustomers(cachedCustomers);
                toast('キャッシュされた得意先リストを使用します', { icon: '📡' });
            }
        });
    }, [selectedFile, isOnline]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            if (!isOnline) {
                saveOfflineReport(formData, selectedFile);
                onSuccess();
                return;
            }

            const response = await fetch(`/api/reports?filename=${encodeURIComponent(selectedFile)}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Server error details:', errorData);
                throw new Error(`Failed to create report: ${JSON.stringify(errorData)}`);
            }

            const responseData = await response.json();
            alert(`日報を保存しました。\n\n管理番号: ${responseData.management_number}\n\n保存先:\n${responseData.file_path}`);
            onSuccess();
        } catch (error: any) {
            console.error('Error creating report:', error);
            alert(`日報の作成に失敗しました: ${error.message}`);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-sf-border p-4 flex justify-between items-center z-10">
                    <h2 className="text-xl font-bold text-sf-text">新規日報作成</h2>
                    <button
                        onClick={onClose}
                        className="text-sf-text-weak hover:text-sf-text"
                    >
                        ✕
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-sf-text mb-1">日付 *</label>
                            <input
                                type="text"
                                name="日付"
                                value={formData.日付}
                                onChange={handleChange}
                                placeholder="YY/MM/DD"
                                required
                                className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-sf-text mb-1">行動内容 *</label>
                            <select
                                name="行動内容"
                                value={formData.行動内容}
                                onChange={handleChange}
                                required
                                className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue"
                            >
                                <option value="">選択してください</option>
                                <option value="-">-</option>
                                <option value="訪問（アポあり）">訪問（アポあり）</option>
                                <option value="訪問（アポなし）">訪問（アポなし）</option>
                                <option value="訪問（新規）">訪問（新規）</option>
                                <option value="訪問（クレーム）">訪問（クレーム）</option>
                                <option value="電話商談">電話商談</option>
                                <option value="電話アポ取り">電話アポ取り</option>
                                <option value="メール商談">メール商談</option>
                                <option value="量販店調査">量販店調査</option>
                                <option value="社内（半日）">社内（半日）</option>
                                <option value="社内（１日）">社内（１日）</option>
                                <option value="外出時間">外出時間</option>
                                <option value="その他">その他</option>
                            </select>
                        </div>

                        <div className="md:col-span-2 relative">
                            <label className="block text-sm font-medium text-sf-text mb-1">訪問先名（得意先名） *</label>
                            <input
                                type="text"
                                name="訪問先名"
                                value={formData.訪問先名}
                                onChange={handleCustomerNameChange}
                                required
                                autoComplete="off"
                                onFocus={handleCustomerInputFocus}
                                onClick={handleCustomerInputFocus}
                                className="w-full pl-3 pr-10 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue"
                            />
                            <button
                                type="button"
                                onClick={handleCustomerInputFocus}
                                className="absolute right-2 top-[34px] text-gray-400 hover:text-gray-600 p-1"
                                tabIndex={-1}
                            >
                                <ChevronDown size={16} />
                            </button>
                            {formData.直送先名 && (
                                <div className="mt-1 text-sm text-sf-light-blue flex items-center gap-1">
                                    <span className="i-lucide-truck w-3 h-3"></span>
                                    直送先: {formData.直送先名} (CD: {formData.直送先CD})
                                </div>
                            )}
                            {showSuggestions && (
                                <ul className="absolute z-20 w-full bg-white border border-sf-border rounded mt-1 max-h-60 overflow-y-auto shadow-lg">
                                    {filteredCustomers.map((customer, index) => (
                                        <li
                                            key={index}
                                            className="px-3 py-2 hover:bg-sf-bg-light cursor-pointer"
                                            onClick={() => selectCustomer(customer)}
                                        >
                                            <div className="font-medium">
                                                {customer.得意先名}
                                                {customer.直送先名 && <span className="text-sm font-normal ml-2 text-sf-text-weak">(直送先: {customer.直送先名})</span>}
                                            </div>
                                            <div className="text-xs text-sf-text-weak">
                                                {customer.得意先CD} - {customer.エリア}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-sf-text mb-1">面談者</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    name="面談者"
                                    value={formData.面談者}
                                    onChange={handleChange}
                                    list="interviewer-suggestions"
                                    className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue"
                                />
                                <datalist id="interviewer-suggestions">
                                    {interviewers.map((interviewer, index) => (
                                        <option key={index} value={interviewer} />
                                    ))}
                                </datalist>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-sf-text mb-1">滞在時間</label>
                            <select
                                name="滞在時間"
                                value={formData.滞在時間}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue"
                            >
                                <option value="">選択してください</option>
                                <option value="-">-</option>
                                <option value="10分未満">10分未満</option>
                                <option value="30分未満">30分未満</option>
                                <option value="60分未満">60分未満</option>
                                <option value="60分以上">60分以上</option>
                            </select>
                        </div>
                    </div>

                    {/* Design Input Section */}
                    <div className="md:col-span-2 border-t border-sf-border pt-4 mt-2">
                        <h3 className="font-medium text-sf-text mb-3">デザイン情報</h3>
                        <div className="space-y-4">
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2">
                                    <input
                                        type="radio"
                                        name="designMode"
                                        value="none"
                                        checked={designMode === 'none'}
                                        onChange={() => handleDesignModeChange('none')}
                                        className="text-sf-light-blue focus:ring-sf-light-blue"
                                    />
                                    <span>なし</span>
                                </label>
                                <label className="flex items-center gap-2">
                                    <input
                                        type="radio"
                                        name="designMode"
                                        value="new"
                                        checked={designMode === 'new'}
                                        onChange={() => handleDesignModeChange('new')}
                                        className="text-sf-light-blue focus:ring-sf-light-blue"
                                    />
                                    <span>新規</span>
                                </label>
                                <label className="flex items-center gap-2">
                                    <input
                                        type="radio"
                                        name="designMode"
                                        value="existing"
                                        checked={designMode === 'existing'}
                                        onChange={() => handleDesignModeChange('existing')}
                                        className="text-sf-light-blue focus:ring-sf-light-blue"
                                    />
                                    <span>既存</span>
                                </label>
                            </div>

                            {designMode === 'existing' && (
                                <div>
                                    <label className="block text-sm font-medium text-sf-text mb-1">過去のデザイン案件</label>
                                    <select
                                        onChange={handleDesignSelect}
                                        value={formData['デザイン依頼No.']}
                                        className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue"
                                    >
                                        <option value="">選択してください</option>
                                        {designs.map((design) => (
                                            <option key={String(design.デザイン依頼No)} value={String(design.デザイン依頼No)}>
                                                {design.デザイン依頼No} - {design.デザイン名} ({design.デザイン進捗状況})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {(designMode === 'new' || designMode === 'existing') && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-sf-text mb-1">デザイン依頼No.</label>
                                        <input
                                            type="text"
                                            name="デザイン依頼No."
                                            value={formData['デザイン依頼No.']}
                                            onChange={handleChange}
                                            readOnly={designMode === 'existing'}
                                            className={`w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue ${designMode === 'existing' ? 'bg-gray-100' : ''}`}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-sf-text mb-1">デザイン種別</label>
                                        <input
                                            type="text"
                                            name="デザイン種別"
                                            value={formData.デザイン種別}
                                            onChange={handleChange}
                                            className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-sf-text mb-1">デザイン名</label>
                                        <input
                                            type="text"
                                            name="デザイン名"
                                            value={formData.デザイン名}
                                            onChange={handleChange}
                                            className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-sf-text mb-1">デザイン進捗状況</label>
                                        <select
                                            name="デザイン進捗状況"
                                            value={formData.デザイン進捗状況}
                                            onChange={handleChange}
                                            className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue"
                                        >
                                            <option value="">選択してください</option>
                                            <option value="-">-</option>
                                            <option value="新規">新規</option>
                                            <option value="50％未満">50％未満</option>
                                            <option value="80％未満">80％未満</option>
                                            <option value="80％以上">80％以上</option>
                                            <option value="出稿">出稿</option>
                                            <option value="不採用（コンペ負け）">不採用（コンペ負け）</option>
                                            <option value="不採用（企画倒れ）">不採用（企画倒れ）</option>
                                            <option value="保留">保留</option>
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-sf-text mb-1">商談内容</label>
                        <textarea
                            name="商談内容"
                            value={formData.商談内容}
                            onChange={handleChange}
                            rows={4}
                            className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue transition-all duration-200 resize-none"
                            onFocus={(e) => e.currentTarget.rows = 8}
                            onBlur={(e) => e.currentTarget.rows = 4}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-sf-text mb-1">提案物</label>
                        <textarea
                            name="提案物"
                            value={formData.提案物}
                            onChange={handleChange}
                            rows={1}
                            className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue transition-all duration-200 resize-none"
                            onFocus={(e) => e.currentTarget.rows = 6}
                            onBlur={(e) => e.currentTarget.rows = 1}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-sf-text mb-1">次回プラン</label>
                        <textarea
                            name="次回プラン"
                            value={formData.次回プラン}
                            onChange={handleChange}
                            rows={1}
                            className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue transition-all duration-200 resize-none"
                            onFocus={(e) => e.currentTarget.rows = 6}
                            onBlur={(e) => e.currentTarget.rows = 1}
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-sf-border">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border border-sf-border rounded text-sf-text hover:bg-gray-50"
                        >
                            キャンセル
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-4 py-2 bg-sf-light-blue text-white rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                            {submitting ? '作成中...' : '作成'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

interface EditReportModalProps {
    report: Report;
    onClose: () => void;
    onSuccess: () => void;
    selectedFile: string;
    isOnline: boolean;
    saveOfflineReport: (data: any, filename: string, type?: 'create' | 'update', reportId?: number) => void;
    setReports: React.Dispatch<React.SetStateAction<Report[]>>;
    cacheReports: (reports: any[]) => void;
    reports: Report[];
}

function EditReportModal({ report, onClose, onSuccess, selectedFile, isOnline, saveOfflineReport, setReports, cacheReports, reports }: EditReportModalProps) {
    const [formData, setFormData] = useState({
        日付: report.日付 || '',
        行動内容: report.行動内容 || '',
        エリア: report.エリア || '',
        得意先CD: report.得意先CD || '',
        直送先CD: report.直送先CD || '',
        訪問先名: report.訪問先名 || '',
        直送先名: report.直送先名 || '',
        面談者: report.面談者 || '',
        滞在時間: report.滞在時間 || '',
        商談内容: report.商談内容 || '',
        提案物: report.提案物 || '',
        次回プラン: report.次回プラン || '',
        重点顧客: report.重点顧客 || '',
        ランク: report.ランク || '',
        上長コメント: report.上長コメント || '',
        コメント返信欄: report.コメント返信欄 || ''
    });
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        const { 管理番号, ...rest } = report;
        const fullReport = { ...rest, ...formData };
        const sanitized = sanitizeReport(fullReport);

        try {

            if (!isOnline) {
                saveOfflineReport(sanitized, selectedFile, 'update', report.管理番号);

                // Optimistic UI update
                const updatedReport = { ...report, ...sanitized };
                setReports(prev => prev.map(r => r.管理番号 === report.管理番号 ? updatedReport : r));
                cacheReports(reports.map(r => r.管理番号 === report.管理番号 ? updatedReport : r));

                onSuccess();
                return;
            }

            await updateReport(report.管理番号, sanitized, selectedFile);
            toast.success('日報を更新しました', {
                duration: 4000,
                position: 'top-right',
            });
            onSuccess();
        } catch (error) {
            console.error('Error updating report:', error);

            // Fallback to offline save on error (e.g. server down)
            saveOfflineReport(sanitized, selectedFile, 'update', report.管理番号);

            // Optimistic UI update
            const updatedReport = { ...report, ...sanitized };
            setReports(prev => {
                const newReports = prev.map(r => r.管理番号 === report.管理番号 ? updatedReport : r);
                cacheReports(newReports); // Update cache as well
                return newReports;
            });

            toast.success('サーバー通信エラー。オフラインで保存しました。', {
                duration: 4000,
                position: 'top-right',
                icon: '📡'
            });
            onSuccess();
        } finally {
            setSubmitting(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData(prev => ({
            ...prev,
            [e.target.name]: e.target.value
        }));
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-sf-border p-4 flex justify-between items-center z-10">
                    <h2 className="text-xl font-bold text-sf-text">日報編集 (No. {report.管理番号})</h2>
                    <button
                        onClick={onClose}
                        className="text-sf-text-weak hover:text-sf-text"
                    >
                        ✕
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-sf-text mb-1">日付 *</label>
                            <input
                                type="text"
                                name="日付"
                                value={formData.日付}
                                onChange={handleChange}
                                placeholder="YY/MM/DD"
                                required
                                className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-sf-text mb-1">行動内容 *</label>
                            <select
                                name="行動内容"
                                value={formData.行動内容}
                                onChange={handleChange}
                                required
                                className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue"
                            >
                                <option value="">選択してください</option>
                                <option value="-">-</option>
                                <option value="訪問（アポあり）">訪問（アポあり）</option>
                                <option value="訪問（アポなし）">訪問（アポなし）</option>
                                <option value="訪問（新規）">訪問（新規）</option>
                                <option value="訪問（クレーム）">訪問（クレーム）</option>
                                <option value="電話商談">電話商談</option>
                                <option value="電話アポ取り">電話アポ取り</option>
                                <option value="メール商談">メール商談</option>
                                <option value="量販店調査">量販店調査</option>
                                <option value="社内（半日）">社内（半日）</option>
                                <option value="社内（１日）">社内（１日）</option>
                                <option value="外出時間">外出時間</option>
                                <option value="その他">その他</option>
                            </select>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-sf-text mb-1">訪問先名（得意先名） *</label>
                            <input
                                type="text"
                                name="訪問先名"
                                value={formData.訪問先名}
                                onChange={handleChange}
                                required
                                className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-sf-text mb-1">面談者</label>
                            <input
                                type="text"
                                name="面談者"
                                value={formData.面談者}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-sf-text mb-1">滞在時間</label>
                            <select
                                name="滞在時間"
                                value={formData.滞在時間}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue"
                            >
                                <option value="">選択してください</option>
                                <option value="-">-</option>
                                <option value="10分未満">10分未満</option>
                                <option value="30分未満">30分未満</option>
                                <option value="60分未満">60分未満</option>
                                <option value="60分以上">60分以上</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-sf-text mb-1">商談内容</label>
                        <textarea
                            name="商談内容"
                            value={formData.商談内容}
                            onChange={handleChange}
                            rows={4}
                            className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue transition-all duration-200 resize-none"
                            onFocus={(e) => e.currentTarget.rows = 8}
                            onBlur={(e) => e.currentTarget.rows = 4}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-sf-text mb-1">提案物</label>
                        <textarea
                            name="提案物"
                            value={formData.提案物}
                            onChange={handleChange}
                            rows={1}
                            className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue transition-all duration-200 resize-none"
                            onFocus={(e) => e.currentTarget.rows = 6}
                            onBlur={(e) => e.currentTarget.rows = 1}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-sf-text mb-1">次回プラン</label>
                        <textarea
                            name="次回プラン"
                            value={formData.次回プラン}
                            onChange={handleChange}
                            rows={1}
                            className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue transition-all duration-200 resize-none"
                            onFocus={(e) => e.currentTarget.rows = 6}
                            onBlur={(e) => e.currentTarget.rows = 1}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-sf-border">
                        <div>
                            <label className="block text-sm font-medium text-sf-text mb-1 text-blue-800">上長コメント</label>
                            <textarea
                                name="上長コメント"
                                value={formData.上長コメント}
                                onChange={handleChange}
                                rows={4}
                                className="w-full px-3 py-2 border border-blue-200 bg-blue-50 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                                placeholder="上長からのコメントを入力..."
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-sf-text mb-1 text-green-800">コメント返信欄</label>
                            <textarea
                                name="コメント返信欄"
                                value={formData.コメント返信欄}
                                onChange={handleChange}
                                rows={4}
                                className="w-full px-3 py-2 border border-green-200 bg-green-50 rounded focus:outline-none focus:ring-2 focus:ring-green-400"
                                placeholder="コメントへの返信を入力..."
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-sf-border">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border border-sf-border rounded text-sf-text hover:bg-gray-50"
                        >
                            キャンセル
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-4 py-2 bg-sf-light-blue text-white rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                            {submitting ? '更新中...' : '更新'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

interface ReportDetailModalProps {
    report: Report;
    onClose: () => void;
    onNext: () => void;
    onPrev: () => void;
    hasNext: boolean;
    hasPrev: boolean;
    onEdit: () => void;
    onUpdate?: () => void;
}

function ReportDetailModal({ report, onClose, onNext, onPrev, hasNext, hasPrev, onEdit, onUpdate }: ReportDetailModalProps) {
    const { selectedFile } = useFile();
    const [approvals, setApprovals] = useState({
        上長: report.上長 || '',
        山澄常務: report.山澄常務 || '',
        岡本常務: report.岡本常務 || '',
        中野次長: report.中野次長 || '',
        既読チェック: report.既読チェック || ''
    });
    const [comments, setComments] = useState({
        上長コメント: report.上長コメント || '',
        コメント返信欄: report.コメント返信欄 || ''
    });
    const [saving, setSaving] = useState(false);

    // キーボードイベントのハンドリング
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft' && hasNext) {
                onNext();
            } else if (e.key === 'ArrowRight' && hasPrev) {
                onPrev();
            } else if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [hasNext, hasPrev, onNext, onPrev, onClose]);

    const handleApprovalChange = async (field: keyof typeof approvals) => {
        const newValue = approvals[field] === '済' ? '' : '済';
        setApprovals(prev => ({ ...prev, [field]: newValue }));

        setSaving(true);
        try {
            // Prepare full report
            const { 管理番号, ...rest } = report;
            const fullReport = {
                ...rest,
                ...approvals, // Use current approvals state
                [field]: newValue,
                ...comments // Also include current comments
            };
            const sanitized = sanitizeReport(fullReport);
            await updateReport(report.管理番号, sanitized, selectedFile);
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error('Failed to update approval:', error);
            // Revert on error
            setApprovals(prev => ({ ...prev, [field]: approvals[field] }));
            toast.error('承認ステータスの更新に失敗しました');
        } finally {
            setSaving(false);
        }
    };

    const handleCommentBlur = async (field: keyof typeof comments) => {
        if (comments[field] === (report[field] || '')) return; // No change

        setSaving(true);
        try {
            // Prepare full report
            const { 管理番号, ...rest } = report;
            const fullReport = {
                ...rest,
                ...comments, // Use current comments state
                [field]: comments[field],
                ...approvals // Also include current approvals
            };
            const sanitized = sanitizeReport(fullReport);
            await updateReport(report.管理番号, sanitized, selectedFile);
            toast.success('コメントを保存しました');
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error('Failed to update comment:', error);
            toast.error('コメントの保存に失敗しました');
        } finally {
            setSaving(false);
        }
    };

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const handleDeleteClick = () => {
        setShowDeleteConfirm(true);
    };

    const executeDelete = async () => {
        setSaving(true);
        try {
            await deleteReport(report.管理番号, selectedFile);
            toast.success('日報を削除しました');
            onClose();
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error('Failed to delete report:', error);
            toast.error('日報の削除に失敗しました');
        } finally {
            setSaving(false);
        }
    };

    const hasDesign = report.デザイン提案有無 === 'あり';

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                {/* ヘッダー */}
                <div className="p-6 border-b border-sf-border flex justify-between items-start bg-gray-50 rounded-t-lg">
                    <div className="flex-1">
                        <h2 className="text-2xl font-bold text-sf-text mb-2">
                            {report.訪問先名}
                            {report.直送先名 && <span className="text-base font-normal text-sf-text-weak ml-3">(直送先: {report.直送先名})</span>}
                        </h2>
                        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-sf-text-weak">
                            <span className="flex items-center gap-1">
                                <span className="i-lucide-calendar w-4 h-4" />
                                {report.日付}
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="i-lucide-hash w-4 h-4" />
                                No. {report.管理番号}
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="i-lucide-briefcase w-4 h-4" />
                                {report.行動内容}
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="i-lucide-user w-4 h-4" />
                                {report.面談者}
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="i-lucide-map-pin w-4 h-4" />
                                {report.エリア}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onEdit}
                            className="p-2 text-sf-text-weak hover:text-sf-light-blue hover:bg-white rounded-full transition-colors border border-transparent hover:border-sf-border"
                            title="編集"
                        >
                            <Edit size={20} />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-sf-text-weak hover:text-sf-text hover:bg-white rounded-full transition-colors border border-transparent hover:border-sf-border"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* コンテンツ */}
                <div className="flex-1 overflow-y-auto p-6 relative">
                    {/* ナビゲーションボタン（オーバーレイ） */}
                    {hasNext && (
                        <button
                            onClick={onNext}
                            className="fixed left-8 top-1/2 -translate-y-1/2 p-3 bg-white/80 hover:bg-white shadow-lg rounded-full text-sf-text-weak hover:text-sf-light-blue transition-all z-10 border border-sf-border backdrop-blur-sm"
                            title="前の日報 (新しい)"
                        >
                            <ChevronLeft size={32} />
                        </button>
                    )}
                    {hasPrev && (
                        <button
                            onClick={onPrev}
                            className="fixed right-8 top-1/2 -translate-y-1/2 p-3 bg-white/80 hover:bg-white shadow-lg rounded-full text-sf-text-weak hover:text-sf-light-blue transition-all z-10 border border-sf-border backdrop-blur-sm"
                            title="次の日報 (古い)"
                        >
                            <ChevronRight size={32} />
                        </button>
                    )}

                    <div className="space-y-8">
                        {/* デザイン情報（条件付き表示） */}
                        {hasDesign && (
                            <div className="bg-blue-50 p-5 rounded-lg border border-blue-100">
                                <h3 className="font-bold text-blue-800 mb-4 flex items-center gap-2 text-lg">
                                    <span className="i-lucide-palette"></span> デザイン案件
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    <InfoRow label="種別" value={report.デザイン種別} />
                                    <InfoRow label="案件名" value={report.デザイン名} />
                                    <InfoRow label="進捗" value={report.デザイン進捗状況} />
                                    <InfoRow label="依頼No." value={report['デザイン依頼No.']} />
                                    <InfoRow label="確認No." value={report['システム確認用デザインNo.']} />
                                </div>
                            </div>
                        )}

                        {/* 商談・提案内容（メイン） */}
                        <div>
                            <h3 className="font-bold text-xl text-sf-text mb-4 border-b-2 border-sf-border pb-2">商談・提案内容</h3>
                            <div className="space-y-6">
                                <div className="bg-white">
                                    <div className="text-sm font-semibold text-sf-text-weak mb-2">商談内容</div>
                                    <div className="text-base text-sf-text whitespace-pre-wrap leading-relaxed p-4 bg-gray-50 rounded border border-gray-100 min-h-[100px]">
                                        {cleanText(report.商談内容) || 'なし'}
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-white">
                                        <div className="text-sm font-semibold text-sf-text-weak mb-2">提案物</div>
                                        <div className="text-base text-sf-text whitespace-pre-wrap p-3 bg-gray-50 rounded border border-gray-100">
                                            {cleanText(report.提案物) || 'なし'}
                                        </div>
                                    </div>
                                    <div className="bg-white">
                                        <div className="text-sm font-semibold text-sf-text-weak mb-2">次回プラン</div>
                                        <div className="text-base text-sf-text whitespace-pre-wrap p-3 bg-gray-50 rounded border border-gray-100">
                                            {cleanText(report.次回プラン) || 'なし'}
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white">
                                    <div className="text-sm font-semibold text-sf-text-weak mb-2">競合他社情報</div>
                                    <div className="text-base text-sf-text whitespace-pre-wrap p-3 bg-gray-50 rounded border border-gray-100">
                                        {cleanText(report.競合他社情報) || 'なし'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 承認・コメント */}
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                            {/* 承認（左側） */}
                            <div className="lg:col-span-1 bg-gray-50 p-5 rounded-lg h-fit">
                                <h3 className="font-bold text-sf-text mb-4 border-b border-gray-200 pb-2">承認・確認</h3>
                                <div className="space-y-3">
                                    {(['上長', '山澄常務', '岡本常務', '中野次長'] as const).map(field => (
                                        <div key={field} className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={approvals[field] === '済'}
                                                onChange={() => handleApprovalChange(field)}
                                                disabled={saving}
                                                className="w-4 h-4 text-sf-light-blue border-gray-300 rounded focus:ring-sf-light-blue cursor-pointer"
                                            />
                                            <span className="text-sm text-sf-text">{field}</span>
                                        </div>
                                    ))}
                                    <div className="pt-2 border-t border-gray-200">
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={approvals.既読チェック === '済'}
                                                onChange={() => handleApprovalChange('既読チェック')}
                                                disabled={saving}
                                                className="w-4 h-4 text-sf-light-blue border-gray-300 rounded focus:ring-sf-light-blue cursor-pointer"
                                            />
                                            <span className="text-sm text-sf-text">既読</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* コメント（右側・大きく） */}
                            <div className="lg:col-span-3 space-y-6">
                                <div>
                                    <h3 className="font-bold text-lg text-sf-text mb-4 border-b border-sf-border pb-2">コメント</h3>
                                    <div className="space-y-4">
                                        <div className="bg-yellow-50 p-5 rounded-lg border border-yellow-100">
                                            <div className="text-sm font-bold text-yellow-800 mb-2 flex items-center gap-2">
                                                <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
                                                上長コメント
                                            </div>
                                            <textarea
                                                value={comments.上長コメント}
                                                onChange={(e) => setComments(prev => ({ ...prev, 上長コメント: e.target.value }))}
                                                onBlur={() => handleCommentBlur('上長コメント')}
                                                disabled={saving}
                                                className="w-full min-h-[100px] p-3 text-sf-text bg-white border border-yellow-200 rounded focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-y"
                                                placeholder="コメントを入力..."
                                            />
                                        </div>
                                        <div className="bg-green-50 p-5 rounded-lg border border-green-100">
                                            <div className="text-sm font-bold text-green-800 mb-2 flex items-center gap-2">
                                                <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                                                コメント返信欄
                                            </div>
                                            <textarea
                                                value={comments.コメント返信欄}
                                                onChange={(e) => setComments(prev => ({ ...prev, コメント返信欄: e.target.value }))}
                                                onBlur={() => handleCommentBlur('コメント返信欄')}
                                                disabled={saving}
                                                className="w-full min-h-[100px] p-3 text-sf-text bg-white border border-green-200 rounded focus:outline-none focus:ring-2 focus:ring-green-400 resize-y"
                                                placeholder="返信を入力..."
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* その他の基本情報（下部にまとめる） */}
                        <div className="border-t border-sf-border pt-6 mt-8">
                            <button
                                className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-2"
                                onClick={(e) => {
                                    const target = e.currentTarget.nextElementSibling;
                                    if (target) {
                                        target.classList.toggle('hidden');
                                    }
                                }}
                            >
                                <span className="i-lucide-info w-3 h-3"></span>
                                詳細属性情報を表示
                            </button>
                            <div className="hidden grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-xs text-gray-500 bg-gray-50 p-4 rounded">
                                <div><span className="block text-gray-400">得意先CD</span>{report.得意先CD}</div>
                                <div><span className="block text-gray-400">直送先CD</span>{report.直送先CD}</div>
                                <div><span className="block text-gray-400">直送先名</span>{report.直送先名}</div>
                                <div><span className="block text-gray-400">重点顧客</span>{report.重点顧客}</div>
                                <div><span className="block text-gray-400">ランク</span>{report.ランク}</div>
                                <div><span className="block text-gray-400">目標</span>{report.得意先目標}</div>
                                <div><span className="block text-gray-400">滞在時間</span>{report.滞在時間}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* フッター */}
                <div className="p-4 border-t border-sf-border bg-gray-50 flex justify-between items-center rounded-b-lg">
                    <button
                        onClick={onNext}
                        disabled={!hasNext}
                        className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${hasNext
                            ? 'bg-white border border-sf-border hover:bg-sf-light-blue hover:text-white hover:border-transparent text-sf-text shadow-sm'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }`}
                    >
                        <ChevronLeft size={16} />
                        前の日報
                    </button>
                    <button
                        onClick={handleDeleteClick}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 rounded transition-colors bg-red-50 border border-red-200 hover:bg-red-500 hover:text-white hover:border-transparent text-red-600 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Trash2 size={16} />
                        削除
                    </button>
                    <button
                        onClick={onPrev}
                        disabled={!hasPrev}
                        className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${hasPrev
                            ? 'bg-white border border-sf-border hover:bg-sf-light-blue hover:text-white hover:border-transparent text-sf-text shadow-sm'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }`}
                    >
                        次の日報
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>

            <ConfirmationModal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={executeDelete}
                title="日報の削除"
                message="この日報を削除してもよろしいですか？\nこの操作は取り消せません。"
                confirmText="削除する"
                isDangerous={true}
            />
        </div>
    );
}
