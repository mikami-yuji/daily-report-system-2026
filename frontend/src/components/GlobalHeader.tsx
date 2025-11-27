import { Search, Bell, Settings, HelpCircle, User, Grid } from 'lucide-react';

export default function GlobalHeader() {
    return (
        <header className="bg-sf-header-bg text-white h-12 flex items-center px-4 justify-between sticky top-0 z-50">
            <div className="flex items-center gap-4">
                <button className="p-1 hover:bg-white/10 rounded">
                    <Grid size={20} />
                </button>
                <span className="font-bold text-lg tracking-wide">Salesforce</span>
            </div>

            <div className="flex-1 max-w-xl mx-4">
                <div className="relative">
                    <Search className="absolute left-2 top-1.5 text-gray-500" size={16} />
                    <input
                        type="text"
                        placeholder="Search..."
                        className="w-full bg-white text-black rounded pl-8 pr-4 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sf-light-blue"
                    />
                </div>
            </div>

            <div className="flex items-center gap-3">
                <button className="p-1 hover:bg-white/10 rounded"><HelpCircle size={20} /></button>
                <button className="p-1 hover:bg-white/10 rounded"><Settings size={20} /></button>
                <button className="p-1 hover:bg-white/10 rounded"><Bell size={20} /></button>
                <button className="p-1 hover:bg-white/10 rounded"><User size={20} /></button>
            </div>
        </header>
    );
}
