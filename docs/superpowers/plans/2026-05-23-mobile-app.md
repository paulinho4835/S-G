# App Mobile Android — Consulta de Catálogo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear una app Android independiente (Expo) que permita al vendedor buscar repuestos y ver precio/stock offline, más un script de exportación que genera el catálogo desde la DB existente.

**Architecture:** Script `exportar-catalogo.js` lee `backend/parts.db` y genera `catalogo.json`. La app Expo carga ese JSON en SQLite local. No hay conexión de red ni modificación al sistema existente.

**Tech Stack:** Node.js (export script), Expo SDK 51, React Native, expo-sqlite, expo-document-picker, expo-file-system, React Navigation

---

## Estructura de archivos

```
exportar-catalogo.js          ← nuevo (raíz del proyecto)
mobile/
  app.json
  package.json
  App.js
  src/
    db/
      database.js             ← init SQLite + importar JSON
    screens/
      SearchScreen.js         ← pantalla principal
      DetailScreen.js         ← detalle de repuesto
      SettingsScreen.js       ← importar catálogo
    navigation/
      AppNavigator.js         ← stack navigator
```

---

## Task 1: Script de exportación

**Files:**
- Create: `exportar-catalogo.js`

- [ ] **Step 1: Instalar sqlite3 en la raíz del proyecto**

Desde la carpeta raíz (`Felipillo/`):
```bash
npm install sqlite3
```

- [ ] **Step 2: Crear el script**

```js
// exportar-catalogo.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const candidates = [
  path.resolve(__dirname, 'backend', 'parts.db'),
  path.resolve(__dirname, 'parts_backup.db'),
];

const dbPath = candidates.find(p => fs.existsSync(p));
if (!dbPath) {
  console.error('ERROR: No se encontró ningún archivo de base de datos.');
  console.error('Buscado en:', candidates.join(', '));
  process.exit(1);
}

console.log('Usando base de datos:', dbPath);

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Error abriendo DB:', err.message);
    process.exit(1);
  }
});

const sql = `
  SELECT
    id,
    codigo,
    codigo_producto,
    marca,
    familia,
    aplicacion,
    internal_measure,
    external_measure,
    height,
    flange_measure,
    stock,
    pv_geli,
    mundial
  FROM parts
  ORDER BY codigo_producto
`;

db.all(sql, [], (err, rows) => {
  if (err) {
    console.error('Error consultando partes:', err.message);
    process.exit(1);
  }

  const output = {
    exported_at: new Date().toISOString(),
    count: rows.length,
    products: rows,
  };

  const outPath = path.resolve(__dirname, 'catalogo.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8');

  console.log(`✓ Exportados ${rows.length} productos → ${outPath}`);
  db.close();
});
```

- [ ] **Step 3: Probar el script**

```
node exportar-catalogo.js
```

Salida esperada:
```
Usando base de datos: C:\...\backend\parts.db
✓ Exportados XXXX productos → C:\...\catalogo.json
```

Verificar que `catalogo.json` existe en la raíz y tiene la estructura:
```json
{
  "exported_at": "2026-...",
  "count": 1234,
  "products": [{ "id": 1, "codigo": "...", ... }]
}
```

- [ ] **Step 4: Commit**

```bash
git add exportar-catalogo.js package.json package-lock.json
git commit -m "feat: add catalog export script for mobile app"
```

---

## Task 2: Setup del proyecto Expo

**Files:**
- Create: `mobile/package.json`
- Create: `mobile/app.json`
- Create: `mobile/App.js`

- [ ] **Step 1: Instalar Expo CLI si no está instalado**

```bash
npm install -g expo-cli eas-cli
```

- [ ] **Step 2: Crear el proyecto Expo**

Desde la carpeta `mobile/` (crearla manualmente si no existe):

```bash
mkdir mobile
cd mobile
npx create-expo-app@latest . --template blank
```

Cuando pregunte el nombre: `CatalogoRetenes`

- [ ] **Step 3: Instalar dependencias**

Desde `mobile/`:

