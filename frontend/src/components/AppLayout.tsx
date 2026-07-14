'use client';

import Sidebar from './Sidebar';
import Header from './Header';
import { useFile } from '@/context/FileContext';
import { useViewerNotifications } from '@/hooks/useViewerNotifications';

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const { selectedFile } = useFile();

    // タブ復帰時に企画課ビューワーの状況変化を検知してトースト通知
    useViewerNotifications({ selectedFile });

    return (
        <div className="flex h-screen bg-sf-bg overflow-hidden">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0">
                <Header />
                <main className="flex-1 overflow-y-auto p-6">
                    {children}
                </main>
            </div>
        </div>
    );
}
