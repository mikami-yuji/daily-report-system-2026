'use client';

import { useEffect, useState } from 'react';
import { getReports, getFiles, Report, ExcelFile } from '@/lib/api';
import { Plus, Filter, RefreshCw, FileText, ChevronDown, ChevronUp, FolderOpen } from 'lucide-react';

export default function ReportsPage() {
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
    const [files, setFiles] = useState<ExcelFile[]>([]);
    const [selectedFile, setSelectedFile] = useState<string>('');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    useEffect(() => {
        // Load available files
        getFiles().then(data => {
            setFiles(data.files);
            setSelectedFile(data.default);
        }).catch(err => {
            console.error('Failed to load files:', err);
        });
    }, []);

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
                    <button className="bg-sf-light-blue text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 shadow-sm flex items-center gap-1 transition-colors">
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
                ) : (
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
                )}
            </div>

            <div className="p-2 bg-white border border-sf-border rounded text-xs text-sf-text-weak flex justify-between items-center">
                <span>{reports.length} 件 • {selectedFile}</span>
                <span>並び順: {sortOrder === 'desc' ? '新しい順' : '古い順'}</span>
            </div>
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value: any }) {
    return (
        <div className="flex justify-between items-start gap-2">
            <span className="text-xs text-sf-text-weak whitespace-nowrap">{label}:</span>
            <span className="text-sm text-sf-text text-right flex-1">{value || '-'}</span>
        </div>
    );
}

function LongTextRow({ label, value }: { label: string; value: any }) {
    return (
        <div className="space-y-1">
            <span className="text-xs text-sf-text-weak font-medium">{label}</span>
            <p className="text-sm text-sf-text bg-white p-3 rounded border border-sf-border min-h-[60px]">
                {value || '-'}
            </p>
        </div>
    );
}
