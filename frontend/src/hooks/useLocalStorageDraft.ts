import { useCallback } from 'react';

/**
 * localStorageを使用してデータの一時保存・取得・削除を行うカスタムフック
 * 日報入力中のデータを保全するために使用する
 */
export function useLocalStorageDraft<T>(key: string): {
    getDraft: () => T | null;
    saveDraft: (data: T) => void;
    clearDraft: () => void;
} {
    // データ取得
    const getDraft = useCallback((): T | null => {
        if (typeof window === 'undefined') return null;
        try {
            const saved = localStorage.getItem(key);
            return saved ? JSON.parse(saved) : null;
        } catch (e) {
            console.error(`Failed to load draft for ${key}:`, e);
            return null;
        }
    }, [key]);

    // データ保存
    const saveDraft = useCallback((data: T) => {
        if (typeof window === 'undefined') return;
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
            console.error(`Failed to save draft for ${key}:`, e);
        }
    }, [key]);

    // データ削除
    const clearDraft = useCallback(() => {
        if (typeof window === 'undefined') return;
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.error(`Failed to clear draft for ${key}:`, e);
        }
    }, [key]);

    return { getDraft, saveDraft, clearDraft };
}