```bash
npx expo install expo-sqlite expo-document-picker expo-file-system
npm install @react-navigation/native @react-navigation/stack
npx expo install react-native-screens react-native-safe-area-context
```

- [ ] **Step 4: Reemplazar `mobile/app.json`**

```json
{
  "expo": {
    "name": "Catálogo Retenes",
    "slug": "catalogo-retenes",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#1a1a2e"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#1a1a2e"
      },
      "package": "com.retenes.catalogo"
    },
    "plugins": [
      [
        "expo-document-picker",
        {
          "iCloudContainerEnvironment": "Production"
        }
      ]
    ]
  }
}
```

- [ ] **Step 5: Verificar que el proyecto arranca**

Desde `mobile/`:
```bash
npx expo start
```

Presionar `a` para abrir en Android (o escanear QR con Expo Go). Debe aparecer la pantalla en blanco de Expo.

- [ ] **Step 6: Commit**

```bash
git add mobile/
git commit -m "feat: scaffold Expo mobile project"
```

---

## Task 3: Capa de base de datos local

**Files:**
- Create: `mobile/src/db/database.js`

- [ ] **Step 1: Crear el módulo de base de datos**

```js
// mobile/src/db/database.js
import * as SQLite from 'expo-sqlite';

let db = null;

export async function getDb() {
  if (!db) {
    db = await SQLite.openDatabaseAsync('catalogo.db');
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY,
        codigo TEXT DEFAULT '',
        codigo_producto TEXT DEFAULT '',
        marca TEXT DEFAULT '',
        familia TEXT DEFAULT '',
        aplicacion TEXT DEFAULT '',
        internal_measure REAL DEFAULT 0,
        external_measure REAL DEFAULT 0,
        height REAL DEFAULT 0,
        flange_measure REAL DEFAULT 0,
        stock INTEGER DEFAULT 0,
        pv_geli TEXT DEFAULT '',
        mundial TEXT DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_search
        ON products(codigo_producto, codigo, marca, aplicacion);
    `);
  }
  return db;
}

