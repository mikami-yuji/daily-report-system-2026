'use client';

import React, { useEffect } from 'react';
import { Loader2, Check, AlertTriangle, ShieldCheck, Database, FileSpreadsheet } from 'lucide-react';

export type SaveStatus = 'idle' | 'sending' | 'writing' | 'backup' | 'success';

interface SavingLockOverlayProps {
    isSaving: boolean;
    saveStatus?: SaveStatus;
    title?: string;
}

export default function SavingLockOverlay({
    isSaving,
    saveStatus = 'sending',
    title = '日報を保存しています'
}: SavingLockOverlayProps) {
    // ESCキーなどあらゆるキーボード操作を保存中に無効化
    useEffect(() => {
        if (!isSaving) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // 保存中はあらゆるキーによる誤動作（Escでモーダルを閉じる等）を防止
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
            }
        };

        window.addEventListener('keydown', handleKeyDown, { capture: true });
        return () => {
            window.removeEventListener('keydown', handleKeyDown, { capture: true });
        };
    }, [isSaving]);

    if (!isSaving && saveStatus !== 'success') return null;

    // ステータスごとの表示内容
    const getStatusInfo = () => {
        switch (saveStatus) {
            case 'writing':
                return {
                    label: 'Excelファイルへ安全に書き込み中...',
                    percent: 65,
                    icon: <FileSpreadsheet className="w-5 h-5 text-emerald-600 animate-pulse" />
                };
            case 'backup':
                return {
                    label: 'バックアップを作成中...',
                    percent: 90,
                    icon: <Database className="w-5 h-5 text-indigo-600 animate-pulse" />
                };
            case 'success':
                return {
                    label: '保存が正常に完了しました！',
                    percent: 100,
                    icon: <ShieldCheck className="w-5 h-5 text-emerald-600" />
                };
            case 'sending':
            default:
                return {
                    label: 'サーバーへデータを送信中...',
                    percent: 30,
                    icon: <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                };
        }
    };

    const statusInfo = getStatusInfo();
    const isSuccess = saveStatus === 'success';

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm transition-all duration-300 select-none cursor-wait p-4"
            onClick={(e) => {
                // 外側のクリックを完全に吸収して何もしない
                e.preventDefault();
                e.stopPropagation();
            }}
            onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
            }}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 p-6 md:p-8 max-w-md w-full mx-auto text-center transform transition-all duration-300 animate-in fade-in zoom-in-95"
                onClick={(e) => e.stopPropagation()}
            >
                {/* アイコンサークル */}
                <div className="flex justify-center mb-5">
                    {isSuccess ? (
                        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-md ring-8 ring-emerald-50 animate-bounce">
                            <Check className="w-8 h-8" strokeWidth={3} />
                        </div>
                    ) : (
                        <div className="relative w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center shadow-md ring-8 ring-blue-50/50">
                            <div className="absolute inset-0 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin" />
                            <Loader2 className="w-7 h-7 text-blue-600 animate-spin" />
                        </div>
                    )}
                </div>

                {/* タイトル */}
                <h3 className="text-xl font-bold text-slate-800 mb-2">
                    {isSuccess ? '保存完了' : title}
                </h3>

                {/* ステータステキスト */}
                <div className="flex items-center justify-center gap-2 text-sm font-medium text-slate-600 mb-4 h-6">
                    {statusInfo.icon}
                    <span>{statusInfo.label}</span>
                </div>

                {/* プログレスバー */}
                <div className="w-full bg-slate-100 rounded-full h-2.5 mb-5 overflow-hidden border border-slate-200/60 shadow-inner">
                    <div
                        className={`h-full transition-all duration-500 rounded-full ${
                            isSuccess
                                ? 'bg-emerald-500'
                                : 'bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-500'
                        }`}
                        style={{ width: `${statusInfo.percent}%` }}
                    />
                </div>

                {/* 注意喚起アラート */}
                {!isSuccess ? (
                    <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3.5 text-left flex items-start gap-3 shadow-sm">
                        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="text-xs text-amber-900 leading-relaxed">
                            <p className="font-bold text-amber-950 mb-0.5">
                                画面を閉じないでください
                            </p>
                            <p className="text-amber-800">
                                トラブル（データの消失やファイルの破損）を防ぐため、保存が完了するまでブラウザやタブを閉じずにそのままお待ちください。
                            </p>
                        </div>
                    </div>
                ) : (
                    <p className="text-xs text-emerald-700 font-medium animate-pulse">
                        まもなく画面が切り替わります...
                    </p>
                )}
            </div>
        </div>
    );
}
