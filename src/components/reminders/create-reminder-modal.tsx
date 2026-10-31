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
import { Reminder, ReminderCategory, RepeatType } from '@/types/reminder';
import {
  ALL_DAYS,
  formatDateSpanish,
  formatDaysSummary,
  getEffectiveMonthlyDay,
  isDateTimeInPast,
  WEEK_DAYS,
} from '@/utils/reminder-dates';
import { WheelTimePicker } from './wheel-time-picker';

interface CreateReminderModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (reminder: Omit<Reminder, 'id' | 'createdAt'>) => void;
  reminderToEdit?: Reminder | null;
}

const CATEGORIES: { key: ReminderCategory; label: string; icon: string }[] = [
  { key: 'salud', label: 'Salud', icon: '💊' },
  { key: 'hogar', label: 'Hogar', icon: '🌿' },
  { key: 'finanzas', label: 'Finanzas', icon: '💳' },
  { key: 'personal', label: 'Personal', icon: '⭐' },
  { key: 'general', label: 'General', icon: '📌' },
];

const REPEAT_OPTIONS: { key: RepeatType; label: string }[] = [
  { key: 'once', label: 'Una sola vez' },
  { key: 'daily', label: 'Todos los días' },
  { key: 'weekly', label: 'Días específicos' },
  { key: 'monthly', label: 'Mensualmente' },
];

interface FormContentProps {
  onClose: () => void;
  onSave: (reminder: Omit<Reminder, 'id' | 'createdAt'>) => void;
  reminderToEdit?: Reminder | null;
}

