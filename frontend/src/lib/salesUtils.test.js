import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    groupByDay,
    groupByWeek,
    groupByCode,
    calcTrend,
    getPresetRange,
    formatCurrency,
} from './salesUtils';

// ── groupByDay ────────────────────────────────────────────────────────────────

describe('groupByDay', () => {
    it('groups multiple sales on the same day into one entry', () => {
        const sales = [
            { sale_date: '2024-01-15T10:00:00', total_price: 100, quantity: 2 },
            { sale_date: '2024-01-15T14:00:00', total_price: 50,  quantity: 1 },
        ];
        const result = groupByDay(sales);
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ day: '2024-01-15', total: 150, units: 3, transactions: 2 });
    });

    it('creates separate entries for different days', () => {
        const sales = [
            { sale_date: '2024-01-15T10:00:00', total_price: 100, quantity: 2 },
            { sale_date: '2024-01-16T09:00:00', total_price: 200, quantity: 3 },
        ];
        const result = groupByDay(sales);
        expect(result).toHaveLength(2);
    });

    it('sorts entries by date ascending', () => {
        const sales = [
            { sale_date: '2024-01-20T10:00:00', total_price: 50, quantity: 1 },
            { sale_date: '2024-01-10T10:00:00', total_price: 100, quantity: 2 },
        ];
        const result = groupByDay(sales);
        expect(result[0].day).toBe('2024-01-10');
        expect(result[1].day).toBe('2024-01-20');
    });

    it('returns empty array for empty input', () => {
        expect(groupByDay([])).toEqual([]);
    });

    it('handles missing total_price and quantity gracefully', () => {
        const sales = [{ sale_date: '2024-01-15T10:00:00' }];
        const result = groupByDay(sales);
        expect(result[0]).toMatchObject({ total: 0, units: 0, transactions: 1 });
    });

    it('handles sale_date missing by bucketing under empty key', () => {
        const sales = [{ total_price: 50, quantity: 1 }];
        const result = groupByDay(sales);
        expect(result).toHaveLength(1);
        expect(result[0].transactions).toBe(1);
    });
});

// ── groupByWeek ───────────────────────────────────────────────────────────────

describe('groupByWeek', () => {
    it('groups sales within the same week into one entry', () => {
        // Use T12:00:00 to force local-time parsing and avoid UTC-midnight timezone drift
        // 2024-01-15 is a Monday, 2024-01-19 is a Friday — same week
        const sales = [
            { sale_date: '2024-01-15T12:00:00', total_price: 100, quantity: 2 },
            { sale_date: '2024-01-19T12:00:00', total_price: 50,  quantity: 1 },
        ];
        const result = groupByWeek(sales);
        expect(result).toHaveLength(1);
        expect(result[0].total).toBe(150);
        expect(result[0].units).toBe(3);
        expect(result[0].transactions).toBe(2);
    });

    it('separates sales in different weeks', () => {
        // 2024-01-15 (Mon week 1) vs 2024-01-22 (Mon week 2)
        const sales = [
            { sale_date: '2024-01-15T12:00:00', total_price: 100, quantity: 1 },
            { sale_date: '2024-01-22T12:00:00', total_price: 200, quantity: 2 },
        ];
        const result = groupByWeek(sales);
        expect(result).toHaveLength(2);
    });

    it('returns empty array for empty input', () => {
        expect(groupByWeek([])).toEqual([]);
    });

    it('week key is the Monday date string', () => {
        // 2024-01-17 is a Wednesday; Monday of that week is 2024-01-15
        const sales = [{ sale_date: '2024-01-17T12:00:00', total_price: 100, quantity: 1 }];
        const result = groupByWeek(sales);
        expect(result[0].day).toBe('2024-01-15');
    });

    it('handles Sunday correctly (Sunday belongs to previous week Monday)', () => {
        // 2024-01-14 is a Sunday; Monday of that week is 2024-01-08
        const sales = [{ sale_date: '2024-01-14T12:00:00', total_price: 100, quantity: 1 }];
        const result = groupByWeek(sales);
        expect(result[0].day).toBe('2024-01-08');
    });
});

// ── groupByCode ───────────────────────────────────────────────────────────────

describe('groupByCode', () => {
    it('groups sales by codigo_producto', () => {
        const sales = [
            { codigo_producto: 'ABC-001', quantity: 3, total_price: 150 },
            { codigo_producto: 'ABC-001', quantity: 2, total_price: 100 },
            { codigo_producto: 'XYZ-002', quantity: 1, total_price: 50  },
        ];
        const result = groupByCode(sales);
        const abc = result.find(r => r.name === 'ABC-001');
        expect(abc).toMatchObject({ quantity: 5, revenue: 250 });
    });

    it('sorts by quantity descending', () => {
        const sales = [
            { codigo_producto: 'LOW', quantity: 1, total_price: 10 },
            { codigo_producto: 'HIGH', quantity: 10, total_price: 100 },
            { codigo_producto: 'MID', quantity: 5, total_price: 50 },
        ];
        const result = groupByCode(sales);
        expect(result[0].name).toBe('HIGH');
        expect(result[1].name).toBe('MID');
        expect(result[2].name).toBe('LOW');
    });

    it('limits to the specified count (default 12)', () => {
        const sales = Array.from({ length: 20 }, (_, i) => ({
            codigo_producto: `PROD-${i}`,
            quantity: 20 - i,
            total_price: (20 - i) * 10,
        }));
        const result = groupByCode(sales);
        expect(result).toHaveLength(12);
    });

    it('respects custom limit', () => {
        const sales = Array.from({ length: 10 }, (_, i) => ({
            codigo_producto: `P-${i}`,
            quantity: 10 - i,
            total_price: 100,
        }));
        expect(groupByCode(sales, 5)).toHaveLength(5);
    });

    it('falls back to part_name when codigo_producto is missing', () => {
        const sales = [{ part_name: 'Reten Grande', quantity: 2, total_price: 80 }];
        const result = groupByCode(sales);
        expect(result[0].name).toBe('Reten Grande');
    });

    it('falls back to #part_id when both names are missing', () => {
        const sales = [{ part_id: 42, quantity: 1, total_price: 30 }];
        const result = groupByCode(sales);
        expect(result[0].name).toBe('#42');
    });

    it('returns empty array for empty input', () => {
        expect(groupByCode([])).toEqual([]);
    });
});

