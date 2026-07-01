'use client';

import React, { useState } from 'react';
import { Bell, ChevronDown, ChevronUp, Send, Check, X, FileText } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/hooks/useQueryHooks';
import { updateReportReply, updateReportApproval, Report } from '@/lib/api';
import toast from 'react-hot-toast';

type UnreadCommentsProps = {
  reports: Report[];
  selectedFile: string;
};

export default function UnreadComments({ reports, selectedFile }: UnreadCommentsProps): React.JSX.Element | null {
  const queryClient = useQueryClient();

  const [showAllNotifications, setShowAllNotifications] = useState<boolean>(false);
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState<string>('');
  const [processingNotifications, setProcessingNotifications] = useState<Set<number>>(new Set());

  // 未読コメントの抽出
  const unreadComments = reports.filter((r: Report): boolean => {
    const supervisorCommentRaw = r.上長コメント || r.コメント;
    const supervisorComment = supervisorCommentRaw ? String(supervisorCommentRaw).trim() : '';
    const replyComment = r.コメント返信欄 ? String(r.コメント返信欄).trim() : '';
    const kidoku = r.既読チェック ? String(r.既読チェック).trim() : '';
    return supervisorComment !== '' && replyComment === '' && kidoku === '';
  });

  const handleSubmitReply = async (report: Report): Promise<void> => {
    if (!replyText.trim()) return;
    const replyContent = replyText.trim();
    setReplyingTo(null);
    setReplyText('');
    setProcessingNotifications((prev: Set<number>) => new Set(prev).add(report.管理番号));
    try {
      await updateReportReply(report.管理番号, replyContent, selectedFile);
      await queryClient.invalidateQueries({ queryKey: queryKeys.reports(selectedFile || undefined) });
      await queryClient.invalidateQueries({ queryKey: ['stats'] });
      toast.success('返信を送信しました');
    } catch (error: unknown) {
      toast.error('返信の送信に失敗しました');
    } finally {
      setProcessingNotifications((prev: Set<number>) => {
        const next = new Set(prev);
        next.delete(report.管理番号);
        return next;
      });
    }
  };

  const handleDismissNotification = async (report: Report): Promise<void> => {
    setProcessingNotifications((prev: Set<number>) => new Set(prev).add(report.管理番号));
    try {
      await updateReportApproval(report.管理番号, { 既読チェック: 'ü' }, selectedFile);
      await queryClient.invalidateQueries({ queryKey: queryKeys.reports(selectedFile || undefined) });
      await queryClient.invalidateQueries({ queryKey: ['stats'] });
      toast.success('既読にしました');
    } catch (error: unknown) {
      toast.error('既読処理に失敗しました');
    } finally {
      setProcessingNotifications((prev: Set<number>) => {
        const next = new Set(prev);
        next.delete(report.管理番号);
        return next;
      });
    }
  };

  if (unreadComments.length === 0) return null;

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 animate-pulse-slow">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Bell className="text-red-500 fill-red-500" size={24} />
          <h2 className="text-lg font-bold text-red-700">新着コメントがあります ({unreadComments.length}件)</h2>
        </div>
        {unreadComments.length > 3 && (
          <button
            type="button"
            onClick={(): void => setShowAllNotifications(!showAllNotifications)}
            className="flex items-center gap-1 text-xs font-semibold text-red-700 hover:text-red-900 bg-red-100/50 hover:bg-red-100 px-3 py-1 rounded transition-colors"
          >
            {showAllNotifications ? (
              <>
                <span>折りたたむ</span>
                <ChevronUp size={14} />
              </>
            ) : (
              <>
                <span>すべて表示</span>
                <ChevronDown size={14} />
              </>
            )}
          </button>
        )}
      </div>
      <div className="space-y-2">
        {(showAllNotifications ? unreadComments : unreadComments.slice(0, 3)).map((report: Report) => (
          <div key={report.管理番号} className="bg-white p-3 rounded border border-red-100 shadow-sm">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-red-600">{report.日付}</span>
                  <span className="text-sf-text font-medium">{report.訪問先名 || '訪問先なし'}</span>
                  <span className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-500">No.{report.管理番号}</span>
                </div>
                <div className="text-sm text-gray-600 mt-1 line-clamp-2">
                  <span className="font-bold mr-1">上長:</span>
                  {report.上長コメント || report.コメント}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                {processingNotifications.has(report.管理番号) ? (
                  <span className="text-xs text-sf-light-blue font-bold animate-pulse">保存中...</span>
                ) : replyingTo !== report.管理番号 && (
                  <>
                    <button
                      onClick={(e: React.MouseEvent): void => { e.stopPropagation(); setReplyingTo(report.管理番号); setReplyText(''); }}
                      disabled={processingNotifications.size > 0}
                      className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded-full font-bold hover:bg-red-200 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send size={12} />返信
                    </button>
                    <button
                      onClick={(e: React.MouseEvent): void => { e.stopPropagation(); handleDismissNotification(report); }}
                      disabled={processingNotifications.size > 0}
                      className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-bold hover:bg-green-200 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Check size={12} />既読
                    </button>
                  </>
                )}
              </div>
            </div>
            {replyingTo === report.管理番号 && (
              <div className="mt-3 pt-3 border-t border-gray-200" onClick={(e: React.MouseEvent): void => e.stopPropagation()}>
                {report.商談内容 && (
                  <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                    <div className="font-bold text-blue-700 mb-1">📝 商談内容:</div>
                    <div className="text-gray-700 whitespace-pre-wrap">{report.商談内容}</div>
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>): void => setReplyText(e.target.value)}
                    disabled={processingNotifications.has(report.管理番号)}
                    placeholder="返信を入力..."
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded disabled:opacity-50"
                  />
                  <button
                    onClick={(): Promise<void> => handleSubmitReply(report)}
                    disabled={!replyText.trim() || processingNotifications.has(report.管理番号)}
                    className="px-4 py-2 bg-red-500 text-white text-sm rounded font-bold disabled:opacity-50 flex items-center gap-2"
                  >
                    {processingNotifications.has(report.管理番号) ? (
                      <>
                        <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        送信中...
                      </>
                    ) : '送信'}
                  </button>
                  <button
                    type="button"
                    onClick={(): void => { setReplyingTo(null); setReplyText(''); }}
                    disabled={processingNotifications.has(report.管理番号)}
                    className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm rounded font-bold disabled:opacity-50"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