function ReminderFormContent({ onClose, onSave, reminderToEdit }: FormContentProps) {
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const isEditing = Boolean(reminderToEdit);

  // Campos principales
  const [title, setTitle] = useState(reminderToEdit?.title ?? '');
  const [time, setTime] = useState(reminderToEdit?.time ?? '08:00 AM');
  const [category, setCategory] = useState<ReminderCategory>(
    reminderToEdit?.category ?? 'salud'
  );

  // Tipo de repetición (migrado o por defecto)
  const initialRepeatType: RepeatType =
    reminderToEdit?.repeatType ??
    (reminderToEdit?.frequency?.toLowerCase().includes('mes')
      ? 'monthly'
      : reminderToEdit?.days && reminderToEdit.days.length < 7
      ? 'weekly'
      : 'daily');

  const [repeatType, setRepeatType] = useState<RepeatType>(initialRepeatType);

  // Días para repetición semanal
  const [selectedDays, setSelectedDays] = useState<string[]>(
    reminderToEdit?.days ?? ['L', 'M', 'X', 'J', 'V']
  );

  // Día del mes para repetición mensual (1 - 31)
  const [dayOfMonth, setDayOfMonth] = useState<number>(
    reminderToEdit?.dayOfMonth ?? 15
  );

  // Fecha para "Una sola vez" (YYYY-MM-DD)
  const todayFormatted = new Date().toISOString().split('T')[0];
  const [targetDate, setTargetDate] = useState<string>(
    reminderToEdit?.targetDate ?? todayFormatted
  );

  // Errores de validación
  const [titleError, setTitleError] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Estado para el selector de hora WheelTimePicker estilo Samsung One UI
  const [showWheelPicker, setShowWheelPicker] = useState(false);
  const [showIosDatePicker, setShowIosDatePicker] = useState(false);

  // Abrir WheelTimePicker personalizado
  const handleOpenTimePicker = () => {
    setShowWheelPicker(true);
  };

  // Selector de Calendario para "Una sola vez"
  const handleOpenCalendarOnce = () => {
    const [y, m, d] = targetDate.split('-').map(Number);
    const currentDate = new Date(y, m - 1, d);

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: currentDate,
        onChange: (event: DateTimePickerEvent, selectedDate?: Date) => {
          if (event.type === 'set' && selectedDate) {
            const formatted = selectedDate.toISOString().split('T')[0];
            setTargetDate(formatted);
            if (validationError) setValidationError(null);
          }
        },
        mode: 'date',
        display: 'calendar',
      });
    } else {
      setShowIosDatePicker(true);
    }
  };

  // Selector de Calendario para "Mensualmente" (elige día del mes 1..31)
  const handleOpenCalendarMonthly = () => {
    const today = new Date();
    const currentDate = new Date(today.getFullYear(), today.getMonth(), Math.min(dayOfMonth, 28));

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: currentDate,
        onChange: (event: DateTimePickerEvent, selectedDate?: Date) => {
          if (event.type === 'set' && selectedDate) {
            setDayOfMonth(selectedDate.getDate());
            if (validationError) setValidationError(null);
          }
        },
        mode: 'date',
        display: 'calendar',
      });
    } else {
      setShowIosDatePicker(true);
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
    if (validationError && nextDays.length > 0) {
      setValidationError(null);
    }
  };

  const handleSubmit = () => {
    // 1. Validar título
    if (!title.trim()) {
      setTitleError(true);
      return;
    }

    // 2. Validar días si es semanal
    if (repeatType === 'weekly' && selectedDays.length === 0) {
      setValidationError('Debes seleccionar al menos un día de la semana.');
      return;
    }

    // 3. Validar fecha y hora futura si es "Una sola vez"
    if (repeatType === 'once') {
      if (isDateTimeInPast(targetDate, time)) {
        setValidationError(
          'No puedes guardar un recordatorio en una fecha u hora que ya ha pasado.'
        );
        return;
      }
    }

    // Construir texto legible de frecuencia para la tarjeta
    let computedFrequency = 'Todos los días';
    let computedDays: string[] | undefined;
    let computedDayOfMonth: number | undefined;
    let computedTargetDate: string | undefined;

    if (repeatType === 'once') {
      computedFrequency = `Una vez (${formatDateSpanish(targetDate)})`;
      computedTargetDate = targetDate;
    } else if (repeatType === 'daily') {
      computedFrequency = 'Todos los días';
      computedDays = ALL_DAYS;
    } else if (repeatType === 'weekly') {
      computedFrequency = formatDaysSummary(selectedDays);
      computedDays = selectedDays;
    } else if (repeatType === 'monthly') {
      computedFrequency = `Cada día ${dayOfMonth} del mes`;
      computedDayOfMonth = dayOfMonth;
    }

    onSave({
      title: title.trim(),
      time: time.trim() || '08:00 AM',
      frequency: computedFrequency,
      repeatType,
      days: computedDays,
      dayOfMonth: computedDayOfMonth,
      targetDate: computedTargetDate,
      category,
      isActive: reminderToEdit ? reminderToEdit.isActive : true,
    });

    onClose();
  };

  const effectiveMonthlyDay = getEffectiveMonthlyDay(dayOfMonth);

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
        {/* Indicador de arrastre */}
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
          {/* Mensaje de error general si aplica */}
          {validationError && (
            <View style={styles.validationErrorBox}>
              <Text style={styles.validationErrorText}>⚠️ {validationError}</Text>
            </View>
          )}

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
                titleError && styles.inputError,
              ]}
              value={title}
              onChangeText={(text) => {
                setTitle(text);
                if (titleError && text.trim()) setTitleError(false);
              }}
            />
            {titleError && (
              <Text style={styles.errorText}>Por favor introduce un título para el recordatorio.</Text>
            )}
          </View>

          {/* Sección: Hora del Recordatorio */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, isDark ? styles.labelDark : styles.labelLight]}>
              Hora
            </Text>

            <Pressable
              accessibilityLabel="Seleccionar hora del recordatorio"
              onPress={handleOpenTimePicker}
              style={({ pressed }) => [
                styles.timePickerCard,
                isDark ? styles.cardElementDark : styles.cardElementLight,
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

              <View
                style={[
                  styles.changeBadge,
                  isDark ? styles.changeBadgeDark : styles.changeBadgeLight,
                ]}>
                <Text
                  style={[
                    styles.changeBadgeText,
                    isDark ? styles.changeBadgeTextDark : styles.changeBadgeTextLight,
                  ]}>
                  Ajustar
                </Text>
              </View>
            </Pressable>

            {/* Selector de hora WheelTimePicker estilo Samsung One UI */}
            <WheelTimePicker
              visible={showWheelPicker}
              initialTime={time}
              onConfirm={(newTime) => {
                setTime(newTime);
                setShowWheelPicker(false);
                if (validationError) setValidationError(null);
              }}
              onCancel={() => setShowWheelPicker(false)}
            />
          </View>

          {/* ÚNICA Sección: Repetición */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, isDark ? styles.labelDark : styles.labelLight]}>
              Repetición
            </Text>

            {/* 4 Opciones principales de repetición */}
            <View style={styles.repeatOptionsGrid}>
              {REPEAT_OPTIONS.map((opt) => {
                const isSelected = repeatType === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    onPress={() => {
                      setRepeatType(opt.key);
                      if (validationError) setValidationError(null);
                    }}
                    style={({ pressed }) => [
                      styles.repeatOptionChip,
                      isSelected
                        ? styles.repeatOptionChipSelected
                        : isDark
                        ? styles.cardElementDark
                        : styles.cardElementLight,
                      pressed && styles.buttonPressed,
                    ]}>
                    <Text
                      style={[
                        styles.repeatOptionText,
                        isSelected
                          ? styles.repeatOptionTextSelected
                          : isDark
                          ? styles.textDark
                          : styles.textLight,
                      ]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Subpantalla según la repetición elegida */}

            {/* Caso 1: Una sola vez -> Selector de Fecha */}
            {repeatType === 'once' && (
              <View style={[styles.subSectionBox, isDark ? styles.cardElementDark : styles.cardElementLight]}>
                <View style={styles.subSectionHeader}>
                  <Text style={[styles.subSectionTitle, isDark ? styles.textDark : styles.textLight]}>
                    Fecha del recordatorio
                  </Text>
                  <Text style={[styles.subSectionHelp, isDark ? styles.helperDark : styles.helperLight]}>
                    No se repetirá
                  </Text>
                </View>

                <Pressable
                  onPress={handleOpenCalendarOnce}
                  style={({ pressed }) => [
                    styles.dateSelectBtn,
                    isDark ? styles.innerButtonDark : styles.innerButtonLight,
                    pressed && styles.buttonPressed,
                  ]}>
                  <Text style={styles.calendarIcon}>📅</Text>
                  <Text style={[styles.dateSelectText, isDark ? styles.textDark : styles.textLight]}>
                    {formatDateSpanish(targetDate)}
                  </Text>
                  <View style={styles.editDatePill}>
                    <Text style={styles.editDatePillText}>Cambiar fecha</Text>
                  </View>
                </Pressable>
              </View>
            )}

            {/* Caso 2: Todos los días -> Resumen directo sin círculos */}
            {repeatType === 'daily' && (
              <View style={[styles.subSectionBox, isDark ? styles.cardElementDark : styles.cardElementLight]}>
                <View style={styles.dailyInfoRow}>
                  <Text style={styles.dailyIcon}>🔄</Text>
                  <View>
                    <Text style={[styles.dailyTitle, isDark ? styles.textDark : styles.textLight]}>
                      Repetición diaria
                    </Text>
                    <Text style={[styles.dailySubtitle, isDark ? styles.helperDark : styles.helperLight]}>
                      Sonarás todos los días de la semana a las {time}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Caso 3: Días específicos de la semana -> Fila interactiva D L M X J V S (Estilo Samsung) */}
            {repeatType === 'weekly' && (
              <View style={[styles.subSectionBox, isDark ? styles.cardElementDark : styles.cardElementLight]}>
                <View style={styles.weeklyHeaderRow}>
                  <Text
                    numberOfLines={1}
                    style={[styles.weeklySummaryText, isDark ? styles.textDark : styles.textLight]}>
                    {formatDaysSummary(selectedDays)}
                  </Text>
                  <Text style={styles.calendarIconSmall}>📅</Text>
                </View>

                {/* 7 círculos interactivos D L M X J V S */}
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
                            ? styles.dayCircleUnselectedDark
                            : styles.dayCircleUnselectedLight,
                          pressed && styles.buttonPressed,
                        ]}>
                        <Text
                          style={[
                            styles.dayCircleText,
                            isSelected
                              ? styles.dayCircleTextSelected
                              : isDark
                              ? styles.textDark
                              : styles.textLight,
                          ]}>
                          {day.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Caso 4: Mensualmente -> Selector de día 1..31 con calendario nativo */}
            {repeatType === 'monthly' && (
              <View style={[styles.subSectionBox, isDark ? styles.cardElementDark : styles.cardElementLight]}>
                <View style={styles.subSectionHeader}>
                  <Text style={[styles.subSectionTitle, isDark ? styles.textDark : styles.textLight]}>
                    Repetición mensual
                  </Text>
                  <Text style={[styles.subSectionHelp, isDark ? styles.helperDark : styles.helperLight]}>
                    Día {dayOfMonth} de cada mes
                  </Text>
                </View>

                <Pressable
                  onPress={handleOpenCalendarMonthly}
                  style={({ pressed }) => [
                    styles.dateSelectBtn,
                    isDark ? styles.innerButtonDark : styles.innerButtonLight,
                    pressed && styles.buttonPressed,
                  ]}>
                  <Text style={styles.calendarIcon}>📅</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.dateSelectText, isDark ? styles.textDark : styles.textLight]}>
                      Cada día {dayOfMonth} del mes
                    </Text>
                    {effectiveMonthlyDay !== dayOfMonth && (
                      <Text style={styles.effectiveDayNotice}>
                        * En este mes se usará el día {effectiveMonthlyDay} (último día)
                      </Text>
                    )}
                  </View>
                  <View style={styles.editDatePill}>
                    <Text style={styles.editDatePillText}>Elegir en calendario</Text>
                  </View>
                </Pressable>
              </View>
            )}

            {/* Fallback de selector de fecha iOS para Una sola vez / Mensual */}
            {showIosDatePicker && Platform.OS !== 'android' && (
              <View style={styles.iosPickerContainer}>
                <DateTimePicker
                  value={new Date()}
                  mode="date"
                  display="calendar"
                  onChange={(_event, date) => {
                    setShowIosDatePicker(false);
                    if (date) {
                      if (repeatType === 'once') {
                        setTargetDate(date.toISOString().split('T')[0]);
                      } else if (repeatType === 'monthly') {
                        setDayOfMonth(date.getDate());
                      }
                    }
                  }}
                />
              </View>
            )}
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
                        ? styles.cardElementDark
                        : styles.cardElementLight,
                    ]}>
                    <Text style={styles.categoryChipIcon}>{cat.icon}</Text>
                    <Text
                      style={[
                        styles.chipText,
                        isSelected
                          ? styles.chipTextSelected
                          : isDark
                          ? styles.textDark
                          : styles.textLight,
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
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
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
    maxHeight: '92%',
  },
  containerLight: {
    backgroundColor: '#FFFFFF',
  },
  containerDark: {
    backgroundColor: '#121418',
  },
  dragHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#9CA3AF',
    opacity: 0.4,
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
  validationErrorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: Spacing.three,
  },
  validationErrorText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
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
    backgroundColor: '#1E222A',
    borderColor: '#2F3542',
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
  cardElementLight: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
    borderWidth: 1,
  },
  cardElementDark: {
    backgroundColor: '#1C2028',
    borderColor: '#2B323F',
    borderWidth: 1,
  },
  timePickerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
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
    fontSize: 20,
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
    backgroundColor: '#262D3D',
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
  repeatOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  repeatOptionChip: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  repeatOptionChipSelected: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
    borderWidth: 1,
  },
  repeatOptionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  repeatOptionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  subSectionBox: {
    padding: 14,
    borderRadius: 20,
    marginTop: 4,
  },
  subSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  subSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  subSectionHelp: {
    fontSize: 12,
  },
  dateSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 10,
  },
  innerButtonLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderWidth: 1,
  },
  innerButtonDark: {
    backgroundColor: '#242A36',
    borderColor: '#374151',
    borderWidth: 1,
  },
  calendarIcon: {
    fontSize: 18,
  },
  calendarIconSmall: {
    fontSize: 16,
  },
  dateSelectText: {
    fontSize: 14,
    fontWeight: '700',
  },
  editDatePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
  },
  editDatePillText: {
    fontSize: 11,
    color: '#2563EB',
    fontWeight: '700',
  },
  effectiveDayNotice: {
    fontSize: 11,
    color: '#F59E0B',
    marginTop: 2,
    fontWeight: '500',
  },
  dailyInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dailyIcon: {
    fontSize: 22,
  },
  dailyTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  dailySubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  weeklyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  weeklySummaryText: {
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
    marginRight: 8,
  },
  dayCirclesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleSelected: {
    backgroundColor: '#818CF8', // Tono lavanda/azul suave como la referencia de Samsung
  },
  dayCircleUnselectedLight: {
    backgroundColor: 'transparent',
  },
  dayCircleUnselectedDark: {
    backgroundColor: 'transparent',
  },
  dayCircleText: {
    fontSize: 14,
    fontWeight: '700',
  },
  dayCircleTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    gap: 4,
  },
  chipSelected: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
    borderWidth: 1,
  },
  categoryChipIcon: {
    fontSize: 13,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
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
