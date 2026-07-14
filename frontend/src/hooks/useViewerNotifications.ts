'use client';

import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { getLatestDesignRequests } from '@/lib/api';
import { ViewerDesignRequest } from '@/types/report';

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
    const enabledRef = useRef<boolean>(enabled);
    const selectedFileRef = useRef<string>(selectedFile);

    useEffect((): void => {
        enabledRef.current = enabled;
    }, [enabled]);

    useEffect((): void => {
        selectedFileRef.current = selectedFile;
    }, [selectedFile]);

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

    const checkViewerStatusChanges = async (): Promise<void> => {
        if (!enabledRef.current || !selectedFileRef.current) return;

        const activeSalesPerson = extractSalesPersonName(selectedFileRef.current);
        if (!activeSalesPerson) return;

        const passcode = typeof window !== 'undefined' ? localStorage.getItem('viewer_passcode') || '' : '';
        // パスコードが未設定の場合はAPIリクエストを行わず負荷を軽減
        if (!passcode) return;

        try {
            const data = await getLatestDesignRequests(passcode);
            if (!data || !data.documents) return;

            // 担当営業名が一致し、無効でない案件のみ抽出
            const myRequests = data.documents.filter((req: ViewerDesignRequest): boolean => {
                if (!req || !req.salesPerson) return false;
                const viewerRep = String(req.salesPerson).toLowerCase().trim();
                const activeRep = String(activeSalesPerson).toLowerCase().trim();
                return viewerRep.includes(activeRep) || activeRep.includes(viewerRep);
            });

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
            const notifications: string[] = [];

            myRequests.forEach((req: ViewerDesignRequest): void => {
                const reqId = req.requestId;
                const status = req.status;
                const hasComp = !!req.compUrl;
                const content = req.designContent || 'デザイン依頼';

                newSnapshot[reqId] = {
                    status,
                    hasComp,
                    designContent: content,
                };

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
                        notifications.push(`デザイン「${content}」の状況が「${oldLabel}」から「${newLabel}」になりました。`);
                    }
                    // 2. カンプアップロード完了 (ステータスそのままでカンプURLが追加された場合)
                    else if (!old.hasComp && hasComp && status !== 'completed') {
                        notifications.push(`デザイン「${content}」の新しいカンプ画像がアップロードされました。`);
                    }
                } else if (savedSnapshotStr && !oldSnapshot[reqId]) {
                    // 新しい依頼が追加された場合
                    notifications.push(`新しいデザイン依頼「${content}」が企画課に登録されました。`);
                }
            });

            // 差分が検出された場合は通知を表示
            if (notifications.length > 0) {
                notifications.forEach((msg: string): void => {
                    toast(msg, {
                        icon: '🔔',
                        duration: 6000,
                    });
                });
            }

            // スナップショットを更新保存
            localStorage.setItem('viewer_snapshot', JSON.stringify(newSnapshot));
            lastCheckedRef.current = Date.now();
        } catch (error) {
            console.error('Error checking viewer notifications:', error);
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
