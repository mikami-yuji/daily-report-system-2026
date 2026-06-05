export type MonthlyActivityStats = {
  month: string;      // 表示用ラベル (例: "26年06月")
  visits: number;     // 訪問回数
  calls: number;      // 電話回数
  designs: number;    // デザイン提案件数
  complaints: number; // クレーム対応件数
  proposals: number;  // 提案物件数
  total: number;      // 総活動数
};
