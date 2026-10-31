import DateTimePicker, {
  DateTimePickerAndroid,
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import { Reminder, ReminderCategory } from '@/types/reminder';

interface CreateReminderModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (reminder: Omit<Reminder, 'id' | 'createdAt'>) => void;
  reminderToEdit?: Reminder | null;
}

const ALL_DAYS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

const WEEK_DAYS: { key: string; label: string; full: string }[] = [
  { key: 'D', label: 'D', full: 'Domingo' },
  { key: 'L', label: 'L', full: 'Lunes' },
  { key: 'M', label: 'M', full: 'Martes' },
  { key: 'X', label: 'X', full: 'Miércoles' },
  { key: 'J', label: 'J', full: 'Jueves' },
  { key: 'V', label: 'V', full: 'Viernes' },
  { key: 'S', label: 'S', full: 'Sábado' },
];

const FREQUENCY_PRESETS = [
  'Diariamente',
  'Lunes a viernes',
  'Martes y jueves',
  'Fines de semana',
  'Días específicos',
  'Día 15 del mes',
];

const CATEGORIES: { key: ReminderCategory; label: string; icon: string }[] = [
  { key: 'salud', label: 'Salud', icon: '💊' },
  { key: 'hogar', label: 'Hogar', icon: '🌿' },
  { key: 'finanzas', label: 'Finanzas', icon: '💳' },
  { key: 'personal', label: 'Personal', icon: '⭐' },
  { key: 'general', label: 'General', icon: '📌' },
];

function getDaysSummary(days: string[]): string {
  const ordered = ALL_DAYS.filter((d) => days.includes(d));
  if (ordered.length === 7) return 'D L M X J V S';
  if (ordered.length === 0) return 'Sin días seleccionados';
  return ordered.join(' ');
}

function getDaysFromFrequency(freq: string): string[] {
  const lower = freq.toLowerCase();
  if (lower.includes('diaria') || lower.includes('todos los días')) {
    return ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
  }
  if (lower.includes('lunes a viernes') || lower.includes('laborales')) {
    return ['L', 'M', 'X', 'J', 'V'];
  }
  if (lower.includes('martes y jueves')) {
    return ['M', 'J'];
  }
  if (lower.includes('fin') || lower.includes('fines de semana')) {
    return ['D', 'S'];
  }
  const matched = ALL_DAYS.filter((d) => freq.includes(d));
  if (matched.length > 0) return matched;
  return ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
}

function parseTimeString(timeStr: string): Date {
  const d = new Date();
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const ampm = match[3]?.toUpperCase();

    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;

    d.setHours(hours, minutes, 0, 0);
  } else {
    d.setHours(8, 0, 0, 0);
  }
  return d;
}

function formatTimeString(date: Date): string {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';

  hours = hours % 12;
  hours = hours ? hours : 12;
  const formattedHours = hours < 10 ? `0${hours}` : `${hours}`;
  const formattedMinutes = minutes < 10 ? `0${minutes}` : `${minutes}`;

  return `${formattedHours}:${formattedMinutes} ${ampm}`;
}

interface FormContentProps {
  onClose: () => void;
  onSave: (reminder: Omit<Reminder, 'id' | 'createdAt'>) => void;
  reminderToEdit?: Reminder | null;
}

