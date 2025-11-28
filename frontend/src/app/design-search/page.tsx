'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { getReports, Report } from '@/lib/api';
import { useFile } from '@/context/FileContext';
import { Search, Calendar, User, FileText, ChevronDown, ChevronUp, Package, Layers, TrendingUp, Filter } from 'lucide-react';
import Link from 'next/link';

interface DesignRequest {
    designNo: number;
    customerCode: string;
    customerName: string;
    designProposal: string;
    designType: string;
    designName: string;
    designProgress: string;
    requests: Report[];
}

export default function DesignSearchPage() {
    const { selectedFile } = useFile();
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState<string>('');
    const [selectedType, setSelectedType] = useState<string>('');
    const [selectedProgress, setSelectedProgress] = useState<string>('');
    const [designRequests, setDesignRequests] = useState<DesignRequest[]>([]);
    const [filteredRequests, setFilteredRequests] = useState<DesignRequest[]>([]);
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
    const [customers, setCustomers] = useState<Array<{ code: string, name: string }>>([]);

    useEffect(() => {
        if (!selectedFile) return;

        setLoading(true);
        getReports(selectedFile).then(data => {
            setReports(data);
            const requests = processDesignRequests(data);

            // デザイン依頼がある得意先のみを抽出
            const customerMap = new Map<string, string>();
            requests.forEach(req => {
                if (req.customerCode && req.customerName && !customerMap.has(req.customerCode)) {
                    customerMap.set(req.customerCode, req.customerName);
                }
            });

            const customerList = Array.from(customerMap.entries())
                .map(([code, name]) => ({ code, name }))
                .sort((a, b) => a.code.localeCompare(b.code));

            setCustomers(customerList);
            setLoading(false);
        }).catch(err => {
            console.error(err);
            setLoading(false);
        });
    }, [selectedFile]);

    const processDesignRequests = (data: Report[]): DesignRequest[] => {
        const designMap = new Map<number, DesignRequest>();

        data.forEach(report => {
            const designNo = report['システム確認用デザインNo.'];
            if (designNo && !isNaN(Number(designNo))) {
                const numDesignNo = Number(designNo);

                if (!designMap.has(numDesignNo)) {
                    designMap.set(numDesignNo, {
                        designNo: numDesignNo,
                        customerCode: String(report.得意先CD || ''),
                        customerName: String(report.訪問先名 || ''),
                        designProposal: String(report['デザイン提案有無'] || ''),
                        designType: String(report['デザイン種別'] || ''),
                        designName: String(report['デザイン名'] || ''),
                        designProgress: String(report['デザイン進捗状況'] || ''),
                        requests: []
                    });
                }

                designMap.get(numDesignNo)!.requests.push(report);
            }
        });

        // 各デザイン依頼の日報を日付順にソート
        const requests = Array.from(designMap.values()).map(req => ({
            ...req,
            requests: req.requests.sort((a, b) => {
                const dateA = String(a.日付 || '');
                const dateB = String(b.日付 || '');
                return dateA.localeCompare(dateB);
            })
        }));

        // デザインNo.の降順でソート
        requests.sort((a, b) => b.designNo - a.designNo);

        setDesignRequests(requests);
        setFilteredRequests(requests);

        return requests;
    };

    // 得意先でフィルターされた場合の種別リスト
    const availableTypes = useMemo(() => {
        let requestsToCheck = designRequests;

        // 得意先でフィルター
        if (selectedCustomer) {
            requestsToCheck = requestsToCheck.filter(req => req.customerCode === selectedCustomer);
        }

        // 種別を抽出
        const types = new Set<string>();
        requestsToCheck.forEach(req => {
            if (req.designType) {
                types.add(req.designType);
            }
        });

        return Array.from(types).sort();
    }, [designRequests, selectedCustomer]);

    // フィルターされた状態での進捗状況リスト
    const availableProgress = useMemo(() => {
        let requestsToCheck = designRequests;

        // 得意先でフィルター
        if (selectedCustomer) {
            requestsToCheck = requestsToCheck.filter(req => req.customerCode === selectedCustomer);
        }

        // 種別でフィルター
        if (selectedType) {
            requestsToCheck = requestsToCheck.filter(req => req.designType === selectedType);
        }

        // 進捗状況を抽出
        const progressList = new Set<string>();
        requestsToCheck.forEach(req => {
            if (req.designProgress) {
                progressList.add(req.designProgress);
            }
        });

        return Array.from(progressList).sort();
    }, [designRequests, selectedCustomer, selectedType]);

    useEffect(() => {
        let filtered = designRequests;

        // 得意先フィルター
        if (selectedCustomer) {
            filtered = filtered.filter(req => req.customerCode === selectedCustomer);
        }

        // 種別フィルター
        if (selectedType) {
            filtered = filtered.filter(req => req.designType === selectedType);
        }

        // 進捗状況フィルター
        if (selectedProgress) {
            filtered = filtered.filter(req => req.designProgress === selectedProgress);
        }

        // キーワード検索
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(req =>
                String(req.designNo).includes(term) ||
                req.customerCode.toLowerCase().includes(term) ||
                req.customerName.toLowerCase().includes(term) ||
                req.designName.toLowerCase().includes(term) ||
                req.designType.toLowerCase().includes(term)
            );
        }

        setFilteredRequests(filtered);
    }, [searchTerm, selectedCustomer, selectedType, selectedProgress, designRequests]);

    // 得意先が変更されたら種別フィルターをリセット
    useEffect(() => {
        if (selectedType && !availableTypes.includes(selectedType)) {
            setSelectedType('');
        }
    }, [availableTypes, selectedType]);

    const toggleRow = (designNo: number) => {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(designNo)) {
            newExpanded.delete(designNo);
        } else {
            newExpanded.add(designNo);
        }
        setExpandedRows(newExpanded);
    };

    const getProgressBadge = (progress: string) => {
        const colorMap: Record<string, string> = {
            '完了': 'bg-green-100 text-green-800',
            '進行中': 'bg-blue-100 text-blue-800',
            '保留': 'bg-yellow-100 text-yellow-800',
            '未着手': 'bg-gray-100 text-gray-800',
        };
        const color = colorMap[progress] || 'bg-gray-100 text-gray-800';
        return progress ? (
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${color}`}>
                {progress}
            </span>
        ) : null;
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-semibold text-sf-text">デザイン依頼検索</h1>
            </div>

            {/* 検索・フィルターエリア */}
            <div className="bg-white rounded border border-sf-border shadow-sm p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* キーワード検索 */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="デザインNo.、得意先、デザイン名、種別で検索..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue focus:border-transparent"
                        />
                    </div>

                    {/* 得意先フィルター */}
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <select
                            value={selectedCustomer}
                            onChange={(e) => setSelectedCustomer(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue focus:border-transparent appearance-none bg-white"
                        >
                            <option value="">すべての得意先</option>
                            {customers.map(customer => (
                                <option key={customer.code} value={customer.code}>
                                    {customer.code} - {customer.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* 種別フィルター */}
                    <div className="relative">
                        <Layers className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <select
                            value={selectedType}
                            onChange={(e) => setSelectedType(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue focus:border-transparent appearance-none bg-white"
                        >
                            <option value="">すべての種別</option>
                            {availableTypes.map(type => (
                                <option key={type} value={type}>
                                    {type}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* 進捗状況フィルター */}
                    <div className="relative">
                        <TrendingUp className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <select
                            value={selectedProgress}
                            onChange={(e) => setSelectedProgress(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue focus:border-transparent appearance-none bg-white"
                        >
                            <option value="">すべての進捗状況</option>
                            {availableProgress.map(progress => (
                                <option key={progress} value={progress}>
                                    {progress}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* 統計サマリー */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded border border-sf-border shadow-sm">
                    <p className="text-sm text-sf-text-weak mb-1">総デザイン依頼数</p>
                    <p className="text-2xl font-semibold text-sf-text">{designRequests.length}</p>
                </div>
                <div className="bg-white p-4 rounded border border-sf-border shadow-sm">
                    <p className="text-sm text-sf-text-weak mb-1">検索結果</p>
                    <p className="text-2xl font-semibold text-sf-light-blue">{filteredRequests.length}</p>
                </div>
                <div className="bg-white p-4 rounded border border-sf-border shadow-sm">
                    <p className="text-sm text-sf-text-weak mb-1">総活動記録数</p>
                    <p className="text-2xl font-semibold text-green-600">
                        {filteredRequests.reduce((sum, req) => sum + req.requests.length, 0)}
                    </p>
                </div>
            </div>

            {/* 検索結果テーブル */}
            <div className="bg-white rounded border border-sf-border shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-sf-border bg-gray-50">
                    <h2 className="font-semibold text-sm text-sf-text">デザイン依頼一覧</h2>
                </div>

                {loading ? (
                    <div className="p-8 text-center text-sf-text-weak">読み込み中...</div>
                ) : filteredRequests.length === 0 ? (
                    <div className="p-8 text-center text-sf-text-weak">
                        {searchTerm || selectedCustomer || selectedType || selectedProgress ? '検索結果が見つかりません' : 'デザイン依頼が見つかりません'}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="text-xs text-sf-text-weak bg-gray-50 border-b border-sf-border">
                                <tr>
                                    <th className="px-4 py-3 text-left font-medium w-12"></th>
                                    <th className="px-4 py-3 text-left font-medium">デザインNo.</th>
                                    <th className="px-4 py-3 text-left font-medium">得意先CD</th>
                                    <th className="px-4 py-3 text-left font-medium">得意先名</th>
                                    <th className="px-4 py-3 text-left font-medium">デザイン名</th>
                                    <th className="px-4 py-3 text-left font-medium">種別</th>
                                    <th className="px-4 py-3 text-center font-medium">進捗状況</th>
                                    <th className="px-4 py-3 text-center font-medium">活動回数</th>
                                    <th className="px-4 py-3 text-left font-medium">最終活動日</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRequests.map((req) => {
                                    const isExpanded = expandedRows.has(req.designNo);
                                    const lastActivity = req.requests[req.requests.length - 1];

                                    return (
                                        <React.Fragment key={req.designNo}>
                                            <tr
                                                key={req.designNo}
                                                className="border-b border-sf-border hover:bg-gray-50 transition-colors cursor-pointer"
                                                onClick={() => toggleRow(req.designNo)}
                                            >
                                                <td className="px-4 py-3">
                                                    {isExpanded ? (
                                                        <ChevronUp size={16} className="text-sf-light-blue" />
                                                    ) : (
                                                        <ChevronDown size={16} className="text-gray-400" />
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 font-medium text-sf-light-blue">
                                                    {req.designNo}
                                                </td>
                                                <td className="px-4 py-3 text-sf-text">{req.customerCode}</td>
                                                <td className="px-4 py-3 text-sf-text font-medium">
                                                    <Link
                                                        href={`/customers/${req.customerCode}`}
                                                        className="text-sf-light-blue hover:underline"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        {req.customerName}
                                                    </Link>
                                                </td>
                                                <td className="px-4 py-3 text-sf-text">{req.designName || '-'}</td>
                                                <td className="px-4 py-3 text-sf-text-weak text-xs">{req.designType || '-'}</td>
                                                <td className="px-4 py-3 text-center">
                                                    {getProgressBadge(req.designProgress)}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                        {req.requests.length}件
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sf-text">{lastActivity.日付}</td>
                                            </tr>

                                            {isExpanded && (
                                                <tr>
                                                    <td colSpan={9} className="bg-gray-50 p-0">
                                                        <div className="px-8 py-4">
                                                            {/* デザイン情報サマリー */}
                                                            <div className="mb-4 p-4 bg-white rounded border border-sf-border">
                                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                                    <div className="flex items-start gap-2">
                                                                        <Package size={16} className="text-sf-light-blue mt-0.5" />
                                                                        <div>
                                                                            <p className="text-xs text-sf-text-weak">デザイン名</p>
                                                                            <p className="text-sm font-medium text-sf-text">{req.designName || '未設定'}</p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-start gap-2">
                                                                        <Layers size={16} className="text-purple-600 mt-0.5" />
                                                                        <div>
                                                                            <p className="text-xs text-sf-text-weak">デザイン種別</p>
                                                                            <p className="text-sm font-medium text-sf-text">{req.designType || '未設定'}</p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-start gap-2">
                                                                        <TrendingUp size={16} className="text-green-600 mt-0.5" />
                                                                        <div>
                                                                            <p className="text-xs text-sf-text-weak">進捗状況</p>
                                                                            <p className="text-sm font-medium text-sf-text">{req.designProgress || '未設定'}</p>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <h3 className="text-sm font-semibold text-sf-text mb-3 flex items-center gap-2">
                                                                <FileText size={16} className="text-sf-light-blue" />
                                                                活動履歴（時系列）
                                                            </h3>
                                                            <div className="space-y-3">
                                                                {req.requests.map((report, idx) => (
                                                                    <div
                                                                        key={idx}
                                                                        className="bg-white rounded border border-sf-border p-3 hover:shadow-sm transition-shadow"
                                                                    >
                                                                        <div className="flex items-start gap-3">
                                                                            <div className="flex-shrink-0 w-20 text-xs text-sf-text-weak">
                                                                                <Calendar size={14} className="inline mr-1" />
                                                                                {report.日付}
                                                                            </div>
                                                                            <div className="flex-1">
                                                                                <div className="flex items-center gap-2 mb-1">
                                                                                    <span className="text-xs font-medium text-sf-light-blue">
                                                                                        {report.行動内容}
                                                                                    </span>
                                                                                    {report.面談者 && (
                                                                                        <span className="text-xs text-sf-text-weak flex items-center gap-1">
                                                                                            <User size={12} />
                                                                                            {report.面談者}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                                {report.商談内容 && (
                                                                                    <p className="text-xs text-sf-text mt-1 leading-relaxed">
                                                                                        {report.商談内容}
                                                                                    </p>
                                                                                )}
                                                                                {report.提案物 && (
                                                                                    <div className="mt-2 text-xs">
                                                                                        <span className="text-sf-text-weak">提案物: </span>
                                                                                        <span className="text-sf-text">{report.提案物}</span>
                                                                                    </div>
                                                                                )}
                                                                                {report.次回プラン && (
                                                                                    <div className="mt-1 text-xs">
                                                                                        <span className="text-sf-text-weak">次回: </span>
                                                                                        <span className="text-sf-text">{report.次回プラン}</span>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div >
    );
}
