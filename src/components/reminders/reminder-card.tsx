import { SymbolView } from 'expo-symbols';
import React from 'react';
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
  useColorScheme,
} from 'react-native';

import { Reminder, ReminderCategory } from '@/types/reminder';
import { isPastOnceReminder } from '@/utils/reminder-dates';

interface ReminderCardProps {
  reminder: Reminder;
  onPress: (reminder: Reminder) => void;
  onToggle: (id: string) => void;
  onDelete: (reminder: Reminder) => void;
  dateKey?: string;
  isCompleted?: boolean;
  showCompletionAction?: boolean;
  isHistoricalCompletion?: boolean;
  onToggleCompletion?: (reminderId: string, dateKey: string) => void | Promise<unknown>;
}

const CATEGORY_CONFIG: Record<
  ReminderCategory,
  { label: string; bgLight: string; textLight: string; bgDark: string; textDark: string; icon: string }
> = {
  salud: {
    label: 'Salud',
    bgLight: '#ECFDF5',
    textLight: '#059669',
    bgDark: '#064E3B',
    textDark: '#6EE7B7',
    icon: '💊',
  },
  hogar: {
    label: 'Hogar',
    bgLight: '#FFFBEB',
    textLight: '#D97706',
    bgDark: '#78350F',
    textDark: '#FCD34D',
    icon: '🌿',
  },
  finanzas: {
    label: 'Finanzas',
    bgLight: '#EFF6FF',
    textLight: '#2563EB',
    bgDark: '#1E3A8A',
    textDark: '#93C5FD',
    icon: '💳',
  },
  personal: {
    label: 'Personal',
    bgLight: '#F5F3FF',
    textLight: '#7C3AED',
    bgDark: '#4C1D95',
    textDark: '#C4B5FD',
    icon: '⭐',
  },
  general: {
    label: 'General',
    bgLight: '#F3F4F6',
    textLight: '#4B5563',
    bgDark: '#374151',
    textDark: '#E5E7EB',
    icon: '📌',
  },
};

