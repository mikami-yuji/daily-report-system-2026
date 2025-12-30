import React, { useState, useEffect } from 'react';
import { Report, updateReport, deleteReport, updateReportComment, updateReportApproval } from '@/lib/api';
import { useFile } from '@/context/FileContext';
import { sanitizeReport, cleanText } from '@/lib/reportUtils';
import ConfirmationModal from '@/components/ConfirmationModal';
import { Edit, X, ChevronLeft, ChevronRight, Trash2, Calendar, Hash, Briefcase, User, MapPin, Palette, Info } from 'lucide-react';
import toast from 'react-hot-toast';

interface ReportDetailModalProps {
    report: Report;
    onClose: () => void;
    onNext: () => void;
    onPrev: () => void;
    hasNext: boolean;
    hasPrev: boolean;
    onEdit: () => void;
    onUpdate?: () => void;
}

function InfoRow({ label, value }: { label: string; value: any }) {
    return (
        <div className="flex justify-between items-start gap-2">
            <span className="text-xs text-sf-text-weak whitespace-nowrap">{label}:</span>
            <span className="text-sm text-sf-text text-right flex-1">{cleanText(value) || '-'}</span>
        </div>
    );
}

// LongTextRow was defined in page.tsx but seemingly unused in ReportDetailModal? 
// Checking usage in ReportDetailModal... 
// It uses <div className="text-base text-sf-text whitespace-pre-wrap ..."> which is similar logic but inline.
// I'll keep InfoRow as it IS used.

export default function ReportDetailModal({ report, onClose, onNext, onPrev, hasNext, hasPrev, onEdit, onUpdate }: ReportDetailModalProps) {
    const { selectedFile } = useFile();
    // Excelの「済」または「ü」をUIでは「✓」として表示
    const convertToDisplay = (value: string | undefined): string => {
        if (value === '済' || value === 'ü') return '✓';
        return value || '';
    };
    const [approvals, setApprovals] = useState({
        上長: convertToDisplay(report.上長),
        山澄常務: convertToDisplay(report.山澄常務),
        岡本常務: convertToDisplay(report.岡本常務),
        中野次長: convertToDisplay(report.中野次長),
        既読チェック: convertToDisplay(report.既読チェック)
    });
    const [comments, setComments] = useState({
        上長コメント: report.上長コメント || '',
        コメント返信欄: report.コメント返信欄 || ''
    });
    const [saving, setSaving] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
        // UIでは✓表示、Excelには「ü」を書き込む（Wingdingsフォントでチェックマーク）
        const isChecked = approvals[field] === '✓' || approvals[field] === '済' || approvals[field] === 'ü';
        const newDisplayValue = isChecked ? '' : '✓';  // UI表示用
        const newExcelValue = isChecked ? '' : 'ü';    // Excel書き込み用
        setApprovals(prev => ({ ...prev, [field]: newDisplayValue }));

        setSaving(true);
        try {
            // 承認専用エンドポイントを使用（バリデーションエラー回避）
            await updateReportApproval(report.管理番号, { [field]: newExcelValue }, selectedFile);
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error('Failed to update approval:', error);
            // Revert on error
            setApprovals(prev => ({ ...prev, [field]: approvals[field] }));
            toast.error('承認ステータスの更新に失敗しました');
        } finally {
            setSaving(false);
        }
    };

    const handleCommentBlur = async (field: keyof typeof comments) => {
        if (comments[field] === (report[field] || '')) return; // No change

        setSaving(true);
        try {
            // コメント専用エンドポイントを使用（バリデーションエラー回避）
            await updateReportComment(report.管理番号, { [field]: comments[field] }, selectedFile);
            toast.success('コメントを保存しました');
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error('Failed to update comment:', error);
            toast.error('コメントの保存に失敗しました');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteClick = () => {
        setShowDeleteConfirm(true);
    };

    const executeDelete = async () => {
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

    const hasDesign = report.デザイン提案有無 === 'あり';

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
                                    <InfoRow label="依頼No." value={report['デザイン依頼No.']} />
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
                                            <input
                                                type="checkbox"
                                                checked={approvals[field] === '✓' || approvals[field] === '済' || approvals[field] === 'ü'}
                                                onChange={() => handleApprovalChange(field)}
                                                disabled={saving}
                                                className="w-4 h-4 text-sf-light-blue border-gray-300 rounded focus:ring-sf-light-blue cursor-pointer"
                                            />
                                            <span className="text-sm text-sf-text">{field}</span>
                                        </div>
                                    ))}
                                    <div className="pt-2 border-t border-gray-200">
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={approvals.既読チェック === '✓' || approvals.既読チェック === '済' || approvals.既読チェック === 'ü'}
                                                onChange={() => handleApprovalChange('既読チェック')}
                                                disabled={saving}
                                                className="w-4 h-4 text-sf-light-blue border-gray-300 rounded focus:ring-sf-light-blue cursor-pointer"
                                            />
                                            <span className="text-sm text-sf-text">既読</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* コメント（右側・大きく） */}
                            <div className="lg:col-span-3 space-y-6">
                                <div>
                                    <h3 className="font-bold text-lg text-sf-text mb-4 border-b border-sf-border pb-2">コメント</h3>
                                    <div className="space-y-4">
                                        <div className="bg-yellow-50 p-5 rounded-lg border border-yellow-100">
                                            <div className="text-sm font-bold text-yellow-800 mb-2 flex items-center gap-2">
                                                <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
                                                上長コメント
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
                                                onChange={(e) => setComments(prev => ({ ...prev, 上長コメント: e.target.value }))}
                                                onBlur={() => handleCommentBlur('上長コメント')}
                                                disabled={saving}
                                                className="w-full min-h-[100px] p-3 text-sf-text bg-white border border-yellow-200 rounded focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-y"
                                                placeholder="コメントを入力..."
                                            />
                                        </div>
                                        <div className="bg-green-50 p-5 rounded-lg border border-green-100">
                                            <div className="text-sm font-bold text-green-800 mb-2 flex items-center gap-2">
                                                <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                                                コメント返信欄
                                            </div>
                                            <textarea
                                                value={comments.コメント返信欄}
                                                onChange={(e) => setComments(prev => ({ ...prev, コメント返信欄: e.target.value }))}
                                                onBlur={() => handleCommentBlur('コメント返信欄')}
                                                disabled={saving}
                                                className="w-full min-h-[100px] p-3 text-sf-text bg-white border border-green-200 rounded focus:outline-none focus:ring-2 focus:ring-green-400 resize-y"
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
        </div>
    );
}