export async function importCatalog(jsonData) {
  const db = await getDb();
  const { products, exported_at, count } = jsonData;

  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM products');
    for (const p of products) {
      await db.runAsync(
        `INSERT INTO products
          (id, codigo, codigo_producto, marca, familia, aplicacion,
           internal_measure, external_measure, height, flange_measure,
           stock, pv_geli, mundial)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          p.id,
          p.codigo || '',
          p.codigo_producto || '',
          p.marca || '',
          p.familia || '',
          p.aplicacion || '',
          p.internal_measure || 0,
          p.external_measure || 0,
          p.height || 0,
          p.flange_measure || 0,
          p.stock || 0,
          p.pv_geli || '',
          p.mundial || '',
        ]
      );
    }
    await db.runAsync(
      `INSERT OR REPLACE INTO meta (key, value) VALUES ('last_sync', ?)`,
      [exported_at]
    );
    await db.runAsync(
      `INSERT OR REPLACE INTO meta (key, value) VALUES ('product_count', ?)`,
      [String(count)]
    );
  });
}

export async function searchProducts(query) {
  const db = await getDb();
  if (!query || query.trim() === '') {
    return await db.getAllAsync(
      'SELECT * FROM products ORDER BY codigo_producto LIMIT 50'
    );
  }
  const term = `%${query.trim()}%`;
  return await db.getAllAsync(
    `SELECT * FROM products
     WHERE codigo_producto LIKE ?
        OR codigo LIKE ?
        OR aplicacion LIKE ?
        OR marca LIKE ?
     ORDER BY codigo_producto
     LIMIT 100`,
    [term, term, term, term]
  );
}

export async function getMeta(key) {
  const db = await getDb();
  const row = await db.getFirstAsync(
    'SELECT value FROM meta WHERE key = ?',
    [key]
  );
  return row ? row.value : null;
}
```

- [ ] **Step 2: Verificar que no hay errores de sintaxis**

```bash
cd mobile
npx expo start
```

No debe haber errores en consola al cargar el módulo.

- [ ] **Step 3: Commit**

```bash
git add mobile/src/db/database.js
git commit -m "feat: add local SQLite database layer with import and search"
```

---

## Task 4: Pantalla de búsqueda (SearchScreen)

**Files:**
- Create: `mobile/src/screens/SearchScreen.js`

- [ ] **Step 1: Crear la pantalla**

```js
// mobile/src/screens/SearchScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, StatusBar,
} from 'react-native';
import { searchProducts } from '../db/database';

export default function SearchScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const doSearch = useCallback(async (text) => {
    setLoading(true);
    try {
      const rows = await searchProducts(text);
      setResults(rows);
    } catch (e) {
      console.error('Search error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    doSearch('');
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => doSearch(query), 250);
    return () => clearTimeout(timer);
  }, [query]);

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.item}
      onPress={() => navigation.navigate('Detail', { product: item })}
    >
      <Text style={styles.itemCode}>{item.codigo || item.codigo_producto}</Text>
      <Text style={styles.itemName} numberOfLines={1}>{item.codigo_producto}</Text>
      <Text style={styles.itemPrice}>
        {item.pv_geli ? `$${item.pv_geli}` : 'Sin precio'}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />
      <View style={styles.searchBar}>
        <TextInput
          style={styles.input}
          placeholder="Buscar por código, nombre, aplicación..."
          placeholderTextColor="#888"
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#4f8ef7" size="large" />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {query ? 'Sin resultados' : 'Importá el catálogo desde Ajustes'}
            </Text>
          }
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  searchBar: {
    backgroundColor: '#1a1a2e',
    padding: 12,
    paddingTop: 16,
  },
  input: {
    backgroundColor: '#2a2a3e',
    color: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e30',
  },
  itemCode: {
    color: '#4f8ef7',
    fontWeight: 'bold',
    width: 90,
    fontSize: 13,
  },
  itemName: {
    color: '#ddd',
    flex: 1,
    fontSize: 14,
    marginHorizontal: 8,
  },
  itemPrice: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
    minWidth: 70,
    textAlign: 'right',
  },
  empty: {
    color: '#555',
    textAlign: 'center',
    marginTop: 60,
    fontSize: 15,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/screens/SearchScreen.js
git commit -m "feat: add SearchScreen with real-time product search"
```

---

## Task 5: Pantalla de detalle (DetailScreen)

**Files:**
- Create: `mobile/src/screens/DetailScreen.js`

- [ ] **Step 1: Crear la pantalla**

```js
// mobile/src/screens/DetailScreen.js
import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, StatusBar,
} from 'react-native';

function Row({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{String(value)}</Text>
    </View>
  );
}

export default function DetailScreen({ route }) {
  const { product: p } = route.params;

  const dimensions = [
    p.internal_measure && `MI: ${p.internal_measure}`,
    p.external_measure && `ME: ${p.external_measure}`,
    p.height && `AL: ${p.height}`,
    p.flange_measure && `Pestaña: ${p.flange_measure}`,
  ].filter(Boolean).join('  |  ');

  const stockColor = p.stock > 5 ? '#4CAF50' : p.stock > 0 ? '#FF9800' : '#F44336';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />

      <Text style={styles.productName}>{p.codigo_producto || p.codigo}</Text>
      {p.codigo ? <Text style={styles.codigo}>Cód: {p.codigo}</Text> : null}

      <View style={styles.card}>
        <View style={styles.priceStock}>
          <View style={styles.priceBox}>
            <Text style={styles.priceLabel}>Precio</Text>
            <Text style={styles.priceValue}>
              {p.pv_geli ? `$${p.pv_geli}` : '—'}
            </Text>
          </View>
          <View style={styles.stockBox}>
            <Text style={styles.stockLabel}>Stock</Text>
            <Text style={[styles.stockValue, { color: stockColor }]}>
              {p.stock ?? 0}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Dimensiones</Text>
        <Text style={styles.dimensions}>{dimensions || '—'}</Text>
      </View>

      <View style={styles.card}>
        <Row label="Marca" value={p.marca} />
        <Row label="Mundial" value={p.mundial} />
        <Row label="Familia" value={p.familia} />
        <Row label="Aplicación" value={p.aplicacion} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  content: { padding: 16, paddingBottom: 40 },
  productName: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  codigo: { color: '#4f8ef7', fontSize: 14, marginBottom: 16 },
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  priceStock: { flexDirection: 'row', justifyContent: 'space-around' },
  priceBox: { alignItems: 'center' },
  priceLabel: { color: '#888', fontSize: 13, marginBottom: 4 },
  priceValue: { color: '#4CAF50', fontSize: 28, fontWeight: 'bold' },
  stockBox: { alignItems: 'center' },
  stockLabel: { color: '#888', fontSize: 13, marginBottom: 4 },
  stockValue: { fontSize: 28, fontWeight: 'bold' },
  sectionTitle: { color: '#888', fontSize: 12, marginBottom: 8, textTransform: 'uppercase' },
  dimensions: { color: '#fff', fontSize: 16, letterSpacing: 0.5 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3e',
  },
  label: { color: '#888', fontSize: 14 },
  value: { color: '#fff', fontSize: 14, flex: 1, textAlign: 'right' },
});
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/screens/DetailScreen.js
git commit -m "feat: add DetailScreen with product info display"
```

---

## Task 6: Pantalla de ajustes e importación (SettingsScreen)

**Files:**
- Create: `mobile/src/screens/SettingsScreen.js`

- [ ] **Step 1: Crear la pantalla**

```js
// mobile/src/screens/SettingsScreen.js
import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, StatusBar,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { importCatalog, getMeta } from '../db/database';

export default function SettingsScreen() {
  const [importing, setImporting] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [productCount, setProductCount] = useState(null);

  useEffect(() => {
    loadMeta();
  }, []);

  async function loadMeta() {
    const sync = await getMeta('last_sync');
    const count = await getMeta('product_count');
    setLastSync(sync);
    setProductCount(count);
  }

  async function handleImport() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      setImporting(true);

      const fileUri = result.assets[0].uri;
      const content = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      let data;
      try {
        data = JSON.parse(content);
      } catch {
        Alert.alert('Error', 'El archivo no es un JSON válido.');
        return;
      }

      if (!data.products || !Array.isArray(data.products)) {
        Alert.alert('Error', 'El archivo no tiene el formato correcto. Generalo con exportar-catalogo.js');
        return;
      }

      await importCatalog(data);
      await loadMeta();

      Alert.alert('Listo', `Se importaron ${data.count} productos correctamente.`);
    } catch (e) {
      console.error('Import error:', e);
      Alert.alert('Error', 'No se pudo importar el catálogo: ' + e.message);
    } finally {
      setImporting(false);
    }
  }

  function formatDate(isoString) {
    if (!isoString) return 'Nunca';
    try {
      const d = new Date(isoString);
      return d.toLocaleString('es-AR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Catálogo</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Última importación</Text>
          <Text style={styles.value}>{formatDate(lastSync)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Productos</Text>
          <Text style={styles.value}>{productCount ?? '—'}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Importar catálogo</Text>
        <Text style={styles.instructions}>
          1. En la PC, ejecutá:{'\n'}
          {'   '}node exportar-catalogo.js{'\n\n'}
          2. Enviá el archivo <Text style={styles.mono}>catalogo.json</Text> al celular{'\n'}
          {'   '}(WhatsApp, Drive, USB, etc.){'\n\n'}
          3. Presioná el botón de abajo y seleccioná el archivo
        </Text>

        <TouchableOpacity
          style={[styles.button, importing && styles.buttonDisabled]}
          onPress={handleImport}
          disabled={importing}
        >
          {importing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Importar catálogo</Text>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.version}>Catálogo Retenes v1.0</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a', padding: 16 },
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#4f8ef7',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 12,
    letterSpacing: 1,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3e',
  },
  label: { color: '#888', fontSize: 14 },
  value: { color: '#fff', fontSize: 14 },
  instructions: {
    color: '#aaa',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 16,
  },
  mono: { fontFamily: 'monospace', color: '#4f8ef7' },
  button: {
    backgroundColor: '#4f8ef7',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: { backgroundColor: '#2a4a8a', opacity: 0.7 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  version: { color: '#333', textAlign: 'center', marginTop: 'auto', paddingTop: 20 },
});
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/screens/SettingsScreen.js
git commit -m "feat: add SettingsScreen with JSON catalog import"
```

---

## Task 7: Navegación y App.js

**Files:**
- Create: `mobile/src/navigation/AppNavigator.js`
- Modify: `mobile/App.js`

- [ ] **Step 1: Crear el navegador**

```js
// mobile/src/navigation/AppNavigator.js
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import SearchScreen from '../screens/SearchScreen';
import DetailScreen from '../screens/DetailScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function SearchStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#1a1a2e' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
        cardStyle: { backgroundColor: '#0f0f1a' },
      }}
    >
      <Stack.Screen
        name="Search"
        component={SearchScreen}
        options={{ title: 'Catálogo de Repuestos' }}
      />
      <Stack.Screen
        name="Detail"
        component={DetailScreen}
        options={({ route }) => ({
          title: route.params?.product?.codigo || 'Detalle',
        })}
      />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#1a1a2e', borderTopColor: '#2a2a3e' },
        tabBarActiveTintColor: '#4f8ef7',
        tabBarInactiveTintColor: '#555',
      }}
    >
      <Tab.Screen
        name="CatalogTab"
        component={SearchStack}
        options={{
          title: 'Catálogo',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>🔍</Text>,
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsScreen}
        options={{
          title: 'Ajustes',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>⚙️</Text>,
          headerShown: true,
          headerStyle: { backgroundColor: '#1a1a2e' },
          headerTintColor: '#fff',
          headerTitle: 'Ajustes',
        }}
      />
    </Tab.Navigator>
  );
}
```

- [ ] **Step 2: Instalar bottom tabs**

```bash
cd mobile
npm install @react-navigation/bottom-tabs
```

- [ ] **Step 3: Reemplazar `mobile/App.js`**

```js
// mobile/App.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <NavigationContainer>
      <AppNavigator />
    </NavigationContainer>
  );
}
```

- [ ] **Step 4: Probar la app completa**

```bash
cd mobile
npx expo start
```

Verificar:
- Tab "Catálogo" muestra barra de búsqueda y lista vacía con mensaje "Importá el catálogo desde Ajustes"
- Tab "Ajustes" muestra instrucciones y botón "Importar catálogo"
- El botón abre el file picker
- Importar `catalogo.json` generado en Task 1 y verificar que los productos aparecen en la búsqueda
- Tocar un producto abre el detalle con precio, stock y dimensiones

- [ ] **Step 5: Commit**

```bash
git add mobile/src/navigation/AppNavigator.js mobile/App.js mobile/package.json mobile/package-lock.json
git commit -m "feat: wire up navigation and complete mobile app"
```

---

## Task 8: Build del APK

- [ ] **Step 1: Crear cuenta en expo.dev (si no existe)**

Ir a https://expo.dev → Sign Up (gratuito)

- [ ] **Step 2: Login desde terminal**

```bash
cd mobile
eas login
```

Ingresar usuario y contraseña de expo.dev

- [ ] **Step 3: Inicializar EAS**

```bash
eas build:configure
```

Cuando pregunte por la plataforma: seleccionar `Android`

Esto genera `eas.json`. Editar para agregar el perfil preview:

```json
{
  "cli": { "version": ">= 7.0.0" },
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  }
}
```

- [ ] **Step 4: Compilar el APK**

```bash
eas build --platform android --profile preview
```

El build corre en la nube de Expo (gratis). Tarda ~10-15 minutos. Al terminar entrega un link para descargar el `.apk`.

- [ ] **Step 5: Instalar el APK en Android**

1. Descargar el `.apk` desde el link
2. Enviarlo al celular (WhatsApp, Drive, etc.)
3. En el celular: Ajustes → Seguridad → Permitir instalar apps de fuentes desconocidas
4. Abrir el `.apk` y seguir el asistente de instalación

- [ ] **Step 6: Commit final**

```bash
git add mobile/eas.json
git commit -m "feat: add EAS build config for Android APK"
```