export function ReminderCard({
  reminder,
  onPress,
  onToggle,
  onDelete,
  dateKey,
  isCompleted = false,
  showCompletionAction = false,
  isHistoricalCompletion = false,
  onToggleCompletion,
}: ReminderCardProps) {
  const isDark = useColorScheme() === 'dark';
  const categoryInfo = CATEGORY_CONFIG[reminder.category ?? 'general'];
  const isPast = isPastOnceReminder(reminder);

  return (
    <Pressable
      accessibilityLabel={`Recordatorio: ${reminder.title}. Toca para editar.`}
      accessibilityRole="button"
      onPress={() => onPress(reminder)}
      style={({ pressed }) => [
        styles.card,
        isDark ? styles.cardDark : styles.cardLight,
        !reminder.isActive && styles.cardInactive,
        pressed && styles.cardPressed,
      ]}>
      {/* Fila 1: Categoría a la izquierda, Estado + Switch + Eliminar a la derecha */}
      <View style={styles.topRow}>
        <View
          style={[
            styles.categoryBadge,
            { backgroundColor: isDark ? categoryInfo.bgDark : categoryInfo.bgLight },
          ]}>
          <Text style={styles.categoryIcon}>{categoryInfo.icon}</Text>
          <Text
            style={[
              styles.categoryText,
              { color: isDark ? categoryInfo.textDark : categoryInfo.textLight },
            ]}>
            {categoryInfo.label}
          </Text>
        </View>

        {/* Zona de controles interactivos con responder para evitar activar la edición al tocar el switch o borrar */}
        <View
          onStartShouldSetResponder={() => true}
          style={styles.actionsGroup}>
          <Text style={[styles.statusText, isDark ? styles.statusTextDark : styles.statusTextLight]}>
            {reminder.isActive ? 'Activo' : 'Pausado'}
          </Text>
          <Switch
            accessibilityLabel={`Estado del recordatorio ${reminder.title}`}
            style={styles.switchControl}
            thumbColor={reminder.isActive ? '#2563EB' : isDark ? '#4B5563' : '#D1D5DB'}
            trackColor={{ false: isDark ? '#374151' : '#E5E7EB', true: '#93C5FD' }}
            value={reminder.isActive}
            onValueChange={() => onToggle(reminder.id)}
          />
          <Pressable
            accessibilityLabel="Eliminar recordatorio"
            hitSlop={10}
            onPress={(e) => {
              e.stopPropagation();
              onDelete(reminder);
            }}
            style={({ pressed }) => [styles.deleteBtn, pressed && styles.deleteBtnPressed]}>
            <Text style={[styles.deleteBtnText, isDark && styles.deleteBtnTextDark]}>✕</Text>
          </Pressable>
        </View>
      </View>

      {/* Fila 2: Título del recordatorio */}
      <Text
        numberOfLines={2}
        ellipsizeMode="tail"
        style={[
          styles.title,
          isDark ? styles.titleDark : styles.titleLight,
          !reminder.isActive && styles.titleInactive,
        ]}>
        {reminder.title}
      </Text>

      {/* Fila 3: Horario y Frecuencia */}
      <View style={styles.metaRow}>
        <View style={[styles.metaPill, isDark ? styles.metaPillDark : styles.metaPillLight]}>
          <Text style={styles.metaIcon}>⏰</Text>
          <Text
            numberOfLines={1}
            style={[styles.metaText, isDark ? styles.metaTextDark : styles.metaTextLight]}>
            {reminder.time}
          </Text>
        </View>

        <View style={[styles.metaPill, isDark ? styles.metaPillDark : styles.metaPillLight]}>
          <Text style={styles.metaIcon}>
            {reminder.repeatType === 'once' || reminder.repeatType === 'monthly' ? '📅' : '🔄'}
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.metaText, isDark ? styles.metaTextDark : styles.metaTextLight]}>
            {reminder.frequency}
          </Text>
        </View>

        {/* Muestra los días específicos si están configurados y no repite el texto completo */}
        {reminder.days && reminder.days.length > 0 && reminder.days.length < 7 && reminder.frequency !== reminder.days.join(' ') && (
          <View style={[styles.metaPill, isDark ? styles.daysPillDark : styles.daysPillLight]}>
            <Text style={[styles.daysText, isDark ? styles.daysTextDark : styles.daysTextLight]}>
              {reminder.days.join(' ')}
            </Text>
          </View>
        )}

        {/* Indicador de Fecha pasada para recordatorios de una sola vez expirados */}
        {isPast && (
          <View style={[styles.metaPill, isDark ? styles.pastPillDark : styles.pastPillLight]}>
            <Text style={[styles.pastText, isDark ? styles.pastTextDark : styles.pastTextLight]}>
              Fecha pasada
            </Text>
          </View>
        )}
      </View>

      {/* Fila 4: Acción de cumplimiento compacta (Hoy) o Indicador histórico (Calendario pasado) */}
      {showCompletionAction && (
        <View
          onStartShouldSetResponder={() => true}
          style={styles.actionRow}>
          {isCompleted ? (
            <View style={styles.completedContainer}>
              <View style={styles.completedBadge}>
                <SymbolView
                  fallback={
                    <Text
                      style={[
                        styles.checkIconFallback,
                        isDark ? styles.iconGreenDark : styles.iconGreenLight,
                      ]}>
                      ✓
                    </Text>
                  }
                  name={{
                    ios: 'checkmark.circle.fill',
                    android: 'check_circle',
                    web: 'check_circle',
                  }}
                  size={16}
                  tintColor={isDark ? '#10B981' : '#059669'}
                />
                <Text
                  style={[
                    styles.completedLabel,
                    isDark ? styles.textGreenDark : styles.textGreenLight,
                  ]}>
                  Completado
                </Text>
              </View>

              {reminder.isActive && (
                <Pressable
                  accessibilityLabel="Deshacer cumplimiento del recordatorio"
                  accessibilityRole="button"
                  hitSlop={{ top: 12, bottom: 12, left: 10, right: 10 }}
                  onPress={(e) => {
                    e.stopPropagation();
                    if (onToggleCompletion && dateKey) {
                      onToggleCompletion(reminder.id, dateKey);
                    }
                  }}
                  style={({ pressed }) => [
                    styles.undoButton,
                    pressed && styles.buttonPressed,
                  ]}>
                  <Text
                    style={[
                      styles.undoText,
                      isDark ? styles.undoTextDark : styles.undoTextLight,
                    ]}>
                    Deshacer
                  </Text>
                </Pressable>
              )}
            </View>
          ) : (
            <Pressable
              accessibilityLabel={
                reminder.isActive
                  ? 'Completar recordatorio'
                  : 'Recordatorio pausado. Actívalo para completarlo.'
              }
              accessibilityRole="button"
              accessibilityState={{ disabled: !reminder.isActive }}
              disabled={!reminder.isActive}
              hitSlop={{ top: 10, bottom: 10, left: 12, right: 12 }}
              onPress={(e) => {
                e.stopPropagation();
                if (onToggleCompletion && dateKey) {
                  onToggleCompletion(reminder.id, dateKey);
                }
              }}
              style={({ pressed }) => [
                styles.pendingPill,
                isDark ? styles.pendingPillDark : styles.pendingPillLight,
                !reminder.isActive && styles.pendingPillDisabled,
                pressed && reminder.isActive && styles.buttonPressed,
              ]}>
              <SymbolView
                fallback={
                  <Text
                    style={[
                      styles.circleIconFallback,
                      isDark ? styles.circleIconFallbackDark : styles.circleIconFallbackLight,
                    ]}>
                    ○
                  </Text>
                }
                name={{
                  ios: 'circle',
                  android: 'radio_button_unchecked',
                  web: 'radio_button_unchecked',
                }}
                size={14}
                tintColor={isDark ? '#9CA3AF' : '#6B7280'}
              />
              <Text
                style={[
                  styles.pendingPillText,
                  isDark ? styles.pendingPillTextDark : styles.pendingPillTextLight,
                ]}>
                Completar
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {isHistoricalCompletion && !showCompletionAction && (
        <View style={styles.actionRow}>
          <View style={styles.historicalBadge}>
            <SymbolView
              fallback={
                <Text
                  style={[
                    styles.checkIconFallback,
                    isDark ? styles.iconGreenDark : styles.iconGreenLight,
                  ]}>
                  ✓
                </Text>
              }
              name={{
                ios: 'checkmark.circle.fill',
                android: 'check_circle',
                web: 'check_circle',
              }}
              size={15}
              tintColor={isDark ? '#10B981' : '#059669'}
            />
            <Text
              style={[
                styles.completedLabel,
                isDark ? styles.textGreenDark : styles.textGreenLight,
              ]}>
              Completado
            </Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
  },
  cardLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#ECEEF2',
  },
  cardDark: {
    backgroundColor: '#1C1F26',
    borderColor: '#2B303C',
  },
  cardInactive: {
    opacity: 0.65,
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  categoryIcon: {
    fontSize: 11,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '700',
  },
  actionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    marginRight: 2,
  },
  statusTextLight: {
    color: '#6B7280',
  },
  statusTextDark: {
    color: '#9CA3AF',
  },
  switchControl: {
    transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }],
    marginVertical: -6,
  },
  deleteBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  deleteBtnPressed: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  deleteBtnText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '700',
    lineHeight: 15,
  },
  deleteBtnTextDark: {
    color: '#6B7280',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 8,
  },
  titleLight: {
    color: '#111827',
  },
  titleDark: {
    color: '#F9FAFB',
  },
  titleInactive: {
    textDecorationLine: 'line-through',
    color: '#9CA3AF',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
    maxWidth: '100%',
  },
  metaPillLight: {
    backgroundColor: '#F3F4F6',
  },
  metaPillDark: {
    backgroundColor: '#262A34',
  },
  metaIcon: {
    fontSize: 11,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '500',
  },
  metaTextLight: {
    color: '#4B5563',
  },
  metaTextDark: {
    color: '#D1D5DB',
  },
  daysPillLight: {
    backgroundColor: '#EEF2FF',
  },
  daysPillDark: {
    backgroundColor: '#1E293B',
  },
  daysText: {
    fontSize: 11,
    fontWeight: '700',
  },
  daysTextLight: {
    color: '#2563EB',
  },
  daysTextDark: {
    color: '#93C5FD',
  },
  pastPillLight: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  pastPillDark: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  pastText: {
    fontSize: 11,
    fontWeight: '700',
  },
  pastTextLight: {
    color: '#DC2626',
  },
  pastTextDark: {
    color: '#F87171',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 8,
  },
  pendingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: 9999,
    borderWidth: 1,
    minHeight: 28,
  },
  pendingPillDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: '#374151',
  },
  pendingPillLight: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
  },
  pendingPillDisabled: {
    opacity: 0.45,
  },
  buttonPressed: {
    opacity: 0.65,
  },
  pendingPillText: {
    fontSize: 12,
    fontWeight: '500',
  },
  pendingPillTextDark: {
    color: '#D1D5DB',
  },
  pendingPillTextLight: {
    color: '#4B5563',
  },
  circleIconFallback: {
    fontSize: 12,
    lineHeight: 14,
  },
  circleIconFallbackDark: {
    color: '#9CA3AF',
  },
  circleIconFallbackLight: {
    color: '#6B7280',
  },
  completedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  checkIconFallback: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 15,
  },
  iconGreenDark: {
    color: '#10B981',
  },
  iconGreenLight: {
    color: '#059669',
  },
  completedLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  textGreenDark: {
    color: '#10B981',
  },
  textGreenLight: {
    color: '#059669',
  },
  undoButton: {
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  undoText: {
    fontSize: 12,
    fontWeight: '500',
  },
  undoTextDark: {
    color: '#9CA3AF',
  },
  undoTextLight: {
    color: '#6B7280',
  },
  historicalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
});
