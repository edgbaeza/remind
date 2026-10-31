import React from 'react';
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
  useColorScheme,
} from 'react-native';

import { Spacing } from '@/constants/theme';
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
      {/* Encabezado: Categoría y Acción de borrar */}
      <View style={styles.headerRow}>
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

        <Pressable
          accessibilityLabel="Eliminar recordatorio"
          hitSlop={8}
          onPress={() => onDelete(reminder.id)}
          style={({ pressed }) => [styles.deleteButton, pressed && styles.deleteButtonPressed]}>
          <Text style={[styles.deleteIconText, isDark && styles.deleteIconTextDark]}>✕</Text>
        </Pressable>
      </View>

      {/* Título del recordatorio */}
      <Text
        style={[
          styles.title,
          isDark ? styles.titleDark : styles.titleLight,
          !reminder.isActive && styles.titleInactive,
        ]}>
        {reminder.title}
      </Text>

      {/* Detalles: Hora y Frecuencia */}
      <View style={styles.detailsRow}>
        <View style={[styles.detailPill, isDark ? styles.detailPillDark : styles.detailPillLight]}>
          <Text style={styles.detailIcon}>⏰</Text>
          <Text style={[styles.detailText, isDark ? styles.detailTextDark : styles.detailTextLight]}>
            {reminder.time}
          </Text>
        </View>

        <View style={[styles.detailPill, isDark ? styles.detailPillDark : styles.detailPillLight]}>
          <Text style={styles.detailIcon}>🔄</Text>
          <Text style={[styles.detailText, isDark ? styles.detailTextDark : styles.detailTextLight]}>
            {reminder.frequency}
          </Text>
        </View>
      </View>

      {/* Barra inferior: Estado y Switch */}
      <View style={styles.footerRow}>
        <Text style={[styles.statusLabel, isDark ? styles.statusLabelDark : styles.statusLabelLight]}>
          {reminder.isActive ? 'Activo' : 'En pausa'}
        </Text>
        <Switch
          accessibilityLabel={`Estado del recordatorio ${reminder.title}`}
          thumbColor={reminder.isActive ? '#2563EB' : isDark ? '#6B7280' : '#D1D5DB'}
          trackColor={{ false: isDark ? '#374151' : '#E5E7EB', true: '#93C5FD' }}
          value={reminder.isActive}
          onValueChange={() => onToggle(reminder.id)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: Spacing.four,
    marginBottom: Spacing.three,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
  },
  cardLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#F0F1F5',
  },
  cardDark: {
    backgroundColor: '#1E2126',
    borderColor: '#2A2E36',
  },
  cardInactive: {
    opacity: 0.7,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  categoryIcon: {
    fontSize: 12,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  deleteButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonPressed: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  deleteIconText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: 'bold',
  },
  deleteIconTextDark: {
    color: '#6B7280',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: Spacing.three,
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
  detailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  detailPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 6,
  },
  detailPillLight: {
    backgroundColor: '#F3F4F6',
  },
  detailPillDark: {
    backgroundColor: '#272B32',
  },
  detailIcon: {
    fontSize: 13,
  },
  detailText: {
    fontSize: 13,
    fontWeight: '500',
  },
  detailTextLight: {
    color: '#4B5563',
  },
  detailTextDark: {
    color: '#D1D5DB',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(156, 163, 175, 0.15)',
    paddingTop: Spacing.two,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  statusLabelLight: {
    color: '#6B7280',
  },
  statusLabelDark: {
    color: '#9CA3AF',
  },
});

