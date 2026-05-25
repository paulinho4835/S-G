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
