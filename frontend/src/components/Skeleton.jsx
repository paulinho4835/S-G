import React from 'react';

/**
 * Placeholders animados (shimmer) para estados de carga.
 * Dan sensación de rapidez en lugar de un texto "Cargando...".
 */

export function SkeletonBar({ height = 14, width = '100%', radius = 4, style }) {
    return <div className="skeleton" style={{ height, width, borderRadius: radius, ...style }} />;
}

/** Filas tipo tabla: `rows` filas de `cols` columnas. */
export function SkeletonTable({ rows = 8, cols = 6 }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0.75rem 0.25rem' }}>
            {Array.from({ length: rows }).map((_, r) => (
                <div key={r} style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                    {Array.from({ length: cols }).map((_, c) => (
                        <SkeletonBar key={c} height={14} style={{ flex: c === cols - 1 ? 2.2 : 1 }} />
                    ))}
                </div>
            ))}
        </div>
    );
}

/** Placeholder con forma de gráfico (barras de alturas variadas). */
export function SkeletonChart({ height = 230, bars = 12 }) {
    const heights = [45, 70, 55, 85, 60, 95, 50, 75, 65, 90, 58, 80];
    return (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height, padding: '1rem 0.5rem 0' }}>
            {Array.from({ length: bars }).map((_, i) => (
                <SkeletonBar key={i} height={`${heights[i % heights.length]}%`} radius={3} style={{ flex: 1 }} />
            ))}
        </div>
    );
}

/** Tarjetas KPI tipo dashboard. */
export function SkeletonCards({ count = 4 }) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <SkeletonBar height={12} width="55%" />
                    <SkeletonBar height={26} width="80%" />
                    <SkeletonBar height={10} width="40%" />
                </div>
            ))}
        </div>
    );
}
