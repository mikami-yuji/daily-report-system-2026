'use client';

import { useEffect, useState, useMemo } from 'react';
import { useFile } from '@/context/FileContext';
import { useReports } from '@/hooks/useQueryHooks';
import { Search, User, Building2, AlertCircle, TrendingDown, Truck, Tag, Calendar, RotateCcw, X } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { normalizeSearchText, getDaysSinceDate, deduplicateReports } from '@/lib/reportUtils';

// 主要な競合候補リスト
const COMMON_COMPETITORS = [
    'トーヨー', '東洋', '三和', 'レンゴー', '朋和', '大日本', '凸版', 'トッパン',
    'ダイパック', '吉村', 'カナエ', '大森', '精華', '旭化成', 'クラレ', '丸紅'
];

export default function CompetitorInfoPage(): React.JSX.Element {
    const { selectedFile } = useFile();

    // React Queryでデータ取得（自動キャッシュ）
    const { data: allReports = [], isLoading, error } = useReports(selectedFile || undefined);

    // 競合他社情報があるレポートを抽出（重複排除）
    const reports = useMemo(() => {
        const uniqueReports = deduplicateReports(allReports);
        const competitorReports = uniqueReports.filter(r =>
            r.競合他社情報 &&
            String(r.競合他社情報).trim() !== '' &&
            String(r.競合他社情報) !== '-'
        );
        // 日付の降順（新しい順）にソート
        return competitorReports.sort((a, b) => {
            const dateA = String(a.日付 || '');
            const dateB = String(b.日付 || '');
            return dateB.localeCompare(dateA);
        });
    }, [allReports]);

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTag, setSelectedTag] = useState<string>('');
    const [periodFilter, setPeriodFilter] = useState<'all' | '3m' | '6m' | 'year'>('all');

    // 頻出競合タグの自動集計
    const competitorTags = useMemo(() => {
        const counts: { [key: string]: number } = {};
        reports.forEach(r => {
            const text = normalizeSearchText(r.競合他社情報);
            COMMON_COMPETITORS.forEach(comp => {
                const normComp = normalizeSearchText(comp);
                if (text.includes(normComp)) {
                    counts[comp] = (counts[comp] || 0) + 1;
                }
            });
        });
        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([name, count]) => ({ name, count }));
    }, [reports]);

    // エラー時のtoast表示
    useEffect(() => {
        if (error) {
            toast.error('競合他社情報の読み込みに失敗しました');
        }
    }, [error]);

    const filteredReports = useMemo(() => {
        let result = reports;

        // 1. 期間フィルター
        if (periodFilter !== 'all') {
            result = result.filter(r => {
                const days = getDaysSinceDate(r.日付);
                if (days === null) return false;
                if (periodFilter === '3m') return days <= 90;
                if (periodFilter === '6m') return days <= 180;
                if (periodFilter === 'year') return days <= 365;
                return true;
            });
        }

        // 2. 競合タグフィルター
        if (selectedTag) {
            const normTag = normalizeSearchText(selectedTag);
            result = result.filter(r => normalizeSearchText(r.競合他社情報).includes(normTag));
        }

        // 3. キーワードAND検索
        if (searchTerm.trim()) {
            const terms = searchTerm.trim().split(/\s+/).filter(Boolean).map(normalizeSearchText);
            result = result.filter(r => {
                const targetValues = [
                    r.得意先CD,
                    r.訪問先名,
                    r.直送先名,
                    r.直送先CD,
                    r.競合他社情報,
                    r.面談者,
                    r.商談内容
                ].map(normalizeSearchText);
                return terms.every(term => targetValues.some(val => val.includes(term)));
            });
        }

        return result;
    }, [reports, periodFilter, selectedTag, searchTerm]);

    const hasActiveFilters = Boolean(searchTerm.trim() || selectedTag || periodFilter !== 'all');

    const handleClearAll = () => {
        setSearchTerm('');
        setSelectedTag('');
        setPeriodFilter('all');
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-semibold text-sf-text">競合他社情報</h1>
            </div>

            {/* 検索・フィルターエリア */}
            <div className="bg-white rounded border border-sf-border shadow-sm p-4 space-y-3">
                <div className="flex flex-col md:flex-row gap-3 items-center">
                    {/* キーワード検索 */}
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="得意先、直送先、競合名、商談内容（複数語AND検索）..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-9 py-2 text-xs border border-sf-border rounded focus:outline-none focus:ring-1 focus:ring-sf-light-blue focus:border-sf-light-blue"
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
                    <div className="flex items-center gap-1.5 w-full md:w-auto">
                        <Calendar size={16} className="text-gray-400 shrink-0" />
                        <select
                            value={periodFilter}
                            onChange={(e) => setPeriodFilter(e.target.value as 'all' | '3m' | '6m' | 'year')}
                            className="text-xs border border-sf-border rounded px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-sf-light-blue focus:border-sf-light-blue font-medium"
                        >
                            <option value="all">全期間</option>
                            <option value="3m">直近3ヶ月</option>
                            <option value="6m">直近半年</option>
                            <option value="year">直近1年</option>
                        </select>
                    </div>

                    {/* クリアボタン */}
                    {hasActiveFilters && (
                        <button
                            type="button"
                            onClick={handleClearAll}
                            className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/80 border border-rose-200 px-3 py-2 rounded transition-colors font-medium shrink-0 cursor-pointer"
                        >
                            <RotateCcw size={13} />
                            <span>リセット</span>
                        </button>
                    )}
                </div>

                {/* 頻出競合タグチップ */}
                {competitorTags.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-gray-100 text-xs">
                        <span className="text-[11px] font-bold text-gray-400 flex items-center gap-1 shrink-0">
                            <Tag size={12} />
                            <span>頻出競合タグ:</span>
                        </span>
                        {competitorTags.map(tag => (
                            <button
                                key={tag.name}
                                type="button"
                                onClick={() => setSelectedTag(selectedTag === tag.name ? '' : tag.name)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition cursor-pointer ${
                                    selectedTag === tag.name
                                        ? 'bg-rose-100 border-rose-400 text-rose-950 ring-1 ring-rose-400'
                                        : 'bg-gray-50 hover:bg-rose-50/60 border-gray-200 text-gray-700'
                                }`}
                            >
                                <span>{tag.name}</span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                                    selectedTag === tag.name ? 'bg-rose-200 text-rose-950' : 'bg-gray-200 text-gray-600'
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
                    <p className="text-sm text-sf-text-weak mb-1">総情報件数</p>
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
                    <h2 className="font-semibold text-sm text-sf-text">競合他社情報タイムライン</h2>
                </div>

                {isLoading ? (
                    <div className="p-8 text-center text-sf-text-weak">読み込み中...</div>
                ) : filteredReports.length === 0 ? (
                    <div className="p-8 text-center text-sf-text-weak">
                        {searchTerm ? '検索結果が見つかりません' : '競合他社情報が見つかりません'}
                    </div>
                ) : (
                    <div className="p-4 space-y-4">
                        {filteredReports.map((report, idx) => (
                            <div
                                key={idx}
                                className="bg-white p-4 rounded border border-sf-border shadow-sm hover:shadow-md transition-shadow relative pl-12"
                            >
                                <div className="absolute left-4 top-4 flex flex-col items-center h-full">
                                    <div className="bg-red-100 p-1.5 rounded-full border border-red-200 z-10">
                                        <AlertCircle size={16} className="text-red-600" />
                                    </div>
                                    {idx !== filteredReports.length - 1 && (
                                        <div className="w-px bg-gray-200 h-full absolute top-8"></div>
                                    )}
                                </div>

                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-sf-text">{report.日付}</span>
                                        <span className="text-sm text-sf-text-weak bg-gray-100 px-2 py-0.5 rounded">
                                            {report.行動内容}
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
                                    {report.直送先名 && (
                                        <div className="flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 mt-1 ml-6 w-fit">
                                            <Truck size={13} className="text-blue-500" />
                                            <span>直送先: {report.直送先名} {report.直送先CD ? `(${report.直送先CD})` : ''}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="bg-red-50 border border-red-200 rounded p-3">
                                    <div className="flex items-start gap-2">
                                        <TrendingDown size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <p className="text-xs font-semibold text-red-800 mb-1">競合他社情報</p>
                                            <p className="text-sm text-sf-text whitespace-pre-wrap">{report.競合他社情報}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
