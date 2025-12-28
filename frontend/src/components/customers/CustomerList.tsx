import React, { Fragment } from 'react';
import { CustomerSummary } from './types';
import { ChevronDown, ChevronRight, CornerDownRight } from 'lucide-react';
import Link from 'next/link';

interface CustomerListProps {
    customers: CustomerSummary[];
    loading: boolean;
    expandedRows: Set<string>;
    toggleRow: (id: string) => void;
    emptyMessage?: string;
}

export default function CustomerList({ customers, loading, expandedRows, toggleRow, emptyMessage }: CustomerListProps) {
    if (loading) {
        return <div className="p-8 text-center text-sf-text-weak">読み込み中...</div>;
    }

    if (customers.length === 0) {
        return <div className="p-8 text-center text-sf-text-weak">{emptyMessage || '得意先が見つかりません'}</div>;
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead className="text-xs text-sf-text-weak bg-gray-50 border-b border-sf-border">
                    <tr>
                        <th className="px-4 py-3 text-left font-medium w-8"></th>
                        <th className="px-4 py-3 text-left font-medium">得意先CD/直送先CD</th>
                        <th className="px-4 py-3 text-left font-medium">得意先名/直送先名</th>
                        <th className="px-4 py-3 text-left font-medium">エリア</th>
                        <th className="px-4 py-3 text-center font-medium">ランク</th>
                        <th className="px-4 py-3 text-center font-medium">重点</th>
                        <th className="px-4 py-3 text-center font-medium">総活動数</th>
                        <th className="px-4 py-3 text-center font-medium">訪問</th>
                        <th className="px-4 py-3 text-center font-medium">電話</th>
                        <th className="px-4 py-3 text-center font-medium">デザイン案件</th>
                        <th className="px-4 py-3 text-left font-medium">最終活動日</th>
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
                                <td className="px-4 py-3 text-sf-text">{customer.lastActivity}</td>
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
                                        {sub.directDeliveryName}
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
                                                ★重点
                                            </span>
                                        )}
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
                                    <td className="px-4 py-3 text-sf-text-weak text-xs">{sub.lastActivity}</td>
                                </tr>
                            ))}
                        </Fragment>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
