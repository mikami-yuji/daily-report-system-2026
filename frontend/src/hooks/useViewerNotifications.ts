'use client';

import { useEffect, useRef } from 'react';
import { getLatestDesignRequests } from '@/lib/api';
import { ViewerDesignRequest } from '@/types/report';
import { isSalesPersonMatch } from '@/lib/reportUtils';

type SnapshotData = {
    [requestId: string]: {
        status: string;
        hasComp: boolean;
        designContent: string;
    };
};

type UseViewerNotificationsProps = {
    selectedFile: string;
    enabled?: boolean;
};

/**
 * 企画課ビューワーのステータス変更を検知してトースト通知を表示するカスタムフック
 * 負荷軽減のためポーリングは行わず、visibilitychange（タブ復帰時）に5分以上の間隔で確認します
 */
export function useViewerNotifications({ selectedFile, enabled = true }: UseViewerNotificationsProps): void {
    const lastCheckedRef = useRef<number>(0);
    const lastSalesPersonRef = useRef<string>('');
    const isCheckingRef = useRef<boolean>(false);
    const enabledRef = useRef<boolean>(enabled);
    const selectedFileRef = useRef<string>(selectedFile);

    useEffect((): void => {
        enabledRef.current = enabled;
    }, [enabled]);

    useEffect((): void => {
        selectedFileRef.current = selectedFile;
    }, [selectedFile]);

    const checkViewerStatusChanges = async (): Promise<void> => {
        if (!enabledRef.current || !selectedFileRef.current) return;

        const currentFile = selectedFileRef.current;
        const passcode = typeof window !== 'undefined' ? localStorage.getItem('viewer_passcode') || '' : '';
        // パスコードが未設定の場合はAPIリクエストを行わず負荷を軽減
        if (!passcode) return;

        const now = Date.now();
        // 担当ファイルが変わっておらず、かつ前回のチェックから5分(300,000ms)経過していない場合はスキップ
        if (currentFile === lastSalesPersonRef.current && now - lastCheckedRef.current < 5 * 60 * 1000) {
            return;
        }

        // 多重チェックを防止
        if (isCheckingRef.current) return;
        isCheckingRef.current = true;

        try {
            const data = await getLatestDesignRequests(passcode);
            if (!data || !data.documents) {
                return;
            }

            // ローカルストレージから前回のスナップショットを取得
            const savedSnapshotStr = localStorage.getItem('viewer_snapshot');
            let oldSnapshot: SnapshotData = {};
            if (savedSnapshotStr) {
                try {
                    oldSnapshot = JSON.parse(savedSnapshotStr);
                } catch (e) {
                    console.error('Failed to parse viewer snapshot:', e);
                }
            }

            const newSnapshot: SnapshotData = {};
            const notifications: { id: string; msg: string }[] = [];

            // 全案件をスナップショットに保存し、アクティブな営業担当者の案件のみ通知判定を行う
            data.documents.forEach((req: ViewerDesignRequest): void => {
                if (!req) return;
                const reqId = req.requestId;
                const status = req.status;
                const hasComp = !!req.compUrl;
                const content = req.designContent || 'デザイン依頼';

                newSnapshot[reqId] = {
                    status,
                    hasComp,
                    designContent: content,
                };

                // 現在のアクティブな営業担当者名と一致するか判定 (同姓混在防止)
                if (!req.salesPerson) return;
                const isMyRequest = isSalesPersonMatch(req.salesPerson, currentFile);

                if (isMyRequest) {
                    // 前回データとの差分をチェック (前回が存在する場合のみ通知。初回はスナップショット構築のみ)
                    if (savedSnapshotStr && oldSnapshot[reqId]) {
                        const old = oldSnapshot[reqId];

                        // 1. ステータス変更
                        if (old.status !== status) {
                            const statusLabelMap: Record<string, string> = {
                                inProgress: '進行中',
                                completed: '完了',
                                rejected: '却下',
                                inSubmission: '入稿中'
                            };
                            const oldLabel = statusLabelMap[old.status] || old.status;
                            const newLabel = statusLabelMap[status] || status;
                            notifications.push({
                                id: `viewer-status-${reqId}-${status}`,
                                msg: `デザイン「${content}」の状況が「${oldLabel}」から「${newLabel}」になりました。`
                            });
                        }
                        // 2. カンプアップロード完了 (ステータスそのままでカンプURLが追加された場合)
                        else if (!old.hasComp && hasComp && status !== 'completed') {
                            notifications.push({
                                id: `viewer-comp-${reqId}`,
                                msg: `デザイン「${content}」の新しいカンプ画像がアップロードされました。`
                            });
                        }
                    } else if (savedSnapshotStr && !oldSnapshot[reqId]) {
                        // 新しい依頼が追加された場合
                        notifications.push({
                            id: `viewer-new-${reqId}`,
                            msg: `新しいデザイン依頼「${content}」が企画課に登録されました。`
                        });
                    }
                }
            });

            // 差分が検出された場合は通知を表示（ポップアップ停止のためコメントアウト）
            /*
            if (notifications.length > 0) {
                notifications.forEach(({ id, msg }): void => {
                    toast(msg, {
                        id, // 一意のIDを指定して重複表示を防止
                        icon: '🔔',
                        duration: 6000,
                    });
                });
            }
            */

            // スナップショットを更新保存
            localStorage.setItem('viewer_snapshot', JSON.stringify(newSnapshot));
            lastCheckedRef.current = Date.now();
            lastSalesPersonRef.current = currentFile;
        } catch (error) {
            console.error('Error checking viewer notifications:', error);
        } finally {
            isCheckingRef.current = false;
        }
    };

    useEffect((): (() => void) => {
        const handleVisibilityChange = (): void => {
            if (document.visibilityState === 'visible') {
                const now = Date.now();
                // 前回のチェックから5分(300,000ms)以上経過している場合のみ実行
                if (now - lastCheckedRef.current > 5 * 60 * 1000) {
                    checkViewerStatusChanges();
                }
            }
        };

        // 初回ロード時にも静かに実行して最新データに追従
        checkViewerStatusChanges();

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return (): void => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [selectedFile]);
}
