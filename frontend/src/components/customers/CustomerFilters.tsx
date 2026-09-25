import React from 'react';
import { Search, MapPin, TrendingUp, X, ArrowUpDown, AlertCircle, AlertTriangle, Star, RotateCcw, Filter } from 'lucide-react';

export type CustomerSortKey = 'code' | 'name' | 'lastActivity' | 'visits' | 'totalActivities';
export type InactiveFilterType = 'all' | 'inactive30' | 'inactive60' | 'priority_unvisited';

type CustomerFiltersProps = {
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    selectedArea: string;
    setSelectedArea: (area: string) => void;
    selectedRank: string;
    setSelectedRank: (rank: string) => void;
    isPriorityOnly: boolean;
    setIsPriorityOnly: (isPriority: boolean) => void;
    areas: string[];
    ranks: string[];
    sortKey: CustomerSortKey;
    sortOrder: 'asc' | 'desc';
    onSortChange: (key: CustomerSortKey, order: 'asc' | 'desc') => void;
    inactiveFilter: InactiveFilterType;
    setInactiveFilter: (filter: InactiveFilterType) => void;
    counts?: {
        inactive30: number;
        inactive60: number;
        priorityUnvisited: number;
    };
    onClearFilters: () => void;
    hasActiveFilters: boolean;
};

