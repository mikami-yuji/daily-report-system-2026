'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Report, Customer, getSyncStatus, triggerSyncProcess } from '@/lib/api';
import { generateUUID } from '@/lib/reportUtils';

type OfflineReport = {
    id: string;
    timestamp: number;
    data: Omit<Report, '管理番号'> | Partial<Omit<Report, '管理番号'>>;
    status: 'pending' | 'syncing' | 'error';
    filename: string;
    type: 'create' | 'update';
    reportId?: number;
};

type OfflineContextType = {
    isOnline: boolean;
    fileServerConnected: boolean;
    pendingSyncCount: number;
    offlineReports: OfflineReport[];
    saveOfflineReport: (data: Omit<Report, '管理番号'> | Partial<Omit<Report, '管理番号'>>, filename: string, type?: 'create' | 'update', reportId?: number) => void;
    syncReports: () => Promise<void>;
    triggerServerSync: () => Promise<void>;
    removeOfflineReport: (id: string) => void;
    cachedCustomers: Customer[];
    cacheCustomers: (customers: Customer[]) => void;
    cachedReports: Report[];
    cacheReports: (reports: Report[]) => void;
};

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

export function OfflineProvider({ children }: { children: ReactNode }): React.JSX.Element {
    const queryClient = useQueryClient();
    const [isOnline, setIsOnline] = useState(true);
    const [fileServerConnected, setFileServerConnected] = useState(true);
    const [pendingSyncCount, setPendingSyncCount] = useState(0);
    const [offlineReports, setOfflineReports] = useState<OfflineReport[]>([]);
    const [cachedCustomers, setCachedCustomers] = useState<Customer[]>([]);

    const offlineReportsRef = useRef(offlineReports);
    useEffect(() => {
        offlineReportsRef.current = offlineReports;
    }, [offlineReports]);
    const [cachedReports, setCachedReports] = useState<Report[]>([]);

    const prevPendingCountRef = useRef<number>(0);
    const isSyncingRef = useRef<boolean>(false);

    // サーバーの同期状態チェック
    const checkServerSyncStatus = useCallback(async () => {
        try {
            const status = await getSyncStatus();
            setFileServerConnected(status.file_server_connected);
            setPendingSyncCount(status.pending_sync_count);

            // サーバー側で未同期キューが消化された（例: 2件 -> 0件になった）場合、最新日報を即時再取得
            if (prevPendingCountRef.current > 0 && status.pending_sync_count === 0) {
                queryClient.invalidateQueries({ queryKey: ['reports'] });
                queryClient.invalidateQueries({ queryKey: ['dashboard'] });
                queryClient.invalidateQueries({ queryKey: ['stats'] });
            }
            prevPendingCountRef.current = status.pending_sync_count;
        } catch (e) {
            console.warn('Sync status check error:', e);
            setFileServerConnected(false);
        }
    }, [queryClient]);

    // サーバー同期の手動実行
    const triggerServerSync = useCallback(async () => {
        try {
            toast.loading('サーバー同期を実行中...', { id: 'manual-sync' });
            const res = await triggerSyncProcess();
            toast.success(`同期完了: ${res.processed}件反映しました (残${res.remaining}件)`, { id: 'manual-sync' });
            if (res.processed > 0) {
                await queryClient.invalidateQueries({ queryKey: ['reports'] });
                await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
                await queryClient.invalidateQueries({ queryKey: ['stats'] });
            }
            await checkServerSyncStatus();
        } catch (e) {
            console.error('Manual sync error:', e);
            toast.error('サーバー同期に失敗しました', { id: 'manual-sync' });
        }
    }, [checkServerSyncStatus, queryClient]);

    // 15秒ごとのヘルス・同期状態ポーリング
    useEffect(() => {
        checkServerSyncStatus();
        const interval = setInterval(checkServerSyncStatus, 15000);
        return () => clearInterval(interval);
    }, [checkServerSyncStatus]);

    // Initialize state from local storage and event listeners
    useEffect(() => {
        // Load saved reports
        const saved = localStorage.getItem('offlineReports');
        if (saved) {
            try {
                setOfflineReports(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to parse offline reports', e);
            }
        }

        // Load cached customers
        const savedCustomers = localStorage.getItem('cachedCustomers');
        if (savedCustomers) {
            try {
                setCachedCustomers(JSON.parse(savedCustomers));
            } catch (e) {
                console.error('Failed to parse cached customers', e);
            }
        }

        // Load cached reports
        const savedReports = localStorage.getItem('cachedReports');
        if (savedReports) {
            try {
                setCachedReports(JSON.parse(savedReports));
            } catch (e) {
                console.error('Failed to parse cached reports', e);
            }
        }

        // Set initial online status
        setIsOnline(navigator.onLine);

        const handleOnline = () => {
            setIsOnline(true);
            toast.success('オンラインに復帰しました。データを同期します。');
            syncReports();
        };

        const handleOffline = () => {
            setIsOnline(false);
            toast('オフラインモードに切り替わりました', { icon: '📡' });
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Save to local storage whenever reports change
    useEffect(() => {
        localStorage.setItem('offlineReports', JSON.stringify(offlineReports));
    }, [offlineReports]);

    // Save to local storage whenever customers change
    useEffect(() => {
        if (cachedCustomers.length > 0) {
            localStorage.setItem('cachedCustomers', JSON.stringify(cachedCustomers));
        }
    }, [cachedCustomers]);

    // Save to local storage whenever cached reports change
    useEffect(() => {
        if (cachedReports.length > 0) {
            localStorage.setItem('cachedReports', JSON.stringify(cachedReports));
        }
    }, [cachedReports]);

    const saveOfflineReport = (data: Omit<Report, '管理番号'> | Partial<Omit<Report, '管理番号'>>, filename: string, type: 'create' | 'update' = 'create', reportId?: number) => {
        const newReport: OfflineReport = {
            id: generateUUID(),
            timestamp: Date.now(),
            data,
            status: 'pending',
            filename,
            type,
            reportId
        };

        setOfflineReports(prev => {
            const updated = [...prev, newReport];
            localStorage.setItem('offlineReports', JSON.stringify(updated));
            return updated;
        });
        toast.success('オフラインで保存しました。オンライン時に自動送信されます。');
    };

    const cacheCustomers = (customers: Customer[]) => {
        setCachedCustomers(customers);
    };

    const cacheReports = (reports: Report[]) => {
        setCachedReports(reports);
    };

    const removeOfflineReport = (id: string) => {
        setOfflineReports(prev => prev.filter(r => r.id !== id));
    };

    const syncReports = async () => {
        // 多重実行防止（排他制御）
        if (isSyncingRef.current) {
            console.log('Sync already in progress, skipping.');
            return;
        }

        const pending = offlineReportsRef.current.filter(r => r.status === 'pending' || r.status === 'error');
        if (pending.length === 0) return;

        isSyncingRef.current = true;
        const toastId = toast.loading(`${pending.length}件のデータを同期中...`);

        let successCount = 0;
        let failCount = 0;

        try {
            // Process sequentially to avoid overwhelming the server
            for (const report of pending) {
                try {
                    // Update status to syncing
                    setOfflineReports(prev => {
                        const updated = prev.map(r => r.id === report.id ? { ...r, status: 'syncing' as const } : r);
                        offlineReportsRef.current = updated;
                        return updated;
                    });

                    let response;
                    if (report.type === 'update' && report.reportId) {
                        response = await fetch(`/api/reports/${report.reportId}?filename=${encodeURIComponent(report.filename)}`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify(report.data),
                        });
                    } else {
                        response = await fetch(`/api/reports?filename=${encodeURIComponent(report.filename)}`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify(report.data),
                        });
                    }

                    if (!response.ok) {
                        throw new Error(`Server error: ${response.status}`);
                    }

                    // 成功時は即座にキューから確実に削除（ステート・Ref・localStorage を即時反映）
                    setOfflineReports(prev => {
                        const next = prev.filter(r => r.id !== report.id);
                        localStorage.setItem('offlineReports', JSON.stringify(next));
                        offlineReportsRef.current = next;
                        return next;
                    });
                    successCount++;

                } catch (error) {
                    console.error('Sync failed for report', report.id, error);
                    // Update status to error
                    setOfflineReports(prev => {
                        const next = prev.map(r => r.id === report.id ? { ...r, status: 'error' as const } : r);
                        localStorage.setItem('offlineReports', JSON.stringify(next));
                        offlineReportsRef.current = next;
                        return next;
                    });
                    failCount++;
                }
            }

            if (successCount > 0) {
                toast.success(`${successCount}件の同期が完了しました`, { id: toastId });
                await queryClient.invalidateQueries({ queryKey: ['reports'] });
                await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
                await queryClient.invalidateQueries({ queryKey: ['stats'] });
            }
            if (failCount > 0) {
                toast.error(`${failCount}件の同期に失敗しました（復旧時に自動で再試行されます）`, { id: toastId });
            }
            if (successCount === 0 && failCount === 0) {
                toast.dismiss(toastId);
            }
        } finally {
            isSyncingRef.current = false;
        }
    };

    return (
        <OfflineContext.Provider value={{
            isOnline,
            fileServerConnected,
            pendingSyncCount,
            offlineReports,
            saveOfflineReport,
            syncReports,
            triggerServerSync,
            removeOfflineReport,
            cachedCustomers,
            cacheCustomers,
            cachedReports,
            cacheReports
        }}>
            {children}
        </OfflineContext.Provider>
    );
}

export function useOffline() {
    const context = useContext(OfflineContext);
    if (context === undefined) {
        throw new Error('useOffline must be used within an OfflineProvider');
    }
    return context;
}
