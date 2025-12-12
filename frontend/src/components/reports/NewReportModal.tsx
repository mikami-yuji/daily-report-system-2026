import React, { useState, useEffect } from 'react';
import { Customer, Design, getCustomers, getInterviewers, getDesigns } from '@/lib/api';
import { useOffline } from '@/context/OfflineContext';
import { X, Truck } from 'lucide-react';
import toast from 'react-hot-toast';

interface NewReportModalProps {
    onClose: () => void;
    onSuccess: () => void;
    selectedFile: string;
}

export default function NewReportModal({ onClose, onSuccess, selectedFile }: NewReportModalProps) {
    const { isOnline, saveOfflineReport, cachedCustomers, cacheCustomers } = useOffline();

    const [formData, setFormData] = useState({
        日付: new Date().toISOString().split('T')[0].replace(/-/g, '/').slice(2), // YY/MM/DD format
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
        重点顧客: '',
        ランク: '',
        デザイン提案有無: '',
        デザイン種別: '',
        デザイン名: '',
        デザイン進捗状況: '',
        'デザイン依頼No.': '',
    });
    const [submitting, setSubmitting] = useState(false);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [interviewers, setInterviewers] = useState<string[]>([]);
    const [designMode, setDesignMode] = useState<'none' | 'new' | 'existing'>('none');
    const [designs, setDesigns] = useState<Design[]>([]);
    const [startOutTime, setStartOutTime] = useState('');
    const [endOutTime, setEndOutTime] = useState('');

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
        }).catch(err => {
            console.error('Failed to fetch customers:', err);
            // Fallback to cache if fetch fails (offline or server error)
            if (cachedCustomers.length > 0) {
                setCustomers(cachedCustomers);
                toast('キャッシュされた得意先リストを使用します', { icon: '📡' });
            }
        });
    }, [selectedFile, isOnline, cacheCustomers, cachedCustomers]);

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
            getDesigns(customer.得意先CD, selectedFile).then(data => {
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
            let finalFormData = { ...formData };
            if (formData.行動内容 === '外出時間') {
                let timeString = '';
                if (startOutTime && endOutTime) {
                    timeString += `【外出時間】${startOutTime}〜${endOutTime}\n`;
                }
                if (formData.ランク) {
                    timeString += `【満足度】${formData.ランク}\n`;
                }
                finalFormData.商談内容 = timeString + (formData.商談内容 || '');
            }

            const response = await fetch(`/api/reports?filename=${encodeURIComponent(selectedFile)}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(finalFormData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Server error details:', errorData);
                throw new Error(`Failed to create report: ${JSON.stringify(errorData)}`);
            }

            const responseData = await response.json();
            alert(`日報を保存しました。\n\n管理番号: ${responseData.management_number}\n\n保存先:\n${responseData.file_path}`);
            onSuccess();
        } catch (error: any) {
            console.error('Error creating report:', error);
            alert(`日報の作成に失敗しました: ${error.message}`);
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

    const isMinimalUI = ['社内（１日）', '社内（半日）', '量販店調査', '外出時間'].includes(formData.行動内容);
    const isOuting = formData.行動内容 === '外出時間';

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-sf-border p-4 flex justify-between items-center z-10">
                    <h2 className="text-xl font-bold text-sf-text">新規日報作成</h2>
                    <button
                        onClick={onClose}
                        className="text-sf-text-weak hover:text-sf-text"
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
                                            <input
                                                type="text"
                                                name="デザイン種別"
                                                value={formData.デザイン種別}
                                                onChange={handleChange}
                                                className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue"
                                            />
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

                    <div className="flex justify-end gap-3 pt-4 border-t border-sf-border">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border border-sf-border rounded text-sf-text hover:bg-gray-50"
                        >
                            キャンセル
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-4 py-2 bg-sf-light-blue text-white rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                            {submitting ? '作成中...' : '作成'}
                        </button>
                    </div>
                </form>
            </div >
        </div >
    );
}
