'use client';

import { FolderOpen, Upload } from 'lucide-react';
import { useFile } from '@/context/FileContext';
import { useState } from 'react';
import { uploadFile } from '@/lib/api';
import UpdateNotificationBanner from './common/UpdateNotificationBanner';

export default function Header() {
    const { files, selectedFile, setSelectedFile, refreshFiles } = useFile();
    const [uploading, setUploading] = useState(false);

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            await uploadFile(file);
            await refreshFiles();
            setSelectedFile(file.name);
            alert(`ファイル「${file.name}」をアップロードしました`);
        } catch (error) {
            console.error('File upload failed:', error);
            alert('ファイルのアップロードに失敗しました');
        } finally {
            setUploading(false);
            event.target.value = '';
        }
    };

    return (
        <header className="h-14 bg-white border-b border-sf-border flex items-center justify-between px-6 sticky top-0 z-10">
            {/* 左側: アップデート通知 */}
            <div className="flex items-center">
                <UpdateNotificationBanner />
            </div>

            {/* File Controls (Right Aligned) */}
            <div className="flex items-center gap-4">
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
                        onChange={(e) => setSelectedFile(e.target.value)}
                        className="bg-transparent text-sm text-sf-text focus:outline-none w-full cursor-pointer"
                        title="Excelファイルを選択"
                        aria-label="Excelファイルを選択"
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
    );
}
