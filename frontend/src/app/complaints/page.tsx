'use client';

import { useEffect, useState, useMemo } from 'react';
import { useFile } from '@/context/FileContext';
import { useReports } from '@/hooks/useQueryHooks';
import { Search, Calendar, User, Building2, AlertTriangle, Truck } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function ComplaintsPage() {
    const { selectedFile, isLoadingFiles } = useFile();

    // React Queryでデータ取得（自動キャッシュ）
    const { data: allReports = [], isLoading, error } = useReports(selectedFile || undefined);

    // クレーム関連のレポートを抽出
    const reports = useMemo(() => {
        const complaintReports = allReports.filter(r =>
            (r.行動内容 && String(r.行動内容).includes('クレーム')) ||
            (r.商談内容 && String(r.商談内容).includes('クレーム'))
        );
        // 日付の降順（新しい順）にソート
        return complaintReports.sort((a, b) => {
            const dateA = String(a.日付 || '');
            const dateB = String(b.日付 || '');
            return dateB.localeCompare(dateA);
        });
    }, [allReports]);

    // 顧客リストを抽出（得意先CD + 直送先CDでユニーク）
    const customers = useMemo(() => {
        const customerMap = new Map<string, { code: string; name: string; isDD: boolean }>();
        reports.forEach(r => {
            const code = String(r.得意先CD || '');
            const name = String(r.訪問先名 || '');
            const ddCode = r.直送先CD ? String(r.直送先CD) : '';
            const ddName = r.直送先名 ? String(r.直送先名) : '';

            // 得意先を追加
            if (code && !customerMap.has(code)) {
                customerMap.set(code, { code, name, isDD: false });
            }
            // 直送先を追加
            if (ddCode) {
                const ddKey = `${code}-${ddCode}`;
                if (!customerMap.has(ddKey)) {
                    customerMap.set(ddKey, { code: ddKey, name: ddName || name, isDD: true });
                }
            }
        });
        return Array.from(customerMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [reports]);

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState('');
    const [filteredReports, setFilteredReports] = useState(reports);

    // エラー時のtoast表示
    useEffect(() => {
        if (error) {
            toast.error('クレームデータの読み込みに失敗しました');
        }
    }, [error]);

    // レポートが変わったらフィルタリングをリセット
    useEffect(() => {
        setFilteredReports(reports);
    }, [reports]);

    useEffect(() => {
        let filtered = reports;

        // 得意先/直送先フィルター
        if (selectedCustomer) {
            if (selectedCustomer.includes('-')) {
                // 直送先の場合 (code-ddCode形式)
                const [code, ddCode] = selectedCustomer.split('-');
                filtered = filtered.filter(r =>
                    String(r.得意先CD) === code && String(r.直送先CD || '') === ddCode
                );
            } else {
                // 得意先の場合
                filtered = filtered.filter(r => String(r.得意先CD) === selectedCustomer);
            }
        }

        // キーワード検索
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(r =>
                String(r.得意先CD || '').toLowerCase().includes(term) ||
                String(r.訪問先名 || '').toLowerCase().includes(term) ||
                String(r.直送先名 || '').toLowerCase().includes(term) ||
                String(r.商談内容 || '').toLowerCase().includes(term) ||
                String(r.面談者 || '').toLowerCase().includes(term)
            );
        }

        setFilteredReports(filtered);
    }, [searchTerm, selectedCustomer, reports]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-semibold text-sf-text">クレーム対応履歴</h1>
            </div>

            {/* 検索エリア */}
            <div className="bg-white rounded border border-sf-border shadow-sm p-4">
                <div className="flex flex-col md:flex-row gap-4">
                    {/* 得意先プルダウン */}
                    <div className="relative w-full md:w-80">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <select
                            value={selectedCustomer}
                            onChange={(e) => setSelectedCustomer(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue focus:border-transparent appearance-none bg-white"
                        >
                            <option value="">すべての得意先・直送先</option>
                            {customers.map(c => (
                                <option key={c.code} value={c.code}>
                                    {c.isDD ? `【直送】${c.name}` : c.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    {/* キーワード検索 */}
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="商談内容、面談者で検索..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue focus:border-transparent"
                        />
                    </div>
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

                {isLoading ? (
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
                                            href={`/customers/detail?code=${report.得意先CD}`}
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
                                    {/* 直送先表示 */}
                                    {(report.直送先CD || report.直送先名) && (
                                        report.得意先CD && report.直送先CD ? (
                                            <Link
                                                href={`/customers/detail?code=${report.得意先CD}&ddCode=${report.直送先CD}`}
                                                className="flex items-center gap-2 text-blue-600 hover:underline text-sm mt-1 ml-6"
                                            >
                                                <Truck size={14} />
                                                <span className="text-xs bg-blue-50 border border-blue-200 rounded px-1">直送先</span>
                                                {report.直送先名 || '直送先'} ({report.直送先CD})
                                            </Link>
                                        ) : (
                                            <div className="flex items-center gap-2 text-blue-700 text-sm mt-1 ml-6">
                                                <Truck size={14} className="text-blue-500" />
                                                <span className="text-xs bg-blue-50 border border-blue-200 rounded px-1">直送先</span>
                                                {report.直送先名 || report.直送先CD}
                                            </div>
                                        )
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
