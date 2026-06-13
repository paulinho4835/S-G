// Pure utility functions for sales analytics — all testable without DOM/API

export function toDateStr(d) {
    return d.toLocaleDateString('en-CA');
}

export function getPresetRange(preset) {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const today = new Date();
    const todayStr = today.toLocaleDateString('en-CA', { timeZone: tz });

    if (preset === 'today') return { startDate: todayStr, endDate: todayStr };
    if (preset === 'week') {
        const d = new Date(today); d.setDate(d.getDate() - 6);
        return { startDate: toDateStr(d), endDate: todayStr };
    }
    if (preset === 'month') {
        const d = new Date(today); d.setDate(d.getDate() - 29);
        return { startDate: toDateStr(d), endDate: todayStr };
    }
    if (preset === 'quarter') {
        const d = new Date(today); d.setDate(d.getDate() - 89);
        return { startDate: toDateStr(d), endDate: todayStr };
    }
    if (preset === 'year') {
        const d = new Date(today); d.setFullYear(d.getFullYear() - 1);
        return { startDate: toDateStr(d), endDate: todayStr };
    }
    return { startDate: todayStr, endDate: todayStr };
}

export function groupByDay(sales) {
    const map = {};
    sales.forEach(s => {
        const day = (s.sale_date || '').slice(0, 10);
        if (!map[day]) map[day] = { day, total: 0, units: 0, transactions: 0 };
        map[day].total += parseFloat(s.total_price || 0);
        map[day].units += parseInt(s.quantity || 0);
        map[day].transactions++;
    });
    return Object.values(map).sort((a, b) => a.day.localeCompare(b.day));
}

export function groupByWeek(sales) {
    const map = {};
    sales.forEach(s => {
        const d = new Date(s.sale_date);
        const dow = d.getDay();
        const monday = new Date(d);
        monday.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
        const key = toDateStr(monday);
        if (!map[key]) map[key] = { day: key, total: 0, units: 0, transactions: 0 };
        map[key].total += parseFloat(s.total_price || 0);
        map[key].units += parseInt(s.quantity || 0);
        map[key].transactions++;
    });
    return Object.values(map).sort((a, b) => a.day.localeCompare(b.day));
}

export function groupByCode(sales, limit = 12) {
    const map = {};
    sales.forEach(s => {
        const code = s.codigo_producto || s.part_name || `#${s.part_id}`;
        if (!map[code]) map[code] = { name: code, quantity: 0, revenue: 0 };
        map[code].quantity += parseInt(s.quantity || 0);
        map[code].revenue += parseFloat(s.total_price || 0);
    });
    return Object.values(map).sort((a, b) => b.quantity - a.quantity).slice(0, limit);
}

export function calcTrend(trendData) {
    if (trendData.length < 2) return null;
    const mid = Math.floor(trendData.length / 2);
    const first = trendData.slice(0, mid).reduce((s, d) => s + d.total, 0);
    const second = trendData.slice(mid).reduce((s, d) => s + d.total, 0);
    if (first === 0) return null;
    return ((second - first) / first) * 100;
}

export function formatCurrency(val) {
    if (!val || isNaN(val)) return '0 Bs.';
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M Bs.`;
    if (val >= 1_000)     return `${(val / 1_000).toFixed(2)}K Bs.`;
    return `${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs.`;
}

export function groupByMonth(sales) {
    const map = {};
    for (const s of sales) {
        const key = (s.sale_date || '').slice(0, 7); // "2024-01"
        if (!key) continue;
        if (!map[key]) map[key] = { day: key, total: 0, units: 0, transactions: 0 };
        map[key].total += parseFloat(s.total_price || 0);
        map[key].units += parseInt(s.quantity || 0);
        map[key].transactions++;
    }
    return Object.values(map).sort((a, b) => a.day.localeCompare(b.day));
}

export function groupByYear(sales) {
    const map = {};
    for (const s of sales) {
        const key = (s.sale_date || '').slice(0, 4); // "2024"
        if (!key) continue;
        if (!map[key]) map[key] = { day: key, total: 0, units: 0, transactions: 0 };
        map[key].total += parseFloat(s.total_price || 0);
        map[key].units += parseInt(s.quantity || 0);
        map[key].transactions++;
    }
    return Object.values(map).sort((a, b) => a.day.localeCompare(b.day));
}

export function groupByHour(sales) {
    const map = {};
    for (const s of sales) {
        if (!s.sale_date) continue;
        const h = new Date(s.sale_date).getHours();
        const key = `${String(h).padStart(2, '0')}:00`;
        if (!map[key]) map[key] = { hour: key, total: 0, units: 0, transactions: 0 };
        map[key].total += parseFloat(s.total_price || 0);
        map[key].units += parseInt(s.quantity || 0);
        map[key].transactions += 1;
    }
    return Object.values(map).sort((a, b) => a.hour.localeCompare(b.hour));
}

export function calcMargin(sales) {
    let revenue = 0;
    let cost = 0;
    for (const s of sales) {
        revenue += parseFloat(s.total_price || 0);
        cost += parseFloat(s.cost_price || 0) * parseInt(s.quantity || 0);
    }
    if (revenue === 0) return null;
    return {
        revenue,
        cost,
        margin: revenue - cost,
        marginPct: ((revenue - cost) / revenue) * 100,
    };
}
