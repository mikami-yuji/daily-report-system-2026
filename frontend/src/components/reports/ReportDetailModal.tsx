import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Report, updateReport, deleteReport, updateReportComment, updateReportApproval, searchDesignImages, DesignImage } from '@/lib/api';
import { useFile } from '@/context/FileContext';
import { sanitizeReport, cleanText } from '@/lib/reportUtils';
import ConfirmationModal from '@/components/ConfirmationModal';
import { Edit, X, ChevronLeft, ChevronRight, Trash2, Calendar, Hash, Briefcase, User, MapPin, Palette, Info, Loader2, Image as ImageIcon } from 'lucide-react';
import DesignImagePreviewModal from './DesignImagePreviewModal';
import toast from 'react-hot-toast';

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

type ReportDetailModalProps = {
    report: Report;
    onClose: () => void;
    onNext: () => void;
    onPrev: () => void;
    hasNext: boolean;
    hasPrev: boolean;
    onEdit: () => void;
    onUpdate?: () => void;
};

function InfoRow({ label, value }: { label: string; value: unknown }) {
    return (
        <div className="flex justify-between items-start gap-2">
            <span className="text-xs text-sf-text-weak whitespace-nowrap">{label}:</span>
            <span className="text-sm text-sf-text text-right flex-1">
                {cleanText(value !== null && value !== undefined ? String(value) : '') || '-'}
            </span>
        </div>
    );
}

// LongTextRow was defined in page.tsx but seemingly unused in ReportDetailModal? 
// Checking usage in ReportDetailModal... 
// It uses <div className="text-base text-sf-text whitespace-pre-wrap ..."> which is similar logic but inline.
// I'll keep InfoRow as it IS used.

// Excelの「済」または「ü」をUIでは「✓」として表示
const convertToDisplay = (value: string | undefined): string => {
    if (value === '済' || value === 'ü') return '✓';
    return value || '';
};

