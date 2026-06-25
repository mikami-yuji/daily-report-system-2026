import React, { useState, useEffect } from 'react';
import { Report, updateReport, getDesigns, Design } from '@/lib/api';
import { sanitizeReport, normalizeDateInput } from '@/lib/reportUtils';
import { X, Loader2, Check } from 'lucide-react';
import toast from 'react-hot-toast';

// セッションストレージから下書きデータを取得する関数
const getSessionDraft = (reportId: number | string | undefined, field: string): string | null => {
    if (typeof window === 'undefined' || !reportId) {
        return null;
    }
    return sessionStorage.getItem(`draft_comment_${reportId}_${field}`);
};

// セッションストレージに下書きデータを保存する関数
const setSessionDraft = (reportId: number | string | undefined, field: string, value: string): void => {
    if (typeof window === 'undefined' || !reportId) {
        return;
    }
    sessionStorage.setItem(`draft_comment_${reportId}_${field}`, value);
};

// セッションストレージの下書きデータを削除する関数
const removeSessionDraft = (reportId: number | string | undefined, field: string): void => {
    if (typeof window === 'undefined' || !reportId) {
        return;
    }
    sessionStorage.removeItem(`draft_comment_${reportId}_${field}`);
};

interface EditReportModalProps {
    report: Report;
    onClose: () => void;
    onSuccess: () => void;
    selectedFile: string;
    reports: Report[];
}

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

    const [formData, setFormData] = useState({
        日付: report?.日付 || '',
        行動内容: report?.行動内容 || '',
        エリア: report?.エリア || '',
        得意先CD: report?.得意先CD || '',
        直送先CD: report?.直送先CD || '',
        訪問先名: report?.訪問先名 || '',
        直送先名: report?.直送先名 || '',
        面談者: report?.面談者 || '',
        滞在時間: report?.滞在時間 || '',
        商談内容: initialParsed.content,
        提案物: report?.提案物 || '',
        次回プラン: report?.次回プラン || '',
        競合他社情報: report?.競合他社情報 || '',
        重点顧客: report?.重点顧客 || '',
        ランク: initialParsed.satisfaction || report?.ランク || '', // ランクカラムが空でも本文から復元
        上長コメント: report?.上長コメント || report?.コメント || '',
        コメント返信欄: report?.コメント返信欄 || '',
        デザイン提案有無: report?.デザイン提案有無 || '',
        デザイン種別: report?.デザイン種別 || '',
        デザイン名: report?.デザイン名 || '',
        デザイン進捗状況: report?.デザイン進捗状況 || '',
        'デザイン依頼No.': report?.['デザイン依頼No.'] || ''
    });
    const [startOutTime, setStartOutTime] = useState(initialParsed.start);
    const [endOutTime, setEndOutTime] = useState(initialParsed.end);
    const [designMode, setDesignMode] = useState<'none' | 'new' | 'existing'>(() => {
        if (report?.デザイン提案有無 === 'あり') {
            return report?.['デザイン依頼No.'] ? 'existing' : 'new';
        }
        return 'none';
    });
    const [designs, setDesigns] = useState<Design[]>([]);

    useEffect(() => {
        const draftComment = getSessionDraft(report?.管理番号, '上長コメント');
        const draftReply = getSessionDraft(report?.管理番号, 'コメント返信欄');

        if (draftComment !== null || draftReply !== null) {
            setFormData(prev => ({
                ...prev,
                上長コメント: draftComment !== null ? draftComment : prev.上長コメント,
                コメント返信欄: draftReply !== null ? draftReply : prev.コメント返信欄
            }));
        }
    }, [report]);

    useEffect(() => {
        if (formData.得意先CD) {
            getDesigns(formData.得意先CD, selectedFile, formData.直送先名 || undefined)
                .then(data => setDesigns(data))
                .catch(err => {
                    console.error('Failed to fetch designs in EditReportModal:', err);
                    setDesigns([]);
                });
        }
    }, [formData.得意先CD, selectedFile, formData.直送先名]);

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





    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // 管理番号の検証
        if (!report?.管理番号) {
            toast.error('管理番号が無効です。日報を再読み込みしてください。');
            setSubmitting(false);
            return;
        }

        setSubmitting(true);
        setSaveStatus('sending');

        // 時間経過で段階的にステータスを遷移させるタイマー
        const timer1 = setTimeout(() => setSaveStatus('writing'), 600);
        const timer2 = setTimeout(() => setSaveStatus('backup'), 1800);

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
            await updateReport(report?.管理番号, sanitized, selectedFile);
            
            clearTimeout(timer1);
            clearTimeout(timer2);
            setSaveStatus('success');

            toast.success(`日報を更新しました (No. ${report?.管理番号})`);
            if (report?.管理番号) {
                removeSessionDraft(report.管理番号, '上長コメント');
                removeSessionDraft(report.管理番号, 'コメント返信欄');
            }
            
            // 成功アニメーションをしっかり見せてから閉じる
            await new Promise(resolve => setTimeout(resolve, 1200));
            onSuccess();
        } catch (error: unknown) {
            clearTimeout(timer1);
            clearTimeout(timer2);
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
            if (saveStatus !== 'success') {
                setSubmitting(false);
            }
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));

        if (report?.管理番号 && (name === '上長コメント' || name === 'コメント返信欄')) {
            const original = name === '上長コメント'
                ? (report?.上長コメント || report?.コメント || '')
                : (report?.コメント返信欄 || '');

            if (value === original) {
                removeSessionDraft(report.管理番号, name);
            } else {
                setSessionDraft(report.管理番号, name, value);
            }
        }
    };

    // 下書きデータを破棄して元の値に戻す関数
    const handleDiscardDraft = (field: '上長コメント' | 'コメント返信欄'): void => {
        removeSessionDraft(report?.管理番号, field);
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={(e) => { if (!submitting && e.target === e.currentTarget) onClose(); }}>
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-sf-border p-4 flex justify-between items-center z-10">
                    <h2 className="text-xl font-bold text-sf-text">
                        日報編集 (No. {report?.管理番号})
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
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-sf-text mb-1">訪問先名（得意先名） *</label>
                                <input
                                    type="text"
                                    name="訪問先名"
                                    value={formData.訪問先名}
                                    onChange={handleChange}
                                    required={!isMinimalUI}
                                    className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue"
                                />
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
                                    className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue"
                                />
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
