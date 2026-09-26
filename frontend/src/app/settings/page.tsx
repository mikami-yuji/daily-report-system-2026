'use client';

import { useState, useEffect } from 'react';
import { Bell, BellOff, Smartphone, Wifi, WifiOff, Key, CheckCircle2, XCircle, Loader2, Database, RefreshCw, FileSpreadsheet, HardDrive } from 'lucide-react';
import { getLatestDesignRequests } from '@/lib/api';
import toast from 'react-hot-toast';

type AS400SyncStatus = {
    is_syncing: boolean;
    total_orders: number;
    last_import_time: string | null;
    last_csv_path: string | null;
    latest_csv: {
        path: string;
        filename: string;
        size: number;
        modified_at: string;
    } | null;
    configured_dir: string;
    auto_sync_enabled?: boolean;
    is_up_to_date?: boolean;
};

export default function SettingsPage(): React.JSX.Element {
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    const [isOnline, setIsOnline] = useState(true);
    const [isStandalone, setIsStandalone] = useState(false);
    const [viewerPasscode, setViewerPasscode] = useState('');
    const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'failed'>('idle');
    const [testMessage, setTestMessage] = useState('');
    const [isTesting, setIsTesting] = useState(false);

    // AS/400 売上データ同期ステート
    const [as400Status, setAs400Status] = useState<AS400SyncStatus | null>(null);
    const [isSyncingAS400, setIsSyncingAS400] = useState(false);
    const [as400Error, setAs400Error] = useState<string | null>(null);

    const handleTestConnection = async () => {
        if (!viewerPasscode) {
            setTestStatus('failed');
            setTestMessage('パスコードが入力されていません。');
            return;
        }
        setIsTesting(true);
        setTestStatus('idle');
        setTestMessage('');
        try {
            const data = await getLatestDesignRequests(viewerPasscode);
            if (data && data.documents) {
                setTestStatus('success');
                const count = data.documents.length;
                setTestMessage(`接続成功！データを正常にロードしました (進行中: ${count}件)`);
                localStorage.setItem('viewer_passcode', viewerPasscode);
            } else {
                setTestStatus('failed');
                setTestMessage(data.message || '接続に失敗しました。');
            }
        } catch (error: unknown) {
            console.error('Test connection error:', error);
            setTestStatus('failed');
            const err = error as { response?: { data?: { detail?: string } } };
            const detail = err.response?.data?.detail || '接続エラーが発生しました。サーバーの起動状態とパスコードをご確認ください。';
            setTestMessage(`接続失敗: ${detail}`);
        } finally {
            setIsTesting(false);
        }
    };

    useEffect(() => {
        // Check online status and standalone status asynchronously to avoid cascading renders
        requestAnimationFrame(() => {
            setIsOnline(navigator.onLine);
            if (typeof window !== 'undefined') {
                const savedCode = localStorage.getItem('viewer_passcode') || '';
                setViewerPasscode(savedCode);
                if (savedCode) {
                    const verifyConnection = async (code: string): Promise<void> => {
                        setIsTesting(true);
                        setTestStatus('idle');
                        setTestMessage('');
                        try {
                            const data = await getLatestDesignRequests(code);
                            if (data && data.documents) {
                                setTestStatus('success');
                                const count = data.documents.length;
                                setTestMessage(`接続成功！データを正常にロードしました (進行中: ${count}件)`);
                            } else {
                                setTestStatus('failed');
                                setTestMessage(data.message || '接続に失敗しました。');
                            }
                        } catch (error: unknown) {
                            console.error('Initial verification error:', error);
                            setTestStatus('failed');
                            const err = error as { response?: { data?: { detail?: string } } };
                            const detail = err.response?.data?.detail || '接続エラーが発生しました。';
                            setTestMessage(`接続失敗: ${detail}`);
                        } finally {
                            setIsTesting(false);
                        }
                    };
                    verifyConnection(savedCode);
                }
            }

            // Check if running as PWA
            const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                (window.navigator as Navigator & { standalone?: boolean }).standalone ||
                document.referrer.includes('android-app://');
            setIsStandalone(isPWA);

            // Check notification permission
            if ('Notification' in window) {
                setNotificationsEnabled(Notification.permission === 'granted');
            }
        });

        // AS/400 同期ステータス取得
        fetchAS400Status();

        const handleOnline = (): void => setIsOnline(true);
        const handleOffline = (): void => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const fetchAS400Status = async () => {
        try {
            const res = await fetch('http://localhost:8001/api/sales/sync-status');
            if (res.ok) {
                const data = await res.json();
                setAs400Status(data);
                setAs400Error(null);
            }
        } catch (err) {
            console.error('Failed to fetch AS400 status:', err);
            setAs400Error('同期ステータスの取得に失敗しました');
        }
    };

    const handleSyncAS400 = async () => {
        if (isSyncingAS400) return;
        setIsSyncingAS400(true);
        setAs400Error(null);
        const tId = toast.loading('基幹売上明細（AS/400）を同期しています...');
        try {
            const res = await fetch('http://localhost:8001/api/sales/sync', {
                method: 'POST'
            });
            const data = await res.json();
            if (res.ok && data.success) {
                toast.success(data.message || '同期が完了しました！', { id: tId, duration: 5000 });
                if (data.status) {
                    setAs400Status(data.status);
                } else {
                    fetchAS400Status();
                }
            } else {
                toast.error(data.message || '同期処理に失敗しました。', { id: tId, duration: 5000 });
                setAs400Error(data.message);
                fetchAS400Status();
            }
        } catch (err: unknown) {
            console.error('AS400 sync error:', err);
            const msg = '通信エラーが発生しました。';
            toast.error(msg, { id: tId });
            setAs400Error(msg);
        } finally {
            setIsSyncingAS400(false);
        }
    };

    const requestNotificationPermission = async () => {
        if (!('Notification' in window)) {
            alert('このブラウザは通知をサポートしていません。');
            return;
        }

        try {
            const permission = await Notification.requestPermission();
            setNotificationsEnabled(permission === 'granted');
            if (permission === 'granted') {
                // Here we would subscribe to push notifications
                // const registration = await navigator.serviceWorker.ready;
                // const subscription = await registration.pushManager.subscribe(...)
                alert('通知が許可されました。');
            }
        } catch (error) {
            console.error('Error requesting permission:', error);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">設定</h1>
                <p className="text-gray-600">アプリケーションの設定とステータス確認</p>
            </div>

            <div className="space-y-6 max-w-2xl">
                {/* App Status Card */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Smartphone size={20} />
                        アプリステータス
                    </h2>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <span className="text-gray-700">ネットワーク接続</span>
                            <div className={`flex items-center gap-2 ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
                                {isOnline ? <Wifi size={18} /> : <WifiOff size={18} />}
                                <span className="font-medium">{isOnline ? 'オンライン' : 'オフライン'}</span>
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <span className="text-gray-700">インストール状態</span>
                            <div className="flex items-center gap-2 text-gray-600">
                                <span className="font-medium">
                                    {isStandalone ? 'アプリとして実行中' : 'ブラウザで実行中'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Notifications Card */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Bell size={20} />
                        通知設定
                    </h2>

                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium text-gray-900">プッシュ通知</p>
                            <p className="text-sm text-gray-500">重要な更新やリマインダーを受け取る</p>
                        </div>
                        <button
                            onClick={requestNotificationPermission}
                            disabled={notificationsEnabled}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${notificationsEnabled
                                    ? 'bg-green-100 text-green-700 cursor-default'
                                    : 'bg-sf-light-blue text-white hover:bg-blue-600'
                                }`}
                        >
                            {notificationsEnabled ? (
                                <>
                                    <Bell size={18} />
                                    許可済み
                                </>
                            ) : (
                                <>
                                    <BellOff size={18} />
                                    通知を許可
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* 企画課ビューア連携設定 Card */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 font-sans">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Key size={20} className="text-amber-500" />
                        企画課デザインビューア連携設定
                    </h2>

                    <div className="space-y-4">
                        <p className="text-sm text-gray-600">
                            企画課ビューアとの自動データ連携に必要なパスコードを設定します。<br/>
                            ここに登録・ログインを完了させることで、日報の入力画面からデザイン依頼情報を選択するだけで自動補完できるようになります。
                        </p>

                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">社内専用パスコード</label>
                                <div className="flex gap-2">
                                    <input
                                        type="password"
                                        placeholder="パスコードを入力"
                                        value={viewerPasscode}
                                        onChange={(e) => {
                                            setViewerPasscode(e.target.value);
                                            setTestStatus('idle');
                                        }}
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleTestConnection}
                                        disabled={isTesting || !viewerPasscode}
                                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold disabled:bg-amber-300 transition-colors flex items-center gap-1 cursor-pointer"
                                    >
                                        {isTesting && <Loader2 size={16} className="animate-spin" />}
                                        接続テスト & 保存
                                    </button>
                                </div>
                            </div>

                            {testStatus === 'success' && (
                                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-xs flex items-start gap-2">
                                    <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
                                    <span>{testMessage}</span>
                                </div>
                            )}

                            {testStatus === 'failed' && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-start gap-2">
                                    <XCircle size={16} className="mt-0.5 flex-shrink-0" />
                                    <span>{testMessage}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* AS/400 Sales Data Sync Card */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <Database size={20} className="text-blue-600" />
                            基幹売上明細連携 (AS/400 自動同期・手動同期)
                        </h2>
                        <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                                自動同期: 有効 (定期監視中)
                            </span>
                            {as400Status && as400Status.total_orders > 0 && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    登録済: {as400Status.total_orders.toLocaleString()} 件
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <p className="text-sm text-gray-600 leading-relaxed">
                            基幹システム（IBM AS/400）から共有フォルダに出力された最新売上明細CSVを取り込みます。<br/>
                            <strong>システム起動時および定期的に、フォルダ内の最新CSVを自動検知して取り込みます。</strong>最新の売上・粗利・直近受注残（ロール＝ｍ、単袋＋他＝枚）を今すぐ手動で即時反映したい場合は、以下のボタンからも同期できます。
                        </p>

                        {/* ステータスボックス */}
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2 text-xs text-gray-700">
                            <div className="flex items-center justify-between">
                                <span className="font-semibold flex items-center gap-1.5 text-gray-800">
                                    <HardDrive size={14} className="text-gray-500" />
                                    基幹共有フォルダ:
                                </span>
                                <span className="font-mono text-gray-600 select-all">{as400Status?.configured_dir || '\\\\192.168.1.200\\qibm\\ABS\\USERDATA\\054'}</span>
                            </div>

                            <div className="flex items-center justify-between">
                                <span className="font-semibold flex items-center gap-1.5 text-gray-800">
                                    <FileSpreadsheet size={14} className="text-gray-500" />
                                    検出された最新CSV:
                                </span>
                                <span>
                                    {as400Status?.latest_csv ? (
                                        <span className="text-blue-700 font-mono font-medium">
                                            {as400Status.latest_csv.filename}
                                            <span className="text-gray-500 ml-1.5">({as400Status.latest_csv.modified_at} 更新)</span>
                                        </span>
                                    ) : (
                                        <span className="text-gray-400">CSVが見つかりません（社内ネットワーク未接続）</span>
                                    )}
                                </span>
                            </div>

                            <div className="flex items-center justify-between pt-1 border-t border-gray-200">
                                <span className="font-semibold text-gray-800">
                                    最終同期日時:
                                </span>
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-gray-600">
                                        {as400Status?.last_import_time ? as400Status.last_import_time : '未実行'}
                                    </span>
                                    {as400Status?.is_up_to_date && (
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-700">
                                            最新反映済
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {as400Error && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-start gap-2">
                                <XCircle size={16} className="mt-0.5 flex-shrink-0" />
                                <span>{as400Error}</span>
                            </div>
                        )}

                        <div className="flex items-center gap-3 pt-2">
                            <button
                                type="button"
                                onClick={handleSyncAS400}
                                disabled={isSyncingAS400}
                                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold disabled:bg-blue-300 transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
                            >
                                {isSyncingAS400 ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        <span>基幹データを同期中（10〜15秒ほどかかります）...</span>
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw size={16} />
                                        <span>今すぐ最新データを手動同期する</span>
                                    </>
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={fetchAS400Status}
                                disabled={isSyncingAS400}
                                className="px-3 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm transition-colors flex items-center gap-1 cursor-pointer"
                                title="ステータス再取得"
                            >
                                <RefreshCw size={14} className={isSyncingAS400 ? 'animate-spin' : ''} />
                                状態更新
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
