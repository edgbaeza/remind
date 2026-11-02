import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProfileHeader } from '@/components/profile/profile-header';
import { ConfirmDeleteModal } from '@/components/reminders/confirm-delete-modal';
import { CreateReminderModal } from '@/components/reminders/create-reminder-modal';
import { ReminderCard } from '@/components/reminders/reminder-card';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useProfile } from '@/hooks/use-profile';
import { useReminders } from '@/hooks/use-reminders';
import { useTodayDate } from '@/hooks/use-today-date';
import { Reminder } from '@/types/reminder';
import { occursOnDate, sortTodayReminders, sortUpcomingReminders } from '@/utils/reminder-dates';

export default function RemindersScreen() {
  const router = useRouter();
  const { profile } = useProfile();
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const { todayDate } = useTodayDate();

  const {
    reminders,
    isLoading,
    addReminder,
    updateReminder,
    toggleReminder,
    deleteReminder,
  } = useReminders();

  const [activeFilter, setActiveFilter] = useState<'today' | 'upcoming'>('today');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [reminderToEdit, setReminderToEdit] = useState<Reminder | null>(null);
  const [reminderToDelete, setReminderToDelete] = useState<Reminder | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filtrado y ordenamiento de recordatorios según el filtro activo
  const todayReminders = useMemo(
    () => sortTodayReminders(reminders.filter((r) => occursOnDate(r, todayDate))),
    [reminders, todayDate]
  );

  const upcomingReminders = useMemo(
    () =>
      sortUpcomingReminders(
        reminders.filter((r) => !occursOnDate(r, todayDate)),
        todayDate
      ),
    [reminders, todayDate]
  );

  const displayedReminders = activeFilter === 'today' ? todayReminders : upcomingReminders;
  const activeCount = displayedReminders.filter((r) => r.isActive).length;
  const bottomInset = Math.max(insets.bottom, 16);

  const handleOpenCreate = () => {
    setReminderToEdit(null);
    setIsModalVisible(true);
  };

  const handleOpenEdit = (reminder: Reminder) => {
    setReminderToEdit(reminder);
    setIsModalVisible(true);
  };

  const handleSaveReminder = (reminderData: Omit<Reminder, 'id' | 'createdAt'>) => {
    if (reminderToEdit) {
      updateReminder(reminderToEdit.id, reminderData);
    } else {
      addReminder(reminderData);
    }
  };

  const handleCloseModal = () => {
    setIsModalVisible(false);
    setReminderToEdit(null);
  };

  const handleRequestDelete = (reminder: Reminder) => {
    setReminderToDelete(reminder);
  };

  const handleConfirmDelete = async () => {
    if (!reminderToDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteReminder(reminderToDelete.id);
      setReminderToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    if (isDeleting) return;
    setReminderToDelete(null);
  };

  const handleOpenSettings = () => {
    router.push('/settings');
  };

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.safeArea, isDark ? styles.safeAreaDark : styles.safeAreaLight]}>
      <View style={styles.contentWrapper}>
        {/* Cabecera de perfil */}
        <ProfileHeader
          avatarType={profile.avatarType}
          avatarUri={profile.avatarUri}
          name={profile.name}
          onPressSettings={handleOpenSettings}
        />

        {/* Cabecera de la sección de recordatorios */}
        <View style={styles.header}>
          <View style={styles.titleColumn}>
            <Text
              numberOfLines={1}
              style={[styles.headerTitle, isDark ? styles.titleDark : styles.titleLight]}>
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

        {/* Selector de Filtros: Hoy / Próximos */}
        <View style={styles.filterContainer}>
          <Pressable
            accessibilityLabel="Ver recordatorios de hoy"
            accessibilityRole="button"
            accessibilityState={{ selected: activeFilter === 'today' }}
            onPress={() => setActiveFilter('today')}
            style={({ pressed }) => [
              styles.filterTab,
              activeFilter === 'today'
                ? styles.filterTabActive
                : isDark
                ? styles.filterTabInactiveDark
                : styles.filterTabInactiveLight,
              pressed && styles.filterTabPressed,
            ]}>
            <Text
              style={[
                styles.filterTabText,
                activeFilter === 'today'
                  ? styles.filterTabTextActive
                  : isDark
                  ? styles.filterTabTextInactiveDark
                  : styles.filterTabTextInactiveLight,
              ]}>
              Hoy
            </Text>
          </Pressable>

          <Pressable
            accessibilityLabel="Ver recordatorios próximos"
            accessibilityRole="button"
            accessibilityState={{ selected: activeFilter === 'upcoming' }}
            onPress={() => setActiveFilter('upcoming')}
            style={({ pressed }) => [
              styles.filterTab,
              activeFilter === 'upcoming'
                ? styles.filterTabActive
                : isDark
                ? styles.filterTabInactiveDark
                : styles.filterTabInactiveLight,
              pressed && styles.filterTabPressed,
            ]}>
            <Text
              style={[
                styles.filterTabText,
                activeFilter === 'upcoming'
                  ? styles.filterTabTextActive
                  : isDark
                  ? styles.filterTabTextInactiveDark
                  : styles.filterTabTextInactiveLight,
              ]}>
              Próximos
            </Text>
          </Pressable>
        </View>

        {/* Lista de recordatorios */}
        <FlatList
          data={displayedReminders}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ReminderCard
              reminder={item}
              onPress={handleOpenEdit}
              onToggle={toggleReminder}
              onDelete={handleRequestDelete}
            />
          )}
          contentContainerStyle={[
            styles.listContainer,
            { paddingBottom: bottomInset + 80 },
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
                <Text style={styles.emptyIcon}>
                  {activeFilter === 'today' ? '☀️' : '📅'}
                </Text>
                <Text style={[styles.emptyTitle, isDark ? styles.titleDark : styles.titleLight]}>
                  {activeFilter === 'today'
                    ? 'No tienes recordatorios para hoy'
                    : 'No tienes otros recordatorios programados'}
                </Text>
                <Text style={[styles.emptySubtitle, isDark ? styles.subtitleDark : styles.subtitleLight]}>
                  {activeFilter === 'today'
                    ? 'Pulsa «+ Nuevo recordatorio» para programar uno.'
                    : 'Los recordatorios para fechas posteriores aparecerán aquí.'}
                </Text>
              </View>
            )
          }
        />

        {/* Botón Flotante para crear nuevo recordatorio */}
        <View style={[styles.fabContainer, { bottom: bottomInset + 8 }]}>
          <Pressable
            accessibilityLabel="Crear nuevo recordatorio"
            onPress={handleOpenCreate}
            style={({ pressed }) => [styles.fabButton, pressed && styles.fabButtonPressed]}>
            <Text style={styles.fabIcon}>＋</Text>
            <Text style={styles.fabText}>Nuevo recordatorio</Text>
          </Pressable>
        </View>

        {/* Modal con el formulario de creación y edición */}
        <CreateReminderModal
          visible={isModalVisible}
          reminderToEdit={reminderToEdit}
          onClose={handleCloseModal}
          onSave={handleSaveReminder}
        />

        {/* Modal personalizado de confirmación de eliminación */}
        <ConfirmDeleteModal
          visible={reminderToDelete !== null}
          reminderTitle={reminderToDelete?.title ?? ''}
          isDeleting={isDeleting}
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
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
    backgroundColor: '#111317',
  },
  contentWrapper: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    marginBottom: 4,
  },
  titleColumn: {
    flex: 1,
    marginRight: 12,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 26,
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
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    marginBottom: 4,
    alignSelf: 'flex-end',
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
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    marginTop: 2,
  },
  filterTab: {
    paddingVertical: 7,
    paddingHorizontal: 18,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterTabActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  filterTabInactiveLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  filterTabInactiveDark: {
    backgroundColor: '#181C24',
    borderColor: '#2E384D',
  },
  filterTabPressed: {
    opacity: 0.85,
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },
  filterTabTextInactiveLight: {
    color: '#64748B',
  },
  filterTabTextInactiveDark: {
    color: '#94A3B8',
  },
  listContainer: {
    paddingTop: 4,
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
    fontSize: 44,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 260,
  },
  fabContainer: {
    position: 'absolute',
    right: 16,
    alignItems: 'center',
  },
  fabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 24,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
    gap: 6,
  },
  fabButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
  fabIcon: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 18,
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
