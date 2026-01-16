'use client';

import { useEffect, useState, useMemo } from 'react';
import { useFile } from '@/context/FileContext';
import { useReports, useCustomers } from '@/hooks/useQueryHooks';
import CustomerFilters from '@/components/customers/CustomerFilters';
import CustomerList from '@/components/customers/CustomerList';
import CustomerStats from '@/components/customers/CustomerStats';
import { CustomerSummary } from '@/components/customers/types';
import { processCustomers, createCustomerTargetMap } from '@/components/customers/utils';
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
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [currentPage, setCurrentPage] = useState(1);

    // エラー時のtoast表示
    useEffect(() => {
        if (error) {
            toast.error('得意先データの読み込みに失敗しました');
        }
    }, [error]);

    // 顧客データが変わったらフィルタリングをリセット
    useEffect(() => {
        setFilteredCustomers(customers);
    }, [customers]);

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

            const checkFilters = (c: CustomerSummary, checkPriorityForSub: boolean = false) => {
                if (selectedArea && c.area !== selectedArea) return false;
                if (selectedRank && c.rank !== selectedRank) return false;
                // 重点フィルターは親と子で別々にチェック
                if (!checkPriorityForSub && isPriorityOnly && !c.isPriority) return false;
                return true;
            };

            result = result.map(parent => {
                // 親（得意先）のフィルターチェック（エリア、ランク）
                if (selectedArea && parent.area !== selectedArea) return null;
                if (selectedRank && parent.rank !== selectedRank) return null;

                // 重点フィルターの場合は、親か子のどちらかが重点であればOK
                const parentIsPriority = parent.isPriority;
                const prioritySubItems = parent.subItems?.filter(sub => sub.isPriority) || [];

                if (isPriorityOnly) {
                    // 親も子も重点でなければ除外
                    if (!parentIsPriority && prioritySubItems.length === 0) return null;

                    // 重点の子だけをフィルタリング
                    const filteredSubs = prioritySubItems;

                    // 検索条件もチェック
                    if (term) {
                        const parentMatches = checkMatch(parent);
                        const matchingSubs = filteredSubs.filter(sub => checkMatch(sub));

                        if (parentMatches || matchingSubs.length > 0) {
                            if (matchingSubs.length > 0) {
                                autoExpandIds.add(parent.id);
                            }
                            return { ...parent, subItems: parentIsPriority ? filteredSubs : matchingSubs };
                        }
                        return null;
                    }

                    return { ...parent, subItems: filteredSubs };
                }

                // 重点フィルターなしの場合
                const parentMatches = term ? checkMatch(parent) : true;
                let filteredSubs = parent.subItems || [];
                if (term) {
                    filteredSubs = filteredSubs.filter(sub => checkMatch(sub));
                }

                if (parentMatches || filteredSubs.length > 0) {
                    if (term && filteredSubs.length > 0) {
                        autoExpandIds.add(parent.id);
                        if (!parentMatches) {
                            return { ...parent, subItems: filteredSubs };
                        }
                    }
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
        setCurrentPage(1);
    }, [searchTerm, selectedArea, selectedRank, isPriorityOnly, customers]);

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
                                {Math.min((currentPage - 1) * 50 + 1, filteredCustomers.length)} - {Math.min(currentPage * 50, filteredCustomers.length)} 表示中
                            </span>
                        </div>

                        <CustomerList
                            customers={filteredCustomers.slice((currentPage - 1) * 50, currentPage * 50)}
                            loading={isLoading}
                            expandedRows={expandedRows}
                            toggleRow={toggleRow}
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
