import { saveAs } from 'file-saver';

/**
 * Export data to CSV format with Japanese character support
 */

export interface ExportColumn {
    key: string;
    label: string;
}

/**
 * Convert data array to CSV string
 */
export function convertToCSV(data: any[], columns: ExportColumn[]): string {
    if (data.length === 0) {
        return '';
    }

    // Create header row
    const headers = columns.map(col => col.label);
    const headerRow = headers.map(escapeCSVValue).join(',');

    // Create data rows
    const dataRows = data.map(item => {
        return columns.map(col => {
            const value = item[col.key];
            return escapeCSVValue(value);
        }).join(',');
    });

    return [headerRow, ...dataRows].join('\r\n');
}

/**
 * Escape CSV value (handle commas, quotes, newlines)
 */
function escapeCSVValue(value: any): string {
    if (value === null || value === undefined) {
        return '';
    }

    const stringValue = String(value);

    // If value contains comma, quote, or newline, wrap in quotes
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
        // Escape quotes by doubling them
        return `"${stringValue.replace(/"/g, '""')}"`;
    }

    return stringValue;
}

/**
 * Download CSV file with BOM for Excel compatibility
 * Uses file-saver library for robust download handling
 */
export function downloadCSV(csvContent: string, filename: string): void {
    // Add BOM for UTF-8 (Excel compatibility)
    const BOM = '\uFEFF';
    const csvWithBOM = BOM + csvContent;

    // Create blob
    const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' });

    // Use file-saver to save the file
    saveAs(blob, filename);
}

/**
 * Generate filename with timestamp in Japanese format
 * Format: prefix_YYYYMMDD_HHMMSS.csv
 */
export function generateFilename(prefix: string): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    const timestamp = `${year}${month}${day}_${hours}${minutes}${seconds}`;

    return `${prefix}_${timestamp}.csv`;
}

/**
 * Export data to CSV and trigger download
 */
export function exportToCSV(data: any[], columns: ExportColumn[], filenamePrefix: string): void {
    const csvContent = convertToCSV(data, columns);
    const filename = generateFilename(filenamePrefix);
    downloadCSV(csvContent, filename);
}
