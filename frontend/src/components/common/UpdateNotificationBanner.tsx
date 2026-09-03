'use client';

import React, { useState } from 'react';
import { Sparkles, Download, X, AlertTriangle, CheckCircle2, ChevronRight, Loader2, Power } from 'lucide-react';
import { useAppUpdate } from '@/hooks/useAppUpdate';
import { useOffline } from '@/context/OfflineContext';

export default function UpdateNotificationBanner() {
    const { updateInfo, hasUpdate, isUpdating, applyUpdate, shutdownApp, dismiss } = useAppUpdate();
    const { pendingSyncCount } = useOffline();
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [isComplete, setIsComplete] = useState<boolean>(false);
    const [isShuttingDown, setIsShuttingDown] = useState<boolean>(false);
    const [updateStatusText, setUpdateStatusText] = useState<string>('');

    if (!hasUpdate || !updateInfo) return null;

    const handleApplyUpdate = async () => {
        setUpdateStatusText('最新EXEをダウンロード＆検証中...');
        const res = await applyUpdate();
        if (res.success) {
            setIsComplete(true);
            setUpdateStatusText('');
        } else {
            setUpdateStatusText('');
        }
    };

    const handleShutdown = async () => {
        setIsShuttingDown(true);
        await shutdownApp();
    };

    return (
        <>
            {/* ヘッダー内に表示するお知らせバッジ */}
            <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-lg text-xs font-bold shadow-xs transition-all animate-pulse hover:animate-none cursor-pointer"
                title="新しいバージョンが利用可能です。クリックして詳細を確認できます。"
            >
                <Sparkles size={14} className="text-yellow-200" />
                <span>新版 v{updateInfo.latest_version} が利用可能</span>
            </button>

            {/* 詳細＆アップデート実行モーダル */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-xs animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-200 flex flex-col">
                        {/* ヘッダー */}
                        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-amber-500/20 rounded-lg text-amber-400">
                                    <Sparkles size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm">営業日報システム アップデート</h3>
                                    <p className="text-[11px] text-slate-300">新しいバージョンが社内サーバーに公開されました</p>
                                </div>
                            </div>
                            {!isUpdating && (
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            )}
                        </div>

                        {/* 本文: 完了画面 */}
                        {isComplete ? (
                            <div className="p-8 text-center space-y-5 animate-fadeIn">
                                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                                    <CheckCircle2 size={38} />
                                </div>
                                <div className="space-y-1.5">
                                    <h3 className="text-base font-bold text-gray-800">
                                        最新版（v{updateInfo.latest_version}）への更新が完了しました！
                                    </h3>
                                    <p className="text-xs text-gray-600 leading-relaxed max-w-sm mx-auto">
                                        新しいEXEファイルが安全に配置されました。<br />
                                        変更を反映するため、一度アプリを終了してデスクトップのアイコンから再起動してください。
                                    </p>
                                </div>

                                {isShuttingDown ? (
                                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5 text-xs text-amber-800 animate-fadeIn">
                                        <p className="font-bold">アプリを正常に終了しました</p>
                                        <p className="text-[11px] text-amber-700">
                                            このブラウザタブを閉じて、デスクトップのアイコンから最新版の日報システムを起動してください。
                                        </p>
                                    </div>
                                ) : (
                                    <div className="pt-2 flex justify-center items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                dismiss();
                                                setIsModalOpen(false);
                                            }}
                                            className="px-4 py-2.5 text-gray-600 hover:text-gray-800 font-medium text-xs rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
                                        >
                                            あとで再起動する
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleShutdown}
                                            className="flex items-center gap-1.5 px-5 py-2.5 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-bold text-xs rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer"
                                        >
                                            <Power size={15} />
                                            今すぐアプリを終了する
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* 本文: 通常の確認画面 */
                            <>
                                <div className="p-6 space-y-4 text-xs">
                                    {/* バージョン比較 */}
                                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                                        <div>
                                            <p className="text-[10px] text-gray-500 font-medium">現在のバージョン</p>
                                            <p className="font-bold text-gray-700 text-sm">v{updateInfo.current_version}</p>
                                        </div>
                                        <ChevronRight size={18} className="text-gray-400" />
                                        <div>
                                            <p className="text-[10px] text-amber-600 font-bold">利用可能な最新版</p>
                                            <p className="font-extrabold text-amber-600 text-sm flex items-center gap-1">
                                                v{updateInfo.latest_version}
                                                {updateInfo.release_date && (
                                                    <span className="text-[10px] font-normal text-gray-400">({updateInfo.release_date})</span>
                                                )}
                                            </p>
                                        </div>
                                    </div>

                                    {/* リリースノート */}
                                    <div>
                                        <h4 className="font-bold text-gray-700 mb-2 flex items-center gap-1.5">
                                            <CheckCircle2 size={14} className="text-green-600" />
                                            更新内容・改善点
                                        </h4>
                                        <div className="bg-green-50/50 border border-green-200/60 rounded-xl p-3 space-y-1.5 max-h-48 overflow-y-auto">
                                            {updateInfo.release_notes && updateInfo.release_notes.length > 0 ? (
                                                updateInfo.release_notes.map((note, idx) => (
                                                    <div key={idx} className="flex items-start gap-1.5 text-gray-700">
                                                        <span className="text-green-600 font-bold">•</span>
                                                        <span className="leading-relaxed">{note}</span>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-gray-500">機能改善および安定性の向上</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* 未送信キューの警告 */}
                                    {pendingSyncCount > 0 && (
                                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
                                            <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                                            <div className="text-amber-800">
                                                <p className="font-bold">未同期の日報が {pendingSyncCount} 件あります</p>
                                                <p className="text-[10px] text-amber-700 mt-0.5 leading-relaxed">
                                                    ネットワーク再接続後に日報がファイルサーバーへ同期完了してからアップデートすることをお勧めします。
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* 更新中のステータス表示 */}
                                    {isUpdating && (
                                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-center space-y-2 animate-fadeIn">
                                            <Loader2 size={24} className="animate-spin text-blue-600 mx-auto" />
                                            <p className="font-bold text-blue-900">{updateStatusText}</p>
                                            <p className="text-[10px] text-blue-700">最新ファイルを配置しています。少々お待ちください...</p>
                                        </div>
                                    )}
                                </div>

                                {/* フッター */}
                                <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            dismiss();
                                            setIsModalOpen(false);
                                        }}
                                        disabled={isUpdating}
                                        className="px-3.5 py-2 text-gray-600 hover:text-gray-800 font-medium text-xs rounded-lg hover:bg-gray-200/60 transition-colors disabled:opacity-50 cursor-pointer"
                                    >
                                        今回はスキップ
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleApplyUpdate}
                                        disabled={isUpdating}
                                        className="flex items-center gap-1.5 px-5 py-2 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold text-xs rounded-lg shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                                    >
                                        {isUpdating ? (
                                            <>
                                                <Loader2 size={14} className="animate-spin" />
                                                更新を適用中...
                                            </>
                                        ) : (
                                            <>
                                                <Download size={14} />
                                                今すぐ更新する
                                            </>
                                        )}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
