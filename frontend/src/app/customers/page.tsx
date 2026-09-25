'use client';

import { useEffect, useState, useMemo } from 'react';
import { useFile } from '@/context/FileContext';
import { useReports, useCustomers } from '@/hooks/useQueryHooks';
import CustomerFilters, { CustomerSortKey, InactiveFilterType } from '@/components/customers/CustomerFilters';
import CustomerList from '@/components/customers/CustomerList';
import CustomerStats from '@/components/customers/CustomerStats';
import { CustomerSummary } from '@/components/customers/types';
import { processCustomers, createCustomerTargetMap } from '@/components/customers/utils';
import { normalizeSearchText, getDaysSinceDate, compareDates } from '@/lib/reportUtils';
import toast from 'react-hot-toast';

export default function CustomersPage() {
    const { selectedFile } = useFile();

    // React Queryでデータ取得（自動キャッシュ）
    const { data: reports, isLoading: reportsLoading, error: reportsError } = useReports(selectedFile || undefined);
    const { data: customerMaster, isLoading: customerMasterLoading } = useCustomers(selectedFile || undefined);

    const isLoading = reportsLoading || customerMasterLoading;
    const error = reportsError;

    // 得意先マスタから現目標マップを作成
    const customerTargetMap = useMemo(() => {
        if (!customerMaster) return undefined;
        return createCustomerTargetMap(customerMaster);
    }, [customerMaster]);

    // 顧客データを加工（現目標を含む）
    const customers = useMemo(() => {
        if (!reports) return [];
        return processCustomers(reports, customerTargetMap);
    }, [reports, customerTargetMap]);

    const [filteredCustomers, setFilteredCustomers] = useState<CustomerSummary[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedArea, setSelectedArea] = useState('');
    const [selectedRank, setSelectedRank] = useState('');
    const [isPriorityOnly, setIsPriorityOnly] = useState(false);
    const [sortKey, setSortKey] = useState<CustomerSortKey>('lastActivity');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [inactiveFilter, setInactiveFilter] = useState<InactiveFilterType>('all');
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [currentPage, setCurrentPage] = useState(1);

    // エラー時のtoast表示
    useEffect(() => {
        if (error) {
            toast.error('得意先データの読み込みに失敗しました');
        }
    }, [error]);

    const toggleRow = (id: string) => {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedRows(newExpanded);
    };

    const handleSortChange = (key: CustomerSortKey, order?: 'asc' | 'desc') => {
        if (order) {
            setSortKey(key);
            setSortOrder(order);
        } else {
            if (sortKey === key) {
                setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
            } else {
                setSortKey(key);
                const defaultOrder = (key === 'lastActivity' || key === 'visits' || key === 'totalActivities') ? 'desc' : 'asc';
                setSortOrder(defaultOrder);
            }
        }
    };

    const hasActiveFilters = Boolean(
        searchTerm.trim() ||
        selectedArea ||
        selectedRank ||
        isPriorityOnly ||
        inactiveFilter !== 'all' ||
        sortKey !== 'lastActivity' ||
        sortOrder !== 'desc'
    );

    const handleClearAllFilters = () => {
        setSearchTerm('');
        setSelectedArea('');
        setSelectedRank('');
        setIsPriorityOnly(false);
        setInactiveFilter('all');
        setSortKey('lastActivity');
        setSortOrder('desc');
        setCurrentPage(1);
    };

    // ご無沙汰件数の集計
    const inactiveCounts = useMemo(() => {
        let in30 = 0;
        let in60 = 0;
        let pUnvisited = 0;
        customers.forEach(c => {
            const days = getDaysSinceDate(c.lastActivity);
            if (days !== null && days >= 30) in30++;
            if (days !== null && days >= 60) in60++;
            if (c.isPriority && (days === null || days >= 30)) pUnvisited++;
        });
        return { inactive30: in30, inactive60: in60, priorityUnvisited: pUnvisited };
    }, [customers]);

    useEffect(() => {
        let result = customers;

        const hasSearch = searchTerm.trim() !== '';
        const terms = hasSearch
            ? searchTerm.trim().split(/\s+/).filter(Boolean).map(normalizeSearchText)
            : [];

        const autoExpandIds = new Set<string>();

        const checkMatch = (c: CustomerSummary) => {
            if (terms.length === 0) return true;
            const targetValues = [
                c.name,
                c.code,
                c.directDeliveryName || '',
                c.directDeliveryCode || '',
                c.area || '',
                c.rank || ''
            ].map(normalizeSearchText);
            return terms.every(term => targetValues.some(val => val.includes(term)));
        };

        const checkInactive = (c: CustomerSummary) => {
            if (inactiveFilter === 'all') return true;
            const days = getDaysSinceDate(c.lastActivity);
            if (inactiveFilter === 'inactive30') {
                return days !== null && days >= 30;
            }
            if (inactiveFilter === 'inactive60') {
                return days !== null && days >= 60;
            }
            if (inactiveFilter === 'priority_unvisited') {
                return c.isPriority && (days === null || days >= 30);
            }
            return true;
        };

        // フィルタリング処理
        const filteredList: CustomerSummary[] = [];

        result.forEach(parent => {
            // エリア・ランクフィルター
            if (selectedArea && parent.area !== selectedArea) return;
            if (selectedRank && parent.rank !== selectedRank) return;

            // 重点フィルター
            const parentIsPriority = parent.isPriority;
            const prioritySubItems = parent.subItems?.filter(sub => sub.isPriority) || [];
            if (isPriorityOnly && !parentIsPriority && prioritySubItems.length === 0) {
                return;
            }

            // ご無沙汰フィルター
            const parentInactive = checkInactive(parent);
            const matchingSubsByInactive = parent.subItems?.filter(sub => checkInactive(sub)) || [];
            if (inactiveFilter !== 'all' && !parentInactive && matchingSubsByInactive.length === 0) {
                return;
            }

            // 検索ワードチェック
            const parentMatches = checkMatch(parent);
            let filteredSubs = parent.subItems;
            if (hasSearch && filteredSubs) {
                filteredSubs = filteredSubs.filter(sub => checkMatch(sub));
            }

            if (parentMatches || (filteredSubs && filteredSubs.length > 0)) {
                if (hasSearch && filteredSubs && filteredSubs.length > 0) {
                    autoExpandIds.add(parent.id);
                }
                filteredList.push({ ...parent, subItems: filteredSubs });
            }
        });

        result = filteredList;

        if (hasSearch) {
            setExpandedRows(autoExpandIds);
        }

        // ソート処理
        result.sort((a, b) => {
            let cmp = 0;
            if (sortKey === 'lastActivity') {
                cmp = compareDates(String(a.lastActivity || ''), String(b.lastActivity || ''));
            } else if (sortKey === 'visits') {
                cmp = a.visits - b.visits;
            } else if (sortKey === 'totalActivities') {
                cmp = a.totalActivities - b.totalActivities;
            } else if (sortKey === 'code') {
                cmp = a.code.localeCompare(b.code, undefined, { numeric: true });
            } else if (sortKey === 'name') {
                cmp = a.name.localeCompare(b.name);
            }
            return sortOrder === 'asc' ? cmp : -cmp;
        });

        setFilteredCustomers(result);
        setCurrentPage(1);
    }, [searchTerm, selectedArea, selectedRank, isPriorityOnly, inactiveFilter, sortKey, sortOrder, customers]);

    // Unique Areas and Ranks for dropdowns
    const areas = Array.from(new Set(customers.map(c => c.area).filter(Boolean))).sort();
    const ranks = Array.from(new Set(customers.map(c => c.rank).filter(Boolean))).sort();

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-semibold text-sf-text">得意先一覧</h1>
            </div>

            {/* ローディング表示 */}
            {isLoading && (
                <div className="bg-white rounded border border-sf-border shadow-sm p-8">
                    <div className="flex items-center justify-center gap-3">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-sf-light-blue"></div>
                        <span className="text-sf-text-weak">読み込み中...</span>
                    </div>
                </div>
            )}

            {/* エラー表示 */}
            {error && !isLoading && (
                <div className="bg-red-50 border border-red-200 rounded p-4 text-red-700">
                    データの読み込みに失敗しました
                </div>
            )}

            {!isLoading && !error && (
                <>
                    {/* 検索・フィルターバー */}
                    <CustomerFilters
                        searchTerm={searchTerm}
                        setSearchTerm={setSearchTerm}
                        selectedArea={selectedArea}
                        setSelectedArea={setSelectedArea}
                        selectedRank={selectedRank}
                        setSelectedRank={setSelectedRank}
                        isPriorityOnly={isPriorityOnly}
                        setIsPriorityOnly={setIsPriorityOnly}
                        areas={areas}
                        ranks={ranks}
                        sortKey={sortKey}
                        sortOrder={sortOrder}
                        onSortChange={handleSortChange}
                        inactiveFilter={inactiveFilter}
                        setInactiveFilter={setInactiveFilter}
                        counts={inactiveCounts}
                        onClearFilters={handleClearAllFilters}
                        hasActiveFilters={hasActiveFilters}
                    />

                    {/* 統計サマリー */}
                    <CustomerStats
                        customers={customers}
                        filteredCustomers={filteredCustomers}
                    />

                    {/* 得意先一覧テーブル */}
                    <div className="bg-white rounded border border-sf-border shadow-sm overflow-hidden">
                        <div className="px-4 py-3 border-b border-sf-border bg-gray-50 flex justify-between items-center">
                            <h2 className="font-semibold text-sm text-sf-text">得意先一覧 ({filteredCustomers.length}件)</h2>
                            <span className="text-xs text-gray-500">
                                {filteredCustomers.length === 0 ? '0件' : `${Math.min((currentPage - 1) * 50 + 1, filteredCustomers.length)} - ${Math.min(currentPage * 50, filteredCustomers.length)} 表示中`}
                            </span>
                        </div>

                        <CustomerList
                            customers={filteredCustomers.slice((currentPage - 1) * 50, currentPage * 50)}
                            loading={isLoading}
                            expandedRows={expandedRows}
                            toggleRow={toggleRow}
                            sortKey={sortKey}
                            sortOrder={sortOrder}
                            onSort={(key) => handleSortChange(key)}
                            emptyMessage={hasActiveFilters ? "条件に一致する得意先が見つかりませんでした。「条件クリア」で全件表示に戻せます。" : "得意先データがありません"}
                        />

                        {/* Pagination Controls */}
                        {filteredCustomers.length > 50 && (
                            <div className="px-4 py-3 border-t border-sf-border bg-gray-50 flex justify-center items-center gap-4">
                                <button
                                    onClick={() => {
                                        setCurrentPage(p => Math.max(1, p - 1));
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                    disabled={currentPage === 1}
                                    className="px-3 py-1 bg-white border border-gray-300 rounded text-sm disabled:opacity-50 hover:bg-gray-50 transition-colors"
                                >
                                    前へ
                                </button>
                                <span className="text-sm text-gray-600">
                                    {currentPage} / {Math.ceil(filteredCustomers.length / 50)} ページ
                                </span>
                                <button
                                    onClick={() => {
                                        setCurrentPage(p => Math.min(Math.ceil(filteredCustomers.length / 50), p + 1));
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                    disabled={currentPage === Math.ceil(filteredCustomers.length / 50)}
                                    className="px-3 py-1 bg-white border border-gray-300 rounded text-sm disabled:opacity-50 hover:bg-gray-50 transition-colors"
                                >
                                    次へ
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
