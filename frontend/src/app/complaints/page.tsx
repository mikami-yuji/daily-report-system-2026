'use client';

import { useEffect, useState, useMemo } from 'react';
import { useFile } from '@/context/FileContext';
import { useReports } from '@/hooks/useQueryHooks';
import { Search, User, Building2, AlertTriangle, Truck, Tag, Calendar, RotateCcw, X } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { normalizeSearchText, getDaysSinceDate, deduplicateReports } from '@/lib/reportUtils';

// 主なクレーム原因キーワード
const COMPLAINT_CAUSE_KEYWORDS = [
    '破袋', 'ピンホール', '印刷不良', '色ブレ', '納期', '遅延', '異物', '寸法', '誤納', '破損', 'シール不良', '異臭'
];

export default function ComplaintsPage() {
    const { selectedFile } = useFile();

    // React Queryでデータ取得（自動キャッシュ）
    const { data: allReports = [], isLoading, error } = useReports(selectedFile || undefined);

    // クレーム関連のレポートを抽出（重複排除）
    const reports = useMemo(() => {
        const uniqueReports = deduplicateReports(allReports);
        const complaintReports = uniqueReports.filter(r =>
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
    const [selectedCauseTag, setSelectedCauseTag] = useState<string>('');
    const [periodFilter, setPeriodFilter] = useState<'all' | '3m' | '6m' | 'year'>('all');

    // 頻出原因タグの集計
    const causeTags = useMemo(() => {
        const counts: { [key: string]: number } = {};
        reports.forEach(r => {
            const text = normalizeSearchText(`${r.商談内容 || ''} ${r.行動内容 || ''}`);
            COMPLAINT_CAUSE_KEYWORDS.forEach(kw => {
                const normKw = normalizeSearchText(kw);
                if (text.includes(normKw)) {
                    counts[kw] = (counts[kw] || 0) + 1;
                }
            });
        });
        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .map(([name, count]) => ({ name, count }));
    }, [reports]);

    // エラー時のtoast表示
    useEffect(() => {
        if (error) {
            toast.error('クレームデータの読み込みに失敗しました');
        }
    }, [error]);

    const filteredReports = useMemo(() => {
        let filtered = reports;

        // 1. 期間フィルター
        if (periodFilter !== 'all') {
            filtered = filtered.filter(r => {
                const days = getDaysSinceDate(r.日付);
                if (days === null) return false;
                if (periodFilter === '3m') return days <= 90;
                if (periodFilter === '6m') return days <= 180;
                if (periodFilter === 'year') return days <= 365;
                return true;
            });
        }

        // 2. 得意先/直送先フィルター
        if (selectedCustomer) {
            if (selectedCustomer.includes('-')) {
                const [code, ddCode] = selectedCustomer.split('-');
                filtered = filtered.filter(r =>
                    String(r.得意先CD) === code && String(r.直送先CD || '') === ddCode
                );
            } else {
                filtered = filtered.filter(r => String(r.得意先CD) === selectedCustomer);
            }
        }

        // 3. 原因タグフィルター
        if (selectedCauseTag) {
            const normTag = normalizeSearchText(selectedCauseTag);
            filtered = filtered.filter(r => {
                const text = normalizeSearchText(`${r.商談内容 || ''} ${r.行動内容 || ''}`);
                return text.includes(normTag);
            });
        }

        // 4. キーワードAND検索
        if (searchTerm.trim()) {
            const terms = searchTerm.trim().split(/\s+/).filter(Boolean).map(normalizeSearchText);
            filtered = filtered.filter(r => {
                const targetValues = [
                    r.得意先CD,
                    r.訪問先名,
                    r.直送先名,
                    r.商談内容,
                    r.面談者,
                    r.次回プラン
                ].map(normalizeSearchText);
                return terms.every(term => targetValues.some(val => val.includes(term)));
            });
        }

        return filtered;
    }, [reports, periodFilter, selectedCustomer, selectedCauseTag, searchTerm]);

    const hasActiveFilters = Boolean(
        searchTerm.trim() || selectedCustomer || selectedCauseTag || periodFilter !== 'all'
    );

    const handleClearAll = () => {
        setSearchTerm('');
        setSelectedCustomer('');
        setSelectedCauseTag('');
        setPeriodFilter('all');
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-semibold text-sf-text">クレーム対応履歴</h1>
            </div>

            {/* 検索・フィルターエリア */}
            <div className="bg-white rounded border border-sf-border shadow-sm p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                    {/* 得意先プルダウン */}
                    <div className="relative md:col-span-4">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <select
                            value={selectedCustomer}
                            onChange={(e) => setSelectedCustomer(e.target.value)}
                            className="w-full pl-8 pr-4 py-1.5 text-xs border border-sf-border rounded focus:outline-none focus:ring-1 focus:ring-sf-light-blue focus:border-sf-light-blue appearance-none bg-white"
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
                    <div className="relative md:col-span-5">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="商談内容、面談者、次回プラン（複数語AND検索）..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-8 pr-8 py-1.5 text-xs border border-sf-border rounded focus:outline-none focus:ring-1 focus:ring-sf-light-blue focus:border-sf-light-blue"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded-full hover:bg-gray-100"
                                title="クリア"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {/* 期間フィルター */}
                    <div className="relative md:col-span-2">
                        <div className="flex items-center gap-1">
                            <Calendar size={14} className="text-gray-400 shrink-0" />
                            <select
                                value={periodFilter}
                                onChange={(e) => setPeriodFilter(e.target.value as any)}
                                className="w-full text-xs border border-sf-border rounded px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-sf-light-blue font-medium"
                            >
                                <option value="all">全期間</option>
                                <option value="3m">直近3ヶ月</option>
                                <option value="6m">直近半年</option>
                                <option value="year">直近1年</option>
                            </select>
                        </div>
                    </div>

                    {/* リセットボタン */}
                    <div className="md:col-span-1 flex justify-end">
                        {hasActiveFilters && (
                            <button
                                type="button"
                                onClick={handleClearAll}
                                className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/80 border border-rose-200 px-2.5 py-1.5 rounded transition-colors font-medium cursor-pointer"
                                title="条件をリセット"
                            >
                                <RotateCcw size={12} />
                                <span>解除</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* 頻出原因タグチップ */}
                {causeTags.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-gray-100 text-xs">
                        <span className="text-[11px] font-bold text-gray-400 flex items-center gap-1 shrink-0">
                            <Tag size={12} />
                            <span>原因別クイック抽出:</span>
                        </span>
                        {causeTags.map(tag => (
                            <button
                                key={tag.name}
                                type="button"
                                onClick={() => setSelectedCauseTag(selectedCauseTag === tag.name ? '' : tag.name)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition cursor-pointer ${
                                    selectedCauseTag === tag.name
                                        ? 'bg-amber-100 border-amber-400 text-amber-950 ring-1 ring-amber-400'
                                        : 'bg-gray-50 hover:bg-amber-50/60 border-gray-200 text-gray-700'
                                }`}
                            >
                                <span>{tag.name}</span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                                    selectedCauseTag === tag.name ? 'bg-amber-200 text-amber-950' : 'bg-gray-200 text-gray-600'
                                }`}>
                                    {tag.count}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
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
