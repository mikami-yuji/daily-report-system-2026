'use client';

import { useState, useEffect } from 'react';
import { Bell, BellOff, Smartphone, Wifi, WifiOff } from 'lucide-react';

export default function SettingsPage() {
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    const [isOnline, setIsOnline] = useState(true);
    const [isStandalone, setIsStandalone] = useState(false);

    useEffect(() => {
        // Check online status
        setIsOnline(navigator.onLine);
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Check if running as PWA
        const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
            (window.navigator as any).standalone ||
            document.referrer.includes('android-app://');
        setIsStandalone(isPWA);

        // Check notification permission
        if ('Notification' in window) {
            setNotificationsEnabled(Notification.permission === 'granted');
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

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

                {/* Sales Data Management Card */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Smartphone size={20} className="text-blue-600" />
                        売上データ管理
                    </h2>

                    <div className="space-y-4">
                        <p className="text-sm text-gray-600">
                            全顧客の売上データを一括で登録・更新します。<br/>
                            CSVファイル (Shift-JIS または UTF-8) をアップロードしてください。
                        </p>
                        
                        <div className="flex items-center gap-4">
                            <input
                                type="file"
                                accept=".csv"
                                className="block w-full text-sm text-gray-500
                                    file:mr-4 file:py-2 file:px-4
                                    file:rounded-full file:border-0
                                    file:text-sm file:font-semibold
                                    file:bg-blue-50 file:text-blue-700
                                    hover:file:bg-blue-100"
                                onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;

                                    if (!confirm('既存の売上データを上書きしますか？')) {
                                        e.target.value = '';
                                        return;
                                    }

                                    const formData = new FormData();
                                    formData.append('file', file);

                                    try {
                                        const res = await fetch('http://localhost:8001/api/sales/upload', {
                                            method: 'POST',
                                            body: formData,
                                        });

                                        if (res.ok) {
                                            alert('売上データを更新しました。');
                                        } else {
                                            const err = await res.json();
                                            alert(`エラー: ${err.detail || 'アップロードに失敗しました'}`);
                                        }
                                    } catch (error) {
                                        console.error(error);
                                        alert('通信エラーが発生しました。');
                                    }
                                    e.target.value = ''; // Reset input
                                }}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
