'use client';

import Sidebar from './Sidebar';
import Header from './Header';

export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-screen bg-sf-bg overflow-hidden">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0">
                <Header />
                <main className="flex-1 overflow-y-auto px-4 py-2.5 sm:px-6 sm:py-3 flex flex-col min-h-0">
                    {children}
                </main>
            </div>
        </div>
    );
}
