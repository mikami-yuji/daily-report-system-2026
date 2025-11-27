'use client';

import { useEffect, useState } from 'react';
import { getReports, Report } from '@/lib/api';
import { Search, Users, TrendingUp, Phone, MapPin } from 'lucide-react';
import Link from 'next/link';

interface CustomerSummary {
    code: string;
    name: string;
    totalActivities: number;
    visits: number;
    calls: number;
    designRequests: number;
    isPriority: boolean;
    lastActivity: string;
    rank: string;
}

export default function CustomersPage() {
    const [customers, setCustomers] = useState<CustomerSummary[]>([]);
    const [filteredCustomers, setFilteredCustomers] = useState<CustomerSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        getReports().then(data => {
            processCustomers(data);
            setLoading(false);
        }).catch(err => {
            console.error(err);
            setLoading(false);
        });
    }, []);

    const processCustomers = (data: Report[]) => {
        const customerMap = new Map<string, CustomerSummary>();

        data.forEach(report => {
            const code = String(report.得意先CD || '');
            const name = String(report.訪問先名 || '');

            if (!code || !name) return;

            if (!customerMap.has(code)) {
                customerMap.set(code, {
                    code,
                    name,
                    totalActivities: 0,
                    visits: 0,
                    calls: 0,
                    designRequests: 0,
                    isPriority: !!(report.重点顧客 && report.重点顧客 !== '-' && report.重点顧客 !== ''),
                    lastActivity: '',
                    rank: String(report.ランク || '')
                });
            }

            const customer = customerMap.get(code)!;
            customer.totalActivities++;

            if (report.行動内容 && report.行動内容.includes('訪問')) {
                customer.visits++;
            }
            if (report.行動内容 && report.行動内容.includes('電話')) {
                customer.calls++;
            }
            if (report['システム確認用デザインNo.'] && !isNaN(Number(report['システム確認用デザインNo.']))) {
                customer.designRequests++;
            }

            const reportDate = String(report.日付 || '');
            if (!customer.lastActivity || reportDate > customer.lastActivity) {
                customer.lastActivity = reportDate;
            }
        });

        const customerList = Array.from(customerMap.values())
            .sort((a, b) => b.totalActivities - a.totalActivities);

        setCustomers(customerList);
        setFilteredCustomers(customerList);
    };

    useEffect(() => {
        if (!searchTerm.trim()) {
            setFilteredCustomers(customers);
            return;
        }

        const term = searchTerm.toLowerCase();
        const filtered = customers.filter(c =>
            c.code.toLowerCase().includes(term) ||
            c.name.toLowerCase().includes(term)
        );
        setFilteredCustomers(filtered);
    }, [searchTerm, customers]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-semibold text-sf-text">得意先一覧</h1>
            </div>

            {/* 検索バー */}
            <div className="bg-white rounded border border-sf-border shadow-sm p-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="得意先CD、得意先名で検索..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue focus:border-transparent"
                    />
                </div>
            </div>

            {/* 統計サマリー */}
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

            {/* 得意先一覧テーブル */}
            <div className="bg-white rounded border border-sf-border shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-sf-border bg-gray-50">
                    <h2 className="font-semibold text-sm text-sf-text">得意先一覧</h2>
                </div>

                {loading ? (
                    <div className="p-8 text-center text-sf-text-weak">読み込み中...</div>
                ) : filteredCustomers.length === 0 ? (
                    <div className="p-8 text-center text-sf-text-weak">
                        {searchTerm ? '検索結果が見つかりません' : '得意先が見つかりません'}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="text-xs text-sf-text-weak bg-gray-50 border-b border-sf-border">
                                <tr>
                                    <th className="px-4 py-3 text-left font-medium">得意先CD</th>
                                    <th className="px-4 py-3 text-left font-medium">得意先名</th>
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
                                {filteredCustomers.map((customer) => (
                                    <tr
                                        key={customer.code}
                                        className="border-b border-sf-border hover:bg-gray-50 transition-colors"
                                    >
                                        <td className="px-4 py-3 text-sf-text font-mono">{customer.code}</td>
                                        <td className="px-4 py-3">
                                            <Link
                                                href={`/customers/${customer.code}`}
                                                className="font-medium text-sf-light-blue hover:underline"
                                            >
                                                {customer.name}
                                            </Link>
                                        </td>
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
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
