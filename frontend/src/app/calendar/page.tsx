'use client';

import { useEffect, useState, useRef } from 'react';
import { useFile } from '@/context/FileContext';
import { getReports, Report } from '@/lib/api';
import { generateMonthCalendar, MonthData, CalendarDay, getDayName, getMonthName } from '@/lib/calendar';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Printer, Users, MapPin } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';

export default function CalendarPage() {
    const { selectedFile } = useFile();
    const [reports, setReports] = useState<Report[]>([]);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [monthData, setMonthData] = useState<MonthData | null>(null);
    const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
    const [loading, setLoading] = useState(true);
    const printRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadReports();
    }, [selectedFile]);

    useEffect(() => {
        if (reports.length > 0) {
            generateCalendar();
        }
    }, [reports, currentDate]);

    const loadReports = async () => {
        if (!selectedFile) return;
        try {
            setLoading(true);
            const data = await getReports(selectedFile);
            setReports(data);
        } catch (error) {
            console.error('Failed to load reports:', error);
        } finally {
            setLoading(false);
        }
    };

    const generateCalendar = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const data = generateMonthCalendar(year, month, reports);
        setMonthData(data);
    };

    const handlePreviousMonth = () => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            newDate.setMonth(prev.getMonth() - 1);
            return newDate;
        });
        setSelectedDay(null);
    };

    const handleNextMonth = () => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            newDate.setMonth(prev.getMonth() + 1);
            return newDate;
        });
        setSelectedDay(null);
    };

    const handleToday = () => {
        setCurrentDate(new Date());
        setSelectedDay(null);
    };

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `訪問カレンダー_${currentDate.getFullYear()}年${getMonthName(currentDate.getMonth())}`,
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen flex-col">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sf-light-blue mx-auto mb-4"></div>
                    <p className="text-sf-text-weak">データを読み込んでいます...</p>
                </div>
            </div>
        );
    }

    if (!monthData) {
        return (
            <div className="flex items-center justify-center min-h-screen flex-col">
                <p className="text-sf-text-weak">データがありません</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">訪問カレンダー</h1>
                        <p className="text-gray-600">月次訪問履歴の確認とレポート出力</p>
                    </div>
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-4 py-2 bg-sf-light-blue text-white rounded-lg hover:bg-blue-600 transition-colors print:hidden"
                    >
                        <Printer size={18} />
                        印刷
                    </button>
                </div>
            </div>

            {/* Controls */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6 print:hidden">
                <div className="flex items-center justify-between">
                    <button
                        onClick={handlePreviousMonth}
                        className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <ChevronLeft size={20} />
                        前月
                    </button>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleToday}
                            className="px-4 py-2 text-sm font-medium text-sf-light-blue hover:bg-blue-50 rounded-lg transition-colors"
                        >
                            今月
                        </button>
                        <div className="flex items-center gap-2">
                            <CalendarIcon size={20} className="text-gray-600" />
                            <h2 className="text-2xl font-bold text-gray-900">
                                {currentDate.getFullYear()}年 {getMonthName(currentDate.getMonth())}
                            </h2>
                        </div>
                    </div>

                    <button
                        onClick={handleNextMonth}
                        className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        次月
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 print:hidden">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-blue-50 rounded-lg">
                            <MapPin className="text-blue-600" size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">総訪問数</p>
                            <p className="text-2xl font-bold text-gray-900">{monthData.totalVisits}件</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-green-50 rounded-lg">
                            <Users className="text-green-600" size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">訪問先数</p>
                            <p className="text-2xl font-bold text-gray-900">{monthData.uniqueCustomers}社</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Calendar */}
            <div ref={printRef} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                {/* Print Header */}
                <div className="hidden print:block mb-6">
                    <h1 className="text-2xl font-bold text-center mb-2">
                        訪問カレンダー - {currentDate.getFullYear()}年 {getMonthName(currentDate.getMonth())}
                    </h1>
                    <div className="flex justify-center gap-8 text-sm text-gray-600">
                        <p>総訪問数: {monthData.totalVisits}件</p>
                        <p>訪問先数: {monthData.uniqueCustomers}社</p>
                    </div>
                </div>

                {/* Day Headers */}
                <div className="grid grid-cols-7 gap-2 mb-2">
                    {[0, 1, 2, 3, 4, 5, 6].map(day => (
                        <div
                            key={day}
                            className={`text-center font-bold py-2 ${day === 0 ? 'text-red-600' : day === 6 ? 'text-blue-600' : 'text-gray-700'
                                }`}
                        >
                            {getDayName(day)}
                        </div>
                    ))}
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-2">
                    {monthData.days.map((day, index) => {
                        const isToday = day.dateString === new Date().toISOString().split('T')[0].replace(/-/g, '/');
                        const dayOfWeek = day.date.getDay();

                        return (
                            <div
                                key={index}
                                onClick={() => day.isCurrentMonth && day.visits.length > 0 && setSelectedDay(day)}
                                className={`min-h-[120px] border rounded-lg p-2 transition-all print:min-h-[100px] print:break-inside-avoid ${day.isCurrentMonth
                                    ? 'bg-white border-gray-200 hover:border-sf-light-blue hover:shadow-md cursor-pointer'
                                    : 'bg-gray-50 border-gray-100'
                                    } ${isToday ? 'ring-2 ring-sf-light-blue' : ''} ${day.visits.length > 0 ? 'print:border-2 print:border-gray-400' : ''
                                    }`}
                            >
                                <div
                                    className={`text-sm font-semibold mb-1 ${!day.isCurrentMonth
                                        ? 'text-gray-400'
                                        : dayOfWeek === 0
                                            ? 'text-red-600'
                                            : dayOfWeek === 6
                                                ? 'text-blue-600'
                                                : 'text-gray-700'
                                        } ${isToday ? 'text-white bg-sf-light-blue rounded px-1' : ''}`}
                                >
                                    {day.date.getDate()}
                                </div>
                                <div className="space-y-1">
                                    {day.visits.map((visit, vIndex) => (
                                        <div
                                            key={vIndex}
                                            className="text-xs bg-blue-50 text-blue-800 px-2 py-1 rounded truncate print:bg-gray-100 print:text-gray-800"
                                            title={visit.customerName}
                                        >
                                            {visit.hasDesign && <span className="text-purple-600 mr-1">★</span>}
                                            {visit.customerName}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Print Legend */}
                <div className="hidden print:block mt-4 pt-4 border-t border-gray-200">
                    <p className="text-xs text-gray-600">★ = デザイン提案あり</p>
                </div>
            </div>

            {/* Visit Details Modal */}
            {selectedDay && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
                    onClick={() => setSelectedDay(null)}
                >
                    <div
                        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-bold text-gray-900">
                                    {selectedDay.dateString} の訪問先
                                </h3>
                                <button
                                    onClick={() => setSelectedDay(null)}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    ✕
                                </button>
                            </div>
                            <div className="space-y-3">
                                {selectedDay.visits.map((visit, index) => (
                                    <div
                                        key={index}
                                        className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <h4 className="font-semibold text-gray-900 mb-1">
                                                    {visit.customerName}
                                                </h4>
                                                <p className="text-sm text-gray-600">{visit.action}</p>
                                                {visit.hasDesign && (
                                                    <span className="inline-block mt-2 text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                                                        デザイン提案あり
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-xs text-gray-500">
                                                No. {visit.managementNumber}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
