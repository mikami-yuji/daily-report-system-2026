import React, { useState, useEffect } from 'react';
import { Customer, Design, getCustomers, getInterviewers, getDesigns } from '@/lib/api';
import { useOffline } from '@/context/OfflineContext';
import { useLocalStorageDraft } from '@/hooks/useLocalStorageDraft';
import { X, Truck } from 'lucide-react';
import toast from 'react-hot-toast';
import { normalizeDateInput } from '@/lib/reportUtils';

export interface InitialDesignData {
    得意先CD?: string;
    得意先名?: string;
    デザイン依頼No?: string;
    デザイン名?: string;
    デザイン種別?: string;
    デザイン進捗状況?: string;
}

interface NewReportModalProps {
    onClose: () => void;
    onSuccess: () => void;
    selectedFile: string;
    initialDesignData?: InitialDesignData;
}

export default function NewReportModal({ onClose, onSuccess, selectedFile, initialDesignData }: NewReportModalProps) {
    const { isOnline, saveOfflineReport, cachedCustomers, cacheCustomers } = useOffline();

    // 下書き保存フック
    type ModalDraftData = {
        formData: typeof defaultFormData;
        designMode: 'none' | 'new' | 'existing';
    };
    const defaultFormData = {
        日付: new Date().toISOString().split('T')[0].replace(/-/g, '/').slice(2),
        行動内容: '',
        エリア: '',
        得意先CD: '',
        直送先CD: '',
        訪問先名: '',
        直送先名: '',
        面談者: '',
        滞在時間: '',
        商談内容: '',
        提案物: '',
        次回プラン: '',
        競合他社情報: '',
        重点顧客: '',
        ランク: '',
        デザイン提案有無: '',
        デザイン種別: '',
        デザイン名: '',
        デザイン進捗状況: '',
        'デザイン依頼No.': '',
    };
    const { getDraft, saveDraft, clearDraft } = useLocalStorageDraft<ModalDraftData>('new-report-modal-draft');

    // 下書きがあれば復元、なければ初期値
    const initialDraft = getDraft();
    const [formData, setFormData] = useState(() => {
        const base = initialDesignData ? defaultFormData : (initialDraft?.formData || defaultFormData);
        if (initialDesignData) {
            return {
                ...base,
                訪問先名: initialDesignData.得意先名 || '',
                得意先CD: initialDesignData.得意先CD || '',
                'デザイン依頼No.': initialDesignData.デザイン依頼No || '',
                デザイン名: initialDesignData.デザイン名 || '',
                デザイン種別: initialDesignData.デザイン種別 || '',
                デザイン進捗状況: initialDesignData.デザイン進捗状況 || '',
                デザイン提案有無: 'あり'
            };
        }
        return base;
    });
    const [submitting, setSubmitting] = useState(false);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [interviewers, setInterviewers] = useState<string[]>([]);
    const [designMode, setDesignMode] = useState<'none' | 'new' | 'existing'>(
        initialDesignData ? 'existing' : (initialDraft?.designMode || 'none')
    );
    const [designs, setDesigns] = useState<Design[]>([]);
    const [startOutTime, setStartOutTime] = useState('');
    const [endOutTime, setEndOutTime] = useState('');
    // 得意先リストからエリア一覧を動的に取得
    const [areaOptions, setAreaOptions] = useState<string[]>([]);
    // 下書き復元時のtoast通知
    const [draftRestored] = useState(!initialDesignData && !!initialDraft);

    // 下書き復元通知（初回マウント時のみ）
    useEffect(() => {
        if (draftRestored) {
            toast.success('前回の入力内容を復元しました', { icon: '📝', id: 'modal-draft-restored' });
        }
    }, []);

    // formDataまたはdesignMode変更時に自動保存
    useEffect(() => {
        const hasData = formData.訪問先名 || formData.行動内容 || formData.商談内容 || formData.面談者 || formData.提案物;
        if (hasData) {
            saveDraft({ formData, designMode });
        }
    }, [formData, designMode, saveDraft]);



    // 時間の選択肢を生成 (08:00 - 23:00)
    const timeOptions = [];
    for (let i = 8; i <= 23; i++) {
        timeOptions.push(`${String(i).padStart(2, '0')}:00`);
        if (i < 23) {
            timeOptions.push(`${String(i).padStart(2, '0')}:30`);
        }
    }

    useEffect(() => {
        // Fetch customer list
        getCustomers(selectedFile).then(data => {
            setCustomers(data);
            cacheCustomers(data); // Cache successful response
            // エリア一覧を抽出（重複除去・ソート）
            const areas = [...new Set(data.map(c => c.エリア).filter(Boolean))].sort();
            setAreaOptions(areas);

            // initialDesignData がある場合、該当得意先情報を埋める
            if (initialDesignData?.得意先CD) {
                const customer = data.find(c => String(c.得意先CD) === initialDesignData.得意先CD);
                if (customer) {
                    setFormData(prev => ({
                        ...prev,
                        訪問先名: customer.得意先名 || '',
                        直送先名: customer.直送先名 || '',
                        得意先CD: customer.得意先CD || '',
                        直送先CD: customer.直送先CD || '',
                        エリア: customer.エリア || '',
                        重点顧客: customer.重点顧客 || '',
                        ランク: customer.ランク || ''
                    }));
                }

                // Fetch interviewers and designs for this customer
                getInterviewers(initialDesignData.得意先CD, selectedFile, initialDesignData.得意先名).then(d => setInterviewers(d)).catch(() => setInterviewers([]));
                getDesigns(initialDesignData.得意先CD, selectedFile).then(d => setDesigns(d)).catch(() => setDesigns([]));
            }

        }).catch(err => {
            console.error('Failed to fetch customers:', err);
            if (cachedCustomers.length > 0) {
                setCustomers(cachedCustomers);
                const areas = [...new Set(cachedCustomers.map(c => c.エリア).filter(Boolean))].sort();
                setAreaOptions(areas);
                toast('キャッシュされた得意先リストを使用します', { icon: '📡', id: 'cached-customers' });
            }
        });
    }, [selectedFile, isOnline, cacheCustomers, cachedCustomers, initialDesignData]);


    // Handle customer name change with keyword search across all fields including kana
    const handleCustomerNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setFormData(prev => ({
            ...prev,
            訪問先名: value,
        }));

        filterCustomers(value);
    };

    const filterCustomers = (searchTerm: string) => {
        if (!searchTerm.trim()) {
            setFilteredCustomers([]);
            setShowSuggestions(false);
            return;
        }

        const lowerSearchTerm = searchTerm.toLowerCase();
        // Convert hiragana to katakana for kana search
        const katakanaSearchTerm = lowerSearchTerm.replace(/[\u3041-\u3096]/g, (match) => {
            const chr = match.charCodeAt(0) + 0x60;
            return String.fromCharCode(chr);
        });

        const filtered = customers.filter(c => {
            // Search in customer name
            if (c.得意先名 && c.得意先名.toLowerCase().includes(lowerSearchTerm)) {
                return true;
            }
            // Search in customer code
            if (c.得意先CD && String(c.得意先CD).includes(lowerSearchTerm)) {
                return true;
            }
            // Search in kana (フリガナ)
            if (c.フリガナ && c.フリガナ.toLowerCase().includes(katakanaSearchTerm)) {
                return true;
            }
            // Search in Direct Delivery Name
            if (c.直送先名 && c.直送先名.toLowerCase().includes(lowerSearchTerm)) {
                return true;
            }
            // Search in Direct Delivery Code
            if (c.直送先CD && String(c.直送先CD).includes(lowerSearchTerm)) {
                return true;
            }
            return false;
        }).slice(0, 50); // Limit to 50 results
        setFilteredCustomers(filtered);
        setShowSuggestions(filtered.length > 0);
    };

    const selectCustomer = (customer: Customer) => {
        setFormData(prev => ({
            ...prev,
            訪問先名: customer.直送先名 ? `${customer.得意先名}　${customer.直送先名}` : (customer.得意先名 || ''),
            直送先名: customer.直送先名 || '',
            得意先CD: customer.得意先CD || '',
            直送先CD: customer.直送先CD || '',
            エリア: customer.エリア || '',
            重点顧客: customer.重点顧客 || '',
            ランク: customer.ランク || ''
        }));
        setShowSuggestions(false);

        // Fetch interviewers for this customer
        if (customer.得意先CD) {
            getInterviewers(customer.得意先CD, selectedFile, customer.得意先名, customer.直送先名).then(data => {
                setInterviewers(data);
            }).catch(err => {
                console.error('Failed to fetch interviewers:', err);
                setInterviewers([]);
            });

            // Fetch designs for this customer
            getDesigns(customer.得意先CD, selectedFile, customer.直送先名 || undefined).then(data => {
                setDesigns(data);
            }).catch(err => {
                console.error('Failed to fetch designs:', err);
                setDesigns([]);
            });
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData(prev => ({
            ...prev,
            [e.target.name]: e.target.value
        }));
    };

    const handleDesignModeChange = (mode: 'none' | 'new' | 'existing') => {
        setDesignMode(mode);
        if (mode === 'none') {
            setFormData(prev => ({
                ...prev,
                デザイン提案有無: '',
                デザイン種別: '',
                デザイン名: '',
                デザイン進捗状況: '',
                'デザイン依頼No.': ''
            }));
        } else if (mode === 'new') {
            setFormData(prev => ({
                ...prev,
                デザイン提案有無: 'あり',
                デザイン種別: '',
                デザイン名: '',
                デザイン進捗状況: '新規',
                'デザイン依頼No.': ''
            }));
        } else if (mode === 'existing') {
            setFormData(prev => ({
                ...prev,
                デザイン提案有無: 'あり',
                デザイン種別: '',
                デザイン名: '',
                デザイン進捗状況: '',
                'デザイン依頼No.': ''
            }));
        }
    };

    const handleDesignSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const designNo = e.target.value;
        const selectedDesign = designs.find(d => String(d.デザイン依頼No) === designNo);
        if (selectedDesign) {
            setFormData(prev => ({
                ...prev,
                'デザイン依頼No.': String(selectedDesign.デザイン依頼No),
                デザイン種別: selectedDesign.デザイン種別,
                デザイン名: selectedDesign.デザイン名,
                デザイン進捗状況: selectedDesign.デザイン進捗状況
            }));
        }
    };



    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            if (!isOnline) {
                saveOfflineReport(formData, selectedFile);
                onSuccess();
                return;
            }

            // 外出時間の場合は商談内容に時間を追記
            let finalFormData = { 
                ...formData,
                日付: normalizeDateInput(formData.日付)
            };
            if (formData.行動内容 === '外出時間') {
                let timeString = '';
                if (startOutTime && endOutTime) {
                    timeString += `【外出時間】${startOutTime}〜${endOutTime}\n`;
                }
                if (formData.ランク) {
                    timeString += `【満足度】${formData.ランク}\n`;
                }
                finalFormData.商談内容 = timeString + (formData.商談内容 || '');
                // ユーザー要望: ランクカラムには保存しない
                finalFormData.ランク = '';
            }

            const response = await fetch(`/api/reports?filename=${encodeURIComponent(selectedFile)}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(finalFormData),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));

                if (response.status === 422) {
                    // バリデーションエラー
                    const details = errorData.detail || '入力内容を確認してください';
                    toast.error(`入力エラー: ${details}`, {
                        duration: 6000,
                        style: {
                            border: '1px solid #f59e0b',
                            padding: '16px',
                        }
                    });
                    throw new Error(`Validation error: ${details}`);
                } else if (response.status === 409) {
                    // コンフリクトエラー
                    toast.error('データの競合が発生しました。ページを更新してください', {
                        duration: 5000
                    });
                    throw new Error('Conflict error');
                } else if (response.status >= 500) {
                    // サーバーエラー
                    toast.error('サーバーエラーが発生しました。しばらくしてからお試しください', {
                        duration: 5000
                    });
                    throw new Error('Server error');
                } else {
                    // その他のHTTPエラー
                    const message = errorData.detail || response.statusText;
                    toast.error(`エラー (${response.status}): ${message}`);
                    throw new Error(`HTTP ${response.status}: ${message}`);
                }
            }

            const responseData = await response.json();
            toast.success(`日報を保存しました (No. ${responseData.management_number})`, { duration: 3000 });
            // 送信成功時に下書きをクリア
            clearDraft();
            onSuccess();
        } catch (error: any) {
            console.error('Error creating report:', error);

            // ネットワークエラーのチェック
            if (error.message?.includes('Failed to fetch') || !navigator.onLine) {
                toast.error('ネットワーク接続を確認してください', {
                    duration: 5000,
                    icon: '🌐'
                });
                return;
            }

            // 既にtoast.errorで表示済みのエラーは再表示しない
            if (error.message?.includes('Validation error') ||
                error.message?.includes('Conflict error') ||
                error.message?.includes('Server error') ||
                error.message?.includes('HTTP')) {
                // 既に適切なエラーメッセージが表示されているので何もしない
                return;
            }

            // その他の予期しないエラー
            toast.error(`予期しないエラーが発生しました: ${error.message}`);
        } finally {
            setSubmitting(false);
        }
    };

    const handleClearCustomer = () => {
        setFormData(prev => ({
            ...prev,
            訪問先名: '',
        }));
        filterCustomers('');
    };

    const isMinimalUI = ['社内（１日）', '社内（半日）', '外出時間'].includes(formData.行動内容);
    const isOuting = formData.行動内容 === '外出時間';


    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={(e) => { if (!submitting && e.target === e.currentTarget) onClose(); }}>
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-sf-border p-4 flex justify-between items-center z-10">
                    <h2 className="text-xl font-bold text-sf-text">
                        新規日報作成
                        {submitting && <span className="ml-3 text-sm text-blue-600">処理中...</span>}
                    </h2>
                    <button
                        onClick={onClose}
                        disabled={submitting}
                        className="text-sf-text-weak hover:text-sf-text disabled:opacity-50 disabled:cursor-not-allowed"
                        title={submitting ? "処理が完了するまでお待ちください" : ""}
                    >
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-sf-text mb-1">日付 *</label>
                            <input
                                type="text"
                                name="日付"
                                value={formData.日付}
                                onChange={handleChange}
                                placeholder="YY/MM/DD"
                                required
                                className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-sf-text mb-1">行動内容 *</label>
                            <select
                                name="行動内容"
                                value={formData.行動内容}
                                onChange={handleChange}
                                required
                                className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue"
                            >
                                <option value="">選択してください</option>
                                <option value="-">-</option>
                                <option value="訪問（アポあり）">訪問（アポあり）</option>
                                <option value="訪問（アポなし）">訪問（アポなし）</option>
                                <option value="訪問（新規）">訪問（新規）</option>
                                <option value="訪問（クレーム）">訪問（クレーム）</option>
                                <option value="電話商談">電話商談</option>
                                <option value="電話アポ取り">電話アポ取り</option>
                                <option value="メール商談">メール商談</option>
                                <option value="量販店調査">量販店調査</option>
                                <option value="社内（半日）">社内（半日）</option>
                                <option value="社内（１日）">社内（１日）</option>
                                <option value="外出時間">外出時間</option>
                                <option value="その他">その他</option>
                            </select>
                        </div>

                        {/* 行動内容と同じ行にエリア選択ドロップダウンを配置 */}
                        {!isMinimalUI && (
                            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-sf-text mb-1">エリア</label>
                                    <select
                                        name="エリア"
                                        value={formData.エリア}
                                        onChange={handleChange}
                                        className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue ${!formData.エリア ? 'border-amber-300 bg-amber-50' : 'border-sf-border'
                                            }`}
                                    >
                                        <option value="">エリアを選択</option>
                                        {areaOptions.map(area => (
                                            <option key={area} value={area}>{area}</option>
                                        ))}
                                    </select>
                                    {!formData.エリア && (
                                        <p className="mt-1 text-xs text-amber-600">⚠ エリアが未選択です</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {isOuting && (
                            <div className="md:col-span-2 grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded border border-sf-border">
                                <div>
                                    <label className="block text-sm font-medium text-sf-text mb-1">出発時間 *</label>
                                    <select
                                        value={startOutTime}
                                        onChange={(e) => {
                                            setStartOutTime(e.target.value);
                                            if (endOutTime && e.target.value >= endOutTime) {
                                                setEndOutTime('');
                                            }
                                        }}
                                        required
                                        className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue"
                                    >
                                        <option value="">選択してください</option>
                                        {timeOptions.map(time => (
                                            <option key={time} value={time}>{time}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-sf-text mb-1">帰社時間 *</label>
                                    <select
                                        value={endOutTime}
                                        onChange={(e) => setEndOutTime(e.target.value)}
                                        required
                                        className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue"
                                    >
                                        <option value="">選択してください</option>
                                        {timeOptions.filter(t => !startOutTime || t > startOutTime).map(time => (
                                            <option key={time} value={time}>{time}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        {!isMinimalUI && (
                            <div className="md:col-span-2 relative">
                                <label className="block text-sm font-medium text-sf-text mb-1">訪問先名（得意先名） *</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        name="訪問先名"
                                        value={formData.訪問先名}
                                        onChange={handleCustomerNameChange}
                                        required={!isMinimalUI}
                                        autoComplete="off"
                                        className="w-full pl-3 pr-10 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue"
                                    />
                                    {formData.訪問先名 && (
                                        <button
                                            type="button"
                                            onClick={handleClearCustomer}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
                                            title="クリア"
                                        >
                                            <X size={16} />
                                        </button>
                                    )}
                                </div>
                                {formData.直送先名 && (
                                    <div className="mt-1 text-sm text-sf-light-blue flex items-center gap-1">
                                        <Truck size={12} />
                                        直送先: {formData.直送先名} (CD: {formData.直送先CD})
                                    </div>
                                )}
                                {showSuggestions && (
                                    <ul className="absolute z-20 w-full bg-white border border-sf-border rounded mt-1 max-h-60 overflow-y-auto shadow-lg">
                                        {filteredCustomers.map((customer, index) => (
                                            <li
                                                key={index}
                                                className="px-3 py-2 hover:bg-sf-bg-light cursor-pointer"
                                                onClick={() => selectCustomer(customer)}
                                            >
                                                <div className="font-medium">
                                                    {customer.得意先名}
                                                    {customer.直送先名 && <span className="text-sm font-normal ml-2 text-sf-text-weak">(直送先: {customer.直送先名})</span>}
                                                </div>
                                                <div className="text-xs text-sf-text-weak">
                                                    {customer.得意先CD} - {customer.エリア}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}

                        {!isMinimalUI && (
                            <div>
                                <label className="block text-sm font-medium text-sf-text mb-1">面談者</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        name="面談者"
                                        value={formData.面談者}
                                        onChange={handleChange}
                                        list="interviewer-suggestions"
                                        className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue"
                                    />
                                    <datalist id="interviewer-suggestions">
                                        {interviewers.map((interviewer, index) => (
                                            <option key={index} value={interviewer} />
                                        ))}
                                    </datalist>
                                </div>
                            </div>
                        )}

                        {!isMinimalUI && (
                            <div>
                                <label className="block text-sm font-medium text-sf-text mb-1">滞在時間</label>
                                <select
                                    name="滞在時間"
                                    value={formData.滞在時間}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue"
                                >
                                    <option value="">選択してください</option>
                                    <option value="-">-</option>
                                    <option value="10分未満">10分未満</option>
                                    <option value="30分未満">30分未満</option>
                                    <option value="60分未満">60分未満</option>
                                    <option value="60分以上">60分以上</option>
                                </select>
                            </div>
                        )}

                        {/* 満足度・ランク分岐：外出時間のみ表示 */}
                        {isOuting && (
                            <div>
                                <label className="block text-sm font-medium text-sf-text mb-1">満足度（達成率）</label>
                                <select
                                    name="ランク"
                                    value={formData.ランク}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue"
                                >
                                    <option value="">選択してください</option>
                                    <option value="25%">25%</option>
                                    <option value="50%">50%</option>
                                    <option value="75%">75%</option>
                                    <option value="100%">100%</option>
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Design Input Section */}
                    {!isMinimalUI && (
                        <div className="md:col-span-2 border-t border-sf-border pt-4 mt-2">
                            <h3 className="font-medium text-sf-text mb-3">デザイン情報</h3>
                            <div className="space-y-4">
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="radio"
                                            name="designMode"
                                            value="none"
                                            checked={designMode === 'none'}
                                            onChange={() => handleDesignModeChange('none')}
                                            className="text-sf-light-blue focus:ring-sf-light-blue"
                                        />
                                        <span>なし</span>
                                    </label>
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="radio"
                                            name="designMode"
                                            value="new"
                                            checked={designMode === 'new'}
                                            onChange={() => handleDesignModeChange('new')}
                                            className="text-sf-light-blue focus:ring-sf-light-blue"
                                        />
                                        <span>新規</span>
                                    </label>
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="radio"
                                            name="designMode"
                                            value="existing"
                                            checked={designMode === 'existing'}
                                            onChange={() => handleDesignModeChange('existing')}
                                            className="text-sf-light-blue focus:ring-sf-light-blue"
                                        />
                                        <span>既存</span>
                                    </label>
                                </div>

                                {designMode === 'existing' && (
                                    <div>
                                        <label className="block text-sm font-medium text-sf-text mb-1">過去のデザイン案件</label>
                                        <select
                                            onChange={handleDesignSelect}
                                            value={formData['デザイン依頼No.']}
                                            className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue"
                                        >
                                            <option value="">選択してください</option>
                                            {designs.map((design) => (
                                                <option key={String(design.デザイン依頼No)} value={String(design.デザイン依頼No)}>
                                                    {design.デザイン依頼No} - {design.デザイン名} ({design.デザイン進捗状況})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {(designMode === 'new' || designMode === 'existing') && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-sf-text mb-1">デザイン依頼No.</label>
                                            <input
                                                type="text"
                                                name="デザイン依頼No."
                                                value={formData['デザイン依頼No.']}
                                                onChange={handleChange}
                                                readOnly={designMode === 'existing'}
                                                className={`w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue ${designMode === 'existing' ? 'bg-gray-100' : ''}`}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-sf-text mb-1">デザイン種別</label>
                                            <select
                                                name="デザイン種別"
                                                value={formData.デザイン種別}
                                                onChange={handleChange}
                                                className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue"
                                            >
                                                <option value="">選択してください</option>
                                                <option value="-">-</option>
                                                <option value="別注（新版）">別注（新版）</option>
                                                <option value="別注（改版）">別注（改版）</option>
                                                <option value="別注（再版）">別注（再版）</option>
                                                <option value="SP（新版）">SP（新版）</option>
                                            </select>
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-sf-text mb-1">デザイン名</label>
                                            <input
                                                type="text"
                                                name="デザイン名"
                                                value={formData.デザイン名}
                                                onChange={handleChange}
                                                className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-sf-text mb-1">デザイン進捗状況</label>
                                            <select
                                                name="デザイン進捗状況"
                                                value={formData.デザイン進捗状況}
                                                onChange={handleChange}
                                                className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue"
                                            >
                                                <option value="">選択してください</option>
                                                <option value="-">-</option>
                                                <option value="新規">新規</option>
                                                <option value="50％未満">50％未満</option>
                                                <option value="80％未満">80％未満</option>
                                                <option value="80％以上">80％以上</option>
                                                <option value="出稿">出稿</option>
                                                <option value="不採用（コンペ負け）">不採用（コンペ負け）</option>
                                                <option value="不採用（企画倒れ）">不採用（企画倒れ）</option>
                                                <option value="保留">保留</option>
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-sf-text mb-1">商談内容</label>
                        <textarea
                            name="商談内容"
                            value={formData.商談内容}
                            onChange={handleChange}
                            rows={4}
                            className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue transition-all duration-200 resize-none"
                            onFocus={(e) => e.currentTarget.rows = 8}
                            onBlur={(e) => e.currentTarget.rows = 4}
                        />
                    </div>

                    {!isMinimalUI && (
                        <div>
                            <label className="block text-sm font-medium text-sf-text mb-1">提案物</label>
                            <textarea
                                name="提案物"
                                value={formData.提案物}
                                onChange={handleChange}
                                rows={1}
                                className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue transition-all duration-200 resize-none"
                                onFocus={(e) => e.currentTarget.rows = 6}
                                onBlur={(e) => e.currentTarget.rows = 1}
                            />
                        </div>
                    )}

                    {!isMinimalUI && (
                        <div>
                            <label className="block text-sm font-medium text-sf-text mb-1">次回プラン</label>
                            <textarea
                                name="次回プラン"
                                value={formData.次回プラン}
                                onChange={handleChange}
                                rows={1}
                                className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue transition-all duration-200 resize-none"
                                onFocus={(e) => e.currentTarget.rows = 6}
                                onBlur={(e) => e.currentTarget.rows = 1}
                            />
                        </div>
                    )}

                    {!isMinimalUI && (
                        <div>
                            <label className="block text-sm font-medium text-sf-text mb-1">競合他社情報</label>
                            <textarea
                                name="競合他社情報"
                                value={formData.競合他社情報}
                                onChange={handleChange}
                                rows={1}
                                className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue transition-all duration-200 resize-none"
                                onFocus={(e) => e.currentTarget.rows = 4}
                                onBlur={(e) => e.currentTarget.rows = 1}
                            />
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4 border-t border-sf-border">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="px-4 py-2 border border-sf-border rounded text-sf-text hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            キャンセル
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-4 py-2 bg-sf-light-blue text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {submitting ? (
                                <>
                                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    作成中...
                                </>
                            ) : '作成'}
                        </button>
                    </div>
                </form>
            </div>


        </div>
    );
}
