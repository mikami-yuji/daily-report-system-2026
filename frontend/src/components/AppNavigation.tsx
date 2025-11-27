import Link from 'next/link';

const navItems = [
    { name: 'ホーム', href: '/' },
    { name: '営業日報', href: '/reports' },
    { name: 'デザイン進捗', href: '/design-progress' },
    { name: 'ダッシュボード', href: '/dashboards' },
    { name: 'カレンダー', href: '/calendar' },
];

export default function AppNavigation() {
    return (
        <nav className="bg-white border-b border-sf-border h-10 flex items-end px-4 shadow-sm">
            {navItems.map((item) => (
                <Link
                    key={item.name}
                    href={item.href}
                    className="px-4 py-2 text-sm font-medium text-sf-text hover:text-sf-light-blue hover:border-b-2 hover:border-sf-light-blue transition-colors border-b-2 border-transparent"
                >
                    {item.name}
                </Link>
            ))}
        </nav>
    );
}
