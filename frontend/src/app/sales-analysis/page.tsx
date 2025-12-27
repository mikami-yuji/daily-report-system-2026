'use client';

import { useEffect, useState, useMemo } from 'react';
import { getAllSales, SalesData } from '@/lib/api';
import SalesTable from '@/components/sales/SalesTable';
import { Search, RotateCcw } from 'lucide-react';

export default function SalesAnalysisPage() {
    const [salesData, setSalesData] = useState<SalesData[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Sort State
    const [sortField, setSortField] = useState<keyof SalesData>('sales_amount');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    useEffect(() => {
        loadData();
    }, []);

    const extractPrefecture = (address: string | null | undefined): string | undefined => {
        if (!address) return undefined;
        // Match up to the first occurrence of To, Do, Fu, Ken
        const match = address.match(/^.*?[都道府県]/);
        return match ? match[0] : address;
    };

    const loadData = async () => {
        setLoading(true);
        const data = await getAllSales();
        // Transform area to prefecture only
        const processedData = data.map(item => ({
            ...item,
            area: extractPrefecture(item.area)
        }));
        setSalesData(processedData);
        setLoading(false);
    };

    const [filterRank, setFilterRank] = useState('all');
    const [filterArea, setFilterArea] = useState('all');
    const [filterSalesRep, setFilterSalesRep] = useState('all');  // 担当者フィルター

    // ページネーション
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;

    // 各フィルターに対して、他のフィルターが適用されたデータからユニーク値を取得（連動フィルター）
    const uniqueRanks = useMemo(() => {
        let data = salesData;
        if (filterArea !== 'all') data = data.filter(d => d.area === filterArea);
        if (filterSalesRep !== 'all') data = data.filter(d => d.sales_rep === filterSalesRep);
        const ranks = new Set(data.map(d => d.rank_class).filter(Boolean));
        return Array.from(ranks).sort((a, b) => a.localeCompare(b, 'ja'));
    }, [salesData, filterArea, filterSalesRep]);

    const uniqueAreas = useMemo(() => {
        let data = salesData;
        if (filterRank !== 'all') data = data.filter(d => d.rank_class === filterRank);
        if (filterSalesRep !== 'all') data = data.filter(d => d.sales_rep === filterSalesRep);
        const areas = new Set(data.map(d => d.area).filter(d => d && d !== 'null' && d !== 'None'));
        return Array.from(areas).sort((a, b) => a!.localeCompare(b!, 'ja'));
    }, [salesData, filterRank, filterSalesRep]);

    const uniqueSalesReps = useMemo(() => {
        let data = salesData;
        if (filterRank !== 'all') data = data.filter(d => d.rank_class === filterRank);
        if (filterArea !== 'all') data = data.filter(d => d.area === filterArea);
        const reps = new Set(data.map(d => d.sales_rep).filter(d => d && d !== 'null' && d !== 'None'));
        return Array.from(reps).sort((a, b) => a!.localeCompare(b!, 'ja'));
    }, [salesData, filterRank, filterArea]);

    const handleSort = (field: keyof SalesData) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    const filteredAndSortedData = useMemo(() => {
        if (!Array.isArray(salesData)) return [];
        let result = [...salesData];

        // Filter
        if (filterRank !== 'all') {
            result = result.filter(item => item.rank_class === filterRank);
        }
        if (filterArea !== 'all') {
            result = result.filter(item => item.area === filterArea);
        }
        if (filterSalesRep !== 'all') {
            result = result.filter(item => item.sales_rep === filterSalesRep);
        }

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(item =>
                (item.customer_name && item.customer_name.toLowerCase().includes(term)) ||
                (item.customer_code && item.customer_code.toLowerCase().includes(term))
            );
        }

        // Sort
        result.sort((a, b) => {
            const valA = a[sortField];
            const valB = b[sortField];

            if (valA === null || valA === undefined) return 1;
            if (valB === null || valB === undefined) return -1;

            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    }, [salesData, searchTerm, sortField, sortDirection, filterRank, filterArea, filterSalesRep]);

    // ページネーション計算
    const totalPages = Math.ceil(filteredAndSortedData.length / itemsPerPage);
    const paginatedData = filteredAndSortedData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // フィルター変更時にページをリセット
    useEffect(() => {
        setCurrentPage(1);
    }, [filterRank, filterArea, filterSalesRep, searchTerm]);

    // 合計計算（フィルター適用後のデータ）
    const totals = useMemo(() => {
        const sales = filteredAndSortedData.reduce((sum, item) => sum + (item.sales_amount || 0), 0);
        const profit = filteredAndSortedData.reduce((sum, item) => sum + (item.gross_profit || 0), 0);
        const salesLastYear = filteredAndSortedData.reduce((sum, item) => sum + (item.sales_last_year || 0), 0);
        const profitLastYear = filteredAndSortedData.reduce((sum, item) => sum + (item.profit_last_year || 0), 0);
        const salesYoY = salesLastYear > 0 ? ((sales - salesLastYear) / salesLastYear * 100) : 0;
        const profitYoY = profitLastYear > 0 ? ((profit - profitLastYear) / profitLastYear * 100) : 0;
        return { sales, profit, salesLastYear, profitLastYear, salesYoY, profitYoY };
    }, [filteredAndSortedData]);

    // 金額フォーマット
    const formatCurrency = (value: number) => {
        if (value >= 100000000) {
            return `${(value / 100000000).toFixed(1)}億`;
        } else if (value >= 10000) {
            return `${Math.round(value / 10000).toLocaleString()}万`;
        }
        return value.toLocaleString();
    };


    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center bg-white p-6 rounded-lg shadow-sm border border-sf-border mb-4">
                <div>
                    <h1 className="text-2xl font-bold text-sf-text">売上分析</h1>
                    <p className="text-sm text-sf-text-weak mt-1">
                        全得意先の売上・粗利・前年比を分析します。
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={loadData}
                        className="p-2 text-sf-light-blue hover:bg-blue-50 rounded-full transition-colors"
                        title="データを更新"
                    >
                        <RotateCcw size={20} />
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* 今年売上 */}
                <div className="bg-white p-4 rounded-lg border border-sf-border shadow-sm">
                    <div className="text-xs text-gray-500 mb-1">売上合計（今年）</div>
                    <div className="text-xl font-bold text-sf-text">{formatCurrency(totals.sales)}円</div>
                    <div className={`text-xs mt-1 ${totals.salesYoY >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        前年比 {totals.salesYoY >= 0 ? '+' : ''}{totals.salesYoY.toFixed(1)}%
                    </div>
                </div>
                {/* 前年売上 */}
                <div className="bg-white p-4 rounded-lg border border-sf-border shadow-sm">
                    <div className="text-xs text-gray-500 mb-1">売上合計（前年）</div>
                    <div className="text-xl font-bold text-gray-500">{formatCurrency(totals.salesLastYear)}円</div>
                    <div className="text-xs mt-1 text-gray-400">
                        差額 {totals.sales - totals.salesLastYear >= 0 ? '+' : ''}{formatCurrency(totals.sales - totals.salesLastYear)}円
                    </div>
                </div>
                {/* 今年粗利 */}
                <div className="bg-white p-4 rounded-lg border border-sf-border shadow-sm">
                    <div className="text-xs text-gray-500 mb-1">粗利合計（今年）</div>
                    <div className="text-xl font-bold text-emerald-600">{formatCurrency(totals.profit)}円</div>
                    <div className={`text-xs mt-1 ${totals.profitYoY >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        前年比 {totals.profitYoY >= 0 ? '+' : ''}{totals.profitYoY.toFixed(1)}%
                    </div>
                </div>
                {/* 前年粗利 */}
                <div className="bg-white p-4 rounded-lg border border-sf-border shadow-sm">
                    <div className="text-xs text-gray-500 mb-1">粗利合計（前年）</div>
                    <div className="text-xl font-bold text-gray-500">{formatCurrency(totals.profitLastYear)}円</div>
                    <div className="text-xs mt-1 text-gray-400">
                        差額 {totals.profit - totals.profitLastYear >= 0 ? '+' : ''}{formatCurrency(totals.profit - totals.profitLastYear)}円
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-lg border border-sf-border shadow-sm flex flex-wrap items-center gap-4">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="得意先名、またはコードで検索..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue/20 transition-all"
                    />
                </div>

                {/* Rank Filter */}
                <select
                    value={filterRank}
                    onChange={(e) => setFilterRank(e.target.value)}
                    className="border border-sf-border rounded px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-sf-light-blue/20"
                >
                    <option value="all">全ランク</option>
                    {uniqueRanks.map(r => (
                        <option key={r} value={r}>{r}</option>
                    ))}
                </select>

                {/* Area Filter */}
                <select
                    value={filterArea}
                    onChange={(e) => setFilterArea(e.target.value)}
                    className="border border-sf-border rounded px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-sf-light-blue/20"
                    disabled={uniqueAreas.length === 0}
                >
                    <option value="all">全エリア</option>
                    {uniqueAreas.length > 0 ? (
                        uniqueAreas.map(a => (
                            <option key={a} value={a}>{a}</option>
                        ))
                    ) : (
                        <option disabled>エリア情報なし</option>
                    )}
                </select>

                {/* Sales Rep Filter */}
                <select
                    value={filterSalesRep}
                    onChange={(e) => setFilterSalesRep(e.target.value)}
                    className="border border-sf-border rounded px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-sf-light-blue/20"
                    disabled={uniqueSalesReps.length === 0}
                >
                    <option value="all">全担当者</option>
                    {uniqueSalesReps.length > 0 ? (
                        uniqueSalesReps.map(rep => (
                            <option key={rep} value={rep}>{rep}</option>
                        ))
                    ) : (
                        <option disabled>担当者情報なし</option>
                    )}
                </select>

                <div className="text-sm text-gray-500 whitespace-nowrap">
                    {filteredAndSortedData.length} 件
                </div>
            </div>

            {/* Table */}
            {loading ? (
                <div className="text-center py-20 text-gray-400">
                    データを読み込み中...
                </div>
            ) : (
                <SalesTable
                    data={paginatedData}
                    sortField={sortField}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                />
            )}

            {/* ページネーション */}
            {totalPages > 1 && (
                <div className="p-3 bg-white border border-sf-border rounded flex justify-center items-center gap-2">
                    <button
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="px-3 py-1 rounded border border-gray-300 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                    >
                        ««
                    </button>
                    <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 rounded border border-gray-300 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                    >
                        «
                    </button>
                    <span className="px-4 text-sm text-sf-text">
                        {currentPage} / {totalPages} ページ
                    </span>
                    <button
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 rounded border border-gray-300 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                    >
                        »
                    </button>
                    <button
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 rounded border border-gray-300 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                    >
                        »»
                    </button>
                </div>
            )}
        </div>
    );
}
