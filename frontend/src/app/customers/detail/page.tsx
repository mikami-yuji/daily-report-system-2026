'use client';

import { useEffect, useState, Suspense } from 'react';
import { getReports, getCustomers, Report, Customer } from '@/lib/api';
import { useFile } from '@/context/FileContext';
import {
    User,
    MapPin,
    Calendar,
    Phone,
    FileText,
    Package,
    Layers,
    TrendingUp,
    Clock,
    ArrowLeft,

    AlertTriangle,
    DollarSign,
    Upload,
    Database
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

interface DesignRequest {
    designNo: number;
    designProposal: string;
    designType: string;
    designName: string;
    designProgress: string;
    requests: Report[];
    lastUpdate: string;
}

interface SalesData {
    found: boolean;
    rank?: string | number;
    rank_class?: string;
    sales_amount?: string | number;
    gross_profit?: string | number;
    sales_yoy?: string | number;
    sales_last_year?: string | number;
    profit_last_year?: string | number;
    sales_2y_ago?: string | number;
    profit_2y_ago?: string | number;
    customer_name?: string;
    message?: string;
    updated_at?: string;
}

function CustomerDetailContent() {
    const { selectedFile } = useFile();
    const searchParams = useSearchParams();
    const customerCode = searchParams.get('code');
    const ddCode = searchParams.get('ddCode');  // 直送先CDパラメータ

    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [customerName, setCustomerName] = useState('');
    const [directDeliveryName, setDirectDeliveryName] = useState('');  // 直送先名
    const [activeTab, setActiveTab] = useState<'timeline' | 'designs' | 'complaints' | 'sales'>('timeline');
    const [designRequests, setDesignRequests] = useState<DesignRequest[]>([]);
    const [selectedInterviewer, setSelectedInterviewer] = useState<string>('');
    const [salesData, setSalesData] = useState<SalesData | null>(null);
    const [currentTarget, setCurrentTarget] = useState('');  // 得意先の現目標

    // Fetch sales data when tab is active
    useEffect(() => {
        if (activeTab === 'sales' && customerCode) {
            setSalesData(null); // Reset or show loading
            fetch(`http://localhost:8001/api/sales/${customerCode}`)
                .then(res => res.json())
                .then(data => setSalesData(data))
                .catch(err => console.error("Sales fetch error:", err));
        }
    }, [activeTab, customerCode]);



    useEffect(() => {
        if (customerCode && selectedFile) {
            getReports(selectedFile).then(data => {
                // 得意先CDでフィルタリング
                let customerReports = data.filter(r => String(r.得意先CD) === customerCode);

                // 直送先CDが指定されている場合は直送先でもフィルタリング
                if (ddCode) {
                    customerReports = customerReports.filter(r => String(r.直送先CD || '') === ddCode);
                }

                customerReports.sort((a, b) => {
                    const dateA = String(a.日付 || '');
                    const dateB = String(b.日付 || '');
                    return dateB.localeCompare(dateA);
                });

                setReports(customerReports);

                if (customerReports.length > 0) {
                    setCustomerName(customerReports[0].訪問先名 || '名称不明');
                    if (ddCode) {
                        setDirectDeliveryName(customerReports[0].直送先名 || '直送先名不明');
                    }
                }

                processDesignRequests(customerReports);
                setLoading(false);
            }).catch(err => {
                console.error(err);
                setLoading(false);
            });
        }
    }, [customerCode, ddCode, selectedFile]);

    // 得意先マスタから現目標を取得
    useEffect(() => {
        if (customerCode && selectedFile) {
            getCustomers(selectedFile).then(customers => {
                // 得意先CDでマッチする顧客を検索
                const matchedCustomer = customers.find(c => {
                    const custCD = String(c.得意先CD || '').trim();
                    const ddCD = String(c.直送先CD || '').trim();
                    return custCD === customerCode && (!ddCode || ddCD === ddCode);
                });

                if (matchedCustomer && matchedCustomer['現目標']) {
                    setCurrentTarget(String(matchedCustomer['現目標']));
                }
            }).catch(err => {
                console.error('Failed to fetch customers for target:', err);
            });
        }
    }, [customerCode, ddCode, selectedFile]);

    const processDesignRequests = (data: Report[]) => {
        const designMap = new Map<number, DesignRequest>();

        data.forEach(report => {
            const designNo = report['システム確認用デザインNo.'];
            if (designNo && !isNaN(Number(designNo))) {
                const numDesignNo = Number(designNo);

                if (!designMap.has(numDesignNo)) {
                    designMap.set(numDesignNo, {
                        designNo: numDesignNo,
                        designProposal: String(report['デザイン提案有無'] || ''),
                        designType: String(report['デザイン種別'] || ''),
                        designName: String(report['デザイン名'] || ''),
                        designProgress: String(report['デザイン進捗状況'] || ''),
                        requests: [],
                        lastUpdate: ''
                    });
                }

                designMap.get(numDesignNo)!.requests.push(report);
            }
        });

        const requests = Array.from(designMap.values()).map(req => {
            req.requests.sort((a, b) => {
                const dateA = String(a.日付 || '');
                const dateB = String(b.日付 || '');
                return dateB.localeCompare(dateA);
            });
            req.lastUpdate = req.requests[0]?.日付 || '';
            return req;
        });

        requests.sort((a, b) => b.lastUpdate.localeCompare(a.lastUpdate));
        setDesignRequests(requests);
    };

    const getProgressBadge = (progress: string) => {
        const colorMap: Record<string, string> = {
            '完了': 'bg-green-100 text-green-800',
            '進行中': 'bg-blue-100 text-blue-800',
            '保留': 'bg-yellow-100 text-yellow-800',
            '未着手': 'bg-gray-100 text-gray-800',
        };
        const color = colorMap[progress] || 'bg-gray-100 text-gray-800';
        return (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
                {progress || '未設定'}
            </span>
        );
    };

    const getActionIcon = (action: string) => {
        if (action.includes('電話')) return <Phone size={16} className="text-blue-500" />;
        if (action.includes('訪問')) return <User size={16} className="text-green-500" />;
        return <FileText size={16} className="text-gray-500" />;
    };

    // 面談者のリストを抽出
    const interviewers = Array.from(new Set(reports.map(r => r.面談者).filter(Boolean))).sort();

    const filteredReports = selectedInterviewer
        ? reports.filter(r => r.面談者 === selectedInterviewer)
        : reports;

    const [selectedDesignType, setSelectedDesignType] = useState<string>('');
    const [selectedDesignProgress, setSelectedDesignProgress] = useState<string>('');

    // デザイン種別のリストを抽出
    const designTypes = Array.from(new Set(designRequests.map(req => req.designType).filter(Boolean))).sort();

    // 進捗状況のリストを抽出
    const progressOptions = Array.from(new Set(designRequests.map(req => req.designProgress).filter(Boolean))).sort();

    const filteredDesignRequests = designRequests.filter(req => {
        const matchType = !selectedDesignType || req.designType === selectedDesignType;
        const matchProgress = !selectedDesignProgress || req.designProgress === selectedDesignProgress;
        return matchType && matchProgress;
    });

    if (loading) {
        return <div className="p-8 text-center text-sf-text-weak">読み込み中...</div>;
    }

    if (reports.length === 0) {
        return (
            <div className="space-y-6">
                <Link href="/customers" className="inline-flex items-center text-sf-light-blue hover:underline mb-4">
                    <ArrowLeft size={16} className="mr-1" />
                    得意先一覧に戻る
                </Link>
                <div className="bg-white p-8 rounded border border-sf-border text-center">
                    <p className="text-sf-text-weak">指定された得意先のデータが見つかりません。</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* ヘッダーエリア */}
            <div className="bg-white rounded border border-sf-border shadow-sm p-6">
                <div className="flex items-center gap-2 text-sf-text-weak text-sm mb-2">
                    <Link href="/customers" className="hover:text-sf-light-blue hover:underline">
                        得意先一覧
                    </Link>
                    <span>/</span>
                    {ddCode ? (
                        <>
                            <Link
                                href={`/customers/detail?code=${customerCode}`}
                                className="hover:text-sf-light-blue hover:underline"
                            >
                                {customerName}
                            </Link>
                            <span>/</span>
                            <span>{directDeliveryName}</span>
                        </>
                    ) : (
                        <span>{customerName}</span>
                    )}
                </div>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-sf-text flex items-center gap-3">
                            {ddCode ? (
                                <>
                                    <span className="text-sm font-normal text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-200">直送先</span>
                                    {directDeliveryName}
                                </>
                            ) : (
                                customerName
                            )}
                            <span className="text-base font-normal text-sf-text-weak bg-gray-100 px-2 py-1 rounded">
                                {ddCode ? `直送CD: ${ddCode}` : `CD: ${customerCode}`}
                            </span>
                            {reports.length > 0 && reports[0].重点顧客 && reports[0].重点顧客 !== '-' && reports[0].重点顧客 !== '' && (
                                <span className="inline-flex items-center px-2.5 py-1 rounded text-sm font-medium bg-yellow-100 text-yellow-800">
                                    ★ 重点顧客
                                </span>
                            )}
                        </h1>
                        {reports.length > 0 && (
                            <div className="flex items-center gap-4 mt-2 text-sm text-sf-text-weak">
                                {reports[0].ランク && (
                                    <div className="flex items-center gap-1">
                                        <TrendingUp size={14} />
                                        <span>ランク: {reports[0].ランク}</span>
                                    </div>
                                )}
                                {reports[0].エリア && (
                                    <div className="flex items-center gap-1">
                                        <MapPin size={14} />
                                        <span>エリア: {reports[0].エリア}</span>
                                    </div>
                                )}
                            </div>
                        )}
                        {/* 現目標バナー */}
                        {currentTarget && (
                            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-100 to-indigo-100 border border-blue-300 rounded-lg">
                                <span className="text-xs font-bold text-blue-700 bg-blue-200 px-2 py-0.5 rounded">目標</span>
                                <span className="text-sm font-semibold text-blue-900">{currentTarget}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* 統計情報グリッド */}
                <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
                    <div className="text-center px-4 py-3 bg-gray-50 rounded border border-sf-border">
                        <p className="text-xs text-sf-text-weak mb-1">総活動数</p>
                        <p className="text-2xl font-semibold text-sf-text">{reports.length}</p>
                    </div>
                    <div className="text-center px-4 py-3 bg-green-50 rounded border border-green-200">
                        <p className="text-xs text-green-700 mb-1">訪問</p>
                        <p className="text-2xl font-semibold text-green-600">
                            {reports.filter(r => r.行動内容 && r.行動内容.includes('訪問')).length}
                        </p>
                    </div>
                    <div className="text-center px-4 py-3 bg-blue-50 rounded border border-blue-200">
                        <p className="text-xs text-blue-700 mb-1">電話</p>
                        <p className="text-2xl font-semibold text-blue-600">
                            {reports.filter(r => r.行動内容 && r.行動内容.includes('電話')).length}
                        </p>
                    </div>
                    <div className="text-center px-4 py-3 bg-purple-50 rounded border border-purple-200">
                        <p className="text-xs text-purple-700 mb-1">デザイン案件</p>
                        <p className="text-2xl font-semibold text-purple-600">{designRequests.length}</p>
                    </div>
                    <div className="text-center px-4 py-3 bg-red-50 rounded border border-red-200">
                        <p className="text-xs text-red-700 mb-1">クレーム</p>
                        <p className="text-2xl font-semibold text-red-600">
                            {reports.filter(r => (r.行動内容 && r.行動内容.includes('クレーム')) || (r.商談内容 && String(r.商談内容).includes('クレーム'))).length}
                        </p>
                    </div>
                    <div className="text-center px-4 py-3 bg-orange-50 rounded border border-orange-200">
                        <p className="text-xs text-orange-700 mb-1">提案物</p>
                        <p className="text-2xl font-semibold text-orange-600">
                            {reports.filter(r => r.提案物 && typeof r.提案物 === 'string' && r.提案物.trim() !== '').length}
                        </p>
                    </div>
                    <div className="text-center px-4 py-3 bg-gray-50 rounded border border-sf-border">
                        <p className="text-xs text-sf-text-weak mb-1">最終活動</p>
                        <p className="text-sm font-semibold text-sf-text">
                            {reports.length > 0 ? reports[0].日付 : '-'}
                        </p>
                    </div>
                </div>
            </div>

            {/* タブナビゲーション */}
            <div className="border-b border-sf-border">
                <nav className="-mb-px flex space-x-8">
                    <button
                        onClick={() => setActiveTab('timeline')}
                        className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2
              ${activeTab === 'timeline'
                                ? 'border-sf-light-blue text-sf-light-blue'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
            `}
                    >
                        <Clock size={18} />
                        活動履歴（タイムライン）
                    </button>
                    <button
                        onClick={() => setActiveTab('designs')}
                        className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2
              ${activeTab === 'designs'
                                ? 'border-sf-light-blue text-sf-light-blue'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
            `}
                    >
                        <Package size={18} />
                        デザイン案件
                        <span className="bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs ml-1">
                            {designRequests.length}
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('complaints')}
                        className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2
              ${activeTab === 'complaints'
                                ? 'border-sf-light-blue text-sf-light-blue'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
            `}
                    >
                        <AlertTriangle size={18} />
                        クレーム対応
                        <span className="bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs ml-1">
                            {reports.filter(r => (r.行動内容 && r.行動内容.includes('クレーム')) || (r.商談内容 && String(r.商談内容).includes('クレーム'))).length}
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('sales')}
                        className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2
              ${activeTab === 'sales'
                                ? 'border-sf-light-blue text-sf-light-blue'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
            `}
                    >
                        <DollarSign size={18} />
                        売上データ
                    </button>
                </nav>
            </div>

            {/* コンテンツエリア */}
            <div className="min-h-[400px]">
                {activeTab === 'timeline' && (
                    <div className="space-y-4">
                        {/* フィルターエリア */}
                        <div className="flex justify-end mb-4">
                            <div className="relative w-64">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <select
                                    value={selectedInterviewer}
                                    onChange={(e) => setSelectedInterviewer(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 text-sm border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue focus:border-transparent appearance-none bg-white"
                                >
                                    <option value="">すべての面談者</option>
                                    {interviewers.map(interviewer => (
                                        <option key={interviewer} value={interviewer}>{interviewer}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {filteredReports.length === 0 ? (
                            <div className="text-center py-12 text-sf-text-weak bg-white rounded border border-sf-border">
                                {selectedInterviewer ? '該当する面談者の活動履歴はありません' : '活動履歴はありません'}
                            </div>
                        ) : (
                            filteredReports.map((report, idx) => (
                                <div key={idx} className="bg-white p-4 rounded border border-sf-border shadow-sm hover:shadow-md transition-shadow relative pl-12">
                                    <div className="absolute left-4 top-4 flex flex-col items-center h-full">
                                        <div className="bg-gray-100 p-1.5 rounded-full border border-sf-border z-10">
                                            {getActionIcon(report.行動内容)}
                                        </div>
                                        {idx !== filteredReports.length - 1 && (
                                            <div className="w-px bg-gray-200 h-full absolute top-8"></div>
                                        )}
                                    </div>

                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <span className="font-semibold text-sf-text mr-2">{report.日付}</span>
                                            <span className="text-sm text-sf-text-weak bg-gray-100 px-2 py-0.5 rounded">
                                                {report.行動内容}
                                            </span>
                                        </div>
                                        {report.面談者 && (
                                            <div className="flex items-center text-sm text-sf-text-weak">
                                                <User size={14} className="mr-1" />
                                                {report.面談者}
                                            </div>
                                        )}
                                    </div>

                                    <div className="text-sf-text text-sm leading-relaxed whitespace-pre-wrap">
                                        {report.商談内容 || <span className="text-gray-400 italic">商談内容の記録なし</span>}
                                    </div>

                                    {(report.提案物 || report.次回プラン) && (
                                        <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {report.提案物 && (
                                                <div className="text-xs">
                                                    <span className="font-medium text-sf-text-weak block mb-1">提案物</span>
                                                    <span className="text-sf-text">{report.提案物}</span>
                                                </div>
                                            )}
                                            {report.次回プラン && (
                                                <div className="text-xs">
                                                    <span className="font-medium text-sf-text-weak block mb-1">次回プラン</span>
                                                    <span className="text-sf-text">{report.次回プラン}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {report['システム確認用デザインNo.'] && (
                                        <div className="mt-3">
                                            <span className="inline-flex items-center gap-1 text-xs font-medium text-sf-light-blue bg-blue-50 px-2 py-1 rounded border border-blue-100">
                                                <Package size={12} />
                                                デザインNo. {report['システム確認用デザインNo.']}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'designs' && (
                    <div className="space-y-4">
                        {/* フィルターエリア */}
                        <div className="flex justify-end gap-4 mb-4">
                            <div className="relative w-48">
                                <Layers className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <select
                                    value={selectedDesignType}
                                    onChange={(e) => setSelectedDesignType(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 text-sm border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue focus:border-transparent appearance-none bg-white"
                                >
                                    <option value="">すべての種別</option>
                                    {designTypes.map(type => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="relative w-48">
                                <TrendingUp className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <select
                                    value={selectedDesignProgress}
                                    onChange={(e) => setSelectedDesignProgress(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 text-sm border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue focus:border-transparent appearance-none bg-white"
                                >
                                    <option value="">すべての進捗</option>
                                    {progressOptions.map(progress => (
                                        <option key={progress} value={progress}>{progress}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {filteredDesignRequests.length === 0 ? (
                            <div className="text-center py-12 text-sf-text-weak bg-white rounded border border-sf-border">
                                {selectedDesignType || selectedDesignProgress ? '該当するデザイン案件はありません' : 'デザイン案件はありません'}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-6">
                                {filteredDesignRequests.map((req) => (
                                    <div key={req.designNo} className="bg-white rounded border border-sf-border shadow-sm overflow-hidden">
                                        <div className="p-4 border-b border-sf-border bg-gray-50 flex justify-between items-center">
                                            <div className="flex items-center gap-3">
                                                <span className="font-bold text-lg text-sf-light-blue">#{req.designNo}</span>
                                                <h3 className="font-semibold text-sf-text">{req.designName || '名称未設定'}</h3>
                                            </div>
                                            {getProgressBadge(req.designProgress)}
                                        </div>

                                        <div className="p-4">
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                                <div className="flex items-start gap-2">
                                                    <Layers size={16} className="text-purple-600 mt-0.5" />
                                                    <div>
                                                        <p className="text-xs text-sf-text-weak">種別</p>
                                                        <p className="text-sm font-medium text-sf-text">{req.designType || '-'}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-start gap-2">
                                                    <TrendingUp size={16} className="text-green-600 mt-0.5" />
                                                    <div>
                                                        <p className="text-xs text-sf-text-weak">提案有無</p>
                                                        <p className="text-sm font-medium text-sf-text">{req.designProposal || '-'}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-start gap-2">
                                                    <Calendar size={16} className="text-orange-500 mt-0.5" />
                                                    <div>
                                                        <p className="text-xs text-sf-text-weak">最終更新</p>
                                                        <p className="text-sm font-medium text-sf-text">{req.lastUpdate}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <h4 className="text-xs font-semibold text-sf-text-weak uppercase tracking-wider border-b border-gray-100 pb-1">
                                                    関連する活動履歴 ({req.requests.length}件)
                                                </h4>
                                                {req.requests.map((report, idx) => (
                                                    <div key={idx} className="text-sm border-l-2 border-gray-200 pl-3 py-1 hover:border-sf-light-blue transition-colors">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-xs font-medium text-sf-text">{report.日付}</span>
                                                            <span className="text-xs text-sf-text-weak bg-gray-100 px-1.5 rounded">{report.行動内容}</span>
                                                        </div>
                                                        <p className="text-sf-text line-clamp-2">{report.商談内容}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'complaints' && (
                    <div className="space-y-4">
                        {reports.filter(r => (r.行動内容 && r.行動内容.includes('クレーム')) || (r.商談内容 && String(r.商談内容).includes('クレーム'))).length === 0 ? (
                            <div className="text-center py-12 text-sf-text-weak bg-white rounded border border-sf-border">
                                クレーム対応履歴はありません
                            </div>
                        ) : (
                            reports
                                .filter(r => (r.行動内容 && r.行動内容.includes('クレーム')) || (r.商談内容 && String(r.商談内容).includes('クレーム')))
                                .map((report, idx) => (
                                    <div
                                        key={idx}
                                        className="bg-white p-4 rounded border border-sf-border shadow-sm hover:shadow-md transition-shadow relative pl-12"
                                    >
                                        <div className="absolute left-4 top-4 flex flex-col items-center h-full">
                                            <div className="bg-orange-100 p-1.5 rounded-full border border-orange-200 z-10">
                                                <AlertTriangle size={16} className="text-orange-600" />
                                            </div>
                                            {idx !== reports.filter(r => (r.行動内容 && r.行動内容.includes('クレーム')) || (r.商談内容 && String(r.商談内容).includes('クレーム'))).length - 1 && (
                                                <div className="w-px bg-gray-200 h-full absolute top-8"></div>
                                            )}
                                        </div>

                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-sf-text">{report.日付}</span>
                                                <span className="text-sm text-orange-700 bg-orange-100 px-2 py-0.5 rounded font-medium">
                                                    {report.行動内容 || '-'}
                                                </span>
                                            </div>
                                            {report.面談者 && (
                                                <div className="flex items-center text-sm text-sf-text-weak">
                                                    <User size={14} className="mr-1" />
                                                    {report.面談者}
                                                </div>
                                            )}
                                        </div>

                                        {report.商談内容 && (
                                            <div className="bg-orange-50 border border-orange-200 rounded p-3">
                                                <p className="text-xs font-semibold text-orange-800 mb-1">対応内容</p>
                                                <p className="text-sm text-sf-text whitespace-pre-wrap">{report.商談内容}</p>
                                            </div>
                                        )}

                                        {report.次回プラン && (
                                            <div className="mt-3 text-sm text-sf-text-weak">
                                                <span className="font-medium">次回プラン: </span>
                                                <span className="text-sf-text">{report.次回プラン}</span>
                                            </div>
                                        )}
                                    </div>
                                ))
                        )}
                    </div>
                )}


                {activeTab === 'sales' && (
                    <div className="space-y-6">
                        {/* Auto-fetch logic is handled in useEffect now, or trigger here */}
                        <div className="bg-white p-6 rounded border border-sf-border shadow-sm">
                            <h3 className="text-lg font-semibold text-sf-text mb-4 text-center border-b pb-2">
                                売上実績サマリ
                                <span className="text-sm font-normal text-sf-text-weak ml-2">({customerName})</span>
                            </h3>

                            {!salesData ? (
                                <div className="text-center py-8 text-sf-text-weak">
                                    <p>データを読み込んでいます...</p>
                                    <p className="text-xs mt-2 text-gray-400">
                                        ※データが表示されない場合は、設定画面から売上CSVをアップロードしてください。
                                    </p>
                                </div>
                            ) : !salesData.found ? (
                                <div className="text-center py-8 text-gray-500">
                                    <Database size={48} className="mx-auto mb-4 text-gray-300" />
                                    <p className="font-medium">売上データが見つかりませんでした</p>
                                    <p className="text-sm mt-2 text-gray-400">
                                        設定画面から最新の売上データをアップロードしてください。
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Rank Info */}
                                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-center">
                                        <p className="text-sm text-blue-800 mb-1 font-bold">売上順位</p>
                                        <p className="text-4xl font-bold text-blue-600">
                                            {salesData.rank}
                                            <span className="text-base font-normal text-blue-800 ml-1">位</span>
                                        </p>
                                        {salesData.rank_class && (
                                            <span className="inline-block mt-2 px-3 py-1 bg-white text-blue-800 rounded-full text-sm font-medium shadow-sm">
                                                ランク: {salesData.rank_class}
                                            </span>
                                        )}
                                    </div>

                                    {/* Sales Info */}
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-end border-b border-gray-100 pb-2">
                                            <span className="text-sf-text-weak text-sm">今期売上金額</span>
                                            <span className="text-2xl font-bold text-sf-text">
                                                {Number(salesData.sales_amount).toLocaleString()}
                                                <span className="text-sm font-normal ml-1">円</span>
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-end border-b border-gray-100 pb-2">
                                            <span className="text-sf-text-weak text-sm">今期粗利</span>
                                            <span className="text-2xl font-bold text-sf-text">
                                                {Number(salesData.gross_profit).toLocaleString()}
                                                <span className="text-sm font-normal ml-1">円</span>
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 mt-4 pt-2 border-t border-gray-100">
                                            <div className="text-right">
                                                <p className="text-xs text-sf-text-weak">前年売上</p>
                                                <p className="font-medium text-gray-700">
                                                    {Number(salesData.sales_last_year || 0).toLocaleString()}円
                                                </p>
                                                <p className="text-xs text-blue-600 mt-1">
                                                    対比: {salesData.sales_yoy ? `${salesData.sales_yoy}%` : '-'}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-sf-text-weak">前年粗利</p>
                                                <p className="font-medium text-gray-700">
                                                    {Number(salesData.profit_last_year || 0).toLocaleString()}円
                                                </p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 mt-2 pt-2 border-t border-dashed border-gray-200">
                                            <div className="text-right">
                                                <p className="text-xs text-sf-text-weak">前々年売上</p>
                                                <p className="font-medium text-gray-500">
                                                    {Number(salesData.sales_2y_ago || 0).toLocaleString()}円
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-sf-text-weak">前々年粗利</p>
                                                <p className="font-medium text-gray-500">
                                                    {Number(salesData.profit_2y_ago || 0).toLocaleString()}円
                                                </p>
                                            </div>
                                        </div>
                                        {salesData.updated_at && (
                                            <p className="text-xs text-right text-gray-300 mt-2">
                                                データ更新: {new Date(salesData.updated_at).toLocaleDateString()}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function CustomerDetailPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-sf-text-weak">読み込み中...</div>}>
            <CustomerDetailContent />
        </Suspense>
    );
}
