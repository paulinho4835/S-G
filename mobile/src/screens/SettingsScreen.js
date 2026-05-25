import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, StatusBar,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
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

      let data;
      try {
        const file = new File(fileUri);
        data = await file.json();
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
