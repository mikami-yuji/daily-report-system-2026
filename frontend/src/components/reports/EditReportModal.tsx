import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Report, updateReport, getDesigns, Design, getSuggestedArea, Customer, getCustomers, getInterviewers } from '@/lib/api';
import { sanitizeReport, normalizeDateInput, convertYYMMDDToYYYYMMDD, convertYYYYMMDDToYYMMDD } from '@/lib/reportUtils';
import { X, Loader2, Check, MapPin, Truck } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLocalStorageDraft } from '@/hooks/useLocalStorageDraft';
import { useOffline } from '@/context/OfflineContext';

// ローカルストレージからコメント下書きデータを取得する関数
const getCommentDraft = (reportId: number | string | undefined, field: string): string | null => {
    if (typeof window === 'undefined' || !reportId) {
        return null;
    }
    return localStorage.getItem(`draft_comment_${reportId}_${field}`);
};

// ローカルストレージにコメント下書きデータを保存する関数
const saveCommentDraft = (reportId: number | string | undefined, field: string, value: string): void => {
    if (typeof window === 'undefined' || !reportId) {
        return;
    }
    localStorage.setItem(`draft_comment_${reportId}_${field}`, value);
};

// ローカルストレージのコメント下書きデータを削除する関数
const clearCommentDraft = (reportId: number | string | undefined, field: string): void => {
    if (typeof window === 'undefined' || !reportId) {
        return;
    }
    localStorage.removeItem(`draft_comment_${reportId}_${field}`);
};

type EditReportModalProps = {
    report: Report;
    onClose: () => void;
    onSuccess: () => void;
    selectedFile: string;
    reports: Report[];
};

