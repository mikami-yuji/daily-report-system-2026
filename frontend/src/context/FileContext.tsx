'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getFiles, ExcelFile } from '@/lib/api';

type FileContextType = {
  selectedFile: string;
  setSelectedFile: (file: string) => void;
  files: ExcelFile[];
  setFiles: (files: ExcelFile[]) => void;
  isLoadingFiles: boolean;
  refreshFiles: () => Promise<void>;
};

const FileContext = createContext<FileContextType | undefined>(undefined);

export function FileProvider({ children }: { children: ReactNode }) {
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [files, setFiles] = useState<ExcelFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(true);

  // Use ref to track real-time selectedFile for async functions
  const selectedFileRef = React.useRef(selectedFile);

  useEffect(() => {
    selectedFileRef.current = selectedFile;
    if (selectedFile) {
      localStorage.setItem('selectedFile', selectedFile);
    }
  }, [selectedFile]);

  const refreshFiles = async (preferredFile?: string) => {
    try {
      setIsLoadingFiles(true);
      const data = await getFiles();
      setFiles(data.files);

      // Determine the file to check against: 
      // 1. Explicitly passed preferredFile (for initial load)
      // 2. Current ref value (for manual refresh)
      const currentSelection = preferredFile !== undefined ? preferredFile : selectedFileRef.current;

      // Logic:
      // If no file selected yet -> set default
      // If file selected but not found in new list -> set default
      // If file selected and found -> keep it (do nothing)

      if (!currentSelection && data.default) {
        setSelectedFile(data.default);
      } else if (currentSelection && !data.files.find(f => f.name === currentSelection)) {
        console.warn(`Selected file ${currentSelection} not found in updated list. Reverting to default.`);
        setSelectedFile(data.default);
      }
    } catch (error) {
      console.error('Failed to load files:', error);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  useEffect(() => {
    // Load from local storage on mount
    const savedFile = localStorage.getItem('selectedFile');
    if (savedFile) {
      setSelectedFile(savedFile);
    }
    // Pass savedFile to ensure it's considered even if state update is pending
    refreshFiles(savedFile || undefined);
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
