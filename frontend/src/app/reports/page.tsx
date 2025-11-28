'use client';

import { useEffect, useState } from 'react';
import { getReports, Report, getCustomers, Customer } from '@/lib/api';
import { useFile } from '@/context/FileContext';
import { Plus, Filter, RefreshCw, FileText, ChevronDown, ChevronUp, FolderOpen, LayoutList, Table } from 'lucide-react';

export default function ReportsPage() {
    const { files, selectedFile, setSelectedFile } = useFile();
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [viewMode, setViewMode] = useState<'table' | 'timeline'>('table');
    const [showNewReportModal, setShowNewReportModal] = useState(false);

    useEffect(() => {
        if (selectedFile) {
            fetchData();
        }
    }, [selectedFile]);

    const fetchData = () => {
        setLoading(true);
        getReports(selectedFile).then(data => {
            // Filter out reports with no date
            const validData = data.filter(report => report.日付 && report.日付.trim() !== '');
            // Sort data initially based on current sortOrder
            const sortedData = sortReports(validData, sortOrder);
            setReports(sortedData);
            setLoading(false);
        }).catch(err => {
            console.error(err);
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

    const toggleRow = (index: number) => {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(index)) {
            newExpanded.delete(index);
        } else {
            newExpanded.add(index);
        }
        setExpandedRows(newExpanded);
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
                        {reports.map((report, i) => {
                            const isExpanded = expandedRows.has(i);
                            return (
                                <div key={i} className="hover:bg-gray-50 transition-colors">
                                    {/* サマリー行 */}
                                    <div
                                        className="p-4 cursor-pointer flex items-center gap-4"
                                        onClick={() => toggleRow(i)}
                                    >
                                        <button className="text-sf-text-weak hover:text-sf-text">
                                            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                        </button>
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

                                    {/* 詳細セクション */}
                                    {isExpanded && (
                                        <div className="px-4 pb-4 bg-gray-50 border-t border-sf-border">
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
                                                {/* 基本情報 */}
                                                <div className="space-y-3">
                                                    <h3 className="font-semibold text-sm text-sf-text border-b border-sf-border pb-2">基本情報</h3>
                                                    <InfoRow label="エリア" value={report.エリア} />
                                                    <InfoRow label="得意先CD" value={report.得意先CD} />
                                                    <InfoRow label="直送先CD" value={report.直送先CD} />
                                                    <InfoRow label="直送先名" value={report.直送先名} />
                                                    <InfoRow label="重点顧客" value={report.重点顧客} />
                                                    <InfoRow label="ランク" value={report.ランク} />
                                                    <InfoRow label="得意先目標" value={report.得意先目標} />
                                                    <InfoRow label="滞在時間" value={report.滞在時間} />
                                                </div>

                                                {/* デザイン情報 */}
                                                <div className="space-y-3">
                                                    <h3 className="font-semibold text-sm text-sf-text border-b border-sf-border pb-2">デザイン情報</h3>
                                                    <InfoRow label="デザイン提案有無" value={report.デザイン提案有無} />
                                                    <InfoRow label="デザイン種別" value={report.デザイン種別} />
                                                    <InfoRow label="デザイン名" value={report.デザイン名} />
                                                    <InfoRow label="デザイン進捗状況" value={report.デザイン進捗状況} />
                                                    <InfoRow label="デザイン依頼No." value={report['デザイン依頼No.']} />
                                                    <InfoRow label="システム確認用デザインNo." value={report['システム確認用デザインNo.']} />
                                                </div>

                                                {/* 承認・確認 */}
                                                <div className="space-y-3">
                                                    <h3 className="font-semibold text-sm text-sf-text border-b border-sf-border pb-2">承認・確認</h3>
                                                    <InfoRow label="上長" value={report.上長} />
                                                    <InfoRow label="山澄常務" value={report.山澄常務} />
                                                    <InfoRow label="岡本常務" value={report.岡本常務} />
                                                    <InfoRow label="中野次長" value={report.中野次長} />
                                                    <InfoRow label="既読チェック" value={report.既読チェック} />
                                                </div>

                                                {/* 商談内容 */}
                                                <div className="space-y-3 md:col-span-2 lg:col-span-3">
                                                    <h3 className="font-semibold text-sm text-sf-text border-b border-sf-border pb-2">商談・提案内容</h3>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <LongTextRow label="商談内容" value={report.商談内容} />
                                                        <LongTextRow label="提案物" value={report.提案物} />
                                                        <LongTextRow label="次回プラン" value={report.次回プラン} />
                                                        <LongTextRow label="競合他社情報" value={report.競合他社情報} />
                                                    </div>
                                                </div>

                                                {/* コメント */}
                                                <div className="space-y-3 md:col-span-2 lg:col-span-3">
                                                    <h3 className="font-semibold text-sm text-sf-text border-b border-sf-border pb-2">コメント</h3>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <LongTextRow label="上長コメント" value={report.上長コメント} />
                                                        <LongTextRow label="コメント返信欄" value={report.コメント返信欄} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="p-4 space-y-4">
                        {reports.map((report, i) => (
                            <div key={i} className="bg-white p-4 rounded border border-sf-border shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-3 border-b border-gray-100 pb-2">
                                    <div className="flex items-center gap-3">
                                        <span className="font-bold text-sf-text">{report.日付}</span>
                                        <span className="text-sm px-2 py-0.5 rounded bg-gray-100 text-sf-text-weak">{report.行動内容}</span>
                                        <span className="text-sm font-medium text-sf-light-blue">{report.訪問先名}</span>
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
        <div className="space-y-1">
            <span className="text-xs text-sf-text-weak font-medium">{label}</span>
            <p className="text-sm text-sf-text bg-white p-3 rounded border border-sf-border min-h-[60px] whitespace-pre-wrap">
                {cleanText(value) || '-'}
            </p>
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
        訪問先名: '',
        面談者: '',
        滞在時間: '',
        商談内容: '',
        提案物: '',
        次回プラン: '',
        重点顧客: '',
        ランク: ''
    });
    const [submitting, setSubmitting] = useState(false);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    useEffect(() => {
        // Fetch customer list
        getCustomers(selectedFile).then(data => {
            setCustomers(data);
        }).catch(err => {
            console.error('Failed to fetch customers:', err);
        });
    }, [selectedFile]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const response = await fetch(`http://localhost:8000/reports?filename=${encodeURIComponent(selectedFile)}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                throw new Error('Failed to create report');
            }

            onSuccess();
        } catch (error) {
            console.error('Error creating report:', error);
            alert('日報の作成に失敗しました');
        } finally {
            setSubmitting(false);
        }
    };

    const handleCustomerNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setFormData(prev => ({
            ...prev,
            訪問先名: value
        }));

        // Filter customers based on input
        if (value.trim()) {
            const filtered = customers.filter(c =>
                c.得意先名 && c.得意先名.includes(value)
            );
            setFilteredCustomers(filtered);
            setShowSuggestions(filtered.length > 0);
        } else {
            setFilteredCustomers([]);
            setShowSuggestions(false);
        }
    };

    const selectCustomer = (customer: Customer) => {
        setFormData(prev => ({
            ...prev,
            訪問先名: customer.得意先名 || '',
            得意先CD: customer.得意先CD || '',
            エリア: customer.エリア || '',
            重点顧客: customer.重点顧客 || '',
            ランク: customer.ランク || ''
        }));
        setShowSuggestions(false);
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
                <div className="sticky top-0 bg-white border-b border-sf-border p-4 flex justify-between items-center">
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
                                <option value="訪問">訪問</option>
                                <option value="訪問（クレーム）">訪問（クレーム）</option>
                                <option value="電話">電話</option>
                                <option value="メール">メール</option>
                                <option value="その他">その他</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-sf-text mb-1">エリア</label>
                            <input
                                type="text"
                                name="エリア"
                                value={formData.エリア}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-sf-text mb-1">得意先CD</label>
                            <input
                                type="text"
                                name="得意先CD"
                                value={formData.得意先CD}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue"
                            />
                        </div>

                        <div className="relative">
                            <label className="block text-sm font-medium text-sf-text mb-1">訪問先名 *</label>
                            <input
                                type="text"
                                name="訪問先名"
                                value={formData.訪問先名}
                                onChange={handleCustomerNameChange}
                                onFocus={() => {
                                    if (formData.訪問先名 && filteredCustomers.length > 0) {
                                        setShowSuggestions(true);
                                    }
                                }}
                                required
                                autoComplete="off"
                                className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue"
                            />
                            {showSuggestions && filteredCustomers.length > 0 && (
                                <div className="absolute z-10 w-full mt-1 bg-white border border-sf-border rounded shadow-lg max-h-60 overflow-y-auto">
                                    {filteredCustomers.map((customer, idx) => (
                                        <div
                                            key={idx}
                                            onClick={() => selectCustomer(customer)}
                                            className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                                        >
                                            <div className="font-medium">{customer.得意先名}</div>
                                            <div className="text-xs text-sf-text-weak">
                                                CD: {customer.得意先CD} | エリア: {customer.エリア || '-'} | ランク: {customer.ランク || '-'}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
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
                            <input
                                type="text"
                                name="滞在時間"
                                value={formData.滞在時間}
                                onChange={handleChange}
                                placeholder="例: 1時間"
                                className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-sf-text mb-1">商談内容</label>
                        <textarea
                            name="商談内容"
                            value={formData.商談内容}
                            onChange={handleChange}
                            rows={4}
                            className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-sf-text mb-1">提案物</label>
                        <textarea
                            name="提案物"
                            value={formData.提案物}
                            onChange={handleChange}
                            rows={3}
                            className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-sf-text mb-1">次回プラン</label>
                        <textarea
                            name="次回プラン"
                            value={formData.次回プラン}
                            onChange={handleChange}
                            rows={3}
                            className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue"
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
