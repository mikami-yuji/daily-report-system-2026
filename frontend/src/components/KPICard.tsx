import { LucideIcon } from 'lucide-react';

interface KPICardProps {
    title: string;
    value: number | string;
    icon: LucideIcon;
    trend?: {
        value: number;
        isPositive: boolean;
    };
    color?: 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'yellow';
}

const colorClasses = {
    blue: {
        bg: 'bg-blue-50',
        icon: 'text-blue-600',
        border: 'border-blue-100'
    },
    green: {
        bg: 'bg-green-50',
        icon: 'text-green-600',
        border: 'border-green-100'
    },
    orange: {
        bg: 'bg-orange-50',
        icon: 'text-orange-600',
        border: 'border-orange-100'
    },
    red: {
        bg: 'bg-red-50',
        icon: 'text-red-600',
        border: 'border-red-100'
    },
    purple: {
        bg: 'bg-purple-50',
        icon: 'text-purple-600',
        border: 'border-purple-100'
    },
    yellow: {
        bg: 'bg-yellow-50',
        icon: 'text-yellow-600',
        border: 'border-yellow-100'
    }
};

export default function KPICard({ title, value, icon: Icon, trend, color = 'blue' }: KPICardProps) {
    const colors = colorClasses[color];

    return (
        <div className={`${colors.bg} ${colors.border} border rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow`}>
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
                    <p className="text-3xl font-bold text-gray-900">{value}</p>
                    {trend && (
                        <div className="flex items-center gap-1 mt-2">
                            <span className={`text-sm font-medium ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
                            </span>
                            <span className="text-xs text-gray-500">前期比</span>
                        </div>
                    )}
                </div>
                <div className={`${colors.bg} p-3 rounded-full`}>
                    <Icon className={`${colors.icon} w-6 h-6`} />
                </div>
            </div>
        </div>
    );
}
