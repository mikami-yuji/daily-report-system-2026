import React from 'react';
import { Search, MapPin, TrendingUp, X } from 'lucide-react';

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
};

export default function CustomerFilters({
    searchTerm, setSearchTerm,
    selectedArea, setSelectedArea,
    selectedRank, setSelectedRank,
    isPriorityOnly, setIsPriorityOnly,
    areas, ranks
}: CustomerFiltersProps) {
    return (
        <div className="bg-white rounded border border-sf-border shadow-sm p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="得意先、直送先..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-10 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue focus:border-transparent"
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
                            title="検索条件をクリア"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>

                <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <select
                        value={selectedArea}
                        onChange={(e) => setSelectedArea(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue focus:border-transparent appearance-none bg-white"
                        aria-label="エリアで絞り込み"
                    >
                        <option value="">すべてのエリア</option>
                        {areas.map(area => (
                            <option key={area} value={area}>{area}</option>
                        ))}
                    </select>
                </div>

                <div className="relative">
                    <TrendingUp className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <select
                        value={selectedRank}
                        onChange={(e) => setSelectedRank(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue focus:border-transparent appearance-none bg-white"
                        aria-label="ランクで絞り込み"
                    >
                        <option value="">すべてのランク</option>
                        {ranks.map(rank => (
                            <option key={rank} value={rank}>{rank}</option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={isPriorityOnly}
                            onChange={(e) => setIsPriorityOnly(e.target.checked)}
                            className="w-4 h-4 text-sf-light-blue border-gray-300 rounded focus:ring-sf-light-blue"
                        />
                        <span className="text-sm text-sf-text">重点顧客のみ表示</span>
                    </label>
                </div>
            </div>
        </div>
    );
}
