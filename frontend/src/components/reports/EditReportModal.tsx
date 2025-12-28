import React, { useState } from 'react';
import { Report, updateReport } from '@/lib/api';
import { sanitizeReport } from '@/lib/reportUtils';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';

interface EditReportModalProps {
    report: Report;
    onClose: () => void;
    onSuccess: () => void;
    selectedFile: string;
    reports: Report[];
}

export default function EditReportModal({ report, onClose, onSuccess, selectedFile, reports }: EditReportModalProps) {



    // Parse initial time and clean content from 商談内容
    const parseInitialData = (content: string) => {
        if (!content) return { start: '', end: '', content: '', satisfaction: '' };

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

    const initialParsed = (report.行動内容 === '外出時間' && report.商談内容)
        ? parseInitialData(report.商談内容)
        : { start: '', end: '', content: report.商談内容 || '', satisfaction: '' };

    const [formData, setFormData] = useState({
        日付: report.日付 || '',
        行動内容: report.行動内容 || '',
        エリア: report.エリア || '',
        得意先CD: report.得意先CD || '',
        直送先CD: report.直送先CD || '',
        訪問先名: report.訪問先名 || '',
        直送先名: report.直送先名 || '',
        面談者: report.面談者 || '',
        滞在時間: report.滞在時間 || '',
        商談内容: initialParsed.content,
        提案物: report.提案物 || '',
        次回プラン: report.次回プラン || '',
        競合他社情報: report.競合他社情報 || '',
        重点顧客: report.重点顧客 || '',
        ランク: initialParsed.satisfaction || report.ランク || '', // ランクカラムが空でも本文から復元
        上長コメント: report.上長コメント || '',
        コメント返信欄: report.コメント返信欄 || ''
    });
    const [startOutTime, setStartOutTime] = useState(initialParsed.start);
    const [endOutTime, setEndOutTime] = useState(initialParsed.end);

    // 時間の選択肢を生成 (08:00 - 23:00)
    const timeOptions = [];
    for (let i = 8; i <= 23; i++) {
        timeOptions.push(`${String(i).padStart(2, '0')}:00`);
        if (i < 23) {
            timeOptions.push(`${String(i).padStart(2, '0')}:30`);
        }
    }
    const [submitting, setSubmitting] = useState(false);

    // Capture initial critical values for conflict detection
    const initialCriticalValues = React.useMemo(() => ({
        '上長コメント': report.上長コメント,
        'コメント返信欄': report.コメント返信欄,
        '商談内容': report.商談内容
    }), [report]);





    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        const { 管理番号, ...rest } = report;

        let finalFormData = { ...formData };

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

        const fullReport = { ...rest, ...finalFormData, original_values: initialCriticalValues };
        const sanitized = sanitizeReport(fullReport);

        try {
            await updateReport(report.管理番号, sanitized, selectedFile);
            toast.success(`日報を更新しました (No. ${report.管理番号})`);
            onSuccess();
        } catch (error: any) {
            console.error('Error updating report:', error);

            if (error.response && error.response.status === 409) {
                // Conflict detected
                toast.error(error.response.data.detail || '他の方が編集しました。最新の情報を読み込んでからやり直してください。', {
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
                toast.error('日報の更新に失敗しました');
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData(prev => ({
            ...prev,
            [e.target.name]: e.target.value
        }));
    };

    const isMinimalUI = ['社内（１日）', '社内（半日）', '量販店調査', '外出時間'].includes(formData.行動内容);
    const isOuting = formData.行動内容 === '外出時間';

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-sf-border p-4 flex justify-between items-center z-10">
                    <h2 className="text-xl font-bold text-sf-text">日報編集 (No. {report.管理番号})</h2>
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
                            <label className="block text-sm font-medium text-sf-text mb-1 text-blue-800">上長コメント</label>
                            <textarea
                                name="上長コメント"
                                value={formData.上長コメント}
                                onChange={handleChange}
                                rows={4}
                                className="w-full px-3 py-2 border border-blue-200 bg-blue-50 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                                placeholder="上長からのコメントを入力..."
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-sf-text mb-1 text-green-800">コメント返信欄</label>
                            <textarea
                                name="コメント返信欄"
                                value={formData.コメント返信欄}
                                onChange={handleChange}
                                rows={4}
                                className="w-full px-3 py-2 border border-green-200 bg-green-50 rounded focus:outline-none focus:ring-2 focus:ring-green-400"
                                placeholder="コメントへの返信を入力..."
                            />
                        </div>
                    </div>

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
                            {submitting ? '更新中...' : '更新'}
                        </button>
                    </div>
                </form>
            </div>


        </div>
    );
}
