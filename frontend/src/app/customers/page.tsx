'use client';

import { useEffect, useState, Fragment } from 'react';
import { getReports, Report } from '@/lib/api';
import { useFile } from '@/context/FileContext';
import { Search, Users, TrendingUp, MapPin, ChevronRight, ChevronDown, CornerDownRight } from 'lucide-react';
import Link from 'next/link';

interface CustomerSummary {
    id: string; // Unique ID for React Key
    code: string;
    name: string;
    area: string;
    totalActivities: number;
    visits: number;
    calls: number;
    designRequests: number;
    isPriority: boolean;
    lastActivity: string;
    rank: string;
    // Shared fields for Direct Delivery
    isDirectDelivery?: boolean;
    directDeliveryCode?: string;
    directDeliveryName?: string;
    subItems?: CustomerSummary[];
}

export default function CustomersPage() {
    const { selectedFile } = useFile();
    const [customers, setCustomers] = useState<CustomerSummary[]>([]);
    const [filteredCustomers, setFilteredCustomers] = useState<CustomerSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedArea, setSelectedArea] = useState('');
    const [selectedRank, setSelectedRank] = useState('');
    const [isPriorityOnly, setIsPriorityOnly] = useState(false);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!selectedFile) return;

        setLoading(true);
        getReports(selectedFile).then(data => {
            processCustomers(data);
            setLoading(false);
        }).catch(err => {
            console.error(err);
            setLoading(false);
        });
    }, [selectedFile]);

    const processCustomers = (data: Report[]) => {
        const customerMap = new Map<string, CustomerSummary>();

        // Create base stats object
        const createStats = (code: string, name: string, area: string, rank: string, isPriority: boolean, isDD: boolean = false, ddCode: string = '', ddName: string = '') => ({
            id: isDD ? `${code}-${ddCode}` : code,
            code,
            name,
            area,
            totalActivities: 0,
            visits: 0,
            calls: 0,
            designRequests: 0,
            isPriority: isPriority,
            lastActivity: '',
            rank,
            isDirectDelivery: isDD,
            directDeliveryCode: ddCode,
            directDeliveryName: ddName,
            subItems: isDD ? undefined : []
        });

        data.forEach(report => {
            const code = String(report.得意先CD || '');
            const name = String(report.訪問先名 || '').split('　')[0]; // Extract main customer name if concatenated
            // Note: report.訪問先名 might be "Customer Name Direct Delivery Name" depending on how it was saved.
            // But we should use report.得意先名 if available? The Report interface has 訪問先名.
            // Usually we want the official Customer Name.
            // Let's use the first part of name if it looks like "A B".

            if (!code) return;

            // Ensure Parent Exists
            if (!customerMap.has(code)) {
                customerMap.set(code, createStats(
                    code,
                    name, // This might be "Customer A Direct B" if we are unlucky suitable for display as parent? No.
                    String(report.エリア || ''),
                    String(report.ランク || ''),
                    !!(report.重点顧客 && report.重点顧客 !== '-' && report.重点顧客 !== '')
                ));
            }

            const parent = customerMap.get(code)!;

            // Check for Direct Delivery
            const ddCode = report.直送先CD ? String(report.直送先CD) : '';
            const ddName = report.直送先名 ? String(report.直送先名) : '';

            let target = parent; // Defaults to updating parent

            if (ddCode) {
                // It's a Direct Delivery activity
                // Find or create SubItem
                let sub = parent.subItems?.find(s => s.directDeliveryCode === ddCode);
                if (!sub) {
                    sub = createStats(
                        code,
                        name, // Parent name showing on sub? or just empty?
                        String(report.エリア || ''),
                        String(report.ランク || ''),
                        false, // Priority usually on Customer?
                        true,
                        ddCode,
                        ddName
                    );
                    parent.subItems?.push(sub);
                }
                target = sub;
                // We ALSO increment Parent stats for aggregation?
                // Usually "Total Activities" for Customer includes all its branches.
                // So we increment Parent AND Target (if target != parent)
            }

            // Update Stats for Target (DD or Parent)
            target.totalActivities++;
            if (report.行動内容 && report.行動内容.includes('訪問')) target.visits++;
            if (report.行動内容 && report.行動内容.includes('電話')) target.calls++;
            if (report['システム確認用デザインNo.'] && !isNaN(Number(report['システム確認用デザインNo.']))) target.designRequests++;
            const reportDate = String(report.日付 || '');
            if (!target.lastActivity || reportDate > target.lastActivity) target.lastActivity = reportDate;

            // Update Parent Stats (Aggregate)
            if (target !== parent) {
                parent.totalActivities++;
                if (report.行動内容 && report.行動内容.includes('訪問')) parent.visits++;
                if (report.行動内容 && report.行動内容.includes('電話')) parent.calls++;
                if (report['システム確認用デザインNo.'] && !isNaN(Number(report['システム確認用デザインNo.']))) parent.designRequests++;
                if (!parent.lastActivity || reportDate > parent.lastActivity) parent.lastActivity = reportDate;
            }
        });

        const customerList = Array.from(customerMap.values())
            .sort((a, b) => b.totalActivities - a.totalActivities);

        setCustomers(customerList);
        setFilteredCustomers(customerList);
    };

    const toggleRow = (id: string) => {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedRows(newExpanded);
    };

    useEffect(() => {
        let result = customers;

        // Filter Logic
        if (searchTerm.trim() || selectedArea || selectedRank || isPriorityOnly) {
            const term = searchTerm.toLowerCase().trim();
            const autoExpandIds = new Set<string>();

            const checkMatch = (c: CustomerSummary) => {
                const nameMatch = c.name.toLowerCase().includes(term);
                const codeMatch = c.code.toLowerCase().includes(term);
                const ddNameMatch = c.directDeliveryName?.toLowerCase().includes(term);
                const ddCodeMatch = c.directDeliveryCode?.toLowerCase().includes(term);

                return nameMatch || codeMatch || ddNameMatch || ddCodeMatch;
            };

            const checkFilters = (c: CustomerSummary) => {
                if (selectedArea && c.area !== selectedArea) return false;
                if (selectedRank && c.rank !== selectedRank) return false;
                if (isPriorityOnly && !c.isPriority) return false;
                return true;
            };

            result = result.map(parent => {
                // Check if parent matches strict filters (Area, Rank, Priority)
                if (!checkFilters(parent)) return null;

                // Check text search
                const parentMatches = term ? checkMatch(parent) : true;

                // Filter subItems
                let filteredSubs = parent.subItems || [];
                if (term) {
                    filteredSubs = filteredSubs.filter(sub => checkMatch(sub));
                }

                // Decision: Show Parent if Parent matches OR any Sub matches
                if (parentMatches || filteredSubs.length > 0) {
                    // If we have search term, and sub matches, expand parent
                    if (term && filteredSubs.length > 0) {
                        autoExpandIds.add(parent.id);
                        // Show ONLY matching subs if parent doesn't match? 
                        // Or show matching subs prioritized?
                        // If parent matches, user might expect to see everything.
                        // If parent doesn't match but child does, show only matching child.

                        if (!parentMatches) {
                            return { ...parent, subItems: filteredSubs };
                        }
                    }
                    // If parent matches, show all subs (unless specifically filtering logic requires hiding non-matches)
                    // For now, if parent matches, let's keep all subs (or original list)
                    // But if subs were filtered by checkMatch above...
                    // Wait, filterSubs logic above `filteredSubs.filter` removes non-matching subs.
                    // If parent matches, maybe we want to see ALL subs?
                    // User query "search of sidebar... see info for each direct delivery..."
                    // If I search "Customer A", I probably want to see "Customer A - Delivery 1", "Customer A - Delivery 2".
                    // So if Parent matches, restore all subs.
                    if (parentMatches) {
                        return { ...parent };
                    }

                    return { ...parent, subItems: filteredSubs };
                }
                return null;
            }).filter((c): c is CustomerSummary => c !== null);

            if (term) {
                setExpandedRows(autoExpandIds);
            }
        }

        setFilteredCustomers(result);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchTerm, selectedArea, selectedRank, isPriorityOnly, customers]);

    // ユニークなエリアとランクのリストを作成
    const areas = Array.from(new Set(customers.map(c => c.area).filter(Boolean))).sort();
    const ranks = Array.from(new Set(customers.map(c => c.rank).filter(Boolean))).sort();

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-semibold text-sf-text">得意先一覧</h1>
            </div>

            {/* 検索・フィルターバー */}
            <div className="bg-white rounded border border-sf-border shadow-sm p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="得意先、直送先..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue focus:border-transparent"
                        />
                    </div>

                    <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <select
                            value={selectedArea}
                            onChange={(e) => setSelectedArea(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue focus:border-transparent appearance-none bg-white"
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
                        {searchTerm || selectedArea || selectedRank || isPriorityOnly ? '検索結果が見つかりません' : '得意先が見つかりません'}
                    </div>
                ) : (
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
                                {filteredCustomers.map((customer) => (
                                    <Fragment key={customer.id}>
                                        <tr className="border-b border-sf-border hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-3 text-center">
                                                {customer.subItems && customer.subItems.length > 0 && (
                                                    <button onClick={() => toggleRow(customer.id)} className="p-1 hover:bg-gray-200 rounded">
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
                                                    href={`/customers/${customer.code}`}
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
                                                <td className="px-4 py-3 text-center"></td>
                                                <td className="px-4 py-3 text-center"></td>
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
                )}
            </div>
        </div>
    );
}