// ── calcTrend ─────────────────────────────────────────────────────────────────

describe('calcTrend', () => {
    it('returns positive percentage when second half is higher than first', () => {
        const data = [
            { day: '2024-01-01', total: 100 },
            { day: '2024-01-02', total: 100 },
            { day: '2024-01-03', total: 200 },
            { day: '2024-01-04', total: 200 },
        ];
        // first=[100,100]=200, second=[200,200]=400 → (400-200)/200*100 = 100%
        expect(calcTrend(data)).toBe(100);
    });

    it('returns negative percentage when second half is lower than first', () => {
        const data = [
            { day: '2024-01-01', total: 200 },
            { day: '2024-01-02', total: 200 },
            { day: '2024-01-03', total: 100 },
            { day: '2024-01-04', total: 100 },
        ];
        // first=400, second=200 → (200-400)/400*100 = -50%
        expect(calcTrend(data)).toBe(-50);
    });

    it('returns 0 when both halves are equal', () => {
        const data = [
            { day: '2024-01-01', total: 100 },
            { day: '2024-01-02', total: 100 },
        ];
        expect(calcTrend(data)).toBe(0);
    });

    it('returns null for empty array', () => {
        expect(calcTrend([])).toBeNull();
    });

    it('returns null for single data point', () => {
        expect(calcTrend([{ day: '2024-01-01', total: 100 }])).toBeNull();
    });

    it('returns null when first half sums to zero (avoids division by zero)', () => {
        const data = [
            { day: '2024-01-01', total: 0 },
            { day: '2024-01-02', total: 100 },
        ];
        expect(calcTrend(data)).toBeNull();
    });

    it('handles odd-length arrays by using floor(n/2) split', () => {
        const data = [
            { day: '2024-01-01', total: 100 },
            { day: '2024-01-02', total: 100 },
            { day: '2024-01-03', total: 200 }, // second half: days 1..end = [100, 200]
        ];
        // mid=1, first=[100], second=[100,200]=300 → (300-100)/100*100 = 200%
        expect(calcTrend(data)).toBe(200);
    });
});

// ── getPresetRange ────────────────────────────────────────────────────────────

describe('getPresetRange', () => {
    beforeEach(() => {
        // Fix "today" to a known date so range assertions are deterministic
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2024-03-15T12:00:00Z'));
    });

    it('today preset returns same start and end date', () => {
        const { startDate, endDate } = getPresetRange('today');
        expect(startDate).toBe(endDate);
    });

    it('week preset spans 7 days (startDate is 6 days before today)', () => {
        const { startDate, endDate } = getPresetRange('week');
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diff = Math.round((end - start) / 86400000);
        expect(diff).toBe(6);
    });

    it('month preset spans 30 days', () => {
        const { startDate, endDate } = getPresetRange('month');
        const diff = Math.round((new Date(endDate) - new Date(startDate)) / 86400000);
        expect(diff).toBe(29);
    });

    it('quarter preset spans 90 days', () => {
        const { startDate, endDate } = getPresetRange('quarter');
        const diff = Math.round((new Date(endDate) - new Date(startDate)) / 86400000);
        expect(diff).toBe(89);
    });

    it('year preset spans approximately 1 year', () => {
        const { startDate, endDate } = getPresetRange('year');
        const startYear = new Date(startDate).getFullYear();
        const endYear = new Date(endDate).getFullYear();
        expect(endYear - startYear).toBe(1);
    });

    it('unknown preset falls back to today', () => {
        const { startDate, endDate } = getPresetRange('unknown_preset');
        expect(startDate).toBe(endDate);
    });
});

// ── formatCurrency ────────────────────────────────────────────────────────────

describe('formatCurrency', () => {
    it('returns "0 Bs." for zero', () => {
        expect(formatCurrency(0)).toBe('0 Bs.');
    });

    it('returns "0 Bs." for null/undefined/NaN', () => {
        expect(formatCurrency(null)).toBe('0 Bs.');
        expect(formatCurrency(undefined)).toBe('0 Bs.');
        expect(formatCurrency(NaN)).toBe('0 Bs.');
    });

    it('formats values under 1000 with 2 decimal places', () => {
        expect(formatCurrency(500)).toBe('500.00 Bs.');
        expect(formatCurrency(99.5)).toBe('99.50 Bs.');
    });

    it('formats values >= 1000 with K suffix', () => {
        expect(formatCurrency(1500)).toBe('1.50K Bs.');
        expect(formatCurrency(10000)).toBe('10.00K Bs.');
    });

    it('formats values >= 1,000,000 with M suffix', () => {
        expect(formatCurrency(2500000)).toBe('2.50M Bs.');
    });
});
