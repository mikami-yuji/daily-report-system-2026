'use client';

import React from 'react';
import { PersonalScoreData } from '@/types/analytics';
import { Award, TrendingUp, CheckCircle, Target, ArrowRight, Zap, Calendar } from 'lucide-react';

interface MonthlyScorePacerProps {
    scoreData: PersonalScoreData;
    staffName?: string | null;
}

export default function MonthlyScorePacer({ scoreData, staffName }: MonthlyScorePacerProps): React.JSX.Element {
    const isCompleted = scoreData.points >= scoreData.targetPoints;
    const progressPercent = Math.min(100, scoreData.achievementRate);

    // ペース判定の色とテキスト
    const isAhead = scoreData.daysInfo.paceDiff >= 0;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 md:p-6 mb-8 transition-all hover:shadow-md">
            {/* ヘッダー情報 */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${isCompleted ? 'bg-amber-100 text-amber-700' : 'bg-blue-50 text-blue-600'}`}>
                        {isCompleted ? <Award size={24} className="text-amber-600" /> : <Target size={24} />}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 flex items-center gap-1">
                                <Calendar size={12} />
                                {scoreData.monthLabel}
                            </span>
                            {staffName && (
                                <span className="text-xs text-gray-500 font-medium">
                                    担当: {staffName}
                                </span>
                            )}
                        </div>
                        <h2 className="text-lg font-bold text-gray-900 mt-0.5">
                            月次活動ペースメーカー（200点目標）
                        </h2>
                    </div>
                </div>

                {/* 達成ステータス */}
                <div className="flex items-center gap-3 self-end sm:self-auto">
                    <div className="text-right">
                        <div className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">
                            {scoreData.points.toFixed(1)}
                            <span className="text-xs md:text-sm font-normal text-gray-500 ml-1">
                                / {scoreData.targetPoints} pt
                            </span>
                        </div>
                    </div>
                    <div className={`px-3 py-1.5 rounded-xl text-sm font-bold flex items-center gap-1.5 shadow-sm ${
                        isCompleted
                            ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white'
                            : scoreData.achievementRate >= 80
                            ? 'bg-emerald-500 text-white'
                            : 'bg-blue-600 text-white'
                    }`}>
                        {isCompleted && <CheckCircle size={16} />}
                        {scoreData.achievementRate.toFixed(1)}%
                    </div>
                </div>
            </div>

            {/* プログレスバー */}
            <div className="mt-4">
                <div className="w-full bg-gray-100 rounded-full h-3.5 overflow-hidden p-0.5 border border-gray-200">
                    <div
                        className={`h-full rounded-full transition-all duration-700 ${
                            isCompleted
                                ? 'bg-gradient-to-r from-amber-400 to-amber-500 shadow-sm'
                                : scoreData.achievementRate >= 80
                                ? 'bg-gradient-to-r from-emerald-400 to-emerald-600'
                                : 'bg-gradient-to-r from-blue-500 to-indigo-600'
                        }`}
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
            </div>

            {/* 点数内訳グリッド */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
                {/* 重点訪問 */}
                <div className="bg-blue-50/60 border border-blue-100 rounded-lg p-3 hover:bg-blue-50 transition-colors">
                    <div className="flex justify-between items-start">
                        <span className="text-xs font-semibold text-blue-900">重点訪問 (×10点)</span>
                        <span className="text-xs font-bold text-blue-700 bg-blue-100 px-1.5 py-0.2 rounded">
                            {scoreData.pointsBreakdown.priorityVisits} pt
                        </span>
                    </div>
                    <div className="mt-2 flex items-baseline gap-1">
                        <span className="text-xl font-bold text-gray-900">{scoreData.counts.priorityVisits}</span>
                        <span className="text-xs text-gray-500">件</span>
                    </div>
                </div>

                {/* 一般訪問 */}
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-3 hover:bg-indigo-50 transition-colors">
                    <div className="flex justify-between items-start">
                        <span className="text-xs font-semibold text-indigo-900">一般訪問 (×3点)</span>
                        <span className="text-xs font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.2 rounded">
                            {scoreData.pointsBreakdown.generalVisits} pt
                        </span>
                    </div>
                    <div className="mt-2 flex items-baseline gap-1">
                        <span className="text-xl font-bold text-gray-900">{scoreData.counts.generalVisits}</span>
                        <span className="text-xs text-gray-500">件</span>
                    </div>
                </div>

                {/* 重点電話 */}
                <div className="bg-amber-50/50 border border-amber-100 rounded-lg p-3 hover:bg-amber-50 transition-colors">
                    <div className="flex justify-between items-start">
                        <span className="text-xs font-semibold text-amber-900">重点電話 (×1点)</span>
                        <span className="text-xs font-bold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded">
                            {scoreData.pointsBreakdown.priorityCalls} pt
                        </span>
                    </div>
                    <div className="mt-2 flex items-baseline gap-1">
                        <span className="text-xl font-bold text-gray-900">{scoreData.counts.priorityCalls}</span>
                        <span className="text-xs text-gray-500">件</span>
                    </div>
                </div>

                {/* 一般電話 */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 hover:bg-gray-100/70 transition-colors">
                    <div className="flex justify-between items-start">
                        <span className="text-xs font-semibold text-gray-700">一般電話 (×0.5点)</span>
                        <span className="text-xs font-bold text-gray-600 bg-gray-200 px-1.5 py-0.2 rounded">
                            {scoreData.pointsBreakdown.generalCalls.toFixed(1)} pt
                        </span>
                    </div>
                    <div className="mt-2 flex items-baseline gap-1">
                        <span className="text-xl font-bold text-gray-900">{scoreData.counts.generalCalls}</span>
                        <span className="text-xs text-gray-500">件</span>
                    </div>
                </div>
            </div>

            {/* ペース判定と次の一手アドバイス */}
            <div className="mt-4 pt-3 border-t border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 text-sm">
                {/* ペース情報 */}
                <div className="flex items-center gap-2 text-gray-700">
                    <TrendingUp size={16} className={isAhead ? 'text-emerald-600' : 'text-amber-600'} />
                    <span>
                        進捗ペース:
                        <strong className={`ml-1 ${isAhead ? 'text-emerald-700' : 'text-amber-700'}`}>
                            {isAhead ? `+${scoreData.daysInfo.paceDiff.toFixed(1)} pt 先行` : `${scoreData.daysInfo.paceDiff.toFixed(1)} pt 遅れ`}
                        </strong>
                        <span className="text-gray-400 text-xs ml-1.5">
                            (月末着地予測: 約{scoreData.daysInfo.projectedPoints.toFixed(0)} pt)
                        </span>
                    </span>
                </div>

                {/* アクション提案 */}
                <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/80 w-full md:w-auto">
                    <Zap size={15} className="text-amber-500 shrink-0" />
                    {isCompleted ? (
                        <span className="text-emerald-700 font-semibold text-xs md:text-sm">
                            🎉 今月の目標200点を達成しました！さらなる高みを目指しましょう！
                        </span>
                    ) : (
                        <span className="text-gray-800 text-xs md:text-sm">
                            目標まであと <strong className="text-blue-600 font-bold">{scoreData.remainingToTarget.toFixed(1)} pt</strong>
                            <span className="text-gray-500 ml-1">
                                (重点訪問 <strong className="text-blue-700">{scoreData.neededVisits.priorityOnly}回</strong> または 一般訪問 <strong className="text-indigo-700">{scoreData.neededVisits.generalOnly}回</strong>)
                            </span>
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
