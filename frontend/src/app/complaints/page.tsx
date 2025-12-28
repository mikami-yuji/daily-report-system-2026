'use client';

import { useEffect, useState } from 'react';
import { getReports, Report } from '@/lib/api';
import { useFile } from '@/context/FileContext';
import { Search, Calendar, User, Building2, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function ComplaintsPage() {
    const { selectedFile, isLoadingFiles } = useFile();
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filteredReports, setFilteredReports] = useState<Report[]>([]);

    useEffect(() => {
        if (!selectedFile || isLoadingFiles) return;

        getReports(selectedFile).then(data => {
            // クレーム関連のレポートを抽出（行動内容または商談内容に「クレーム」を含む）
            const complaintReports = data.filter(r =>
                (r.行動内容 && String(r.行動内容).includes('クレーム')) ||
                (r.商談内容 && String(r.商談内容).includes('クレーム'))
            );

            // 日付の降順（新しい順）にソート
            complaintReports.sort((a, b) => {
                const dateA = String(a.日付 || '');
                const dateB = String(b.日付 || '');
                return dateB.localeCompare(dateA);
            });

            setReports(complaintReports);
            setFilteredReports(complaintReports);
            setLoading(false);
        }).catch(err => {
            console.error(err);
            toast.error('クレームデータの読み込みに失敗しました');
            setLoading(false);
        });
    }, [selectedFile, isLoadingFiles]);

    useEffect(() => {
        if (searchTerm.trim() === '') {
            setFilteredReports(reports);
            return;
        }

        const term = searchTerm.toLowerCase();
        const filtered = reports.filter(r =>
            String(r.得意先CD || '').toLowerCase().includes(term) ||
            String(r.訪問先名 || '').toLowerCase().includes(term) ||
            String(r.商談内容 || '').toLowerCase().includes(term) ||
            String(r.面談者 || '').toLowerCase().includes(term)
        );

        setFilteredReports(filtered);
    }, [searchTerm, reports]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-semibold text-sf-text">クレーム対応履歴</h1>
            </div>

            {/* 検索エリア */}
            <div className="bg-white rounded border border-sf-border shadow-sm p-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="得意先、商談内容、面談者で検索..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue focus:border-transparent"
                    />
                </div>
            </div>

            {/* 統計サマリー */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded border border-sf-border shadow-sm">
                    <p className="text-sm text-sf-text-weak mb-1">総クレーム件数</p>
                    <p className="text-2xl font-semibold text-sf-text">{reports.length}</p>
                </div>
                <div className="bg-white p-4 rounded border border-sf-border shadow-sm">
                    <p className="text-sm text-sf-text-weak mb-1">検索結果</p>
                    <p className="text-2xl font-semibold text-sf-light-blue">{filteredReports.length}</p>
                </div>
                <div className="bg-white p-4 rounded border border-sf-border shadow-sm">
                    <p className="text-sm text-sf-text-weak mb-1">対象顧客数</p>
                    <p className="text-2xl font-semibold text-orange-600">
                        {new Set(filteredReports.filter(r => r.得意先CD).map(r => r.得意先CD)).size}
                    </p>
                </div>
            </div>

            {/* タイムライン */}
            <div className="bg-white rounded border border-sf-border shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-sf-border bg-gray-50">
                    <h2 className="font-semibold text-sm text-sf-text">クレーム対応タイムライン</h2>
                </div>

                {loading ? (
                    <div className="p-8 text-center text-sf-text-weak">読み込み中...</div>
                ) : filteredReports.length === 0 ? (
                    <div className="p-8 text-center text-sf-text-weak">
                        {searchTerm ? '検索結果が見つかりません' : 'クレーム対応履歴が見つかりません'}
                    </div>
                ) : (
                    <div className="p-4 space-y-4">
                        {filteredReports.map((report, idx) => (
                            <div
                                key={idx}
                                className="bg-white p-4 rounded border border-sf-border shadow-sm hover:shadow-md transition-shadow relative pl-12"
                            >
                                <div className="absolute left-4 top-4 flex flex-col items-center h-full">
                                    <div className="bg-orange-100 p-1.5 rounded-full border border-orange-200 z-10">
                                        <AlertTriangle size={16} className="text-orange-600" />
                                    </div>
                                    {idx !== filteredReports.length - 1 && (
                                        <div className="w-px bg-gray-200 h-full absolute top-8"></div>
                                    )}
                                </div>

                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-sf-text">{report.日付}</span>
                                        <span className="text-sm text-orange-700 bg-orange-100 px-2 py-0.5 rounded font-medium">
                                            {report.行動内容 || '-'}
                                        </span>
                                    </div>
                                    {report.面談者 && (
                                        <div className="flex items-center text-sm text-sf-text-weak">
                                            <User size={14} className="mr-1" />
                                            {report.面談者}
                                        </div>
                                    )}
                                </div>

                                <div className="mb-3">
                                    {report.得意先CD ? (
                                        <Link
                                            href={`/customers/${report.得意先CD}`}
                                            className="flex items-center gap-2 text-sf-light-blue hover:underline font-medium"
                                        >
                                            <Building2 size={16} />
                                            {report.訪問先名} ({report.得意先CD})
                                        </Link>
                                    ) : (
                                        <div className="flex items-center gap-2 text-sf-text font-medium">
                                            <Building2 size={16} />
                                            {report.訪問先名}
                                        </div>
                                    )}
                                </div>

                                {report.商談内容 && (
                                    <div className="bg-orange-50 border border-orange-200 rounded p-3">
                                        <p className="text-xs font-semibold text-orange-800 mb-1">対応内容</p>
                                        <p className="text-sm text-sf-text whitespace-pre-wrap">{report.商談内容}</p>
                                    </div>
                                )}

                                {report.次回プラン && (
                                    <div className="mt-3 text-sm text-sf-text-weak">
                                        <span className="font-medium">次回プラン: </span>
                                        <span className="text-sf-text">{report.次回プラン}</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
