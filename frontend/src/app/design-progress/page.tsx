'use client';

import { useEffect, useState } from 'react';
import { getReports, getFiles, Report, ExcelFile } from '@/lib/api';
import { Search, Calendar, FileText, TrendingUp, Package } from 'lucide-react';

export default function DesignProgressPage() {
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [files, setFiles] = useState<ExcelFile[]>([]);
    const [selectedFile, setSelectedFile] = useState<string>('');

    const [customers, setCustomers] = useState<string[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<string>('');
    const [designNumbers, setDesignNumbers] = useState<string[]>([]);
    const [selectedDesignNo, setSelectedDesignNo] = useState<string>('');
    const [progressHistory, setProgressHistory] = useState<Report[]>([]);

    // Load available Excel files
    useEffect(() => {
        getFiles()
            .then(data => {
                setFiles(data.files);
                setSelectedFile(data.default);
            })
            .catch(err => console.error('Failed to load files:', err));
    }, []);

    // Load reports for the selected file and build the customer list (only customers that have a design request)
    useEffect(() => {
        if (!selectedFile) return;
        getReports(selectedFile)
            .then(data => {
                setReports(data);
                setLoading(false);
                const customerSet = new Set<string>();
                data.forEach(r => {
                    const custId = r.得意先CD ? String(r.得意先CD) : '';
                    const designNo = r['デザイン依頼No.'];
                    if (custId && custId !== '-' && designNo && designNo !== '-') {
                        customerSet.add(custId);
                    }
                });
                const customerList = Array.from(customerSet).sort();
                setCustomers(customerList);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, [selectedFile]);

    // When a customer is selected, build list of design numbers for that customer
    useEffect(() => {
        if (!selectedCustomer) {
            setDesignNumbers([]);
            setSelectedDesignNo('');
            setProgressHistory([]);
            return;
        }
        const designSet = new Set<string>();
        reports.forEach(r => {
            if (String(r.得意先CD) === selectedCustomer) {
                const designNo = r['デザイン依頼No.'];
                if (designNo && designNo !== '-') {
                    designSet.add(String(designNo));
                }
            }
        });
        const sortedDesigns = Array.from(designSet).sort();
        setDesignNumbers(sortedDesigns);
        setSelectedDesignNo('');
        setProgressHistory([]);
    }, [selectedCustomer, reports]);

    // When a design number is selected, build progress history
    useEffect(() => {
        if (selectedCustomer && selectedDesignNo) {
            const history = reports
                .filter(r =>
                    String(r.得意先CD) === selectedCustomer &&
                    String(r['デザイン依頼No.']) === selectedDesignNo
                )
                .sort((a, b) => {
                    const dateA = new Date(a.日付 || '').getTime();
                    const dateB = new Date(b.日付 || '').getTime();
                    return dateB - dateA;
                });
            setProgressHistory(history);
        } else {
            setProgressHistory([]);
        }
    }, [selectedDesignNo, selectedCustomer, reports]);

    const getCustomerName = (customerCD: string) => {
        const report = reports.find(r => String(r.得意先CD) === customerCD);
        return report?.訪問先名 || customerCD;
    };

    return (
        <div className="space-y-4 h-[calc(100vh-8rem)] flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center bg-white p-4 rounded border border-sf-border shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="bg-sf-light-blue p-2 rounded text-white shadow-sm">
                        <Package size={20} />
                    </div>
                    <div>
                        <p className="text-xs text-sf-text-weak font-medium">オブジェクト</p>
                        <h1 className="text-xl font-bold text-sf-text">デザイン進捗管理</h1>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={selectedFile}
                        onChange={e => setSelectedFile(e.target.value)}
                        className="text-sm text-sf-text bg-white border border-sf-border rounded px-3 py-2"
                    >
                        {files.map(file => (
                            <option key={file.name} value={file.name}>
                                {file.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded border border-sf-border shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-sf-text mb-2">
                            <Search size={16} className="inline mr-1" />
                            得意先CD
                        </label>
                        <select
                            value={selectedCustomer}
                            onChange={e => setSelectedCustomer(e.target.value)}
                            className="w-full border border-sf-border rounded px-3 py-2 text-sf-text"
                        >
                            <option value="">-- 得意先を選択 --</option>
                            {customers.map(cd => (
                                <option key={cd} value={cd}>
                                    {cd} - {getCustomerName(cd)}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-sf-text mb-2">
                            <FileText size={16} className="inline mr-1" />
                            デザイン依頼No.
                        </label>
                        <select
                            value={selectedDesignNo}
                            onChange={e => setSelectedDesignNo(e.target.value)}
                            className="w-full border border-sf-border rounded px-3 py-2 text-sf-text"
                            disabled={!selectedCustomer}
                        >
                            <option value="">-- デザイン依頼Noを選択 --</option>
                            {designNumbers.map(no => (
                                <option key={no} value={no}>
                                    {no}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
                {selectedCustomer && designNumbers.length === 0 && (
                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                        この得意先にはデザイン依頼がありません
                    </div>
                )}
            </div>

            {/* Progress History */}
            <div className="bg-white border border-sf-border shadow-sm flex-1 overflow-auto rounded">
                {!selectedDesignNo ? (
                    <div className="p-10 text-center text-sf-text-weak">
                        <Package size={48} className="mx-auto mb-4 opacity-30" />
                        <p>得意先CDとデザイン依頼Noを選択してください</p>
                    </div>
                ) : progressHistory.length === 0 ? (
                    <div className="p-10 text-center text-sf-text-weak">進捗履歴が見つかりません</div>
                ) : (
                    <div className="p-6">
                        {/* Summary */}
                        <div className="mb-6 p-4 bg-gray-50 rounded border border-sf-border">
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                <div>
                                    <p className="text-xs text-sf-text-weak mb-1">得意先CD</p>
                                    <p className="font-semibold text-sf-text">{selectedCustomer}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-sf-text-weak mb-1">得意先名</p>
                                    <p className="font-semibold text-sf-text">{getCustomerName(selectedCustomer)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-sf-text-weak mb-1">デザイン依頼No.</p>
                                    <p className="font-semibold text-sf-text">{selectedDesignNo}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-sf-text-weak mb-1">最新進捗状況</p>
                                    <p className="font-semibold text-sf-text">
                                        {progressHistory.length > 0 ? progressHistory[0].デザイン進捗状況 : '-'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-sf-text-weak mb-1">更新回数</p>
                                    <p className="font-semibold text-sf-light-blue text-xl">{progressHistory.length}</p>
                                </div>
                            </div>
                        </div>
                        {/* Timeline */}
                        <div className="space-y-4">
                            <h3 className="font-semibold text-sf-text flex items-center gap-2">
                                <TrendingUp size={20} className="text-sf-light-blue" />
                                進捗履歴
                            </h3>
                            <div className="relative border-l-2 border-sf-light-blue ml-4 pl-6 space-y-6">
                                {progressHistory.map((report, i) => (
                                    <div key={i} className="relative">
                                        <div className="absolute -left-[1.6rem] top-2 w-4 h-4 bg-sf-light-blue rounded-full border-4 border-white shadow" />
                                        <div className="bg-white border border-sf-border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex items-center gap-2">
                                                    <Calendar size={16} className="text-sf-text-weak" />
                                                    <span className="font-semibold text-sf-text">{report.日付}</span>
                                                </div>
                                                <span
                                                    className={`px-3 py-1 rounded-full text-xs font-medium ${report.デザイン進捗状況 === '完了'
                                                            ? 'bg-green-100 text-green-700'
                                                            : report.デザイン進捗状況 === '進行中'
                                                                ? 'bg-blue-100 text-blue-700'
                                                                : report.デザイン進捗状況 === '保留'
                                                                    ? 'bg-yellow-100 text-yellow-700'
                                                                    : 'bg-gray-100 text-gray-700'
                                                        }`}
                                                >
                                                    {report.デザイン進捗状況 || '未設定'}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                                <div>
                                                    <p className="text-xs text-sf-text-weak mb-1">行動内容</p>
                                                    <p className="text-sf-text">{report.行動内容 || '-'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-sf-text-weak mb-1">面談者</p>
                                                    <p className="text-sf-text">{report.面談者 || '-'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-sf-text-weak mb-1">デザイン種別</p>
                                                    <p className="text-sf-text">{report.デザイン種別 || '-'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-sf-text-weak mb-1">デザイン名</p>
                                                    <p className="text-sf-text">{report.デザイン名 || '-'}</p>
                                                </div>
                                            </div>
                                            {report.商談内容 && (
                                                <div className="mt-3 pt-3 border-t border-sf-border">
                                                    <p className="text-xs text-sf-text-weak mb-1">商談内容</p>
                                                    <p className="text-sm text-sf-text">{report.商談内容}</p>
                                                </div>
                                            )}
                                            {report.次回プラン && (
                                                <div className="mt-2">
                                                    <p className="text-xs text-sf-text-weak mb-1">次回プラン</p>
                                                    <p className="text-sm text-sf-text bg-blue-50 p-2 rounded">{report.次回プラン}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {selectedDesignNo && (
                <div className="p-2 bg-white border border-sf-border rounded text-xs text-sf-text-weak">
                    {progressHistory.length} 件の進捗記録
                </div>
            )}
        </div>
    );
}
