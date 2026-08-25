import React, { useState, useEffect } from 'react';
import { Customer, Design, getCustomers, getInterviewers, getDesigns, getSuggestedArea, getLatestDesignRequests, ViewerDesignRequest } from '@/lib/api';
import { useOffline } from '@/context/OfflineContext';
import { useLocalStorageDraft } from '@/hooks/useLocalStorageDraft';
import { X, Truck, Loader2, Check, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { normalizeDateInput, convertYYMMDDToYYYYMMDD, convertYYYYMMDDToYYMMDD } from '@/lib/reportUtils';

export type InitialDesignData = {
    得意先CD?: string;
    得意先名?: string;
    デザイン依頼No?: string;
    デザイン名?: string;
    デザイン種別?: string;
    デザイン進捗状況?: string;
    designMode?: 'new' | 'existing';
};

type NewReportModalProps = {
    onClose: () => void;
    onSuccess: () => void;
    selectedFile: string;
    initialDesignData?: InitialDesignData;
};

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
    const [saveStatus, setSaveStatus] = useState<'idle' | 'sending' | 'writing' | 'backup' | 'success'>('idle');
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [interviewers, setInterviewers] = useState<string[]>([]);
    const [designMode, setDesignMode] = useState<'none' | 'new' | 'existing'>(
        initialDesignData?.designMode || (initialDesignData ? 'existing' : (initialDraft?.designMode || 'none'))
    );
    const [designs, setDesigns] = useState<Design[]>([]);
    
    // 企画課ビューア連携用のステート
    const [viewerRequests, setViewerRequests] = useState<ViewerDesignRequest[]>([]);
    const [viewerAuthError, setViewerAuthError] = useState(false);

    // ファイル名から担当営業名（名字）を抽出するヘルパー
    const extractSalesPersonName = (filename: string | null | undefined): string => {
        if (!filename) return '';
        const base = String(filename).replace(/\.xlsm$/, '');
        const matchBrackets = base.match(/【(.*?)】/);
        let name = matchBrackets ? matchBrackets[1] : base;
        name = name.replace(/^日報_/, '');
        name = name.replace(/(MGR|Mgr|次長|課長|部長|係長|主任|担当|顧問|専務|常務|社長)$/i, '');
        name = name.replace(/[\(（].*?[\)）]/, '');
        return name.trim();
    };

    const [passcode, setPasscode] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);

    // 企画課ビューアから最新デザイン依頼を取得
    const loadViewerRequests = async (code?: string) => {
        setIsVerifying(true);
        try {
            const savedCode = code || (typeof window !== 'undefined' ? localStorage.getItem('viewer_passcode') : null) || '';
            const data = await getLatestDesignRequests(savedCode);
            if (data && data.documents) {
                setViewerRequests(data.documents);
            }
            setViewerAuthError(false);
            if (code) {
                localStorage.setItem('viewer_passcode', code);
            }
        } catch (err: unknown) {
            console.error('Failed to fetch design requests from viewer:', err);
            const error = err as { response?: { status?: number } };
            if (error.response?.status === 401) {
                setViewerAuthError(true);
            }
        } finally {
            setIsVerifying(false);
        }
    };

    useEffect(() => {
        loadViewerRequests();
    }, []);

    const [viewerSearchTerm, setViewerSearchTerm] = useState('');
    const activeSalesPerson = extractSalesPersonName(selectedFile);
    
    // 担当営業名が自分自身の「進行中」の依頼を抽出
    const filteredViewerRequests = viewerRequests.filter(req => {
        if (!req) return false;
        if (req.status === 'completed' || req.status === 'rejected' || req.status === 'inSubmission') {
            return false;
        }
        if (!req.salesPerson || !activeSalesPerson) return false;
        
        let isRepMatch = false;
        try {
            const viewerRep = String(req.salesPerson).toLowerCase().trim();
            const activeRep = String(activeSalesPerson).toLowerCase().trim();
            isRepMatch = viewerRep.includes(activeRep) || activeRep.includes(viewerRep);
        } catch (e) {
            console.error('Error filtering viewer requests:', e);
        }

        if (!isRepMatch) return false;

        // キーワード検索によるさらなる絞り込み
        if (viewerSearchTerm.trim()) {
            const term = viewerSearchTerm.toLowerCase().trim();
            const reqId = String(req.requestId || '').toLowerCase();
            const content = String(req.designContent || '').toLowerCase();
            const customer = String(req.customer || '').toLowerCase();
            return reqId.includes(term) || content.includes(term) || customer.includes(term);
        }
        
        return true;
    });
    const [startOutTime, setStartOutTime] = useState('');
    const [endOutTime, setEndOutTime] = useState('');
    // 得意先リストからエリア一覧を動的に取得
    const [areaOptions, setAreaOptions] = useState<string[]>([]);
    // 下書き復元時の状態管理
    const [isDraftRestored, setIsDraftRestored] = useState(!initialDesignData && !!initialDraft);

    // 下書き復元通知（初回マウント時のみ）
    useEffect(() => {
        if (isDraftRestored) {
            toast.success('前回の入力内容を復元しました', { icon: '📝', id: 'modal-draft-restored' });
        }
    }, []);

    const handleDiscardDraft = (): void => {
        clearDraft();
        setFormData(defaultFormData);
        setDesignMode('none');
        setIsDraftRestored(false);
        toast.success('下書きを破棄しました');
    };

    // formDataまたはdesignMode変更時に自動保存
    useEffect(() => {
        const hasData = !!(
            formData.訪問先名 ||
            formData.行動内容 ||
            formData.商談内容 ||
            formData.面談者 ||
            formData.提案物 ||
            formData.次回プラン ||
            formData.競合他社情報 ||
            formData.エリア ||
            formData['デザイン依頼No.']
        );
        if (hasData) {
            saveDraft({ formData, designMode });
        } else {
            clearDraft();
        }
    }, [formData, designMode, saveDraft, clearDraft]);



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
            if (initialDesignData) {
                let customer = null;
                if (initialDesignData.得意先CD) {
                    customer = data.find(c => String(c.得意先CD) === initialDesignData.得意先CD);
                } else if (initialDesignData.得意先名) {
                    // 得意先CDがない場合、得意先名から名寄せする (完全一致 -> 前方一致 -> 部分一致)
                    const name = String(initialDesignData.得意先名).toLowerCase().trim();
                    customer = data.find(c => String(c.得意先名).toLowerCase() === name) ||
                               data.find(c => String(c.得意先名).toLowerCase().startsWith(name)) ||
                               data.find(c => name.includes(String(c.得意先名).toLowerCase()) || String(c.得意先名).toLowerCase().includes(name));
                }

                if (customer) {
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

                    // Fetch interviewers and designs for this customer
                    const cCd = customer.得意先CD;
                    const cName = customer.得意先名;
                    const cDeli = customer.直送先名 || undefined;
                    getInterviewers(cCd, selectedFile, cName, cDeli).then(d => setInterviewers(d)).catch(() => setInterviewers([]));
                    getDesigns(cCd, selectedFile, cDeli).then(d => setDesigns(d)).catch(() => setDesigns([]));
                }
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
    }, [selectedFile, isOnline, initialDesignData]);


    // Handle customer name change with keyword search across all fields including kana
    const handleCustomerNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setFormData(prev => ({
            ...prev,
            訪問先名: value,
            得意先CD: '',
            直送先名: '',
            直送先CD: '',
            重点顧客: '',
            ランク: ''
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

    const loadDesignsForTypedCustomer = (): void => {
        if (formData.得意先CD) return;

        const name = formData.訪問先名.trim();
        if (!name) {
            setDesigns([]);
            return;
        }

        getDesigns(name, selectedFile, formData.直送先名 || undefined)
            .then(data => {
                setDesigns(data);
            })
            .catch(err => {
                console.error('Failed to fetch designs for typed customer:', err);
                setDesigns([]);
            });
    };

    const loadSuggestedAreaForTypedCustomer = (): void => {
        if (formData.得意先CD) return;

        const name = formData.訪問先名.trim();
        if (!name) return;

        getSuggestedArea(name, selectedFile)
            .then(data => {
                if (data.suggested_area) {
                    setFormData(prev => ({
                        ...prev,
                        エリア: data.suggested_area
                    }));
                }
            })
            .catch(err => {
                console.error('Failed to suggest area for typed customer:', err);
            });
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>): void => {
        setFormData(prev => ({
            ...prev,
            [e.target.name]: e.target.value
        }));
    };

    const handleDesignModeChange = (mode: 'none' | 'new' | 'existing'): void => {
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
            loadDesignsForTypedCustomer();
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

    const handleViewerDesignSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const key = e.target.value;
        if (!key) return;
        const [reqId, subId] = key.split('_');
        const req = viewerRequests.find(r => r.requestId === reqId && r.subId === subId);
        if (req) {
            const shortId = req.requestId.split('-')[0]; // ハイフンより前の最初の6桁(枝番なし)のみ
            
            // 得意先名の名寄せ正規化関数
            const normalizeName = (name: string): string => {
                return name
                    .replace(/[\(（]株[\)）]/g, '')
                    .replace(/[\(（]有[\)）]/g, '')
                    .replace(/株式会社/g, '')
                    .replace(/有限会社/g, '')
                    .replace(/\s+/g, '')
                    .toLowerCase()
                    .trim();
            };

            const viewerCustomerNormalized = normalizeName(req.customer || '');
            let matchedCustomer = customers.find(c => {
                const masterNameNormalized = normalizeName(c.得意先名 || '');
                return masterNameNormalized === viewerCustomerNormalized && masterNameNormalized.length > 0;
            });

            if (!matchedCustomer) {
                matchedCustomer = customers.find(c => {
                    const masterNameNormalized = normalizeName(c.得意先名 || '');
                    if (!masterNameNormalized || !viewerCustomerNormalized) return false;
                    return masterNameNormalized.includes(viewerCustomerNormalized) || viewerCustomerNormalized.includes(masterNameNormalized);
                });
            }

            setFormData(prev => {
                const baseUpdate = {
                    ...prev,
                    'デザイン依頼No.': shortId,
                    デザイン名: req.designContent // 依頼内容＝デザイン名
                };

                if (matchedCustomer) {
                    return {
                        ...baseUpdate,
                        訪問先名: matchedCustomer.得意先名 || '',
                        直送先名: matchedCustomer.直送先名 || '',
                        得意先CD: matchedCustomer.得意先CD || '',
                        直送先CD: matchedCustomer.直送先CD || '',
                        エリア: matchedCustomer.エリア || '',
                        重点顧客: matchedCustomer.重点顧客 || '',
                        ランク: matchedCustomer.ランク || ''
                    };
                } else {
                    return {
                        ...baseUpdate,
                        訪問先名: req.customer || '',
                        得意先CD: '',
                        直送先名: '',
                        直送先CD: '',
                        重点顧客: '',
                        ランク: ''
                    };
                }
            });

            // 得意先CDがあれば非同期で面談者とデザイン案件を自動ロード
            if (matchedCustomer && matchedCustomer.得意先CD) {
                getInterviewers(matchedCustomer.得意先CD, selectedFile, matchedCustomer.得意先名)
                    .then(d => setInterviewers(d))
                    .catch(() => setInterviewers([]));
                getDesigns(matchedCustomer.得意先CD, selectedFile)
                    .then(d => setDesigns(d))
                    .catch(() => setDesigns([]));
            } else {
                setInterviewers([]);
                setDesigns([]);
            }
        }
    };



    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setSaveStatus('sending');

        // 成功フラグ（クロージャの stale state 問題を回避するためローカル変数で管理）
        let succeeded = false;

        try {
            if (!isOnline) {
                saveOfflineReport(formData, selectedFile);
                setSaveStatus('success');
                succeeded = true;
                // 成功演出をしっかり見せるためのウェイト
                await new Promise(resolve => setTimeout(resolve, 1000));
                onSuccess();
                return;
            }

            // 外出時間の場合は商談内容に時間を追記
            const finalFormData = { 
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

            // API呼び出しと最低表示時間を並行実行
            // → レスポンスが早くてもアニメーションが見える
            const minimumDisplayPromise = (async () => {
                // 送信中を最低400ms表示
                await new Promise(resolve => setTimeout(resolve, 400));
                setSaveStatus('writing');
                // 書き込み中を最低500ms表示
                await new Promise(resolve => setTimeout(resolve, 500));
                setSaveStatus('backup');
                // バックアップ中を最低400ms表示
                await new Promise(resolve => setTimeout(resolve, 400));
            })();

            const responsePromise = fetch(`/api/reports?filename=${encodeURIComponent(selectedFile)}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(finalFormData),
            });

            // API応答と最低表示時間の両方を待つ
            const [response] = await Promise.all([responsePromise, minimumDisplayPromise]);

            if (!response.ok) {
                setSaveStatus('idle');
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
            setSaveStatus('success');
            succeeded = true;
            
            toast.success(`日報を保存しました (No. ${responseData.management_number})`, { duration: 3000 });
            // 送信成功時に下書きをクリア
            clearDraft();
            
            // 成功アニメーションをしっかり見せてから閉じる
            await new Promise(resolve => setTimeout(resolve, 1200));
            onSuccess();
        } catch (error: unknown) {
            setSaveStatus('idle');
            console.error('Error creating report:', error);

            const err = error as { message?: string };
            // ネットワークエラーのチェック
            if (err.message?.includes('Failed to fetch') || !navigator.onLine) {
                toast.error('ネットワーク接続を確認してください', {
                    duration: 5000,
                    icon: '🌐'
                });
                return;
            }

            // 既にtoast.errorで表示済みのエラーは再表示しない
            if (err.message?.includes('Validation error') ||
                err.message?.includes('Conflict error') ||
                err.message?.includes('Server error') ||
                err.message?.includes('HTTP')) {
                // 既に適切なエラーメッセージが表示されているので何もしない
                return;
            }

            // その他の予期しないエラー
            toast.error(`予期しないエラーが発生しました: ${err.message}`);
        } finally {
            // 成功した場合は onSuccess() によりモーダルが閉じてアンマウントされるため、
            // エラー等で送信完了しなかった場合のみ submitting を解除
            if (!succeeded) {
                setSubmitting(false);
            }
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto pt-10 md:pt-16" onClick={(e) => { if (!submitting && e.target === e.currentTarget) onClose(); }}>
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-sf-border p-4 flex justify-between items-center z-10">
                    <div className="flex items-center gap-3">
                        <h2 className="text-xl font-bold text-sf-text">
                            新規日報作成
                            {submitting && <span className="ml-3 text-sm text-blue-600">処理中...</span>}
                        </h2>
                        {isDraftRestored && (
                            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                                <span className="text-xs text-blue-700 font-medium animate-pulse">
                                    一時保存データを復元中
                                </span>
                                <button
                                    type="button"
                                    onClick={handleDiscardDraft}
                                    className="text-xs font-normal text-red-500 hover:text-red-700 hover:underline cursor-pointer"
                                    title="下書きを破棄して入力を初期化します"
                                >
                                    破棄
                                </button>
                            </div>
                        )}
                    </div>
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
                                type="date"
                                name="日付"
                                value={convertYYMMDDToYYYYMMDD(formData.日付)}
                                onChange={(e) => {
                                    const yyyymmdd = e.target.value;
                                    const yymmdd = convertYYYYMMDDToYYMMDD(yyyymmdd);
                                    setFormData(prev => ({
                                        ...prev,
                                        日付: yymmdd
                                    }));
                                }}
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
                                {[
                                    '-',
                                    '訪問（アポあり）',
                                    '訪問（アポなし）',
                                    '訪問（新規）',
                                    '訪問（クレーム）',
                                    '電話商談',
                                    '電話アポ取り',
                                    'メール商談',
                                    '量販店調査',
                                    '社内（半日）',
                                    '社内（１日）',
                                    '外出時間',
                                    'その他'
                                ]
                                    .filter(action => {
                                        // 得意先や訪問先が入力されている場合は、社内業務や外出時間を除外
                                        if (formData.得意先CD || formData.訪問先名) {
                                            return !['社内（半日）', '社内（１日）', '外出時間'].includes(action);
                                        }
                                        return true;
                                    })
                                    .map(action => (
                                        <option key={action} value={action}>{action}</option>
                                    ))
                                }
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
                                        onBlur={(): void => {
                                            loadDesignsForTypedCustomer();
                                            loadSuggestedAreaForTypedCustomer();
                                        }}
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
                                    <option value="0%">0%</option>
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

                                {designMode === 'new' && (
                                    <div className="mb-3">
                                        <label className="block text-sm font-medium text-sf-text mb-1">デザイン作成依頼（企画課）から選択</label>
                                        {viewerAuthError ? (
                                            <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded p-3 flex flex-col gap-1.5 shadow-sm">
                                                <div className="font-bold flex items-center justify-between">
                                                    <span>⚠️ 企画課ビューアとのデータ連携が未接続です</span>
                                                </div>
                                                <div className="text-gray-600 text-[11px] leading-normal">
                                                    連携用のパスコードが設定されていないか、有効期限が切れています。
                                                    「設定」画面からパスコードを登録し、ログイン接続テストを行ってください。
                                                </div>
                                                <div className="mt-1">
                                                    <a 
                                                        href="/settings" 
                                                        className="inline-block px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-semibold transition-colors cursor-pointer"
                                                    >
                                                        設定画面でパスコードを登録する
                                                    </a>
                                                </div>
                                            </div>
                                        ) : (
                                            <select
                                                onChange={handleViewerDesignSelect}
                                                className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue"
                                            >
                                                <option value="">最新の作成依頼を選択してください (自分の案件のみ)</option>
                                                {filteredViewerRequests.map((req) => {
                                                    const shortId = req.requestId.split('-')[0];
                                                    return (
                                                        <option key={`${req.requestId}_${req.subId}`} value={`${req.requestId}_${req.subId}`}>
                                                            {shortId} - {req.designContent} ({req.customer})
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                        )}
                                    </div>
                                )}

                                {designMode === 'existing' && (
                                    <div className="mb-3">
                                        <label className="block text-sm font-medium text-sf-text mb-1">過去の日報履歴から選択</label>
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
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="block text-sm font-medium text-sf-text">デザイン依頼No.</label>
                                                {formData['デザイン依頼No.'] && (
                                                    <a
                                                        href="http://192.168.1.5:8888/viewer.html"
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-xs text-sf-light-blue hover:underline flex items-center gap-1 font-semibold"
                                                        title="企画課ビューアを開く"
                                                    >
                                                        <ExternalLink size={12} /> ビューアを開く
                                                    </a>
                                                )}
                                            </div>
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
                                                {formData.デザイン種別 && !['-', '別注（新版）', '別注（改版）', '別注（再版）', 'SP（新版）'].includes(formData.デザイン種別) && (
                                                    <option value={formData.デザイン種別}>{formData.デザイン種別}</option>
                                                )}
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
                            className={`relative overflow-hidden px-5 py-2.5 font-medium rounded transition-all duration-300 flex items-center justify-center gap-2 min-w-[120px] active:scale-95 text-sm ${
                                saveStatus === 'idle'
                                    ? 'bg-slate-800 hover:bg-slate-900 text-white shadow-sm hover:shadow-md cursor-pointer'
                                    : saveStatus === 'success'
                                    ? 'bg-teal-700 text-white shadow-inner'
                                    : 'bg-slate-700 text-slate-200 cursor-wait'
                            }`}
                        >
                            {/* プログレスライン */}
                            {saveStatus !== 'idle' && saveStatus !== 'success' && (
                                <div 
                                    className="absolute bottom-0 left-0 h-[3px] bg-cyan-500 transition-all duration-700 ease-out"
                                    style={{
                                        width: saveStatus === 'sending' ? '30%' : saveStatus === 'writing' ? '70%' : '95%'
                                    }}
                                />
                            )}
                            
                            {/* シマー効果の背景レイヤー */}
                            {(saveStatus === 'writing' || saveStatus === 'backup') && (
                                <div className="absolute inset-0 animate-shimmer opacity-20 pointer-events-none" />
                            )}

                            {/* ボタンコンテンツ */}
                            {saveStatus === 'idle' && (
                                <>
                                    作成
                                </>
                            )}

                            {saveStatus === 'sending' && (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin text-slate-300" />
                                    データを送信中...
                                </>
                            )}

                            {saveStatus === 'writing' && (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin text-slate-300" />
                                    Excelへ書き込み中...
                                </>
                            )}

                            {saveStatus === 'backup' && (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin text-slate-300" />
                                    バックアップ作成中...
                                </>
                            )}

                            {saveStatus === 'success' && (
                                <div className="flex items-center gap-1.5 animate-bounceIn">
                                    <Check className="w-4 h-4 text-white" strokeWidth={3} />
                                    保存が完了しました
                                </div>
                            )}
                        </button>
                    </div>
                </form>
            </div>


        </div>
    );
}
