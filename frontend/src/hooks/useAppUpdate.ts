'use client';

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';

export type UpdateInfo = {
    current_version: string;
    build_date: string;
    update_available: boolean;
    latest_version: string;
    release_notes: string[];
    release_date: string;
    file_size: number;
    force_update: boolean;
    reason?: string;
};

export function useAppUpdate() {
    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
    const [isChecking, setIsChecking] = useState<boolean>(false);
    const [isUpdating, setIsUpdating] = useState<boolean>(false);
    const [isDismissed, setIsDismissed] = useState<boolean>(false);

    // バージョン確認（起動3秒後にバックグラウンドで安全に実行）
    const checkForUpdates = useCallback(async (): Promise<void> => {
        setIsChecking(true);
        try {
            const res = await fetch('/api/version/check');
            if (res.ok) {
                const data: UpdateInfo = await res.json();
                setUpdateInfo(data);
            }
        } catch (error) {
            console.debug('Failed to check for updates (offline or server starting):', error);
        } finally {
            setIsChecking(false);
        }
    }, []);

    useEffect(() => {
        // 起動から2.5秒後にバックグラウンド実行（起動時の初期化負荷を避ける）
        const timer = setTimeout(() => {
            checkForUpdates();
        }, 2500);

        return () => clearTimeout(timer);
    }, [checkForUpdates]);

    // アップデートの適用実行
    const applyUpdate = async (): Promise<{ success: boolean; message: string }> => {
        setIsUpdating(true);
        try {
            const res = await fetch('/api/version/apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.detail || data.message || 'アップデートの適用に失敗しました');
            }
            return { success: true, message: data.message };
        } catch (error: unknown) {
            console.error('Error applying update:', error);
            const msg = error instanceof Error ? error.message : 'アップデートの適用に失敗しました';
            toast.error(msg);
            setIsUpdating(false);
            return { success: false, message: msg };
        }
    };

    const shutdownApp = async (): Promise<void> => {
        try {
            await fetch('/api/version/shutdown', { method: 'POST' });
        } catch {
            // サーバー終了に伴う切断は正常
        }
    };

    const dismiss = () => {
        setIsDismissed(true);
    };

    return {
        updateInfo,
        isChecking,
        isUpdating,
        isDismissed,
        hasUpdate: !!updateInfo?.update_available && !isDismissed,
        checkForUpdates,
        applyUpdate,
        shutdownApp,
        dismiss
    };
}
