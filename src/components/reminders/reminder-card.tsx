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
        isCompleted && (isDark ? styles.cardCompletedDark : styles.cardCompletedLight),
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

      {/* Fila 4: Acción de cumplimiento (Hoy) o Indicador histórico (Calendario pasado) */}
      {showCompletionAction && (
        <View
          onStartShouldSetResponder={() => true}
          style={styles.completionContainer}>
          <Pressable
            accessibilityLabel={
              !reminder.isActive
                ? isCompleted
                  ? 'Completado hoy. Recordatorio pausado.'
                  : 'Recordatorio pausado. Actívalo para marcarlo como completado.'
                : isCompleted
                ? 'Completado hoy. Toca para deshacer.'
                : 'Marcar recordatorio como completado'
            }
            accessibilityRole="checkbox"
            accessibilityState={{
              checked: isCompleted,
              disabled: !reminder.isActive && !isCompleted,
            }}
            disabled={!reminder.isActive && !isCompleted}
            hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
            onPress={(e) => {
              e.stopPropagation();
              if (onToggleCompletion && dateKey) {
                onToggleCompletion(reminder.id, dateKey);
              }
            }}
            style={({ pressed }) => [
              styles.completionBtn,
              isCompleted
                ? (isDark ? styles.completionBtnDoneDark : styles.completionBtnDoneLight)
                : (isDark ? styles.completionBtnPendingDark : styles.completionBtnPendingLight),
              !reminder.isActive && !isCompleted && styles.completionBtnDisabled,
              pressed && reminder.isActive && styles.completionBtnPressed,
            ]}>
            <Text
              style={[
                styles.completionCheckIcon,
                isCompleted
                  ? (isDark ? styles.completionCheckIconDoneDark : styles.completionCheckIconDoneLight)
                  : (isDark ? styles.completionCheckIconPendingDark : styles.completionCheckIconPendingLight),
              ]}>
              {isCompleted ? '✓' : '○'}
            </Text>
            <Text
              style={[
                styles.completionBtnText,
                isCompleted
                  ? (isDark ? styles.completionTextDoneDark : styles.completionTextDoneLight)
                  : (isDark ? styles.completionTextPendingDark : styles.completionTextPendingLight),
              ]}>
              {isCompleted ? 'Completado hoy' : 'Marcar como completado'}
            </Text>
            {isCompleted && reminder.isActive && (
              <Text
                style={[
                  styles.undoHintText,
                  isDark ? styles.undoHintTextDark : styles.undoHintTextLight,
                ]}>
                (Deshacer)
              </Text>
            )}
          </Pressable>
        </View>
      )}

      {isHistoricalCompletion && !showCompletionAction && (
        <View style={styles.completionContainer}>
          <View style={[styles.historicalBadge, isDark ? styles.historicalBadgeDark : styles.historicalBadgeLight]}>
            <Text style={[styles.completionCheckIcon, isDark ? styles.completionCheckIconDoneDark : styles.completionCheckIconDoneLight]}>
              ✓
            </Text>
            <Text style={[styles.completionBtnText, isDark ? styles.completionTextDoneDark : styles.completionTextDoneLight]}>
              Completado en esta fecha
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
  cardCompletedLight: {
    borderLeftWidth: 4,
    borderLeftColor: '#059669',
    borderColor: 'rgba(5, 150, 105, 0.4)',
  },
  cardCompletedDark: {
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
    borderColor: 'rgba(16, 185, 129, 0.45)',
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
  completionContainer: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2B303C',
  },
  completionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    minHeight: 44,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  completionBtnDoneLight: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  completionBtnDoneDark: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  completionBtnPendingLight: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
  },
  completionBtnPendingDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: '#374151',
  },
  completionBtnDisabled: {
    opacity: 0.45,
  },
  completionBtnPressed: {
    opacity: 0.8,
  },
  completionCheckIcon: {
    fontSize: 14,
    fontWeight: '700',
  },
  completionCheckIconDoneLight: {
    color: '#059669',
  },
  completionCheckIconDoneDark: {
    color: '#34D399',
  },
  completionCheckIconPendingLight: {
    color: '#6B7280',
  },
  completionCheckIconPendingDark: {
    color: '#9CA3AF',
  },
  completionBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  completionTextDoneLight: {
    color: '#065F46',
  },
  completionTextDoneDark: {
    color: '#34D399',
  },
  completionTextPendingLight: {
    color: '#374151',
  },
  completionTextPendingDark: {
    color: '#D1D5DB',
  },
  undoHintText: {
    fontSize: 11,
    fontWeight: '500',
    marginLeft: 'auto',
  },
  undoHintTextLight: {
    color: '#059669',
  },
  undoHintTextDark: {
    color: '#6EE7B7',
  },
  historicalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  historicalBadgeLight: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  historicalBadgeDark: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
});
