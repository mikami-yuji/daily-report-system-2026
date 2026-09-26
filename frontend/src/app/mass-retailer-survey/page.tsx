'use client';

import { useEffect, useState, useMemo } from 'react';
import { useFile } from '@/context/FileContext';
import { useReports } from '@/hooks/useQueryHooks';
import { Search, MapPin, Calendar, Building2, Tag, ShoppingBag, RotateCcw, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { normalizeSearchText, getDaysSinceDate, deduplicateReports } from '@/lib/reportUtils';

// 主要スーパー・量販店チェーン候補
const COMMON_CHAINS = [
    'イオン', 'ライフ', '万代', '平和堂', 'イズミヤ', 'オークワ', 'マルエツ', 
    'マックスバリュ', 'ダイエー', '西友', 'コノミヤ', 'バロー', 'ヤオコー', 
    'サミット', '関西スーパー', 'サンディ', '業務スーパー', 'カスミ'
];

// 調査トピックキーワード
const SURVEY_TOPICS = ['新米', '特売', 'PB', 'NB', '値上げ', 'コシヒカリ', '無洗米', '陳列'];

export default function MassRetailerSurveyPage(): React.JSX.Element {
    const { selectedFile } = useFile();

    // React Queryでデータ取得（自動キャッシュ）
    const { data: allReports = [], isLoading, error } = useReports(selectedFile || undefined);

    // 量販店調査レポートを抽出（重複排除）
    const reports = useMemo(() => {
        return deduplicateReports(allReports).filter(report => {
            const action = String(report.行動内容 || '');
            return action.includes('量販店調査');
        });
    }, [allReports]);

    // エリア一覧を抽出
    const areas = useMemo(() => {
        return Array.from(new Set(
            reports
                .map(r => r.エリア)
                .filter(area => area && area !== '')
        )).sort();
    }, [reports]);

    const [keyword, setKeyword] = useState('');
    const [selectedArea, setSelectedArea] = useState<string>('all');
    const [selectedChain, setSelectedChain] = useState<string>('');
    const [selectedTopic, setSelectedTopic] = useState<string>('');
    const [periodFilter, setPeriodFilter] = useState<'all' | '3m' | '6m' | 'year'>('all');

    // チェーン別該当件数の集計
    const chainCounts = useMemo(() => {
        const counts: { [key: string]: number } = {};
        reports.forEach(r => {
            const text = normalizeSearchText(`${r.訪問先名 || ''} ${r.商談内容 || ''} ${r.行動内容 || ''}`);
            COMMON_CHAINS.forEach(chain => {
                if (text.includes(normalizeSearchText(chain))) {
                    counts[chain] = (counts[chain] || 0) + 1;
                }
            });
        });
        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .filter(([_, count]) => count > 0)
            .slice(0, 10)
            .map(([name, count]) => ({ name, count }));
    }, [reports]);

    // トピック別該当件数の集計
    const topicCounts = useMemo(() => {
        const counts: { [key: string]: number } = {};
        reports.forEach(r => {
            const text = normalizeSearchText(`${r.商談内容 || ''} ${r.上長コメント || ''} ${r.コメント返信欄 || ''}`);
            SURVEY_TOPICS.forEach(topic => {
                if (text.includes(normalizeSearchText(topic))) {
                    counts[topic] = (counts[topic] || 0) + 1;
                }
            });
        });
        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .filter(([_, count]) => count > 0)
            .map(([name, count]) => ({ name, count }));
    }, [reports]);

    // エラー時のtoast表示
    useEffect(() => {
        if (error) {
            toast.error('量販店調査データの読み込みに失敗しました');
        }
    }, [error]);

    const filteredReports = useMemo(() => {
        let filtered = [...reports];

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

        // 2. エリアフィルター
        if (selectedArea !== 'all') {
            filtered = filtered.filter(report => report.エリア === selectedArea);
        }

        // 3. チェーンフィルター
        if (selectedChain) {
            const normChain = normalizeSearchText(selectedChain);
            filtered = filtered.filter(r => {
                const text = normalizeSearchText(`${r.訪問先名 || ''} ${r.商談内容 || ''} ${r.行動内容 || ''}`);
                return text.includes(normChain);
            });
        }

        // 4. トピックフィルター
        if (selectedTopic) {
            const normTopic = normalizeSearchText(selectedTopic);
            filtered = filtered.filter(r => {
                const text = normalizeSearchText(`${r.商談内容 || ''} ${r.上長コメント || ''} ${r.コメント返信欄 || ''}`);
                return text.includes(normTopic);
            });
        }

        // 5. キーワードAND検索
        if (keyword.trim()) {
            const terms = keyword.trim().split(/\s+/).filter(Boolean).map(normalizeSearchText);
            filtered = filtered.filter(report => {
                const targetValues = [
                    report.訪問先名,
                    report.商談内容,
                    report.上長コメント,
                    report.コメント返信欄,
                    report.エリア,
                    report.行動内容
                ].map(normalizeSearchText);
                return terms.every(term => targetValues.some(val => val.includes(term)));
            });
        }

        // ソート（新しい順）
        filtered.sort((a, b) => {
            const dateA = a.日付 || '';
            const dateB = b.日付 || '';
            return dateB.localeCompare(dateA);
        });

        return filtered;
    }, [reports, periodFilter, selectedArea, selectedChain, selectedTopic, keyword]);

    const hasActiveFilters = Boolean(
        keyword.trim() || selectedArea !== 'all' || selectedChain || selectedTopic || periodFilter !== 'all'
    );

    const handleClearAll = () => {
        setKeyword('');
        setSelectedArea('all');
        setSelectedChain('');
        setSelectedTopic('');
        setPeriodFilter('all');
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen flex-col">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sf-light-blue mx-auto mb-4"></div>
                    <p className="text-sf-text-weak">データを読み込んでいます...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">量販店調査検索</h1>
                <p className="text-gray-600">量販店調査レポートの検索と閲覧</p>
            </div>

            {/* Search and Filter Controls */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 mb-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                    {/* キーワード検索 */}
                    <div className="relative md:col-span-5">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                            placeholder="店舗名・商談内容・特売（複数語AND検索対応）..."
                            className="w-full pl-9 pr-8 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-sf-light-blue focus:border-sf-light-blue outline-none"
                        />
                        {keyword && (
                            <button
                                onClick={() => setKeyword('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded-full hover:bg-gray-100"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {/* エリア */}
                    <div className="relative md:col-span-3">
                        <div className="flex items-center">
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <select
                                value={selectedArea}
                                onChange={(e) => setSelectedArea(e.target.value)}
                                className="w-full pl-8 pr-4 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-sf-light-blue focus:border-sf-light-blue outline-none bg-white font-medium"
                            >
                                <option value="all">すべてのエリア</option>
                                {areas.map(area => (
                                    <option key={area} value={area}>{area}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* 期間 */}
                    <div className="relative md:col-span-3">
                        <div className="flex items-center">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <select
                                value={periodFilter}
                                onChange={(e) => setPeriodFilter(e.target.value as 'all' | '3m' | '6m' | 'year')}
                                className="w-full pl-8 pr-4 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-sf-light-blue focus:border-sf-light-blue outline-none bg-white font-medium"
                            >
                                <option value="all">全期間</option>
                                <option value="3m">直近3ヶ月</option>
                                <option value="6m">直近半年</option>
                                <option value="year">直近1年</option>
                            </select>
                        </div>
                    </div>

                    {/* リセット */}
                    <div className="md:col-span-1 flex justify-end">
                        {hasActiveFilters && (
                            <button
                                type="button"
                                onClick={handleClearAll}
                                className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/80 border border-rose-200 px-2.5 py-2 rounded-lg transition-colors font-medium cursor-pointer"
                                title="条件をリセット"
                            >
                                <RotateCcw size={13} />
                                <span>解除</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* チェーン別クイックチップ */}
                {chainCounts.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-gray-100 text-xs">
                        <span className="text-[11px] font-bold text-gray-400 flex items-center gap-1 shrink-0">
                            <ShoppingBag size={12} />
                            <span>主要チェーン:</span>
                        </span>
                        {chainCounts.map(chain => (
                            <button
                                key={chain.name}
                                type="button"
                                onClick={() => setSelectedChain(selectedChain === chain.name ? '' : chain.name)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition cursor-pointer ${
                                    selectedChain === chain.name
                                        ? 'bg-blue-100 border-blue-400 text-blue-950 ring-1 ring-blue-400'
                                        : 'bg-gray-50 hover:bg-blue-50/60 border-gray-200 text-gray-700'
                                }`}
                            >
                                <span>{chain.name}</span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                                    selectedChain === chain.name ? 'bg-blue-200 text-blue-950' : 'bg-gray-200 text-gray-600'
                                }`}>
                                    {chain.count}
                                </span>
                            </button>
                        ))}
                    </div>
                )}

                {/* トピック別チップ */}
                {topicCounts.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-gray-50 text-xs">
                        <span className="text-[11px] font-bold text-gray-400 flex items-center gap-1 shrink-0">
                            <Tag size={12} />
                            <span>注目トピック:</span>
                        </span>
                        {topicCounts.map(topic => (
                            <button
                                key={topic.name}
                                type="button"
                                onClick={() => setSelectedTopic(selectedTopic === topic.name ? '' : topic.name)}
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border transition cursor-pointer ${
                                    selectedTopic === topic.name
                                        ? 'bg-emerald-100 border-emerald-400 text-emerald-950 ring-1 ring-emerald-400'
                                        : 'bg-gray-50 hover:bg-emerald-50/60 border-gray-200 text-gray-600'
                                }`}
                            >
                                <span>#{topic.name}</span>
                                <span className="text-[10px] text-gray-500">
                                    ({topic.count})
                                </span>
                            </button>
                        ))}
                    </div>
                )}

                {/* Results Count */}
                <div className="pt-2 border-t border-gray-100 flex justify-between items-center text-xs text-gray-500">
                    <p>
                        表示中: <span className="font-bold text-sf-light-blue text-sm">{filteredReports.length}</span> / 全 {reports.length} 件の調査レポート
                    </p>
                </div>
            </div>

            {/* Timeline Display */}
            <div className="space-y-4">
                {filteredReports.length === 0 ? (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                        <Building2 className="mx-auto text-gray-400 mb-4" size={48} />
                        <p className="text-gray-600">該当する調査レポートがありません</p>
                        <p className="text-sm text-gray-500 mt-2">検索条件を変更してください</p>
                    </div>
                ) : (
                    filteredReports.map((report, index) => (
                        <div
                            key={index}
                            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
                        >
                            {/* Header */}
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                                        {report.訪問先名 || '訪問先不明'}
                                    </h3>
                                    <div className="flex items-center gap-4 text-sm text-gray-600">
                                        <div className="flex items-center gap-1">
                                            <Calendar size={14} />
                                            <span>{report.日付}</span>
                                        </div>
                                        {report.エリア && (
                                            <div className="flex items-center gap-1">
                                                <MapPin size={14} />
                                                <span>{report.エリア}</span>
                                            </div>
                                        )}
                                        {report.面談者 && (
                                            <span className="text-gray-500">担当: {report.面談者}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                                        量販店調査
                                    </span>
                                    {report.管理番号 && (
                                        <p className="text-xs text-gray-500 mt-1">No. {report.管理番号}</p>
                                    )}
                                </div>
                            </div>

                            {/* Content */}
                            {report.上長コメント && (
                                <div className="mb-3">
                                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">上長コメント</h4>
                                    <div className="bg-gray-50 rounded-lg p-4">
                                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{report.上長コメント}</p>
                                    </div>
                                </div>
                            )}

                            {/* 商談内容 */}
                            {report.商談内容 && (
                                <div className="mb-3">
                                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">商談内容</h4>
                                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{report.商談内容}</p>
                                    </div>
                                </div>
                            )}

                            {/* Additional Info */}
                            <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                {report.ランク && (
                                    <div>
                                        <span className="text-gray-500">ランク:</span>
                                        <span className="ml-2 font-medium text-gray-900">{report.ランク}</span>
                                    </div>
                                )}
                                {report.重点顧客 && report.重点顧客 !== '-' && (
                                    <div>
                                        <span className="text-gray-500">重点顧客:</span>
                                        <span className="ml-2 font-medium text-orange-600">{report.重点顧客}</span>
                                    </div>
                                )}
                                {report.デザイン提案有無 && (
                                    <div>
                                        <span className="text-gray-500">デザイン提案:</span>
                                        <span className={`ml-2 font-medium ${report.デザイン提案有無 === 'あり' ? 'text-purple-600' : 'text-gray-600'}`}>
                                            {report.デザイン提案有無}
                                        </span>
                                    </div>
                                )}
                                {report.デザイン進捗状況 && (
                                    <div>
                                        <span className="text-gray-500">進捗:</span>
                                        <span className="ml-2 font-medium text-gray-900">{report.デザイン進捗状況}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
