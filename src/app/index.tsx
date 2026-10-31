import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CreateReminderModal } from '@/components/reminders/create-reminder-modal';
import { ReminderCard } from '@/components/reminders/reminder-card';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useReminders } from '@/hooks/use-reminders';

export default function RemindersScreen() {
  const isDark = useColorScheme() === 'dark';
  const {
    reminders,
    isLoading,
    addReminder,
    toggleReminder,
    deleteReminder,
  } = useReminders();

  const [isModalVisible, setIsModalVisible] = useState(false);

  const activeCount = reminders.filter((r) => r.isActive).length;

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.safeArea, isDark ? styles.safeAreaDark : styles.safeAreaLight]}>
      <View style={styles.contentWrapper}>
        {/* Cabecera principal */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.headerSubtitle, isDark ? styles.subtitleDark : styles.subtitleLight]}>
              Organiza tu día
            </Text>
            <Text style={[styles.headerTitle, isDark ? styles.titleDark : styles.titleLight]}>
              Mis recordatorios
            </Text>
          </View>

          {/* Contador de recordatorios */}
          <View style={[styles.counterBadge, isDark ? styles.counterBadgeDark : styles.counterBadgeLight]}>
            <Text style={[styles.counterText, isDark ? styles.counterTextDark : styles.counterTextLight]}>
              {activeCount} {activeCount === 1 ? 'activo' : 'activos'}
            </Text>
          </View>
        </View>

        {/* Lista de recordatorios */}
        <FlatList
          data={reminders}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ReminderCard
              reminder={item}
              onToggle={toggleReminder}
              onDelete={deleteReminder}
            />
          )}
          contentContainerStyle={[
            styles.listContainer,
            { paddingBottom: BottomTabInset + 90 },
          ]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator
                  size="small"
                  color={isDark ? '#818CF8' : '#2563EB'}
                />
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>📝</Text>
                <Text style={[styles.emptyTitle, isDark ? styles.titleDark : styles.titleLight]}>
                  No tienes recordatorios
                </Text>
                <Text style={[styles.emptySubtitle, isDark ? styles.subtitleDark : styles.subtitleLight]}>
                  Pulsa el botón &quot;+ Nuevo recordatorio&quot; para crear el primero.
                </Text>
              </View>
            )
          }
        />

        {/* Botón Flotante para crear nuevo recordatorio */}
        <View style={[styles.fabContainer, { bottom: BottomTabInset + 18 }]}>
          <Pressable
            accessibilityLabel="Crear nuevo recordatorio"
            onPress={() => setIsModalVisible(true)}
            style={({ pressed }) => [styles.fabButton, pressed && styles.fabButtonPressed]}>
            <Text style={styles.fabIcon}>＋</Text>
            <Text style={styles.fabText}>Nuevo recordatorio</Text>
          </Pressable>
        </View>

        {/* Modal con el formulario de creación */}
        <CreateReminderModal
          visible={isModalVisible}
          onClose={() => setIsModalVisible(false)}
          onSave={addReminder}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  safeAreaLight: {
    backgroundColor: '#F7F8FA',
  },
  safeAreaDark: {
    backgroundColor: '#121417',
  },
  contentWrapper: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
    marginBottom: Spacing.two,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  titleLight: {
    color: '#0F172A',
  },
  titleDark: {
    color: '#F8FAFC',
  },
  subtitleLight: {
    color: '#64748B',
  },
  subtitleDark: {
    color: '#94A3B8',
  },
  counterBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 4,
  },
  counterBadgeLight: {
    backgroundColor: '#EEF2FF',
  },
  counterBadgeDark: {
    backgroundColor: '#1E293B',
  },
  counterText: {
    fontSize: 12,
    fontWeight: '700',
  },
  counterTextLight: {
    color: '#4F46E5',
  },
  counterTextDark: {
    color: '#818CF8',
  },
  listContainer: {
    paddingTop: Spacing.two,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  fabContainer: {
    position: 'absolute',
    right: Spacing.four,
    alignItems: 'center',
  },
  fabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 30,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
    gap: 8,
  },
  fabButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
  fabIcon: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 20,
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
