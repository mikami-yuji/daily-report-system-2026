'use client';

import { FolderOpen, Upload, RefreshCw, Search } from 'lucide-react';
import { useFile } from '@/context/FileContext';
import { useState, useEffect } from 'react';
import { uploadFile, clearCache } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import UpdateNotificationBanner from './common/UpdateNotificationBanner';
import GlobalSearchModal from './common/GlobalSearchModal';

export default function Header() {
    const { files, selectedFile, setSelectedFile, refreshFiles } = useFile();
    const [uploading, setUploading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
    const queryClient = useQueryClient();

    // Ctrl+K または Cmd+K で検索モーダルを開く
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                setIsSearchModalOpen(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            await uploadFile(file);
            await refreshFiles();
            setSelectedFile(file.name);
            queryClient.invalidateQueries();
            toast.success(`ファイル「${file.name}」をアップロードしました`);
        } catch (error) {
            console.error('File upload failed:', error);
            toast.error('ファイルのアップロードに失敗しました');
        } finally {
            setUploading(false);
            event.target.value = '';
        }
    };

    const handleFileChange = (newFile: string) => {
        setSelectedFile(newFile);
        // 担当者を変更した際、キャッシュを即座に無効化して全画面データを最新化
        queryClient.invalidateQueries();
    };

    const handleManualRefresh = async () => {
        setRefreshing(true);
        try {
            // バックエンド・SQLiteキャッシュを強制クリア
            try {
                await clearCache(selectedFile || undefined);
            } catch (cacheErr) {
                console.warn('Cache clear notice:', cacheErr);
            }
            await refreshFiles();
            await queryClient.invalidateQueries();
            toast.success('ファイル一覧と画面データを最新化しました');
        } catch (err) {
            console.error('Refresh failed:', err);
            toast.error('データの更新に失敗しました');
        } finally {
            setRefreshing(false);
        }
    };

    return (
        <>
            <header className="h-14 bg-white border-b border-sf-border flex items-center justify-between px-6 sticky top-0 z-10">
                {/* 左側: アップデート通知 */}
                <div className="flex items-center">
                    <UpdateNotificationBanner />
                </div>

                {/* 中央: 全体横断クイック検索ボタン (Ctrl+K) */}
                <button
                    type="button"
                    onClick={() => setIsSearchModalOpen(true)}
                    className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-sf-border bg-gray-50/80 hover:bg-gray-100 text-gray-500 hover:text-gray-800 text-xs transition cursor-pointer min-w-[240px]"
                    title="クイック検索・ジャンプ (Ctrl + K)"
                >
                    <Search size={14} className="text-gray-400" />
                    <span className="flex-1 text-left">得意先・デザイン・画面へ...</span>
                    <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-semibold text-gray-500 bg-white border border-gray-300 rounded shadow-2xs">
                        Ctrl K
                    </kbd>
                </button>

                {/* File Controls (Right Aligned) */}
                <div className="flex items-center gap-3">
                    {/* File List Refresh Button */}
                    <button
                        type="button"
                        onClick={handleManualRefresh}
                        disabled={refreshing}
                        className={`flex items-center justify-center p-2 rounded border border-sf-border bg-white text-sf-text-weak hover:text-sf-text hover:bg-gray-50 transition-colors ${refreshing ? 'opacity-50' : ''}`}
                        title="担当者ファイル一覧と画面データを最新化"
                        aria-label="担当者ファイル一覧と画面データを最新化"
                    >
                        <RefreshCw size={15} className={refreshing ? 'animate-spin text-sf-light-blue' : ''} />
                    </button>

                    {/* Read / Upload Button */}
                    <label className={`flex items-center justify-center px-3 py-1.5 rounded border border-sf-border bg-white cursor-pointer hover:bg-gray-50 transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`} title="Excelファイルをアップロード">
                        <input
                            type="file"
                            accept=".xlsx,.xlsm"
                            className="hidden"
                            onChange={handleFileUpload}
                            disabled={uploading}
                        />
                        <Upload size={16} className="text-sf-text-weak mr-2" />
                        <span className="text-sm text-sf-text">読込</span>
                    </label>

                    {/* File Selector */}
                    <div className="flex items-center gap-2 border border-sf-border rounded px-3 py-1.5 bg-white min-w-[240px]">
                        <FolderOpen size={16} className="text-sf-text-weak" />
                        <select
                            value={selectedFile}
                            onChange={(e) => handleFileChange(e.target.value)}
                            className="bg-transparent text-sm text-sf-text focus:outline-none w-full cursor-pointer font-medium"
                            title="担当者Excelファイルを選択"
                            aria-label="担当者Excelファイルを選択"
                        >
                            {(files || []).map((file) => (
                                <option key={file.name} value={file.name}>
                                    {file.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </header>

            {/* グローバル検索モーダル */}
            <GlobalSearchModal 
                isOpen={isSearchModalOpen} 
                onClose={() => setIsSearchModalOpen(false)} 
            />
        </>
    );
}
