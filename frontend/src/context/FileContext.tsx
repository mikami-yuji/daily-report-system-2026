'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getFiles, ExcelFile } from '@/lib/api';

interface FileContextType {
  selectedFile: string;
  setSelectedFile: (file: string) => void;
  files: ExcelFile[];
  setFiles: (files: ExcelFile[]) => void;
  isLoadingFiles: boolean;
  refreshFiles: () => Promise<void>;
}

const FileContext = createContext<FileContextType | undefined>(undefined);

export function FileProvider({ children }: { children: ReactNode }) {
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [files, setFiles] = useState<ExcelFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(true);

  const refreshFiles = async () => {
    try {
      setIsLoadingFiles(true);
      const data = await getFiles();
      setFiles(data.files);
      
      // まだファイルが選択されていない場合のみ、デフォルトを設定
      // これにより、ページ遷移しても選択状態が維持される
      if (!selectedFile && data.default) {
        setSelectedFile(data.default);
      } else if (selectedFile && !data.files.find(f => f.name === selectedFile)) {
        // 選択中のファイルが存在しなくなった場合（削除など）、デフォルトに戻す
        setSelectedFile(data.default);
      }
    } catch (error) {
      console.error('Failed to load files:', error);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  useEffect(() => {
    refreshFiles();
  }, []);

  return (
    <FileContext.Provider value={{ selectedFile, setSelectedFile, files, setFiles, isLoadingFiles, refreshFiles }}>
      {children}
    </FileContext.Provider>
  );
}

export function useFile() {
  const context = useContext(FileContext);
  if (context === undefined) {
    throw new Error('useFile must be used within a FileProvider');
  }
  return context;
}
