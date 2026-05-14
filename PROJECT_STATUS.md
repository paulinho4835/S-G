# 🚀 Felipillo - Estado del Proyecto

> **INSTRUCCIÓN CRÍTICA:** Al iniciar una nueva sesión, leer este archivo primero para obtener el contexto completo y evitar redundancias o errores de arquitectura.

## 📌 Resumen Actual
El proyecto es un sistema de gestión de inventarios para "La casa de los retenes S&G", construido con **Electron + React + Node.js/Express + SQLite**. Se ha estabilizado la interfaz tras una migración fallida a Tailwind/shadcn, optando por un diseño de alto nivel usando **CSS puro** para garantizar compatibilidad total con Electron.

## 🛠️ Arquitectura Técnica
- **Frontend**: React 18 (Vite). Estilos en CSS puro (variables en `index.css`).
- **Backend**: Express en puerto `3005`. Base de datos SQLite (`parts.db`) persistente en `AppData`.
- **Dashboard**: Implementado con `Recharts`. No usa librerías de UI externas (shadcn/Tailwind eliminados por inestabilidad).

## ✅ Funcionalidades Implementadas
1. **Registro y Carga Masiva**: Formulario manual y subida de Excel.
2. **Gestión de Productos**: Lista con búsqueda y filtros por medidas (MI, ME, ALT).
3. **Ventas**: Historial y registro de salidas de stock.
4. **Dashboard Avanzado**:
   - Gráfica de stock por Familia.
   - Gráfica de "Top Productos Vendidos" (Unidades e Ingresos).
   - Cálculo de **Valor Total del Inventario** (Sanitizado contra valores nulos/NaN).
   - Filtro dinámico de **Umbral de Stock Crítico** (configurable por el usuario).
   - Exportación de pedidos críticos en formato `.txt`.

## 📍 Última Tarea (Donde nos quedamos)
- **Fecha**: 14 de Mayo, 2026.
- **Estado**: Sistema 100% estable. El Dashboard ya calcula correctamente el Valor del Inventario y las gráficas de ventas funcionan con datos reales de la API.
- **Pendiente**: Explorar mejoras sugeridas como "Filtros interactivos en gráficas" o "Buscador en tabla de stock crítico".

---
*Este archivo debe actualizarse al final de cada hito importante.*