export default function ReportDetailModal({ report, onClose, onNext, onPrev, hasNext, hasPrev, onEdit, onUpdate }: ReportDetailModalProps) {
    const { selectedFile } = useFile();
    const [approvals, setApprovals] = useState({
        上長: convertToDisplay(report?.上長),
        山澄常務: convertToDisplay(report?.山澄常務),
        岡本常務: convertToDisplay(report?.岡本常務),
        中野次長: convertToDisplay(report?.中野次長),
        既読チェック: convertToDisplay(report?.既読チェック)
    });
    const [comments, setComments] = useState({
        上長コメント: report?.上長コメント || report?.コメント || '',
        コメント返信欄: report?.コメント返信欄 || ''
    });
    const [saving, setSaving] = useState(false);
    const [processingApproval, setProcessingApproval] = useState<string | null>(null); // 処理中の承認フィールド
    const [processingComment, setProcessingComment] = useState<string | null>(null); // 処理中のコメントフィールド
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const commentSaveTimersRef = useRef<{ [field: string]: NodeJS.Timeout }>({});
    const pendingCommentsRef = useRef<{ [field: string]: string }>({});

    // アンマウント時・レポート変更時に保留中のコメント下書きを即座に保存
    useEffect((): () => void => {
        return (): void => {
            // 全タイマーをクリア
            Object.values(commentSaveTimersRef.current).forEach(clearTimeout);
            
            // 保留中の下書きデータを即時書き込み
            if (report?.管理番号) {
                Object.entries(pendingCommentsRef.current).forEach(([field, value]) => {
                    try {
                        localStorage.setItem(`draft_comment_${report.管理番号}_${field}`, value);
                    } catch (e) {
                        console.error(`Failed to save pending comment draft on unmount:`, e);
                    }
                });
            }
            // 状態リセット
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

    // デザイン画像検索用ステート
    const [searchingImage, setSearchingImage] = useState(false);
    const [imageResults, setImageResults] = useState<DesignImage[]>([]);
    const [showImageModal, setShowImageModal] = useState(false);

    // 画像検索アクション
    const handleImageSearch = async (designNo: string, e: React.MouseEvent) => {
        e.stopPropagation(); // 詳細モーダルの他部分のクリックイベントを防止
        if (!designNo) return;
        setSearchingImage(true);
        try {
            const result = await searchDesignImages(String(designNo), selectedFile || undefined);
            if (result.images && result.images.length > 0) {
                setImageResults(result.images);
                setShowImageModal(true);
                toast.success(`${result.images.length}件の画像が見つかりました`);
            } else {
                setImageResults([]);
                toast.error('関連するデザイン画像が見つかりませんでした');
            }
        } catch (error) {
            console.error('Failed to search design images:', error);
            toast.error('画像検索中にエラーが発生しました');
        } finally {
            setSearchingImage(false);
        }
    };

    // レポート変更時にステートを更新（セッションストレージからの下書き復元も含む）
    useEffect(() => {
        setApprovals({
            上長: convertToDisplay(report?.上長),
            山澄常務: convertToDisplay(report?.山澄常務),
            岡本常務: convertToDisplay(report?.岡本常務),
            中野次長: convertToDisplay(report?.中野次長),
            既読チェック: convertToDisplay(report?.既読チェック)
        });

        const draftComment = getCommentDraft(report?.管理番号, '上長コメント');
        const draftReply = getCommentDraft(report?.管理番号, 'コメント返信欄');

        setComments({
            上長コメント: draftComment !== null ? draftComment : (report?.上長コメント || report?.コメント || ''),
            コメント返信欄: draftReply !== null ? draftReply : (report?.コメント返信欄 || '')
        });
    }, [report]);

    // キーボードイベントのハンドリング
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft' && hasNext) {
                onNext();
            } else if (e.key === 'ArrowRight' && hasPrev) {
                onPrev();
            } else if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [hasNext, hasPrev, onNext, onPrev, onClose]);

    const handleApprovalChange = async (field: keyof typeof approvals) => {
        // 管理番号の検証
        if (!report.管理番号) {
            toast.error('管理番号が無効です。日報を再読み込みしてください。');
            return;
        }

        // UIでは✓表示、Excelには「ü」を書き込む（Wingdingsフォントでチェックマーク）
        const isChecked = approvals[field] === '✓' || approvals[field] === '済' || approvals[field] === 'ü';
        const newDisplayValue = isChecked ? '' : '✓';  // UI表示用
        const newExcelValue = isChecked ? '' : 'ü';    // Excel書き込み用
        setApprovals(prev => ({ ...prev, [field]: newDisplayValue }));

        setSaving(true);
        setProcessingApproval(field); // 処理中のフィールドを記録
        try {
            // 承認専用エンドポイントを使用（バリデーションエラー回避）
            await updateReportApproval(report.管理番号, { [field]: newExcelValue, original_values: report }, selectedFile);
            toast.success(`${field}の承認を更新しました`);
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error('Failed to update approval:', error);
            // Revert on error
            setApprovals(prev => ({ ...prev, [field]: approvals[field] }));
            toast.error('承認ステータスの更新に失敗しました');
        } finally {
            setSaving(false);
            setProcessingApproval(null);
        }
    };

    // 下書きデータを破棄して元の値に戻す関数
    const handleDiscardDraft = (field: '上長コメント' | 'コメント返信欄'): void => {
        clearCommentDraftAndPending(field);
        setComments(prev => ({
            ...prev,
            [field]: field === '上長コメント'
                ? (report?.上長コメント || report?.コメント || '')
                : (report?.コメント返信欄 || '')
        }));
        toast.success('下書きを破棄しました');
    };

    const handleCommentBlur = async (field: keyof typeof comments): Promise<void> => {
        const originalValue = field === '上長コメント'
            ? (report?.上長コメント || report?.コメント || '')
            : (report?.コメント返信欄 || '');

        if (comments[field] === originalValue) {
            clearCommentDraftAndPending(field);
            return; // 変更がない場合は保存処理を行わない
        }

        // 管理番号の検証
        if (!report.管理番号) {
            toast.error('管理番号が無効です。日報を再読み込みしてください。');
            return;
        }

        setSaving(true);
        setProcessingComment(field); // 処理中のコメントフィールドを記録
        try {
            // コメント専用エンドポイントを使用（バリデーションエラー回避）
            await updateReportComment(report.管理番号, { [field]: comments[field], original_values: report }, selectedFile);
            toast.success('コメントを保存しました');
            clearCommentDraftAndPending(field); // 正常に保存されたため下書きを削除
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error('Failed to update comment:', error);
            toast.error('コメントの保存に失敗しました');
        } finally {
            setSaving(false);
            setProcessingComment(null);
        }
    };

    const handleDeleteClick = () => {
        setShowDeleteConfirm(true);
    };

    const executeDelete = async () => {
        // 管理番号の検証
        if (!report.管理番号) {
            toast.error('管理番号が無効です。日報を再読み込みしてください。');
            setShowDeleteConfirm(false);
            return;
        }

        setSaving(true);
        try {
            await deleteReport(report.管理番号, selectedFile);
            toast.success('日報を削除しました');
            onClose();
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error('Failed to delete report:', error);
            toast.error('日報の削除に失敗しました');
        } finally {
            setSaving(false);
        }
    };
    if (!report) return null;

    const originalComment = report.上長コメント || report.コメント || '';
    const originalReply = report.コメント返信欄 || '';

    const hasDraftComment = comments.上長コメント !== originalComment;
    const hasDraftReply = comments.コメント返信欄 !== originalReply;

    // デザイン情報の表示条件をグリッド表示と統一（いずれかのフィールドに値があれば表示）
    const hasDesign = !!(
        report.デザイン進捗状況 ||
        report['デザイン依頼No.'] ||
        report.デザイン種別 ||
        report.デザイン名 ||
        report.デザイン提案有無
    );

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                {/* ヘッダー */}
                <div className="p-6 border-b border-sf-border flex justify-between items-start bg-gray-50 rounded-t-lg">
                    <div className="flex-1">
                        <h2 className="text-2xl font-bold text-sf-text mb-2">
                            {report.訪問先名}
                            {report.直送先名 && <span className="text-base font-normal text-sf-text-weak ml-3">(直送先: {report.直送先名})</span>}
                        </h2>
                        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-sf-text-weak">
                            <span className="flex items-center gap-1">
                                <Calendar size={16} />
                                {report.日付}
                            </span>
                            <span className="flex items-center gap-1">
                                <Hash size={16} />
                                No. {report.管理番号}
                            </span>
                            <span className="flex items-center gap-1">
                                <Briefcase size={16} />
                                {report.行動内容}
                            </span>
                            <span className="flex items-center gap-1">
                                <User size={16} />
                                {report.面談者}
                            </span>
                            <span className="flex items-center gap-1">
                                <MapPin size={16} />
                                {report.エリア}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onEdit}
                            className="p-2 text-sf-text-weak hover:text-sf-light-blue hover:bg-white rounded-full transition-colors border border-transparent hover:border-sf-border"
                            title="編集"
                        >
                            <Edit size={20} />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-sf-text-weak hover:text-sf-text hover:bg-white rounded-full transition-colors border border-transparent hover:border-sf-border"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* コンテンツ */}
                <div className="flex-1 overflow-y-auto p-6 relative">
                    {/* ナビゲーションボタン（オーバーレイ） */}
                    {hasNext && (
                        <button
                            onClick={onNext}
                            className="fixed left-8 top-1/2 -translate-y-1/2 p-3 bg-white/80 hover:bg-white shadow-lg rounded-full text-sf-text-weak hover:text-sf-light-blue transition-all z-10 border border-sf-border backdrop-blur-sm"
                            title="前の日報 (新しい)"
                        >
                            <ChevronLeft size={32} />
                        </button>
                    )}
                    {hasPrev && (
                        <button
                            onClick={onPrev}
                            className="fixed right-8 top-1/2 -translate-y-1/2 p-3 bg-white/80 hover:bg-white shadow-lg rounded-full text-sf-text-weak hover:text-sf-light-blue transition-all z-10 border border-sf-border backdrop-blur-sm"
                            title="次の日報 (古い)"
                        >
                            <ChevronRight size={32} />
                        </button>
                    )}

                    <div className="space-y-8">
                        {/* デザイン情報（条件付き表示） */}
                        {hasDesign && (
                            <div className="bg-blue-50 p-5 rounded-lg border border-blue-100">
                                <h3 className="font-bold text-blue-800 mb-4 flex items-center gap-2 text-lg">
                                    <Palette size={20} /> デザイン案件
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    <InfoRow label="種別" value={report.デザイン種別} />
                                    <InfoRow label="案件名" value={report.デザイン名} />
                                    <InfoRow label="進捗" value={report.デザイン進捗状況} />
                                    <div className="flex justify-between items-start gap-2">
                                        <span className="text-xs text-sf-text-weak whitespace-nowrap">依頼No.:</span>
                                        <span className="text-sm text-sf-text text-right flex-1 flex items-center justify-end gap-1.5 font-semibold text-sf-light-blue">
                                            {cleanText(report['デザイン依頼No.']) || '-'}
                                            {report['デザイン依頼No.'] && (
                                                <button
                                                    onClick={(e) => handleImageSearch(String(report['デザイン依頼No.']), e)}
                                                    disabled={searchingImage}
                                                    className="p-1 hover:bg-blue-100 rounded text-blue-600 transition-colors cursor-pointer"
                                                    title="関連画像を検索"
                                                >
                                                    {searchingImage ? (
                                                        <Loader2 size={14} className="animate-spin" />
                                                    ) : (
                                                        <ImageIcon size={14} />
                                                    )}
                                                </button>
                                            )}
                                        </span>
                                    </div>
                                    <InfoRow label="確認No." value={report['システム確認用デザインNo.']} />
                                </div>
                            </div>
                        )}

                        {/* 商談・提案内容（メイン） */}
                        <div>
                            <h3 className="font-bold text-xl text-sf-text mb-4 border-b-2 border-sf-border pb-2">商談・提案内容</h3>
                            <div className="space-y-6">
                                <div className="bg-white">
                                    <div className="text-sm font-semibold text-sf-text-weak mb-2">商談内容</div>
                                    <div className="text-base text-sf-text whitespace-pre-wrap leading-relaxed p-4 bg-gray-50 rounded border border-gray-100 min-h-[100px]">
                                        {cleanText(report.商談内容) || 'なし'}
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-white">
                                        <div className="text-sm font-semibold text-sf-text-weak mb-2">提案物</div>
                                        <div className="text-base text-sf-text whitespace-pre-wrap p-3 bg-gray-50 rounded border border-gray-100">
                                            {cleanText(report.提案物) || 'なし'}
                                        </div>
                                    </div>
                                    <div className="bg-white">
                                        <div className="text-sm font-semibold text-sf-text-weak mb-2">次回プラン</div>
                                        <div className="text-base text-sf-text whitespace-pre-wrap p-3 bg-gray-50 rounded border border-gray-100">
                                            {cleanText(report.次回プラン) || 'なし'}
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white">
                                    <div className="text-sm font-semibold text-sf-text-weak mb-2">競合他社情報</div>
                                    <div className="text-base text-sf-text whitespace-pre-wrap p-3 bg-gray-50 rounded border border-gray-100">
                                        {cleanText(report.競合他社情報) || 'なし'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 承認・コメント */}
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                            {/* 承認（左側） */}
                            <div className="lg:col-span-1 bg-gray-50 p-5 rounded-lg h-fit">
                                <h3 className="font-bold text-sf-text mb-4 border-b border-gray-200 pb-2">承認・確認</h3>
                                <div className="space-y-3">
                                    {(['上長', '山澄常務', '岡本常務', '中野次長'] as const).map(field => (
                                        <div key={field} className="flex items-center gap-2">
                                            {processingApproval === field ? (
                                                <Loader2 size={16} className="animate-spin text-sf-light-blue" />
                                            ) : (
                                                <input
                                                    type="checkbox"
                                                    checked={approvals[field] === '✓' || approvals[field] === '済' || approvals[field] === 'ü'}
                                                    onChange={() => handleApprovalChange(field)}
                                                    disabled={saving}
                                                    className="w-4 h-4 text-sf-light-blue border-gray-300 rounded focus:ring-sf-light-blue cursor-pointer disabled:opacity-50"
                                                />
                                            )}
                                            <span className={`text-sm ${processingApproval === field ? 'text-sf-light-blue' : 'text-sf-text'}`}>
                                                {field}
                                                {processingApproval === field && <span className="ml-1 text-xs">処理中...</span>}
                                            </span>
                                        </div>
                                    ))}
                                    <div className="pt-2 border-t border-gray-200">
                                        <div className="flex items-center gap-2">
                                            {processingApproval === '既読チェック' ? (
                                                <Loader2 size={16} className="animate-spin text-sf-light-blue" />
                                            ) : (
                                                <input
                                                    type="checkbox"
                                                    checked={approvals.既読チェック === '✓' || approvals.既読チェック === '済' || approvals.既読チェック === 'ü'}
                                                    onChange={() => handleApprovalChange('既読チェック')}
                                                    disabled={saving}
                                                    className="w-4 h-4 text-sf-light-blue border-gray-300 rounded focus:ring-sf-light-blue cursor-pointer disabled:opacity-50"
                                                />
                                            )}
                                            <span className={`text-sm ${processingApproval === '既読チェック' ? 'text-sf-light-blue' : 'text-sf-text'}`}>
                                                既読
                                                {processingApproval === '既読チェック' && <span className="ml-1 text-xs">処理中...</span>}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* コメント（右側・大きく） */}
                            <div className="lg:col-span-3 space-y-6">
                                <div>
                                    <h3 className="font-bold text-lg text-sf-text mb-4 border-b border-sf-border pb-2">コメント</h3>
                                    <div className="space-y-4">
                                        <div className={`bg-yellow-50 p-5 rounded-lg border ${processingComment === '上長コメント' ? 'border-yellow-400' : 'border-yellow-100'}`}>
                                            <div className="text-sm font-bold text-yellow-800 mb-2 flex items-center gap-2">
                                                {processingComment === '上長コメント' ? (
                                                    <Loader2 size={14} className="animate-spin text-yellow-600" />
                                                ) : (
                                                    <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
                                                )}
                                                上長コメント
                                                {processingComment === '上長コメント' && (
                                                    <span className="text-xs font-normal text-yellow-600 ml-2">保存中...</span>
                                                )}
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
                                            {/* 商談内容の参照表示 */}
                                            {report.商談内容 && (
                                                <div className="mb-3 p-3 bg-white/70 border border-yellow-200 rounded text-sm max-h-32 overflow-y-auto">
                                                    <div className="text-xs font-bold text-yellow-700 mb-1">📝 商談内容（参照）:</div>
                                                    <div className="text-gray-700 whitespace-pre-wrap text-xs leading-relaxed">{cleanText(report.商談内容)}</div>
                                                </div>
                                            )}
                                            <textarea
                                                value={comments.上長コメント}
                                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>): void => {
                                                    const value = e.target.value;
                                                    setComments(prev => ({ ...prev, 上長コメント: value }));
                                                    const original = report?.上長コメント || report?.コメント || '';
                                                    if (value === original || !value) {
                                                        clearCommentDraftAndPending('上長コメント');
                                                    } else {
                                                        saveCommentDraftDebounced('上長コメント', value);
                                                    }
                                                }}
                                                onBlur={(): Promise<void> => handleCommentBlur('上長コメント')}
                                                disabled={saving}
                                                className={`w-full min-h-[100px] p-3 text-sf-text bg-white border rounded focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-y disabled:opacity-60 ${processingComment === '上長コメント' ? 'border-yellow-400' : 'border-yellow-200'}`}
                                                placeholder="コメントを入力..."
                                            />
                                        </div>
                                        <div className={`bg-green-50 p-5 rounded-lg border ${processingComment === 'コメント返信欄' ? 'border-green-400' : 'border-green-100'}`}>
                                            <div className="text-sm font-bold text-green-800 mb-2 flex items-center gap-2">
                                                {processingComment === 'コメント返信欄' ? (
                                                    <Loader2 size={14} className="animate-spin text-green-600" />
                                                ) : (
                                                    <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                                                )}
                                                コメント返信欄
                                                {processingComment === 'コメント返信欄' && (
                                                    <span className="text-xs font-normal text-green-600 ml-2">保存中...</span>
                                                )}
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
                                                value={comments.コメント返信欄}
                                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>): void => {
                                                    const value = e.target.value;
                                                    setComments(prev => ({ ...prev, コメント返信欄: value }));
                                                    const original = report?.コメント返信欄 || '';
                                                    if (value === original || !value) {
                                                        clearCommentDraftAndPending('コメント返信欄');
                                                    } else {
                                                        saveCommentDraftDebounced('コメント返信欄', value);
                                                    }
                                                }}
                                                onBlur={(): Promise<void> => handleCommentBlur('コメント返信欄')}
                                                disabled={saving}
                                                className={`w-full min-h-[100px] p-3 text-sf-text bg-white border rounded focus:outline-none focus:ring-2 focus:ring-green-400 resize-y disabled:opacity-60 ${processingComment === 'コメント返信欄' ? 'border-green-400' : 'border-green-200'}`}
                                                placeholder="返信を入力..."
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* その他の基本情報（下部にまとめる） */}
                        <div className="border-t border-sf-border pt-6 mt-8">
                            <button
                                className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-2"
                                onClick={(e) => {
                                    const target = e.currentTarget.nextElementSibling;
                                    if (target) {
                                        target.classList.toggle('hidden');
                                    }
                                }}
                            >
                                <Info size={12} />
                                詳細属性情報を表示
                            </button>
                            <div className="hidden grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-xs text-gray-500 bg-gray-50 p-4 rounded">
                                <div><span className="block text-gray-400">得意先CD</span>{report.得意先CD}</div>
                                <div><span className="block text-gray-400">直送先CD</span>{report.直送先CD}</div>
                                <div><span className="block text-gray-400">直送先名</span>{report.直送先名}</div>
                                <div><span className="block text-gray-400">重点顧客</span>{report.重点顧客}</div>
                                <div><span className="block text-gray-400">ランク</span>{report.ランク}</div>
                                <div><span className="block text-gray-400">目標</span>{report.得意先目標}</div>
                                <div><span className="block text-gray-400">滞在時間</span>{report.滞在時間}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* フッター */}
                <div className="p-4 border-t border-sf-border bg-gray-50 flex justify-between items-center rounded-b-lg">
                    <button
                        onClick={onNext}
                        disabled={!hasNext}
                        className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${hasNext
                            ? 'bg-white border border-sf-border hover:bg-sf-light-blue hover:text-white hover:border-transparent text-sf-text shadow-sm'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }`}
                    >
                        <ChevronLeft size={16} />
                        前の日報
                    </button>
                    <button
                        onClick={handleDeleteClick}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 rounded transition-colors bg-red-50 border border-red-200 hover:bg-red-500 hover:text-white hover:border-transparent text-red-600 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Trash2 size={16} />
                        削除
                    </button>
                    <button
                        onClick={onPrev}
                        disabled={!hasPrev}
                        className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${hasPrev
                            ? 'bg-white border border-sf-border hover:bg-sf-light-blue hover:text-white hover:border-transparent text-sf-text shadow-sm'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }`}
                    >
                        次の日報
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>

            <ConfirmationModal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={executeDelete}
                title="日報の削除"
                message="この日報を削除してもよろしいですか？\nこの操作は取り消せません。"
                confirmText="削除する"
                isDangerous={true}
            />

            {/* Image Search Result Modal */}
            <DesignImagePreviewModal
                isOpen={showImageModal}
                onClose={(): void => setShowImageModal(false)}
                images={imageResults}
            />
        </div>
    );
}