export default function EditReportModal({ report, onClose, onSuccess, selectedFile, reports }: EditReportModalProps) {



    // Parse initial time and clean content from 商談内容
    const parseInitialData = (content: unknown) => {
        if (!content || typeof content !== 'string') return { start: '', end: '', content: '', satisfaction: '' };

        let newContent = content;
        let start = '';
        let end = '';
        let satisfaction = '';

        // Extract Time
        const timeMatch = newContent.match(/^【外出時間】(\d{2}:\d{2})〜(\d{2}:\d{2})\n/);
        if (timeMatch) {
            start = timeMatch[1];
            end = timeMatch[2];
            newContent = newContent.replace(timeMatch[0], '');
        }

        // Extract Satisfaction tag if present
        const satMatch = newContent.match(/^【満足度】(.*)\n/);
        if (satMatch) {
            satisfaction = satMatch[1];
            newContent = newContent.replace(satMatch[0], '');
        }

        return { start, end, content: newContent, satisfaction };
    };

    const initialParsed = (report?.行動内容 === '外出時間' && report?.商談内容)
        ? parseInitialData(report.商談内容)
        : { start: '', end: '', content: report?.商談内容 || '', satisfaction: '' };

    type EditDraftData = {
        formData: {
            日付: string;
            行動内容: string;
            エリア: string;
            得意先CD: string;
            直送先CD: string;
            訪問先名: string;
            直送先名: string;
            面談者: string;
            滞在時間: string;
            商談内容: string;
            提案物: string;
            次回プラン: string;
            競合他社情報: string;
            重点顧客: string;
            ランク: string;
            デザイン提案有無: string;
            デザイン種別: string;
            デザイン名: string;
            デザイン進捗状況: string;
            'デザイン依頼No.': string;
        };
        startOutTime: string;
        endOutTime: string;
        designMode: 'none' | 'new' | 'existing';
    };

    const { getDraft, saveDraft, clearDraft } = useLocalStorageDraft<EditDraftData>(
        report?.管理番号 ? `edit-report-basic-draft-${report.管理番号}` : ''
    );

    // 下書きがあれば復元、なければExcelからロードされた初期値
    const initialDraft = React.useMemo(() => (report?.管理番号 ? getDraft() : null), [report?.管理番号, getDraft]);

    const [formData, setFormData] = useState({
        日付: initialDraft?.formData ? initialDraft.formData.日付 : (report?.日付 || ''),
        行動内容: initialDraft?.formData ? initialDraft.formData.行動内容 : (report?.行動内容 || ''),
        エリア: initialDraft?.formData ? initialDraft.formData.エリア : (report?.エリア || ''),
        得意先CD: initialDraft?.formData ? initialDraft.formData.得意先CD : (report?.得意先CD || ''),
        直送先CD: initialDraft?.formData ? initialDraft.formData.直送先CD : (report?.直送先CD || ''),
        訪問先名: initialDraft?.formData ? initialDraft.formData.訪問先名 : (report?.訪問先名 || ''),
        直送先名: initialDraft?.formData ? initialDraft.formData.直送先名 : (report?.直送先名 || ''),
        面談者: initialDraft?.formData ? initialDraft.formData.面談者 : (report?.面談者 || ''),
        滞在時間: initialDraft?.formData ? initialDraft.formData.滞在時間 : (report?.滞在時間 || ''),
        商談内容: initialDraft?.formData ? initialDraft.formData.商談内容 : initialParsed.content,
        提案物: initialDraft?.formData ? initialDraft.formData.提案物 : (report?.提案物 || ''),
        次回プラン: initialDraft?.formData ? initialDraft.formData.次回プラン : (report?.次回プラン || ''),
        競合他社情報: initialDraft?.formData ? initialDraft.formData.競合他社情報 : (report?.競合他社情報 || ''),
        重点顧客: initialDraft?.formData ? initialDraft.formData.重点顧客 : (report?.重点顧客 || ''),
        ランク: initialDraft?.formData ? initialDraft.formData.ランク : (initialParsed.satisfaction || report?.ランク || ''), // ランクカラムが空でも本文から復元
        上長コメント: report?.上長コメント || report?.コメント || '',
        コメント返信欄: report?.コメント返信欄 || '',
        デザイン提案有無: initialDraft?.formData ? initialDraft.formData.デザイン提案有無 : (report?.デザイン提案有無 || ''),
        デザイン種別: initialDraft?.formData ? initialDraft.formData.デザイン種別 : (report?.デザイン種別 || ''),
        デザイン名: initialDraft?.formData ? initialDraft.formData.デザイン名 : (report?.デザイン名 || ''),
        デザイン進捗状況: initialDraft?.formData ? initialDraft.formData.デザイン進捗状況 : (report?.デザイン進捗状況 || ''),
        'デザイン依頼No.': initialDraft?.formData ? initialDraft.formData['デザイン依頼No.'] : (report?.['デザイン依頼No.'] || '')
    });
    const [startOutTime, setStartOutTime] = useState(initialDraft ? initialDraft.startOutTime : initialParsed.start);
    const [endOutTime, setEndOutTime] = useState(initialDraft ? initialDraft.endOutTime : initialParsed.end);
    const [designMode, setDesignMode] = useState<'none' | 'new' | 'existing'>(() => {
        if (initialDraft) return initialDraft.designMode;
        if (report?.デザイン提案有無 === 'あり') {
            return report?.['デザイン依頼No.'] ? 'existing' : 'new';
        }
        return 'none';
    });
    const [designs, setDesigns] = useState<Design[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
    const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
    const [deliverySearchTerm, setDeliverySearchTerm] = useState('');
    const [showDeliverySuggestions, setShowDeliverySuggestions] = useState(false);
    const [interviewers, setInterviewers] = useState<string[]>([]);

    const justSelectedCustomerRef = useRef(false);
    const justSelectedDeliveryRef = useRef(false);

    const { isOnline, cachedCustomers, cacheCustomers } = useOffline();

    // 顧客マスタのロード
    useEffect(() => {
        if (selectedFile) {
            getCustomers(selectedFile)
                .then(data => {
                    setCustomers(data);
                    if (cacheCustomers) cacheCustomers(data);
                })
                .catch(err => {
                    console.error('Failed to fetch customers in EditReportModal:', err);
                    if (cachedCustomers && cachedCustomers.length > 0) {
                        setCustomers(cachedCustomers);
                    }
                });
        }
    }, [selectedFile]);

    // 初期の得意先CDがあれば面談者リストを取得
    useEffect(() => {
        if (formData.得意先CD) {
            getInterviewers(formData.得意先CD, selectedFile, formData.訪問先名, formData.直送先名 || undefined)
                .then(setInterviewers)
                .catch(() => setInterviewers([]));
        }
    }, [formData.得意先CD, selectedFile]);

    const commentSaveTimersRef = useRef<{ [field: string]: NodeJS.Timeout }>({});
    const pendingCommentsRef = useRef<{ [field: string]: string }>({});

    // アンマウント時・レポート変更時に保留中のコメント下書きを即座に保存
    useEffect((): () => void => {
        return (): void => {
            Object.values(commentSaveTimersRef.current).forEach(clearTimeout);
            if (report?.管理番号) {
                Object.entries(pendingCommentsRef.current).forEach(([field, value]) => {
                    try {
                        localStorage.setItem(`draft_comment_${report.管理番号}_${field}`, value);
                    } catch (e) {
                        console.error(`Failed to save pending comment draft on unmount:`, e);
                    }
                });
            }
            commentSaveTimersRef.current = {};
            pendingCommentsRef.current = {};
        };
    }, [report?.管理番号]);

    const saveCommentDraftDebounced = useCallback((field: string, value: string): void => {
        if (!report?.管理番号) return;
        pendingCommentsRef.current[field] = value;
        if (commentSaveTimersRef.current[field]) {
            clearTimeout(commentSaveTimersRef.current[field]);
        }
        commentSaveTimersRef.current[field] = setTimeout((): void => {
            if (report?.管理番号) {
                try {
                    localStorage.setItem(`draft_comment_${report.管理番号}_${field}`, value);
                    delete pendingCommentsRef.current[field];
                } catch (e) {
                    console.error(`Failed to save comment draft:`, e);
                }
            }
        }, 1000);
    }, [report?.管理番号]);

    const clearCommentDraftAndPending = useCallback((field: string): void => {
        if (commentSaveTimersRef.current[field]) {
            clearTimeout(commentSaveTimersRef.current[field]);
            delete commentSaveTimersRef.current[field];
        }
        delete pendingCommentsRef.current[field];
        if (report?.管理番号) {
            clearCommentDraft(report.管理番号, field);
        }
    }, [report?.管理番号]);

    useEffect(() => {
        const draftComment = getCommentDraft(report?.管理番号, '上長コメント');
        const draftReply = getCommentDraft(report?.管理番号, 'コメント返信欄');

        if (draftComment !== null || draftReply !== null) {
            setFormData(prev => ({
                ...prev,
                上長コメント: draftComment !== null ? draftComment : prev.上長コメント,
                コメント返信欄: draftReply !== null ? draftReply : prev.コメント返信欄
            }));
        }
    }, [report]);

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

    useEffect((): void => {
        if (formData.得意先CD) {
            getDesigns(formData.得意先CD, selectedFile, formData.直送先名 || undefined)
                .then(data => setDesigns(data))
                .catch(err => {
                    console.error('Failed to fetch designs in EditReportModal:', err);
                    setDesigns([]);
                });
        }
    }, [formData.得意先CD, selectedFile, formData.直送先名]);

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

    // 時間の選択肢を生成 (08:00 - 23:00)
    const timeOptions = [];
    for (let i = 8; i <= 23; i++) {
        timeOptions.push(`${String(i).padStart(2, '0')}:00`);
        if (i < 23) {
            timeOptions.push(`${String(i).padStart(2, '0')}:30`);
        }
    }
    const [submitting, setSubmitting] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'sending' | 'writing' | 'backup' | 'success'>('idle');

    // Capture initial critical values for conflict detection
    const initialCriticalValues = React.useMemo(() => ({
        '上長コメント': report?.上長コメント || '',
        'コメント返信欄': report?.コメント返信欄 || '',
        '商談内容': report?.商談内容 || ''
    }), [report]);

    const getOriginalBasicValues = React.useCallback(() => {
        const parsed = (report?.行動内容 === '外出時間' && report?.商談内容)
            ? parseInitialData(report.商談内容)
            : { start: '', end: '', content: report?.商談内容 || '', satisfaction: '' };
        return {
            日付: report?.日付 || '',
            行動内容: report?.行動内容 || '',
            エリア: report?.エリア || '',
            得意先CD: report?.得意先CD || '',
            直送先CD: report?.直送先CD || '',
            訪問先名: report?.訪問先名 || '',
            直送先名: report?.直送先名 || '',
            面談者: report?.面談者 || '',
            滞在時間: report?.滞在時間 || '',
            商談内容: parsed.content,
            提案物: report?.提案物 || '',
            次回プラン: report?.次回プラン || '',
            競合他社情報: report?.競合他社情報 || '',
            重点顧客: report?.重点顧客 || '',
            ランク: parsed.satisfaction || report?.ランク || '',
            デザイン提案有無: report?.デザイン提案有無 || '',
            デザイン種別: report?.デザイン種別 || '',
            デザイン名: report?.デザイン名 || '',
            デザイン進捗状況: report?.デザイン進捗状況 || '',
            'デザイン依頼No.': report?.['デザイン依頼No.'] || '',
            startOutTime: parsed.start,
            endOutTime: parsed.end,
            designMode: report?.デザイン提案有無 === 'あり' ? (report?.['デザイン依頼No.'] ? 'existing' : 'new' as 'none' | 'new' | 'existing') : 'none' as 'none' | 'new' | 'existing'
        };
    }, [report]);

    // 基本情報の変更を監視して自動保存
    useEffect(() => {
        if (!report?.管理番号) return;
        
        const original = getOriginalBasicValues();
        const current = {
            日付: formData.日付,
            行動内容: formData.行動内容,
            エリア: formData.エリア,
            得意先CD: formData.得意先CD,
            直送先CD: formData.直送先CD,
            訪問先名: formData.訪問先名,
            直送先名: formData.直送先名,
            面談者: formData.面談者,
            滞在時間: formData.滞在時間,
            商談内容: formData.商談内容,
            提案物: formData.提案物,
            次回プラン: formData.次回プラン,
            競合他社情報: formData.競合他社情報,
            重点顧客: formData.重点顧客 || '',
            ランク: formData.ランク,
            デザイン提案有無: formData.デザイン提案有無,
            デザイン種別: formData.デザイン種別,
            デザイン名: formData.デザイン名,
            デザイン進捗状況: formData.デザイン進捗状況,
            'デザイン依頼No.': formData['デザイン依頼No.'],
            startOutTime,
            endOutTime,
            designMode
        };

        const hasChange = Object.keys(current).some(key => {
            return current[key as keyof typeof current] !== original[key as keyof typeof original];
        });

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

        if (hasChange && hasData) {
            saveDraft({
                formData: {
                    日付: formData.日付,
                    行動内容: formData.行動内容,
                    エリア: formData.エリア,
                    得意先CD: formData.得意先CD,
                    直送先CD: formData.直送先CD,
                    訪問先名: formData.訪問先名,
                    直送先名: formData.直送先名,
                    面談者: formData.面談者,
                    滞在時間: formData.滞在時間,
                    商談内容: formData.商談内容,
                    提案物: formData.提案物,
                    次回プラン: formData.次回プラン,
                    競合他社情報: formData.競合他社情報,
                    重点顧客: formData.重点顧客,
                    ランク: formData.ランク,
                    デザイン提案有無: formData.デザイン提案有無,
                    デザイン種別: formData.デザイン種別,
                    デザイン名: formData.デザイン名,
                    デザイン進捗状況: formData.デザイン進捗状況,
                    'デザイン依頼No.': formData['デザイン依頼No.']
                },
                startOutTime,
                endOutTime,
                designMode
            });
        } else {
            clearDraft();
        }
    }, [formData, startOutTime, endOutTime, designMode, report, saveDraft, clearDraft, getOriginalBasicValues]);

    const handleDiscardBasicDraft = (): void => {
        clearDraft();
        const original = getOriginalBasicValues();
        setFormData(prev => ({
            ...prev,
            日付: original.日付,
            行動内容: original.行動内容,
            エリア: original.エリア,
            得意先CD: original.得意先CD,
            直送先CD: original.直送先CD,
            訪問先名: original.訪問先名,
            直送先名: original.直送先名,
            面談者: original.面談者,
            滞在時間: original.滞在時間,
            商談内容: original.商談内容,
            提案物: original.提案物,
            次回プラン: original.次回プラン,
            競合他社情報: original.競合他社情報,
            重点顧客: original.重点顧客,
            ランク: original.ランク,
            デザイン提案有無: original.デザイン提案有無,
            デザイン種別: original.デザイン種別,
            デザイン名: original.デザイン名,
            デザイン進捗状況: original.デザイン進捗状況,
            'デザイン依頼No.': original['デザイン依頼No.']
        }));
        setStartOutTime(original.startOutTime);
        setEndOutTime(original.endOutTime);
        setDesignMode(original.designMode);
        toast.success('基本情報の下書きを破棄しました');
    };





    const handleSubmit = async (e: React.FormEvent): Promise<void> => {
        e.preventDefault();

        // 管理番号の検証
        if (!report?.管理番号) {
            toast.error('管理番号が無効です。日報を再読み込みしてください。');
            setSubmitting(false);
            return;
        }

        setSubmitting(true);
        setSaveStatus('sending');

        // 成功フラグ（クロージャの stale state 問題を回避するためローカル変数で管理）
        let succeeded = false;

        const finalFormData = { 
            ...formData,
            日付: normalizeDateInput(formData.日付)
        };

        // 外出時間の場合は商談内容に時間を追記
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

        // バックエンドのReportInputに対応するフィールドのみ送信（余分なフィールドで422を防ぐ）
        const sanitized = sanitizeReport({ ...finalFormData, original_values: initialCriticalValues });

        try {
            // API呼び出しと最低表示時間を並行実行
            // → レスポンスが早くてもアニメーションが見える
            const minimumDisplayPromise = (async (): Promise<void> => {
                // 送信中を最低400ms表示
                await new Promise(resolve => setTimeout(resolve, 400));
                setSaveStatus('writing');
                // 書き込み中を最低500ms表示
                await new Promise(resolve => setTimeout(resolve, 500));
                setSaveStatus('backup');
                // バックアップ中を最低400ms表示
                await new Promise(resolve => setTimeout(resolve, 400));
            })();

            const updatePromise = updateReport(report?.管理番号, sanitized, selectedFile);

            // API応答と最低表示時間の両方を待つ
            await Promise.all([updatePromise, minimumDisplayPromise]);
            
            setSaveStatus('success');
            succeeded = true;

            toast.success(`日報を更新しました (No. ${report?.管理番号})`);
            clearDraft();
            if (report?.管理番号) {
                clearCommentDraftAndPending('上長コメント');
                clearCommentDraftAndPending('コメント返信欄');
            }
            
            // 成功アニメーションをしっかり見せてから閉じる
            await new Promise(resolve => setTimeout(resolve, 1200));
            onSuccess();
        } catch (error: unknown) {
            setSaveStatus('idle');
            
            // エラーログを出力（既存の console.error を維持）
            console.error('Error updating report:', error);

            const axiosError = error as {
                response?: {
                    status?: number;
                    data?: { detail?: string | unknown };
                };
                message?: string;
            };

            if (axiosError.response && axiosError.response.status === 409) {
                // 競合エラーの検出
                const detailMessage = typeof axiosError.response.data?.detail === 'string'
                    ? axiosError.response.data.detail
                    : '他の方が編集しました。最新の情報を読み込んでからやり直してください。';
                toast.error(detailMessage, {
                    duration: 6000,
                    style: {
                        border: '1px solid #ef4444',
                        padding: '16px',
                        color: '#ef4444',
                    },
                    iconTheme: {
                        primary: '#ef4444',
                        secondary: '#FFFAEE',
                    },
                });
            } else {
                const errorDetail = axiosError.response?.data?.detail 
                    ? (typeof axiosError.response.data.detail === 'string' 
                        ? axiosError.response.data.detail 
                        : JSON.stringify(axiosError.response.data.detail))
                    : axiosError.message;
                toast.error(`日報の更新に失敗しました: ${errorDetail}`);
            }
        } finally {
            if (!succeeded) {
                setSubmitting(false);
            }
        }
    };
    // 得意先名検索
    const filterCustomers = (searchTerm: string) => {
        if (!searchTerm.trim()) {
            setFilteredCustomers([]);
            setShowCustomerSuggestions(false);
            return;
        }

        const lowerSearchTerm = searchTerm.toLowerCase();
        const katakanaSearchTerm = lowerSearchTerm.replace(/[\u3041-\u3096]/g, (match) => {
            const chr = match.charCodeAt(0) + 0x60;
            return String.fromCharCode(chr);
        });

        const filtered = customers.filter(c => {
            if (c.得意先名 && c.得意先名.toLowerCase().includes(lowerSearchTerm)) return true;
            if (c.得意先CD && String(c.得意先CD).toLowerCase().includes(lowerSearchTerm)) return true;
            if (c.フリガナ && c.フリガナ.toLowerCase().includes(katakanaSearchTerm)) return true;
            if (c.直送先名 && c.直送先名.toLowerCase().includes(lowerSearchTerm)) return true;
            if (c.直送先CD && String(c.直送先CD).toLowerCase().includes(lowerSearchTerm)) return true;
            return false;
        }).slice(0, 30);

        setFilteredCustomers(filtered);
        setShowCustomerSuggestions(filtered.length > 0);
    };

    // 得意先選択
    const selectCustomer = (customer: Customer) => {
        setFormData(prev => ({
            ...prev,
            訪問先名: customer.得意先名 || '',
            得意先CD: customer.得意先CD || '',
            直送先名: customer.直送先名 || '',
            直送先CD: customer.直送先CD || '',
            エリア: customer.エリア || prev.エリア,
            重点顧客: customer.重点顧客 || prev.重点顧客,
            ランク: customer.ランク || prev.ランク
        }));
        justSelectedCustomerRef.current = true;
        setShowCustomerSuggestions(false);
        setDeliverySearchTerm('');
        setShowDeliverySuggestions(false);

        if (customer.得意先CD) {
            getInterviewers(customer.得意先CD, selectedFile, customer.得意先名, customer.直送先名 || undefined)
                .then(setInterviewers)
                .catch(() => setInterviewers([]));
            getDesigns(customer.得意先CD, selectedFile, customer.直送先名 || undefined)
                .then(setDesigns)
                .catch(() => setDesigns([]));
        }
    };

    // 得意先クリア
    const handleClearCustomer = () => {
        setFormData(prev => ({
            ...prev,
            訪問先名: '',
            得意先CD: '',
            直送先名: '',
            直送先CD: '',
            重点顧客: '',
            ランク: ''
        }));
        setShowCustomerSuggestions(false);
        setDeliverySearchTerm('');
        setShowDeliverySuggestions(false);
        setInterviewers([]);
        setDesigns([]);
    };

    // 直送先候補フィルタ
    const filterDeliveries = (term: string): Customer[] => {
        const lowerTerm = term.toLowerCase().trim();

        // 得意先が選択されている場合: その得意先CDに紐づく直送先レコードを抽出
        if (formData.得意先CD) {
            const related = customers.filter(c => c.得意先CD === formData.得意先CD && c.直送先名);
            if (!lowerTerm) return related;
            return related.filter(c =>
                (c.直送先CD && String(c.直送先CD).toLowerCase().includes(lowerTerm)) ||
                (c.直送先名 && String(c.直送先名).toLowerCase().includes(lowerTerm))
            );
        }

        // 得意先が未選択の場合: 直送先名が存在するレコードから検索
        if (!lowerTerm) return [];
        return customers.filter(c =>
            c.直送先名 && (
                (c.直送先CD && String(c.直送先CD).toLowerCase().includes(lowerTerm)) ||
                (c.直送先名 && String(c.直送先名).toLowerCase().includes(lowerTerm)) ||
                (c.得意先名 && String(c.得意先名).toLowerCase().includes(lowerTerm))
            )
        ).slice(0, 20);
    };

    // 直送先選択
    const selectDelivery = (item: Customer) => {
        const willSetCustomer = !formData.得意先CD && !formData.訪問先名 && item.得意先CD;
        setFormData(prev => ({
            ...prev,
            直送先名: item.直送先名 || '',
            直送先CD: item.直送先CD || '',
            ...(willSetCustomer ? {
                得意先CD: item.得意先CD || '',
                訪問先名: item.得意先名 || '',
                エリア: item.エリア || prev.エリア,
                ランク: item.ランク || prev.ランク,
                重点顧客: item.重点顧客 || prev.重点顧客
            } : {})
        }));

        justSelectedDeliveryRef.current = true;
        setShowDeliverySuggestions(false);
        setDeliverySearchTerm('');

        const targetCd = formData.得意先CD || item.得意先CD;
        const targetName = formData.訪問先名 || item.得意先名;
        if (targetCd) {
            getDesigns(targetCd, selectedFile, item.直送先名 || undefined)
                .then(setDesigns)
                .catch(() => setDesigns([]));
            getInterviewers(targetCd, selectedFile, targetName, item.直送先名)
                .then(setInterviewers)
                .catch(() => setInterviewers([]));
        }
    };

    // 直送先クリア
    const clearDelivery = () => {
        setFormData(prev => ({
            ...prev,
            直送先名: '',
            直送先CD: ''
        }));
        setDeliverySearchTerm('');
        setShowDeliverySuggestions(false);

        if (formData.得意先CD) {
            getDesigns(formData.得意先CD, selectedFile, undefined)
                .then(setDesigns)
                .catch(() => setDesigns([]));
            getInterviewers(formData.得意先CD, selectedFile, formData.訪問先名, undefined)
                .then(setInterviewers)
                .catch(() => setInterviewers([]));
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>): void => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));

        if (report?.管理番号 && (name === '上長コメント' || name === 'コメント返信欄')) {
            const original = name === '上長コメント'
                ? (report?.上長コメント || report?.コメント || '')
                : (report?.コメント返信欄 || '');

            if (value === original || !value) {
                clearCommentDraftAndPending(name);
            } else {
                saveCommentDraftDebounced(name, value);
            }
        }
    };

    // 下書きデータを破棄して元の値に戻す関数
    const handleDiscardDraft = (field: '上長コメント' | 'コメント返信欄'): void => {
        clearCommentDraftAndPending(field);
        setFormData(prev => ({
            ...prev,
            [field]: field === '上長コメント'
                ? (report?.上長コメント || report?.コメント || '')
                : (report?.コメント返信欄 || '')
        }));
        toast.success('下書きを破棄しました');
    };

    const isMinimalUI = ['社内（１日）', '社内（半日）', '外出時間'].includes(formData.行動内容);
    const isOuting = formData.行動内容 === '外出時間';

    if (!report) return null;

    const originalComment = report?.上長コメント || report?.コメント || '';
    const originalReply = report?.コメント返信欄 || '';

    const hasDraftComment = formData.上長コメント !== originalComment;
    const hasDraftReply = formData.コメント返信欄 !== originalReply;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto pt-10 md:pt-16" onClick={(e) => { if (!submitting && e.target === e.currentTarget) onClose(); }}>
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-sf-border p-4 flex justify-between items-center z-10">
                    <div className="flex items-center gap-3">
                        <h2 className="text-xl font-bold text-sf-text">
                            日報編集 (No. {report?.管理番号})
                            {submitting && <span className="ml-3 text-sm text-blue-600">処理中...</span>}
                        </h2>
                        {report?._is_pending_sync && (
                            <span className="text-xs px-2.5 py-1 rounded font-semibold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1 shadow-2xs">
                                ☁️ 一時退避中（未同期）
                            </span>
                        )}
                        {initialDraft && (
                            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                                <span className="text-xs text-blue-700 font-medium animate-pulse">
                                    編集データを復元中
                                </span>
                                <button
                                    type="button"
                                    onClick={handleDiscardBasicDraft}
                                    className="text-xs font-normal text-red-500 hover:text-red-700 hover:underline cursor-pointer"
                                    title="下書きを破棄して元のデータに戻します"
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

                {report?._is_pending_sync && (
                    <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 text-xs text-amber-800 flex items-center gap-2">
                        <span className="text-base">☁️</span>
                        <span>
                            <strong>一時退避中（未同期）：</strong> この日報はオフラインまたはサーバー未接続時に保存されました。再編集して保存した場合もオフラインキューで保持され、ファイルサーバー復旧時に自動同期されます。
                        </span>
                    </div>
                )}

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
                                            // 出発時間が変更されたら、帰社時間がそれより前ならリセット
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
                            <div className="relative">
                                <label className="block text-sm font-medium text-sf-text mb-1">訪問先名（得意先名） *</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        name="訪問先名"
                                        value={formData.訪問先名}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setFormData(prev => ({
                                                ...prev,
                                                訪問先名: value
                                            }));
                                            filterCustomers(value);
                                        }}
                                        onFocus={() => {
                                            if (formData.訪問先名) filterCustomers(formData.訪問先名);
                                        }}
                                        onBlur={() => {
                                            setTimeout(() => {
                                                if (justSelectedCustomerRef.current) {
                                                    justSelectedCustomerRef.current = false;
                                                    setShowCustomerSuggestions(false);
                                                    return;
                                                }
                                                setShowCustomerSuggestions(false);
                                                loadDesignsForTypedCustomer();
                                                loadSuggestedAreaForTypedCustomer();
                                            }, 200);
                                        }}
                                        required={!isMinimalUI}
                                        autoComplete="off"
                                        placeholder="得意先名またはコードを入力..."
                                        className="w-full pl-3 pr-8 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue text-sm"
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
                                {showCustomerSuggestions && filteredCustomers.length > 0 && (
                                    <ul className="absolute z-30 w-full bg-white border border-sf-border rounded-md mt-1 max-h-60 overflow-y-auto shadow-lg text-sm">
                                        {filteredCustomers.map((customer, index) => (
                                            <li
                                                key={index}
                                                className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                                                onMouseDown={() => selectCustomer(customer)}
                                            >
                                                <div className="font-medium text-sf-text">
                                                    {customer.得意先名}
                                                    {customer.直送先名 && (
                                                        <span className="text-xs font-normal ml-2 text-sf-light-blue">
                                                            (直送先: {customer.直送先名})
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-sf-text-weak flex items-center gap-2 mt-0.5">
                                                    {customer.得意先CD && <span className="font-mono">{customer.得意先CD}</span>}
                                                    {customer.エリア && <span>- {customer.エリア}</span>}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}

                        {!isMinimalUI && (
                            <div className="relative">
                                <label className="block text-sm font-medium text-sf-text mb-1 flex items-center justify-between">
                                    <span>直送先CD / 直送先名 <span className="text-gray-400 font-normal">（任意）</span></span>
                                    {formData.直送先CD && (
                                        <span className="text-xs font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                            CD: {formData.直送先CD}
                                        </span>
                                    )}
                                </label>
                                {formData.直送先CD || formData.直送先名 ? (
                                    <div className="flex items-center gap-2 px-3 py-2 bg-blue-50/70 border border-blue-200 rounded min-h-[38px]">
                                        <MapPin size={16} className="text-blue-500 flex-shrink-0" />
                                        {formData.直送先CD && (
                                            <span className="font-mono text-xs text-blue-700 font-semibold flex-shrink-0">
                                                {formData.直送先CD}
                                            </span>
                                        )}
                                        <span className="text-sm text-sf-text font-medium truncate">
                                            {formData.直送先名 || '（直送先名なし）'}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={clearDelivery}
                                            className="ml-auto text-gray-400 hover:text-red-500 p-1 rounded hover:bg-white/80 transition-colors flex-shrink-0"
                                            title="直送先を解除"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                        <input
                                            type="text"
                                            value={deliverySearchTerm}
                                            onChange={(e) => {
                                                setDeliverySearchTerm(e.target.value);
                                                setShowDeliverySuggestions(true);
                                            }}
                                            onFocus={() => setShowDeliverySuggestions(true)}
                                            onBlur={() => {
                                                setTimeout(() => {
                                                    if (justSelectedDeliveryRef.current) {
                                                        justSelectedDeliveryRef.current = false;
                                                        setShowDeliverySuggestions(false);
                                                        return;
                                                    }
                                                    const term = deliverySearchTerm.trim();
                                                    if (term) {
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            直送先名: term,
                                                            直送先CD: ''
                                                        }));
                                                        setDeliverySearchTerm('');
                                                    }
                                                    setShowDeliverySuggestions(false);
                                                }, 200);
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    const term = deliverySearchTerm.trim();
                                                    if (term) {
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            直送先名: term,
                                                            直送先CD: ''
                                                        }));
                                                        setDeliverySearchTerm('');
                                                        setShowDeliverySuggestions(false);
                                                    }
                                                }
                                            }}
                                            placeholder={formData.得意先CD ? "直送先を選択 or 自由記載してEnter..." : "直送先を検索 or 自由記載してEnter..."}
                                            className="w-full pl-9 pr-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue text-sm"
                                        />
                                    </div>
                                )}

                                {/* 直送先サジェストドロップダウン */}
                                {showDeliverySuggestions && !formData.直送先CD && !formData.直送先名 && (
                                    (() => {
                                        const deliveryOptions = filterDeliveries(deliverySearchTerm);
                                        const hasSearchTerm = Boolean(deliverySearchTerm.trim());

                                        if (deliveryOptions.length === 0 && !hasSearchTerm) {
                                            if (formData.得意先CD) {
                                                return (
                                                    <div className="absolute z-30 w-full mt-1 bg-white border border-sf-border rounded-md shadow-lg p-3 text-xs text-gray-400">
                                                        登録されている直送先はありません。自由記載してEnterで追加できます。
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }

                                        return (
                                            <div className="absolute z-30 w-full mt-1 bg-white border border-sf-border rounded-md shadow-lg max-h-48 overflow-y-auto text-sm">
                                                {deliveryOptions.map((c, idx) => (
                                                    <div
                                                        key={`${c.得意先CD}-${c.直送先CD || idx}`}
                                                        className="px-3 py-2 hover:bg-blue-50 cursor-pointer flex items-center justify-between border-b border-gray-100 last:border-b-0"
                                                        onMouseDown={() => selectDelivery(c)}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <MapPin size={14} className="text-blue-500 flex-shrink-0" />
                                                            {c.直送先CD && <span className="font-mono text-xs text-gray-500">{c.直送先CD}</span>}
                                                            <span className="font-medium text-sf-text">{c.直送先名}</span>
                                                        </div>
                                                        {!formData.得意先CD && c.得意先名 && (
                                                            <span className="text-xs text-gray-400 truncate max-w-[120px]">
                                                                {c.得意先名}
                                                            </span>
                                                        )}
                                                    </div>
                                                ))}
                                                {hasSearchTerm && (
                                                    <div
                                                        className="px-3 py-2 text-xs text-amber-600 bg-amber-50 cursor-pointer hover:bg-amber-100 border-t border-amber-200"
                                                        onMouseDown={() => {
                                                            const term = deliverySearchTerm.trim();
                                                            if (term) {
                                                                setFormData(prev => ({
                                                                    ...prev,
                                                                    直送先名: term,
                                                                    直送先CD: ''
                                                                }));
                                                                setDeliverySearchTerm('');
                                                                setShowDeliverySuggestions(false);
                                                            }
                                                        }}
                                                    >
                                                        Enterで「{deliverySearchTerm}」を自由記載として設定
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()
                                )}
                            </div>
                        )}

                        {!isMinimalUI && (
                            <div>
                                <label className="block text-sm font-medium text-sf-text mb-1">面談者</label>
                                <input
                                    type="text"
                                    name="面談者"
                                    value={formData.面談者}
                                    onChange={handleChange}
                                    list="interviewer-edit-suggestions"
                                    className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue text-sm"
                                />
                                <datalist id="interviewer-edit-suggestions">
                                    {interviewers.map((interviewer, index) => (
                                        <option key={index} value={interviewer} />
                                    ))}
                                </datalist>
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

                    {/* デザイン情報セクション */}
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-sf-border">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <label className="block text-sm font-medium text-sf-text text-blue-800">上長コメント</label>
                                {hasDraftComment && (
                                    <div className="flex items-center gap-2 ml-auto">
                                        <span className="text-xs font-normal text-yellow-700 bg-yellow-100 border border-yellow-300 px-2 py-0.5 rounded animate-pulse">
                                            一時保存データを復元中
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => handleDiscardDraft('上長コメント')}
                                            className="text-xs font-normal text-red-500 hover:text-red-700 hover:underline cursor-pointer"
                                            title="下書きを破棄して元のデータに戻します"
                                        >
                                            下書きを破棄
                                        </button>
                                    </div>
                                )}
                            </div>
                            <textarea
                                name="上長コメント"
                                value={formData.上長コメント}
                                onChange={handleChange}
                                rows={4}
                                disabled={submitting}
                                className="w-full px-3 py-2 border border-blue-200 bg-blue-50 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
                                placeholder="上長からのコメントを入力..."
                            />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <label className="block text-sm font-medium text-sf-text text-green-800">コメント返信欄</label>
                                {hasDraftReply && (
                                    <div className="flex items-center gap-2 ml-auto">
                                        <span className="text-xs font-normal text-green-700 bg-green-100 border border-green-300 px-2 py-0.5 rounded animate-pulse">
                                            一時保存データを復元中
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => handleDiscardDraft('コメント返信欄')}
                                            className="text-xs font-normal text-red-500 hover:text-red-700 hover:underline cursor-pointer"
                                            title="下書きを破棄して元のデータに戻します"
                                        >
                                            下書きを破棄
                                        </button>
                                    </div>
                                )}
                            </div>
                            <textarea
                                name="コメント返信欄"
                                value={formData.コメント返信欄}
                                onChange={handleChange}
                                rows={4}
                                disabled={submitting}
                                className="w-full px-3 py-2 border border-green-200 bg-green-50 rounded focus:outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-50 disabled:cursor-not-allowed"
                                placeholder="コメントへの返信を入力..."
                            />
                        </div>
                    </div>

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
                                    更新
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
