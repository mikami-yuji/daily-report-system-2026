import { useCallback, useEffect, useRef } from 'react';

/**
 * localStorageを使用してデータの一時保存・取得・削除を行うカスタムフック
 * 日報入力中のデータを保全するために使用する
 */
export function useLocalStorageDraft<T>(key: string): {
    getDraft: () => T | null;
    saveDraft: (data: T) => void;
    clearDraft: () => void;
} {
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const pendingDataRef = useRef<T | null>(null);

    // キー変更時、およびアンマウント時に保留中の一時保存データを即座に書き込む
    useEffect((): () => void => {
        return (): void => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
            if (pendingDataRef.current !== null && key) {
                try {
                    localStorage.setItem(key, JSON.stringify(pendingDataRef.current));
                } catch (e) {
                    console.error(`Failed to save pending draft for ${key} on unmount:`, e);
                }
            }
            pendingDataRef.current = null;
        };
    }, [key]);

    // データ取得
    const getDraft = useCallback((): T | null => {
        if (typeof window === 'undefined' || !key) return null;
        try {
            const saved = localStorage.getItem(key);
            return saved ? JSON.parse(saved) : null;
        } catch (e) {
            console.error(`Failed to load draft for ${key}:`, e);
            return null;
        }
    }, [key]);

    // 即時書き込みヘルパー
    const saveImmediately = useCallback((data: T): void => {
        if (typeof window === 'undefined' || !key) return;
        try {
            localStorage.setItem(key, JSON.stringify(data));
            pendingDataRef.current = null;
        } catch (e) {
            console.error(`Failed to save draft for ${key}:`, e);
        }
    }, [key]);

    // データ保存 (デバウンス処理: 1秒遅延)
    const saveDraft = useCallback((data: T): void => {
        if (!key) return;
        pendingDataRef.current = data;
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }
        timerRef.current = setTimeout((): void => {
            saveImmediately(data);
        }, 1000);
    }, [key, saveImmediately]);

    // データ削除
    const clearDraft = useCallback((): void => {
        pendingDataRef.current = null;
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        if (typeof window === 'undefined' || !key) return;
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.error(`Failed to clear draft for ${key}:`, e);
        }
    }, [key]);

    return { getDraft, saveDraft, clearDraft };
}
