'use client';

import { useEffect, useState } from 'react';
import { getReports, Report } from '@/lib/api';
import { useFile } from '@/context/FileContext';
import CustomerFilters from '@/components/customers/CustomerFilters';
import CustomerList from '@/components/customers/CustomerList';
import CustomerStats from '@/components/customers/CustomerStats';
import { CustomerSummary } from '@/components/customers/types';
import { processCustomers } from '@/components/customers/utils';

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
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        if (!selectedFile) return;

        setLoading(true);
        getReports(selectedFile).then(data => {
            const processed = processCustomers(data);
            setCustomers(processed);
            setFilteredCustomers(processed);
            setLoading(false);
        }).catch(err => {
            console.error(err);
            setLoading(false);
        });
    }, [selectedFile]);

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
                    loading={loading}
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
        </div>
    );
}
