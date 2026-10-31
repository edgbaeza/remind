import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';

import { Spacing } from '@/constants/theme';
import { Reminder, ReminderCategory } from '@/types/reminder';

interface CreateReminderModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (reminder: Omit<Reminder, 'id' | 'createdAt'>) => void;
}

const TIME_PRESETS = ['08:00 AM', '12:00 PM', '06:00 PM', '09:00 PM'];
const FREQUENCY_PRESETS = [
  'Diariamente',
  'Lunes a viernes',
  'Martes y jueves',
  'Fines de semana',
  'Día 15 del mes',
];

const CATEGORIES: { key: ReminderCategory; label: string; icon: string }[] = [
  { key: 'salud', label: 'Salud', icon: '💊' },
  { key: 'hogar', label: 'Hogar', icon: '🌿' },
  { key: 'finanzas', label: 'Finanzas', icon: '💳' },
  { key: 'personal', label: 'Personal', icon: '⭐' },
  { key: 'general', label: 'General', icon: '📌' },
];

export function CreateReminderModal({ visible, onClose, onSave }: CreateReminderModalProps) {
  const isDark = useColorScheme() === 'dark';

  const [title, setTitle] = useState('');
  const [time, setTime] = useState('08:00 AM');
  const [frequency, setFrequency] = useState('Diariamente');
  const [category, setCategory] = useState<ReminderCategory>('salud');
  const [hasError, setHasError] = useState(false);

  const resetForm = () => {
    setTitle('');
    setTime('08:00 AM');
    setFrequency('Diariamente');
    setCategory('salud');
    setHasError(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = () => {
    if (!title.trim()) {
      setHasError(true);
      return;
    }

    onSave({
      title: title.trim(),
      time: time.trim() || '08:00 AM',
      frequency: frequency.trim() || 'Diariamente',
      category,
      isActive: true,
    });

    handleClose();
  };

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}>
        <Pressable style={styles.backdropTouch} onPress={handleClose} />

        <View style={[styles.container, isDark ? styles.containerDark : styles.containerLight]}>
          {/* Indicador superior de arrastre */}
          <View style={styles.dragHandle} />

          <View style={styles.header}>
            <Text style={[styles.headerTitle, isDark ? styles.textDark : styles.textLight]}>
              Nuevo recordatorio
            </Text>
            <Pressable hitSlop={10} onPress={handleClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}>
            {/* Campo: Título */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, isDark ? styles.labelDark : styles.labelLight]}>
                Título del recordatorio *
              </Text>
              <TextInput
                autoFocus
                placeholder="Ej. Tomar suplemento, llamadas..."
                placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                style={[
                  styles.input,
                  isDark ? styles.inputDark : styles.inputLight,
                  hasError && styles.inputError,
                ]}
                value={title}
                onChangeText={(text) => {
                  setTitle(text);
                  if (hasError && text.trim()) setHasError(false);
                }}
              />
              {hasError && (
                <Text style={styles.errorText}>Por favor introduce un título para el recordatorio.</Text>
              )}
            </View>

            {/* Campo: Hora */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, isDark ? styles.labelDark : styles.labelLight]}>
                Hora
              </Text>
              <TextInput
                placeholder="08:00 AM"
                placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
                value={time}
                onChangeText={setTime}
              />
              {/* Presets de hora */}
              <View style={styles.chipRow}>
                {TIME_PRESETS.map((t) => {
                  const isSelected = time === t;
                  return (
                    <Pressable
                      key={t}
                      onPress={() => setTime(t)}
                      style={[
                        styles.chip,
                        isSelected
                          ? styles.chipSelected
                          : isDark
                          ? styles.chipDark
                          : styles.chipLight,
                      ]}>
                      <Text
                        style={[
                          styles.chipText,
                          isSelected
                            ? styles.chipTextSelected
                            : isDark
                            ? styles.chipTextDark
                            : styles.chipTextLight,
                        ]}>
                        {t}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Campo: Frecuencia */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, isDark ? styles.labelDark : styles.labelLight]}>
                Frecuencia
              </Text>
              <TextInput
                placeholder="Ej. Diariamente, cada dos días..."
                placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
                value={frequency}
                onChangeText={setFrequency}
              />
              {/* Presets de frecuencia */}
              <View style={styles.chipRow}>
                {FREQUENCY_PRESETS.map((f) => {
                  const isSelected = frequency === f;
                  return (
                    <Pressable
                      key={f}
                      onPress={() => setFrequency(f)}
                      style={[
                        styles.chip,
                        isSelected
                          ? styles.chipSelected
                          : isDark
                          ? styles.chipDark
                          : styles.chipLight,
                      ]}>
                      <Text
                        style={[
                          styles.chipText,
                          isSelected
                            ? styles.chipTextSelected
                            : isDark
                            ? styles.chipTextDark
                            : styles.chipTextLight,
                        ]}>
                        {f}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Campo: Categoría */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, isDark ? styles.labelDark : styles.labelLight]}>
                Categoría
              </Text>
              <View style={styles.chipRow}>
                {CATEGORIES.map((cat) => {
                  const isSelected = category === cat.key;
                  return (
                    <Pressable
                      key={cat.key}
                      onPress={() => setCategory(cat.key)}
                      style={[
                        styles.chip,
                        isSelected
                          ? styles.chipSelected
                          : isDark
                          ? styles.chipDark
                          : styles.chipLight,
                      ]}>
                      <Text style={styles.categoryChipIcon}>{cat.icon}</Text>
                      <Text
                        style={[
                          styles.chipText,
                          isSelected
                            ? styles.chipTextSelected
                            : isDark
                            ? styles.chipTextDark
                            : styles.chipTextLight,
                        ]}>
                        {cat.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Botones de acción */}
          <View style={styles.actionsRow}>
            <Pressable
              onPress={handleClose}
              style={({ pressed }) => [
                styles.cancelButton,
                pressed && styles.buttonPressed,
              ]}>
              <Text style={[styles.cancelButtonText, isDark && styles.cancelButtonTextDark]}>
                Cancelar
              </Text>
            </Pressable>

            <Pressable
              onPress={handleSubmit}
              style={({ pressed }) => [
                styles.submitButton,
                pressed && styles.buttonPressed,
              ]}>
              <Text style={styles.submitButtonText}>Guardar recordatorio</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  backdropTouch: {
    flex: 1,
  },
  container: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Platform.OS === 'ios' ? 40 : Spacing.four,
    maxHeight: '88%',
  },
  containerLight: {
    backgroundColor: '#FFFFFF',
  },
  containerDark: {
    backgroundColor: '#1C1F24',
  },
  dragHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.four,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  textLight: {
    color: '#111827',
  },
  textDark: {
    color: '#F9FAFB',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(156, 163, 175, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#6B7280',
  },
  scrollContent: {
    paddingBottom: Spacing.four,
  },
  fieldGroup: {
    marginBottom: Spacing.four,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: Spacing.two,
  },
  labelLight: {
    color: '#374151',
  },
  labelDark: {
    color: '#D1D5DB',
  },
  input: {
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    borderWidth: 1,
  },
  inputLight: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
    color: '#111827',
  },
  inputDark: {
    backgroundColor: '#272B32',
    borderColor: '#374151',
    color: '#F9FAFB',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  chipLight: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  chipDark: {
    backgroundColor: '#272B32',
    borderColor: '#374151',
  },
  chipSelected: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
  },
  categoryChipIcon: {
    fontSize: 13,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  chipTextLight: {
    color: '#4B5563',
  },
  chipTextDark: {
    color: '#D1D5DB',
  },
  chipTextSelected: {
    color: '#4F46E5',
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  cancelButton: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(156, 163, 175, 0.12)',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4B5563',
  },
  cancelButtonTextDark: {
    color: '#D1D5DB',
  },
  submitButton: {
    flex: 2,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});

