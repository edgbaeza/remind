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

interface ReminderCardProps {
  reminder: Reminder;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
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

export function ReminderCard({ reminder, onToggle, onDelete }: ReminderCardProps) {
  const isDark = useColorScheme() === 'dark';
  const categoryInfo = CATEGORY_CONFIG[reminder.category ?? 'general'];

  return (
    <View
      style={[
        styles.card,
        isDark ? styles.cardDark : styles.cardLight,
        !reminder.isActive && styles.cardInactive,
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

        <View style={styles.actionsGroup}>
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
            onPress={() => onDelete(reminder.id)}
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
          <Text style={styles.metaIcon}>🔄</Text>
          <Text
            numberOfLines={1}
            style={[styles.metaText, isDark ? styles.metaTextDark : styles.metaTextLight]}>
            {reminder.frequency}
          </Text>
        </View>
      </View>
    </View>
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
});
