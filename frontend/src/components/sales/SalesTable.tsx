import React, { memo } from 'react';
import { SalesData } from '@/lib/api';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

type SalesTableProps = {
    data: SalesData[];
    sortField: keyof SalesData;
    sortDirection: 'asc' | 'desc';
    onSort: (field: keyof SalesData) => void;
}

type SortIconProps = {
    field: keyof SalesData;
    sortField: keyof SalesData;
    sortDirection: 'asc' | 'desc';
};

// ソート用のアイコンを表示するコンポーネント
const SortIcon = ({ field, sortField, sortDirection }: SortIconProps): React.JSX.Element => {
    if (sortField !== field) return <ArrowUpDown size={14} className="ml-1 text-gray-400 opacity-50" />;
    return sortDirection === 'desc' ?
        <ArrowDown size={14} className="ml-1 text-sf-light-blue" /> :
        <ArrowUp size={14} className="ml-1 text-sf-light-blue" />;
};

type HeaderCellProps = {
    field: keyof SalesData;
    label: string;
    align?: 'left' | 'center' | 'right';
    sortField: keyof SalesData;
    sortDirection: 'asc' | 'desc';
    onSort: (field: keyof SalesData) => void;
};

// テーブルのヘッダーセルを表示するコンポーネント
const HeaderCell = ({ field, label, align = 'left', sortField, sortDirection, onSort }: HeaderCellProps): React.JSX.Element => (
    <th
        className={`px-4 py-3 font-medium text-xs text-sf-text-weak cursor-pointer hover:bg-gray-100 transition-colors select-none text-${align}`}
        onClick={() => onSort(field)}
    >
        <div className={`flex items-center ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'}`}>
            {label}
            <SortIcon field={field} sortField={sortField} sortDirection={sortDirection} />
        </div>
    </th>
);

const SalesTable = memo(function SalesTable({ data, sortField, sortDirection, onSort }: SalesTableProps): React.JSX.Element {
    // 金額を通貨フォーマットに変換する関数
    const formatCurrency = (val: number | null): string => {
        if (val === null || val === undefined) return '-';
        return new Intl.NumberFormat('ja-JP').format(val);
    };

    // 割合をパーセント表示に変換する関数
    const formatPercent = (val: number | null): string => {
        if (val === null || val === undefined) return '-';
        return `${val.toFixed(1)}%`;
    };

    return (
        <div className="bg-white rounded-lg border border-sf-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-sf-border">
                        <tr>
                            <HeaderCell field="rank" label="順位" align="center" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
                            <HeaderCell field="rank_class" label="ランク" align="center" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
                            <HeaderCell field="customer_code" label="CD" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
                            <HeaderCell field="customer_name" label="得意先名" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
                            <HeaderCell field="area" label="エリア" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
                            <HeaderCell field="sales_amount" label="売上金額" align="right" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
                            <HeaderCell field="gross_profit" label="粗利金額" align="right" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
                            <HeaderCell field="sales_yoy" label="前年比" align="right" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
                            <HeaderCell field="sales_last_year" label="前年売上" align="right" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {data.map((row, idx) => (
                            <tr key={`${row.customer_code}-${idx}`} className="hover:bg-blue-50/30 transition-colors">
                                <td className="px-4 py-3 text-center text-sf-text-weak font-mono">{row.rank}</td>
                                <td className="px-4 py-3 text-center">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium 
                                        ${row.rank_class === 'A' ? 'bg-orange-100 text-orange-800' :
                                            row.rank_class === 'B' ? 'bg-blue-100 text-blue-800' :
                                                'bg-gray-100 text-gray-800'}`}>
                                        {row.rank_class}
                                    </span>
                                </td>
                                <td className="px-4 py-3 font-mono text-xs text-sf-text-weak">{row.customer_code}</td>
                                <td className="px-4 py-3 font-medium text-sf-text">{row.customer_name}</td>
                                <td className="px-4 py-3 text-sf-text">{row.area || '-'}</td>
                                <td className="px-4 py-3 text-right font-mono font-medium text-sf-text">
                                    {formatCurrency(row.sales_amount)}
                                </td>
                                <td className="px-4 py-3 text-right font-mono text-sf-text-weak">
                                    {formatCurrency(row.gross_profit)}
                                </td>
                                <td className="px-4 py-3 text-right font-mono font-medium">
                                    {row.sales_yoy ? (
                                        <span className={`${row.sales_yoy >= 105 ? 'text-green-600 bg-green-50 px-1.5 py-0.5 rounded' :
                                            row.sales_yoy < 95 ? 'text-red-500 bg-red-50 px-1.5 py-0.5 rounded' :
                                                'text-sf-text'
                                            }`}>
                                            {formatPercent(row.sales_yoy)}
                                        </span>
                                    ) : '-'}
                                </td>
                                <td className="px-4 py-3 text-right font-mono text-xs text-sf-text-weak">
                                    {formatCurrency(row.sales_last_year)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {data.length === 0 && (
                <div className="p-12 text-center text-gray-400">
                    データが見つかりません
                </div>
            )}
        </div>
    );
});

export default SalesTable;
