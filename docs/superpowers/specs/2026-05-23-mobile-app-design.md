# App Mobile Android — Consulta de Catálogo

**Fecha:** 2026-05-23
**Scope:** Solo lectura — el vendedor busca repuestos, ve precio y stock

---

## Contexto

El sistema de escritorio existente (Electron + React + Node.js + SQLite) NO se modifica. La app mobile es un proyecto completamente separado que funciona de forma independiente.

---

## Arquitectura

```
[PC — sistema existente]          [Celular Android]
  parts_backup.db (SQLite)          Expo app
       ↓                               ↓
  exportar-catalogo.js  → catalogo.json → SQLite local
  (script separado)       (via WhatsApp /
                           Drive / USB / etc.)
```

**Componentes:**

1. **`exportar-catalogo.js`** — script Node.js en la raíz del proyecto existente. Lee la SQLite y genera `catalogo.json`. El usuario lo ejecuta con `node exportar-catalogo.js` cuando quiere actualizar el catálogo.

2. **`mobile/`** — carpeta nueva con la app Expo (React Native). Proyecto independiente, sin relación de dependencias con el sistema existente.

---

## App Mobile

### Stack
- Expo (React Native) — produce APK instalable directamente en Android
- `expo-sqlite` — base de datos local en el dispositivo
- `expo-document-picker` — para que el usuario seleccione el archivo `catalogo.json`
- `expo-file-system` — leer y procesar el archivo importado

### Pantallas

**1. Búsqueda (pantalla principal)**
- Barra de búsqueda en tiempo real
- Busca por nombre, código o dimensiones
- Lista de resultados con nombre, código y precio visible
- Toca un resultado para ver el detalle

**2. Detalle del repuesto**
- Nombre completo
- Código
- Precio de venta
- Stock disponible
- Dimensiones
- Botón volver

**3. Ajustes**
- Botón "Importar catálogo" — abre el file picker para seleccionar `catalogo.json`
- Fecha y hora de la última importación
- Cantidad de productos en la base local

### Base de datos local (SQLite en el celular)

```sql
CREATE TABLE products (
  id INTEGER PRIMARY KEY,
  codigo TEXT,
  nombre TEXT,
  descripcion TEXT,
  precio_venta REAL,
  stock INTEGER,
  dimensiones TEXT
);

CREATE TABLE meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
-- meta almacena: last_sync_date, product_count
```

La importación hace `DELETE FROM products` + `INSERT` masivo desde el JSON. Operación atómica dentro de una transacción.

---

## Script de exportación (`exportar-catalogo.js`)

Lee la base de datos SQLite del sistema existente. El script detecta automáticamente el archivo DB (busca primero `parts_backup.db` en la raíz, luego en `backend/`). Genera `catalogo.json` en la misma carpeta del script.

**Campos exportados:** `id`, `codigo`, `nombre`, `descripcion`, `precio_venta`, `stock`, `dimensiones`

**Campos NO exportados:** costo de compra u otros campos internos sensibles.

---

## Flujo de uso

1. En la PC: `node exportar-catalogo.js` → genera `catalogo.json`
2. El usuario envía `catalogo.json` al celular (WhatsApp, Drive, cable USB, etc.)
3. En el celular: Ajustes → "Importar catálogo" → selecciona el archivo
4. La app carga los datos y queda lista para consultas offline

---

## Distribución

- Se compila con `eas build --platform android --profile preview` (Expo Application Services)
- Requiere cuenta gratuita en expo.dev (registro sin costo)
- Produce un `.apk` que se instala directamente en Android (sin Play Store)
- No requiere cuenta de developer de Google

---

## Lo que queda fuera del scope

- Creación de cotizaciones (solo consulta)
- Ventas o modificación de stock
- Sincronización automática por red
- Soporte iOS
- Autenticación/login
