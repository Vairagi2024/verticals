import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { Link } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function Index() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineLarge" style={styles.title}>
          Vertical Studies
        </Text>
        <Text variant="titleMedium" style={styles.subtitle}>
          Sector 44 D, Chandigarh
        </Text>
        <Text variant="bodyLarge" style={styles.subtitle2}>
          Select Your Role to Continue
        </Text>
      </View>

      <View style={styles.rolesContainer}>
        <Link href="/login/admin" asChild>
          <TouchableOpacity style={[styles.roleCard, { backgroundColor: '#6C3AE0' }]}>
            <MaterialCommunityIcons name="shield-account" size={60} color="#fff" />
            <Text variant="headlineSmall" style={styles.roleText}>
              Admin
            </Text>
            <Text variant="bodyMedium" style={styles.roleDesc}>
              Institute Administrator
            </Text>
          </TouchableOpacity>
        </Link>

        <Link href="/login/teacher" asChild>
          <TouchableOpacity style={[styles.roleCard, { backgroundColor: '#4A90E2' }]}>
            <MaterialCommunityIcons name="account-tie" size={60} color="#fff" />
            <Text variant="headlineSmall" style={styles.roleText}>
              Teacher
            </Text>
            <Text variant="bodyMedium" style={styles.roleDesc}>
              Upload Content & Create Tests
            </Text>
          </TouchableOpacity>
        </Link>

        <Link href="/login/student" asChild>
          <TouchableOpacity style={[styles.roleCard, { backgroundColor: '#4ECDC4' }]}>
            <MaterialCommunityIcons name="school" size={60} color="#fff" />
            <Text variant="headlineSmall" style={styles.roleText}>
              Student
            </Text>
            <Text variant="bodyMedium" style={styles.roleDesc}>
              Access Lectures & Tests
            </Text>
          </TouchableOpacity>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FB',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 40,
  },
  title: {
    fontWeight: 'bold',
    color: '#6C3AE0',
    marginBottom: 8,
  },
  subtitle: {
    color: '#666',
    marginBottom: 4,
  },
  subtitle2: {
    color: '#333',
    marginTop: 20,
    fontWeight: '600',
  },
  rolesContainer: {
    gap: 20,
  },
  roleCard: {
    padding: 30,
    borderRadius: 16,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  roleText: {
    color: '#fff',
    fontWeight: 'bold',
    marginTop: 12,
  },
  roleDesc: {
    color: '#fff',
    marginTop: 8,
    opacity: 0.9,
  },
});