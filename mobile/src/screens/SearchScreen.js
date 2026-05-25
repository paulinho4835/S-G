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
