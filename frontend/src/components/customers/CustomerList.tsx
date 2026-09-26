import React, { Fragment } from 'react';
import { CustomerSummary } from './types';
import { ChevronDown, ChevronRight, CornerDownRight, ArrowUp, ArrowDown, ArrowUpDown, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { CustomerSortKey } from './CustomerFilters';
import { getDaysSinceDate } from '@/lib/reportUtils';

type CustomerListProps = {
    customers: CustomerSummary[];
    loading: boolean;
    expandedRows: Set<string>;
    toggleRow: (id: string) => void;
    emptyMessage?: string;
    sortKey?: CustomerSortKey;
    sortOrder?: 'asc' | 'desc';
    onSort?: (key: CustomerSortKey) => void;
};

export default function CustomerList({
    customers,
    loading,
    expandedRows,
    toggleRow,
    emptyMessage,
    sortKey,
    sortOrder,
    onSort
}: CustomerListProps) {
    if (loading) {
        return <div className="p-8 text-center text-sf-text-weak">読み込み中...</div>;
    }

    if (customers.length === 0) {
        return <div className="p-8 text-center text-sf-text-weak">{emptyMessage || '得意先が見つかりません'}</div>;
    }

    const renderSortIcon = (key: CustomerSortKey) => {
        if (!sortKey || sortKey !== key) {
            return <ArrowUpDown size={12} className="text-gray-300 group-hover:text-gray-500 inline ml-1" />;
        }
        return sortOrder === 'asc' 
            ? <ArrowUp size={12} className="text-sf-light-blue inline ml-1" />
            : <ArrowDown size={12} className="text-sf-light-blue inline ml-1" />;
    };

    const renderLastActivity = (dateStr?: string) => {
        if (!dateStr || dateStr === '-') return <span className="text-gray-400">-</span>;
        const days = getDaysSinceDate(dateStr);
        return (
            <div className="flex flex-col gap-0.5">
                <span className="font-mono text-xs text-sf-text">{dateStr}</span>
                {days !== null && days >= 60 ? (
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-rose-700 bg-rose-50 border border-rose-200 px-1 rounded w-fit font-bold">
                        {days}日前 (要対応)
                    </span>
                ) : days !== null && days >= 30 ? (
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1 rounded w-fit font-semibold">
                        {days}日前
                    </span>
                ) : days !== null && days <= 7 ? (
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 rounded w-fit font-medium">
                        {days === 0 ? '今日' : `${days}日前`}
                    </span>
                ) : null}
            </div>
        );
    };

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead className="text-xs text-sf-text-weak bg-gray-50 border-b border-sf-border sticky top-0 z-10">
                    <tr>
                        <th className="px-4 py-3 text-left font-medium w-8"></th>
                        <th 
                            onClick={() => onSort?.('code')} 
                            className="px-4 py-3 text-left font-medium cursor-pointer hover:bg-gray-100 group transition-colors"
                        >
                            <span>得意先CD/直送先CD</span>
                            {renderSortIcon('code')}
                        </th>
                        <th 
                            onClick={() => onSort?.('name')} 
                            className="px-4 py-3 text-left font-medium cursor-pointer hover:bg-gray-100 group transition-colors"
                        >
                            <span>得意先名/直送先名</span>
                            {renderSortIcon('name')}
                        </th>
                        <th className="px-4 py-3 text-left font-medium">エリア</th>
                        <th className="px-4 py-3 text-center font-medium">ランク</th>
                        <th className="px-4 py-3 text-center font-medium">重点</th>
                        <th className="px-4 py-3 text-left font-medium">現目標</th>
                        <th 
                            onClick={() => onSort?.('totalActivities')} 
                            className="px-4 py-3 text-center font-medium cursor-pointer hover:bg-gray-100 group transition-colors"
                        >
                            <span>総活動数</span>
                            {renderSortIcon('totalActivities')}
                        </th>
                        <th 
                            onClick={() => onSort?.('visits')} 
                            className="px-4 py-3 text-center font-medium cursor-pointer hover:bg-gray-100 group transition-colors"
                        >
                            <span>訪問</span>
                            {renderSortIcon('visits')}
                        </th>
                        <th className="px-4 py-3 text-center font-medium">電話</th>
                        <th className="px-4 py-3 text-center font-medium">デザイン案件</th>
                        <th 
                            onClick={() => onSort?.('lastActivity')} 
                            className="px-4 py-3 text-left font-medium cursor-pointer hover:bg-gray-100 group transition-colors"
                        >
                            <span>最終活動日</span>
                            {renderSortIcon('lastActivity')}
                        </th>
                        <th className="px-4 py-3 text-center font-medium">カタログ</th>
                    </tr>
                </thead>
                <tbody>
                    {customers.map((customer) => (
                        <Fragment key={customer.id}>
                            <tr className="border-b border-sf-border hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-3 text-center">
                                    {customer.subItems && customer.subItems.length > 0 && (
                                        <button
                                            onClick={() => toggleRow(customer.id)}
                                            className="p-1 hover:bg-gray-200 rounded"
                                            aria-label={expandedRows.has(customer.id) ? "直送先を折りたたむ" : "直送先を展開する"}
                                            title={expandedRows.has(customer.id) ? "直送先を折りたたむ" : "直送先を展開する"}
                                        >
                                            {expandedRows.has(customer.id) ? (
                                                <ChevronDown size={16} className="text-gray-500" />
                                            ) : (
                                                <ChevronRight size={16} className="text-gray-500" />
                                            )}
                                        </button>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-sf-text font-mono">{customer.code}</td>
                                <td className="px-4 py-3">
                                    <Link
                                        href={`/customers/detail?code=${customer.code}`}
                                        className="font-medium text-sf-light-blue hover:underline"
                                    >
                                        {customer.name}
                                    </Link>
                                </td>
                                <td className="px-4 py-3 text-sf-text">{customer.area || '-'}</td>
                                <td className="px-4 py-3 text-center">
                                    {customer.rank && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                            {customer.rank}
                                        </span>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-center">
                                    {customer.isPriority && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                            重点
                                        </span>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-sf-text text-sm max-w-32 truncate" title={customer.currentTarget || ''}>
                                    {customer.currentTarget || '-'}
                                </td>
                                <td className="px-4 py-3 text-center font-semibold text-sf-text">
                                    {customer.totalActivities}
                                </td>
                                <td className="px-4 py-3 text-center text-green-600">
                                    {customer.visits}
                                </td>
                                <td className="px-4 py-3 text-center text-blue-600">
                                    {customer.calls}
                                </td>
                                <td className="px-4 py-3 text-center">
                                    {customer.designRequests > 0 ? (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                            {customer.designRequests}
                                        </span>
                                    ) : (
                                        <span className="text-gray-400">-</span>
                                    )}
                                </td>
                                <td className="px-4 py-3">
                                    {renderLastActivity(customer.lastActivity)}
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <Link
                                        href={`/catalog?customer_code=${customer.code}`}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded border border-indigo-200 transition-colors shadow-sm"
                                        title={`${customer.name} の商品カタログ・発注を開く`}
                                    >
                                        <ShoppingBag size={13} />
                                        <span>カタログ</span>
                                    </Link>
                                </td>
                            </tr>
                            {/* Direct Delivery Rows (Sub Items) */}
                            {expandedRows.has(customer.id) && customer.subItems?.map(sub => (
                                <tr key={sub.id} className="bg-sf-bg-light border-b border-sf-border hover:bg-gray-100">
                                    <td className="px-4 py-3"></td>
                                    <td className="px-4 py-3 text-sf-text-weak font-mono pl-8 text-xs flex items-center gap-1">
                                        <CornerDownRight size={12} className="text-sf-text-weak" />
                                        {sub.directDeliveryCode}
                                    </td>
                                    <td className="px-4 py-3 pl-8 text-sm">
                                        <span className="text-sf-text-weak text-xs border border-gray-200 rounded px-1 mr-2 bg-white">直送</span>
                                        <Link
                                            href={`/customers/detail?code=${sub.code}&ddCode=${sub.directDeliveryCode}`}
                                            className="text-sf-light-blue hover:underline"
                                        >
                                            {sub.directDeliveryName}
                                        </Link>
                                    </td>
                                    <td className="px-4 py-3 text-sf-text-weak text-xs">{sub.area || '-'}</td>
                                    <td className="px-4 py-3 text-center">
                                        {sub.rank && (
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-50 text-gray-600">
                                                {sub.rank}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        {sub.isPriority && (
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-50 text-yellow-700">
                                                重点
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-sf-text-weak text-xs max-w-32 truncate" title={sub.currentTarget || ''}>
                                        {sub.currentTarget || '-'}
                                    </td>
                                    <td className="px-4 py-3 text-center text-xs text-sf-text-weak">
                                        {sub.totalActivities}
                                    </td>
                                    <td className="px-4 py-3 text-center text-xs text-green-600/70">
                                        {sub.visits}
                                    </td>
                                    <td className="px-4 py-3 text-center text-xs text-blue-600/70">
                                        {sub.calls}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        {sub.designRequests > 0 && (
                                            <span className="text-xs text-purple-800/70">{sub.designRequests}</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-xs">
                                        {renderLastActivity(sub.lastActivity)}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <Link
                                            href={`/catalog?customer_code=${sub.code}`}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded border border-gray-200 transition-colors"
                                            title={`${sub.directDeliveryName} の商品カタログを開く`}
                                        >
                                            <ShoppingBag size={11} />
                                            <span>カタログ</span>
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </Fragment>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
