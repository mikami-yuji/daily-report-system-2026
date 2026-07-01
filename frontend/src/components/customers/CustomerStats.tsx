import React from 'react';
import { CustomerSummary } from './types';

type CustomerStatsProps = {
    customers: CustomerSummary[];
    filteredCustomers: CustomerSummary[];
};

export default function CustomerStats({ customers, filteredCustomers }: CustomerStatsProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded border border-sf-border shadow-sm">
                <p className="text-sm text-sf-text-weak mb-1">総得意先数</p>
                <p className="text-2xl font-semibold text-sf-text">{customers.length}</p>
            </div>
            <div className="bg-white p-4 rounded border border-sf-border shadow-sm">
                <p className="text-sm text-sf-text-weak mb-1">検索結果</p>
                <p className="text-2xl font-semibold text-sf-light-blue">{filteredCustomers.length}</p>
            </div>
            <div className="bg-white p-4 rounded border border-sf-border shadow-sm">
                <p className="text-sm text-sf-text-weak mb-1">重点顧客</p>
                <p className="text-2xl font-semibold text-yellow-600">
                    {customers.filter(c => c.isPriority).length}
                </p>
            </div>
            <div className="bg-white p-4 rounded border border-sf-border shadow-sm">
                <p className="text-sm text-sf-text-weak mb-1">総活動数</p>
                <p className="text-2xl font-semibold text-green-600">
                    {customers.reduce((sum, c) => sum + c.totalActivities, 0)}
                </p>
            </div>
        </div>
    );
}