function ReminderFormContent({ onClose, onSave, reminderToEdit }: FormContentProps) {
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const isEditing = Boolean(reminderToEdit);

  const [title, setTitle] = useState(reminderToEdit?.title ?? '');
  const [time, setTime] = useState(reminderToEdit?.time ?? '08:00 AM');
  const [frequency, setFrequency] = useState(reminderToEdit?.frequency ?? 'Diariamente');
  const [category, setCategory] = useState<ReminderCategory>(
    reminderToEdit?.category ?? 'salud'
  );
  const [selectedDays, setSelectedDays] = useState<string[]>(
    reminderToEdit?.days ??
      (reminderToEdit
        ? getDaysFromFrequency(reminderToEdit.frequency)
        : ['D', 'L', 'M', 'X', 'J', 'V', 'S'])
  );
  const [hasError, setHasError] = useState(false);
  const [showIosPicker, setShowIosPicker] = useState(false);

  const handleOpenTimePicker = () => {
    const currentDate = parseTimeString(time);

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: currentDate,
        onChange: (event: DateTimePickerEvent, selectedDate?: Date) => {
          if (event.type === 'set' && selectedDate) {
            setTime(formatTimeString(selectedDate));
          }
        },
        mode: 'time',
        is24Hour: false,
      });
    } else {
      setShowIosPicker(true);
    }
  };

  const handleToggleDay = (dayKey: string) => {
    let nextDays: string[];
    if (selectedDays.includes(dayKey)) {
      nextDays = selectedDays.filter((d) => d !== dayKey);
    } else {
      nextDays = [...selectedDays, dayKey];
    }
    setSelectedDays(nextDays);

    const ordered = ALL_DAYS.filter((d) => nextDays.includes(d));
    if (ordered.length === 7) {
      setFrequency('Diariamente');
    } else if (ordered.join('') === 'LMXJV') {
      setFrequency('Lunes a viernes');
    } else if (ordered.join('') === 'MJ') {
      setFrequency('Martes y jueves');
    } else if (ordered.join('') === 'DS') {
      setFrequency('Fines de semana');
    } else {
      setFrequency(ordered.length > 0 ? ordered.join(' ') : 'Días específicos');
    }
  };

  const handleSelectPreset = (preset: string) => {
    setFrequency(preset);
    if (preset === 'Diariamente') {
      setSelectedDays(['D', 'L', 'M', 'X', 'J', 'V', 'S']);
    } else if (preset === 'Lunes a viernes') {
      setSelectedDays(['L', 'M', 'X', 'J', 'V']);
    } else if (preset === 'Martes y jueves') {
      setSelectedDays(['M', 'J']);
    } else if (preset === 'Fines de semana') {
      setSelectedDays(['D', 'S']);
    } else if (preset === 'Día 15 del mes') {
      setSelectedDays([]);
    }
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
      days: selectedDays.length > 0 ? selectedDays : undefined,
      isActive: reminderToEdit ? reminderToEdit.isActive : true,
    });

    onClose();
  };

  const showDayPicker = frequency !== 'Día 15 del mes';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.backdrop}>
      <Pressable style={styles.backdropTouch} onPress={onClose} />

      <View
        style={[
          styles.container,
          isDark ? styles.containerDark : styles.containerLight,
          { paddingBottom: Math.max(insets.bottom, 16) + 8 },
        ]}>
        {/* Indicador superior de arrastre */}
        <View style={styles.dragHandle} />

        <View style={styles.header}>
          <Text style={[styles.headerTitle, isDark ? styles.textDark : styles.textLight]}>
            {isEditing ? 'Editar recordatorio' : 'Nuevo recordatorio'}
          </Text>
          <Pressable hitSlop={10} onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </Pressable>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}>
          {/* Campo: Título */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, isDark ? styles.labelDark : styles.labelLight]}>
              Título del recordatorio *
            </Text>
            <TextInput
              autoFocus={!isEditing}
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

          {/* Campo: Selector de Hora Nativo Android */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, isDark ? styles.labelDark : styles.labelLight]}>
              Hora
            </Text>

            <Pressable
              accessibilityLabel="Seleccionar hora del recordatorio"
              onPress={handleOpenTimePicker}
              style={({ pressed }) => [
                styles.timePickerCard,
                isDark ? styles.timePickerCardDark : styles.timePickerCardLight,
                pressed && styles.buttonPressed,
              ]}>
              <View style={styles.timeInfoRow}>
                <Text style={styles.clockIcon}>⏰</Text>
                <View>
                  <Text style={[styles.timeDisplay, isDark ? styles.textDark : styles.textLight]}>
                    {time}
                  </Text>
                  <Text style={[styles.timeHelper, isDark ? styles.helperDark : styles.helperLight]}>
                    Toca para cambiar la hora
                  </Text>
                </View>
              </View>

              <View style={[styles.changeBadge, isDark ? styles.changeBadgeDark : styles.changeBadgeLight]}>
                <Text style={[styles.changeBadgeText, isDark ? styles.changeBadgeTextDark : styles.changeBadgeTextLight]}>
                  Ajustar
                </Text>
              </View>
            </Pressable>

            {/* Selector para iOS / fallback */}
            {showIosPicker && Platform.OS !== 'android' && (
              <View style={styles.iosPickerContainer}>
                <DateTimePicker
                  value={parseTimeString(time)}
                  mode="time"
                  display="spinner"
                  is24Hour={false}
                  onChange={(_event, date) => {
                    setShowIosPicker(false);
                    if (date) setTime(formatTimeString(date));
                  }}
                />
              </View>
            )}
          </View>

          {/* Campo: Selector Visual de Días Estilo Android/Material */}
          {showDayPicker && (
            <View style={styles.fieldGroup}>
              <View style={styles.dayHeaderRow}>
                <Text style={[styles.fieldLabel, isDark ? styles.labelDark : styles.labelLight]}>
                  Días de repetición
                </Text>
                <View
                  style={[
                    styles.daySummaryBadge,
                    isDark ? styles.daySummaryBadgeDark : styles.daySummaryBadgeLight,
                  ]}>
                  <Text
                    style={[
                      styles.daySummaryText,
                      isDark ? styles.daySummaryTextDark : styles.daySummaryTextLight,
                    ]}>
                    {getDaysSummary(selectedDays)}
                  </Text>
                </View>
              </View>

              {/* Fila de círculos D L M X J V S */}
              <View style={styles.dayCirclesRow}>
                {WEEK_DAYS.map((day) => {
                  const isSelected = selectedDays.includes(day.key);
                  return (
                    <Pressable
                      key={day.key}
                      accessibilityLabel={day.full}
                      onPress={() => handleToggleDay(day.key)}
                      style={({ pressed }) => [
                        styles.dayCircle,
                        isSelected
                          ? styles.dayCircleSelected
                          : isDark
                          ? styles.dayCircleDark
                          : styles.dayCircleLight,
                        pressed && styles.buttonPressed,
                      ]}>
                      <Text
                        style={[
                          styles.dayCircleText,
                          isSelected
                            ? styles.dayCircleTextSelected
                            : isDark
                            ? styles.dayCircleTextDark
                            : styles.dayCircleTextLight,
                        ]}>
                        {day.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* Campo: Frecuencia / Presets */}
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
            <View style={styles.chipRow}>
              {FREQUENCY_PRESETS.map((f) => {
                const isSelected = frequency === f;
                return (
                  <Pressable
                    key={f}
                    onPress={() => handleSelectPreset(f)}
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

        {/* Botones de acción dinámicos */}
        <View style={styles.actionsRow}>
          <Pressable
            onPress={onClose}
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
            <Text style={styles.submitButtonText}>
              {isEditing ? 'Guardar cambios' : 'Guardar recordatorio'}
            </Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

export function CreateReminderModal({
  visible,
  onClose,
  onSave,
  reminderToEdit,
}: CreateReminderModalProps) {
  if (!visible) return null;

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}>
      <ReminderFormContent
        key={reminderToEdit ? reminderToEdit.id : 'new-reminder'}
        onClose={onClose}
        onSave={onSave}
        reminderToEdit={reminderToEdit}
      />
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
    maxHeight: '90%',
  },
  containerLight: {
    backgroundColor: '#FFFFFF',
  },
  containerDark: {
    backgroundColor: '#1C1F26',
  },
  dragHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#9CA3AF',
    opacity: 0.5,
    alignSelf: 'center',
    marginBottom: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
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
    marginBottom: Spacing.three,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
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
    backgroundColor: '#272B34',
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
  timePickerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  timePickerCardLight: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
  },
  timePickerCardDark: {
    backgroundColor: '#272B34',
    borderColor: '#374151',
  },
  timeInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  clockIcon: {
    fontSize: 24,
  },
  timeDisplay: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  timeHelper: {
    fontSize: 12,
    marginTop: 2,
  },
  helperLight: {
    color: '#6B7280',
  },
  helperDark: {
    color: '#9CA3AF',
  },
  changeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  changeBadgeLight: {
    backgroundColor: '#EEF2FF',
  },
  changeBadgeDark: {
    backgroundColor: '#1E293B',
  },
  changeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  changeBadgeTextLight: {
    color: '#2563EB',
  },
  changeBadgeTextDark: {
    color: '#93C5FD',
  },
  iosPickerContainer: {
    marginTop: 10,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 12,
  },
  dayHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  daySummaryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  daySummaryBadgeLight: {
    backgroundColor: '#EEF2FF',
  },
  daySummaryBadgeDark: {
    backgroundColor: '#1E293B',
  },
  daySummaryText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  daySummaryTextLight: {
    color: '#2563EB',
  },
  daySummaryTextDark: {
    color: '#93C5FD',
  },
  dayCirclesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  dayCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  dayCircleLight: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  dayCircleDark: {
    backgroundColor: '#262A34',
    borderColor: '#374151',
  },
  dayCircleSelected: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
    elevation: 2,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  dayCircleText: {
    fontSize: 14,
    fontWeight: '700',
  },
  dayCircleTextLight: {
    color: '#4B5563',
  },
  dayCircleTextDark: {
    color: '#9CA3AF',
  },
  dayCircleTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
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
    backgroundColor: '#272B34',
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
