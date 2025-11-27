'use client';

import { Search, Bell, HelpCircle, Settings } from 'lucide-react';

export default function Header() {
    return (
        <header className="h-14 bg-white border-b border-sf-border flex items-center justify-between px-6 sticky top-0 z-10">
            {/* Global Search */}
            <div className="flex-1 max-w-xl">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="検索..."
                        className="w-full pl-10 pr-4 py-1.5 bg-gray-100 border border-transparent rounded focus:bg-white focus:border-sf-light-blue focus:ring-1 focus:ring-sf-light-blue outline-none text-sm transition-all"
                    />
                </div>
            </div>

            {/* Right Actions */}
            <div className="flex items-center space-x-4 ml-4">
                <button className="text-gray-500 hover:text-sf-light-blue transition-colors">
                    <HelpCircle size={20} />
                </button>
                <button className="text-gray-500 hover:text-sf-light-blue transition-colors relative">
                    <Bell size={20} />
                    <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                </button>
                <button className="text-gray-500 hover:text-sf-light-blue transition-colors">
                    <Settings size={20} />
                </button>
            </div>
        </header>
    );
}