export default function CustomerFilters({
    searchTerm, setSearchTerm,
    selectedArea, setSelectedArea,
    selectedRank, setSelectedRank,
    isPriorityOnly, setIsPriorityOnly,
    areas, ranks,
    sortKey, sortOrder, onSortChange,
    inactiveFilter, setInactiveFilter,
    counts = { inactive30: 0, inactive60: 0, priorityUnvisited: 0 },
    onClearFilters,
    hasActiveFilters
}: CustomerFiltersProps) {
    return (
        <div className="bg-white rounded border border-sf-border shadow-sm p-4 space-y-3">
            {/* 1段目: 検索・エリア・ランク・重点 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="得意先名・CD・直送先（複数語AND検索対応）..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-9 py-1.5 text-xs border border-sf-border rounded focus:outline-none focus:ring-1 focus:ring-sf-light-blue focus:border-sf-light-blue text-sf-text"
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded-full hover:bg-gray-100 transition-colors"
                            title="検索条件をクリア"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>

                <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <select
                        value={selectedArea}
                        onChange={(e) => setSelectedArea(e.target.value)}
                        className="w-full pl-8 pr-4 py-1.5 text-xs border border-sf-border rounded focus:outline-none focus:ring-1 focus:ring-sf-light-blue focus:border-sf-light-blue bg-white text-sf-text"
                        aria-label="エリアで絞り込み"
                    >
                        <option value="">すべてのエリア</option>
                        {areas.map(area => (
                            <option key={area} value={area}>{area}</option>
                        ))}
                    </select>
                </div>

                <div className="relative">
                    <TrendingUp className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <select
                        value={selectedRank}
                        onChange={(e) => setSelectedRank(e.target.value)}
                        className="w-full pl-8 pr-4 py-1.5 text-xs border border-sf-border rounded focus:outline-none focus:ring-1 focus:ring-sf-light-blue focus:border-sf-light-blue bg-white text-sf-text"
                        aria-label="ランクで絞り込み"
                    >
                        <option value="">すべてのランク</option>
                        {ranks.map(rank => (
                            <option key={rank} value={rank}>{rank}</option>
                        ))}
                    </select>
                </div>

                {/* 並び替えセレクター */}
                <div className="relative">
                    <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <select
                        value={`${sortKey}_${sortOrder}`}
                        onChange={(e) => {
                            const [key, order] = e.target.value.split('_') as [CustomerSortKey, 'asc' | 'desc'];
                            onSortChange(key, order);
                        }}
                        className="w-full pl-8 pr-4 py-1.5 text-xs border border-sf-border rounded focus:outline-none focus:ring-1 focus:ring-sf-light-blue focus:border-sf-light-blue bg-white text-sf-text font-medium"
                        aria-label="並び替え順序"
                    >
                        <option value="lastActivity_desc">最終活動日: 新しい順</option>
                        <option value="lastActivity_asc">最終活動日: 古い順 (ご無沙汰順)</option>
                        <option value="visits_desc">訪問回数: 多い順</option>
                        <option value="visits_asc">訪問回数: 少ない順</option>
                        <option value="totalActivities_desc">総活動数: 多い順</option>
                        <option value="code_asc">得意先CD: 昇順</option>
                        <option value="name_asc">得意先名: 五十音順</option>
                    </select>
                </div>
            </div>

            {/* 2段目: ご無沙汰・要フォロークイックフィルターチップ ＆ 条件クリア */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold text-gray-400 flex items-center gap-1 shrink-0">
                        <Filter size={12} />
                        <span>活動状況抽出:</span>
                    </span>

                    {/* 重点顧客トグル */}
                    <button
                        type="button"
                        onClick={() => setIsPriorityOnly(!isPriorityOnly)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition cursor-pointer ${
                            isPriorityOnly
                                ? 'bg-yellow-100 border-yellow-400 text-yellow-950 ring-1 ring-yellow-400'
                                : 'bg-gray-50 hover:bg-yellow-50/60 border-gray-200 text-gray-700'
                        }`}
                    >
                        <Star size={13} className={isPriorityOnly ? 'text-yellow-700 fill-yellow-500' : 'text-yellow-500'} />
                        <span>重点顧客のみ</span>
                    </button>

                    {/* ⚠️ 30日以上未訪問 */}
                    <button
                        type="button"
                        onClick={() => setInactiveFilter(inactiveFilter === 'inactive30' ? 'all' : 'inactive30')}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition cursor-pointer ${
                            inactiveFilter === 'inactive30'
                                ? 'bg-amber-100 border-amber-400 text-amber-950 ring-1 ring-amber-400'
                                : 'bg-gray-50 hover:bg-amber-50/60 border-gray-200 text-gray-700'
                        }`}
                        title="最終活動から30日以上経過している顧客を抽出"
                    >
                        <AlertCircle size={13} className={inactiveFilter === 'inactive30' ? 'text-amber-700' : 'text-amber-500'} />
                        <span>30日以上ご無沙汰</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                            inactiveFilter === 'inactive30' ? 'bg-amber-200 text-amber-950' : 'bg-gray-200 text-gray-600'
                        }`}>
                            {counts.inactive30}
                        </span>
                    </button>

                    {/* 🚨 60日以上未訪問 */}
                    <button
                        type="button"
                        onClick={() => setInactiveFilter(inactiveFilter === 'inactive60' ? 'all' : 'inactive60')}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition cursor-pointer ${
                            inactiveFilter === 'inactive60'
                                ? 'bg-rose-100 border-rose-400 text-rose-950 ring-1 ring-rose-400'
                                : 'bg-gray-50 hover:bg-rose-50/60 border-gray-200 text-gray-700'
                        }`}
                        title="最終活動から60日以上経過している要フォロー顧客を抽出"
                    >
                        <AlertTriangle size={13} className={inactiveFilter === 'inactive60' ? 'text-rose-700' : 'text-rose-500'} />
                        <span>60日以上放置</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                            inactiveFilter === 'inactive60' ? 'bg-rose-200 text-rose-950' : 'bg-gray-200 text-gray-600'
                        }`}>
                            {counts.inactive60}
                        </span>
                    </button>

                    {/* ★ 未訪問の重点顧客 */}
                    <button
                        type="button"
                        onClick={() => setInactiveFilter(inactiveFilter === 'priority_unvisited' ? 'all' : 'priority_unvisited')}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition cursor-pointer ${
                            inactiveFilter === 'priority_unvisited'
                                ? 'bg-orange-100 border-orange-400 text-orange-950 ring-1 ring-orange-400'
                                : 'bg-gray-50 hover:bg-orange-50/60 border-gray-200 text-gray-700'
                        }`}
                        title="直近30日以内に接触のない重点顧客を抽出"
                    >
                        <Star size={13} className={inactiveFilter === 'priority_unvisited' ? 'text-orange-700 fill-orange-500' : 'text-orange-500'} />
                        <span>要フォロー重点顧客</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                            inactiveFilter === 'priority_unvisited' ? 'bg-orange-200 text-orange-950' : 'bg-gray-200 text-gray-600'
                        }`}>
                            {counts.priorityUnvisited}
                        </span>
                    </button>
                </div>

                {hasActiveFilters && (
                    <button
                        type="button"
                        onClick={onClearFilters}
                        className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/80 border border-rose-200 px-2.5 py-1 rounded transition-colors font-medium cursor-pointer ml-auto"
                        title="すべてのフィルターと検索をクリア"
                    >
                        <RotateCcw size={13} />
                        <span>条件クリア</span>
                    </button>
                )}
            </div>
        </div>
    );
}
