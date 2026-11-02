import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConfirmDeleteModal } from '@/components/reminders/confirm-delete-modal';
import { CreateReminderModal } from '@/components/reminders/create-reminder-modal';
import { ReminderCard } from '@/components/reminders/reminder-card';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useReminders } from '@/hooks/use-reminders';
import { useTodayDate } from '@/hooks/use-today-date';
import { Reminder } from '@/types/reminder';
import {
  buildDayAccessibilityLabel,
  buildMonthGridWeeks,
  buildMonthRemindersMap,
  CALENDAR_WEEK_DAYS,
  getDayIndicators,
  getSelectedDateOnMonthChange,
  navigateMonth,
  SPANISH_MONTH_NAMES,
} from '@/utils/calendar-utils';
import { formatDateSpanish } from '@/utils/reminder-dates';

export default function CalendarScreen() {
  const isDark = useColorScheme() === 'dark';
  const { todayDate, todayStr } = useTodayDate();

  const {
    reminders,
    isLoading,
    updateReminder,
    toggleReminder,
    deleteReminder,
  } = useReminders();

  const [displayedYear, setDisplayedYear] = useState<number>(() => todayDate.getFullYear());
  const [displayedMonth, setDisplayedMonth] = useState<number>(() => todayDate.getMonth());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => todayStr);
  const [prevTodayStr, setPrevTodayStr] = useState<string>(() => todayStr);

  // Estado para edición y eliminación desde la lista del día seleccionado
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [reminderToEdit, setReminderToEdit] = useState<Reminder | null>(null);
  const [reminderToDelete, setReminderToDelete] = useState<Reminder | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Sincronizar automáticamente si cambia el día local (medianoche o regreso desde segundo plano)
  if (todayStr !== prevTodayStr) {
    const wasOnPreviousToday = selectedDateStr === prevTodayStr;
    setPrevTodayStr(todayStr);
    if (wasOnPreviousToday) {
      setSelectedDateStr(todayStr);
      setDisplayedYear(todayDate.getFullYear());
      setDisplayedMonth(todayDate.getMonth());
    }
  }

  // Cuadrícula de semanas del mes visible (L, M, X, J, V, S, D)
  const weeks = useMemo(
    () => buildMonthGridWeeks(displayedYear, displayedMonth),
    [displayedYear, displayedMonth]
  );

  // Mapa precalculado de recordatorios por día del mes visible
  const monthRemindersMap = useMemo(
    () => buildMonthRemindersMap(reminders, displayedYear, displayedMonth),
    [reminders, displayedYear, displayedMonth]
  );

  // Recordatorios del día seleccionado (ordenados por hora ascendente)
  const selectedDayReminders = useMemo(
    () => monthRemindersMap[selectedDateStr] ?? [],
    [monthRemindersMap, selectedDateStr]
  );

  const isViewingToday =
    displayedYear === todayDate.getFullYear() &&
    displayedMonth === todayDate.getMonth() &&
    selectedDateStr === todayStr;

  const handlePrevMonth = () => {
    const next = navigateMonth(displayedYear, displayedMonth, 'prev');
    setDisplayedYear(next.year);
    setDisplayedMonth(next.month);
    setSelectedDateStr(
      getSelectedDateOnMonthChange(next.year, next.month, selectedDateStr, todayDate)
    );
  };

  const handleNextMonth = () => {
    const next = navigateMonth(displayedYear, displayedMonth, 'next');
    setDisplayedYear(next.year);
    setDisplayedMonth(next.month);
    setSelectedDateStr(
      getSelectedDateOnMonthChange(next.year, next.month, selectedDateStr, todayDate)
    );
  };

  const handleGoToToday = () => {
    setDisplayedYear(todayDate.getFullYear());
    setDisplayedMonth(todayDate.getMonth());
    setSelectedDateStr(todayStr);
  };

  const handleOpenEdit = (reminder: Reminder) => {
    setReminderToEdit(reminder);
    setIsEditModalVisible(true);
  };

  const handleSaveReminder = (reminderData: Omit<Reminder, 'id' | 'createdAt'>) => {
    if (reminderToEdit) {
      updateReminder(reminderToEdit.id, reminderData);
    }
  };

  const handleCloseEditModal = () => {
    setIsEditModalVisible(false);
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

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.safeArea, isDark ? styles.safeAreaDark : styles.safeAreaLight]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.contentWrapper}>
          {/* Cabecera con título Calendario y botón discreto Hoy */}
          <View style={styles.header}>
            <Text
              numberOfLines={1}
              style={[styles.headerTitle, isDark ? styles.titleDark : styles.titleLight]}>
              Calendario
            </Text>

            <Pressable
              accessibilityHint="Regresa al mes y fecha actual"
              accessibilityLabel="Ir a hoy"
              accessibilityRole="button"
              accessibilityState={{ selected: isViewingToday }}
              hitSlop={8}
              onPress={handleGoToToday}
              style={({ pressed }) => [
                styles.todayButton,
                isViewingToday
                  ? isDark
                    ? styles.todayButtonCurrentDark
                    : styles.todayButtonCurrentLight
                  : styles.todayButtonHighlight,
                pressed && styles.buttonPressed,
              ]}>
              <Text
                style={[
                  styles.todayButtonText,
                  isViewingToday
                    ? isDark
                      ? styles.todayButtonTextCurrentDark
                      : styles.todayButtonTextCurrentLight
                    : styles.todayButtonTextHighlight,
                ]}>
                Hoy
              </Text>
            </Pressable>
          </View>

          {/* Tarjeta de la cuadrícula mensual */}
          <View
            style={[
              styles.calendarCard,
              isDark ? styles.calendarCardDark : styles.calendarCardLight,
            ]}>
            {/* Navegación de Mes y Año */}
            <View style={styles.monthNavRow}>
              <Pressable
                accessibilityLabel="Mes anterior"
                accessibilityRole="button"
                hitSlop={8}
                onPress={handlePrevMonth}
                style={({ pressed }) => [
                  styles.navArrowBtn,
                  isDark ? styles.navArrowBtnDark : styles.navArrowBtnLight,
                  pressed && styles.buttonPressed,
                ]}>
                <SymbolView
                  fallback={
                    <Text style={[styles.navArrowText, isDark ? styles.navArrowTextDark : styles.navArrowTextLight]}>
                      ‹
                    </Text>
                  }
                  name={{
                    ios: 'chevron.left',
                    android: 'chevron_left',
                    web: 'chevron_left',
                  }}
                  size={20}
                  tintColor={isDark ? '#CBD5E1' : '#334155'}
                />
              </Pressable>

              <Text style={[styles.monthYearTitle, isDark ? styles.titleDark : styles.titleLight]}>
                {SPANISH_MONTH_NAMES[displayedMonth]} {displayedYear}
              </Text>

              <Pressable
                accessibilityLabel="Mes siguiente"
                accessibilityRole="button"
                hitSlop={8}
                onPress={handleNextMonth}
                style={({ pressed }) => [
                  styles.navArrowBtn,
                  isDark ? styles.navArrowBtnDark : styles.navArrowBtnLight,
                  pressed && styles.buttonPressed,
                ]}>
                <SymbolView
                  fallback={
                    <Text style={[styles.navArrowText, isDark ? styles.navArrowTextDark : styles.navArrowTextLight]}>
                      ›
                    </Text>
                  }
                  name={{
                    ios: 'chevron.right',
                    android: 'chevron_right',
                    web: 'chevron_right',
                  }}
                  size={20}
                  tintColor={isDark ? '#CBD5E1' : '#334155'}
                />
              </Pressable>
            </View>

            {/* Encabezados de días de la semana: L, M, X, J, V, S, D */}
            <View style={[styles.weekHeaderRow, isDark ? styles.weekHeaderDark : styles.weekHeaderLight]}>
              {CALENDAR_WEEK_DAYS.map((day) => (
                <View key={day.key} style={styles.weekHeaderCell}>
                  <Text style={[styles.weekHeaderText, isDark ? styles.weekHeaderTextDark : styles.weekHeaderTextLight]}>
                    {day.label}
                  </Text>
                </View>
              ))}
            </View>

            {/* Filas de semanas del mes */}
            <View style={styles.weeksContainer}>
              {weeks.map((week, weekIndex) => (
                <View key={`week-${displayedYear}-${displayedMonth}-${weekIndex}`} style={styles.weekRow}>
                  {week.map((cell) => {
                    if (cell.type === 'empty' || !cell.dayNumber || !cell.dateStr) {
                      return <View key={cell.key} style={styles.dayCell} />;
                    }

                    const dateStr = cell.dateStr;
                    const dayNum = cell.dayNumber;
                    const isToday = dateStr === todayStr;
                    const isSelected = dateStr === selectedDateStr;
                    const dayReminders = monthRemindersMap[dateStr];
                    const indicators = getDayIndicators(dayReminders);

                    const a11yLabel = buildDayAccessibilityLabel(
                      dayNum,
                      displayedMonth,
                      displayedYear,
                      isToday,
                      isSelected,
                      indicators
                    );

                    return (
                      <Pressable
                        key={cell.key}
                        accessibilityLabel={a11yLabel}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        onPress={() => setSelectedDateStr(dateStr)}
                        style={({ pressed }) => [
                          styles.dayCell,
                          pressed && styles.dayCellPressed,
                        ]}>
                        <View
                          style={[
                            styles.dayNumberCircle,
                            isSelected
                              ? styles.dayCircleSelected
                              : isToday
                              ? styles.dayCircleToday
                              : null,
                          ]}>
                          <Text
                            style={[
                              styles.dayNumberText,
                              isSelected
                                ? styles.dayTextSelected
                                : isToday
                                ? styles.dayTextToday
                                : isDark
                                ? styles.dayTextNormalDark
                                : styles.dayTextNormalLight,
                            ]}>
                            {dayNum}
                          </Text>
                        </View>

                        {/* Indicadores de puntos de recordatorios debajo del número */}
                        <View style={styles.dotsRow}>
                          {indicators.dots.map((dot) => (
                            <View
                              key={dot.id}
                              style={[
                                styles.dot,
                                { backgroundColor: dot.color },
                                !dot.isActive && styles.dotInactive,
                              ]}
                            />
                          ))}
                          {indicators.hasOverflow ? (
                            <Text style={styles.overflowPlus}>+</Text>
                          ) : null}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>

          {/* Sección: Lista de recordatorios del día seleccionado */}
          <View style={styles.daySectionHeader}>
            <Text
              numberOfLines={1}
              style={[styles.daySectionTitle, isDark ? styles.titleDark : styles.titleLight]}>
              Recordatorios del {formatDateSpanish(selectedDateStr)}
            </Text>

            <View
              style={[
                styles.dayCountBadge,
                isDark ? styles.dayCountBadgeDark : styles.dayCountBadgeLight,
              ]}>
              <Text
                style={[
                  styles.dayCountText,
                  isDark ? styles.dayCountTextDark : styles.dayCountTextLight,
                ]}>
                {selectedDayReminders.length}
              </Text>
            </View>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={isDark ? '#818CF8' : '#2563EB'} size="small" />
            </View>
          ) : selectedDayReminders.length === 0 ? (
            <View
              style={[
                styles.emptyDayCard,
                isDark ? styles.emptyDayCardDark : styles.emptyDayCardLight,
              ]}>
              <Text style={[styles.emptyDayText, isDark ? styles.subtitleDark : styles.subtitleLight]}>
                No tienes recordatorios para este día
              </Text>
            </View>
          ) : (
            <View style={styles.remindersList}>
              {selectedDayReminders.map((reminder) => (
                <ReminderCard
                  key={reminder.id}
                  onDelete={handleRequestDelete}
                  onPress={handleOpenEdit}
                  onToggle={toggleReminder}
                  reminder={reminder}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Modal de edición reutilizado */}
      <CreateReminderModal
        onClose={handleCloseEditModal}
        onSave={handleSaveReminder}
        reminderToEdit={reminderToEdit}
        visible={isEditModalVisible}
      />

      {/* Modal de confirmación de eliminación reutilizado */}
      <ConfirmDeleteModal
        isDeleting={isDeleting}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        reminderTitle={reminderToDelete?.title ?? ''}
        visible={reminderToDelete !== null}
      />
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
  scrollContent: {
    paddingBottom: 28,
  },
  contentWrapper: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    marginBottom: 4,
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
  todayButton: {
    minHeight: 34,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayButtonHighlight: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  todayButtonCurrentDark: {
    backgroundColor: '#181C24',
    borderColor: '#2E384D',
  },
  todayButtonCurrentLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  todayButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  todayButtonTextHighlight: {
    color: '#FFFFFF',
  },
  todayButtonTextCurrentDark: {
    color: '#94A3B8',
  },
  todayButtonTextCurrentLight: {
    color: '#64748B',
  },
  calendarCard: {
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderWidth: 1,
    marginBottom: 18,
  },
  calendarCardDark: {
    backgroundColor: '#181C24',
    borderColor: '#262C3A',
  },
  calendarCardLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  monthYearTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  navArrowBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  navArrowBtnDark: {
    backgroundColor: '#111317',
    borderColor: '#262C3A',
  },
  navArrowBtnLight: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  navArrowText: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 24,
  },
  navArrowTextDark: {
    color: '#CBD5E1',
  },
  navArrowTextLight: {
    color: '#334155',
  },
  buttonPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.97 }],
  },
  weekHeaderRow: {
    flexDirection: 'row',
    paddingBottom: 8,
    marginBottom: 4,
    borderBottomWidth: 1,
  },
  weekHeaderDark: {
    borderBottomColor: '#262C3A',
  },
  weekHeaderLight: {
    borderBottomColor: '#E2E8F0',
  },
  weekHeaderCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekHeaderText: {
    fontSize: 12,
    fontWeight: '700',
  },
  weekHeaderTextDark: {
    color: '#64748B',
  },
  weekHeaderTextLight: {
    color: '#64748B',
  },
  weeksContainer: {
    gap: 2,
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayCell: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 3,
  },
  dayCellPressed: {
    opacity: 0.7,
  },
  dayNumberCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleToday: {
    borderWidth: 1.5,
    borderColor: '#3B82F6',
  },
  dayCircleSelected: {
    backgroundColor: '#2563EB',
  },
  dayNumberText: {
    fontSize: 14,
    includeFontPadding: false,
  },
  dayTextNormalDark: {
    color: '#E2E8F0',
    fontWeight: '600',
  },
  dayTextNormalLight: {
    color: '#1E293B',
    fontWeight: '600',
  },
  dayTextToday: {
    color: '#60A5FA',
    fontWeight: '700',
  },
  dayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 9,
    marginTop: 2,
    gap: 3,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  dotInactive: {
    opacity: 0.45,
  },
  overflowPlus: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    lineHeight: 10,
    marginLeft: 1,
  },
  daySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  daySectionTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    marginRight: 10,
  },
  dayCountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  dayCountBadgeDark: {
    backgroundColor: '#1E293B',
  },
  dayCountBadgeLight: {
    backgroundColor: '#EEF2FF',
  },
  dayCountText: {
    fontSize: 12,
    fontWeight: '700',
  },
  dayCountTextDark: {
    color: '#818CF8',
  },
  dayCountTextLight: {
    color: '#4F46E5',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyDayCard: {
    borderRadius: 16,
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  emptyDayCardDark: {
    backgroundColor: '#181C24',
    borderColor: '#262C3A',
  },
  emptyDayCardLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  emptyDayText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  remindersList: {
    gap: 2,
  },
});
