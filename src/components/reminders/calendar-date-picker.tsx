import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  getLocalDateString,
  parseLocalDateString,
  WEEK_DAYS,
} from '@/utils/reminder-dates';

const SPANISH_MONTHS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export type CalendarPickerMode = 'date' | 'dayOfMonth';

export interface CalendarDatePickerProps {
  visible: boolean;
  mode?: CalendarPickerMode; // 'date' (para una sola vez) o 'dayOfMonth' (para mensual)
  initialDate?: string; // Formato YYYY-MM-DD para modo 'date'
  initialDayOfMonth?: number; // 1 a 31 para modo 'dayOfMonth'
  onConfirmDate?: (dateString: string) => void;
  onConfirmDayOfMonth?: (dayOfMonth: number) => void;
  onCancel: () => void;
}

interface ContentProps {
  mode: CalendarPickerMode;
  initialDate?: string;
  initialDayOfMonth?: number;
  onConfirmDate?: (dateString: string) => void;
  onConfirmDayOfMonth?: (dayOfMonth: number) => void;
  onCancel: () => void;
}

function CalendarPickerContent({
  mode,
  initialDate,
  initialDayOfMonth,
  onConfirmDate,
  onConfirmDayOfMonth,
  onCancel,
}: ContentProps) {
  const today = new Date();
  const todayDateString = getLocalDateString(today);
  const [todayYear, todayMonth, todayDay] = todayDateString.split('-').map(Number);

  // Inicializar fecha para modo 'date'
  const initialDateObj = initialDate
    ? parseLocalDateString(initialDate)
    : today;

  const [displayedYear, setDisplayedYear] = useState(initialDateObj.getFullYear());
  const [displayedMonth, setDisplayedMonth] = useState(initialDateObj.getMonth());

  // Día seleccionado en modo 'date'
  const [selectedYear, setSelectedYear] = useState(initialDateObj.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(initialDateObj.getMonth());
  const [selectedDay, setSelectedDay] = useState(initialDateObj.getDate());

  // Día seleccionado en modo 'dayOfMonth' (1 a 31)
  const [selectedDayOfMonth, setSelectedDayOfMonth] = useState<number>(
    initialDayOfMonth !== undefined ? initialDayOfMonth : today.getDate()
  );

  // Navegación de mes anterior
  const handlePrevMonth = () => {
    if (displayedMonth === 0) {
      setDisplayedMonth(11);
      setDisplayedYear((y) => y - 1);
    } else {
      setDisplayedMonth((m) => m - 1);
    }
  };

  // Navegación de mes siguiente
  const handleNextMonth = () => {
    if (displayedMonth === 11) {
      setDisplayedMonth(0);
      setDisplayedYear((y) => y + 1);
    } else {
      setDisplayedMonth((m) => m + 1);
    }
  };

  // Cálculo de días del mes y alineación en la semana (D L M X J V S)
  const firstDayIndex = new Date(displayedYear, displayedMonth, 1).getDay(); // 0 = Domingo
  const daysInMonth = new Date(displayedYear, displayedMonth + 1, 0).getDate(); // 28 - 31

  const emptyCells = Array.from({ length: firstDayIndex }, (_, i) => i);
  const dayCells = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const handleConfirm = () => {
    if (mode === 'date') {
      const mStr = selectedMonth + 1 < 10 ? `0${selectedMonth + 1}` : `${selectedMonth + 1}`;
      const dStr = selectedDay < 10 ? `0${selectedDay}` : `${selectedDay}`;
      const formatted = `${selectedYear}-${mStr}-${dStr}`;
      onConfirmDate?.(formatted);
    } else {
      onConfirmDayOfMonth?.(selectedDayOfMonth);
    }
  };

  return (
    <View style={styles.modalOverlay}>
      <Pressable style={styles.backdrop} onPress={onCancel} />

      <View style={styles.pickerCard}>
        {/* Título y modo */}
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>
            {mode === 'date' ? 'Seleccionar fecha' : 'Día de repetición mensual'}
          </Text>
          {mode === 'dayOfMonth' && (
            <Text style={styles.headerSubtitle}>
              Día {selectedDayOfMonth} de cada mes
            </Text>
          )}
        </View>

        {/* Barra de navegación de mes y año */}
        <View style={styles.monthNavRow}>
          <Pressable
            accessibilityLabel="Mes anterior"
            hitSlop={12}
            onPress={handlePrevMonth}
            style={({ pressed }) => [styles.navArrowBtn, pressed && styles.buttonPressed]}>
            <Text style={styles.navArrowText}>‹</Text>
          </Pressable>

          <Text style={styles.monthYearText}>
            {SPANISH_MONTHS[displayedMonth]} {displayedYear}
          </Text>

          <Pressable
            accessibilityLabel="Mes siguiente"
            hitSlop={12}
            onPress={handleNextMonth}
            style={({ pressed }) => [styles.navArrowBtn, pressed && styles.buttonPressed]}>
            <Text style={styles.navArrowText}>›</Text>
          </Pressable>
        </View>

        {/* Fila de encabezados de días de la semana (D L M X J V S) */}
        <View style={styles.weekDaysRow}>
          {WEEK_DAYS.map((w) => (
            <View key={w.key} style={styles.weekDayCell}>
              <Text style={styles.weekDayText}>{w.label}</Text>
            </View>
          ))}
        </View>

        {/* Cuadrícula de días del mes */}
        <View style={styles.gridContainer}>
          {/* Celdas vacías previas para alinear el primer día */}
          {emptyCells.map((val) => (
            <View key={`empty-${val}`} style={styles.dayCellWrapper} />
          ))}

          {/* Días del mes */}
          {dayCells.map((dayNum) => {
            const isToday =
              displayedYear === todayYear &&
              displayedMonth === todayMonth - 1 &&
              dayNum === todayDay;

            const isSelected =
              mode === 'date'
                ? selectedYear === displayedYear &&
                  selectedMonth === displayedMonth &&
                  selectedDay === dayNum
                : selectedDayOfMonth === dayNum;

            return (
              <View key={`day-${dayNum}`} style={styles.dayCellWrapper}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Día ${dayNum} de ${SPANISH_MONTHS[displayedMonth]}`}
                  onPress={() => {
                    if (mode === 'date') {
                      setSelectedYear(displayedYear);
                      setSelectedMonth(displayedMonth);
                      setSelectedDay(dayNum);
                    } else {
                      setSelectedDayOfMonth(dayNum);
                    }
                  }}
                  style={({ pressed }) => [
                    styles.dayCircle,
                    isSelected
                      ? styles.dayCircleSelected
                      : isToday
                      ? styles.dayCircleToday
                      : styles.dayCircleNormal,
                    pressed && styles.buttonPressed,
                  ]}>
                  <Text
                    style={[
                      styles.dayText,
                      isSelected
                        ? styles.dayTextSelected
                        : isToday
                        ? styles.dayTextToday
                        : styles.dayTextNormal,
                    ]}>
                    {dayNum}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>

        {/* Botones de acción Cancelar y Aceptar */}
        <View style={styles.actionsRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancelar"
            onPress={onCancel}
            style={({ pressed }) => [styles.actionButton, styles.cancelButton, pressed && styles.buttonPressed]}>
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Aceptar fecha"
            onPress={handleConfirm}
            style={({ pressed }) => [styles.actionButton, styles.confirmButton, pressed && styles.buttonPressed]}>
            <Text style={styles.confirmButtonText}>Aceptar</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export function CalendarDatePicker({
  visible,
  mode = 'date',
  initialDate,
  initialDayOfMonth,
  onConfirmDate,
  onConfirmDayOfMonth,
  onCancel,
}: CalendarDatePickerProps) {
  if (!visible) return null;

  // Clave que fuerza reinicio limpio cuando cambian los valores iniciales o el modo
  const keyIdentifier =
    mode === 'date'
      ? `calendar-date-${initialDate || 'today'}`
      : `calendar-day-${initialDayOfMonth ?? 'today'}`;

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onCancel}>
      <CalendarPickerContent
        key={keyIdentifier}
        mode={mode}
        initialDate={initialDate}
        initialDayOfMonth={initialDayOfMonth}
        onConfirmDate={onConfirmDate}
        onConfirmDayOfMonth={onConfirmDayOfMonth}
        onCancel={onCancel}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  pickerCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#000000',
    borderRadius: 24,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E222B',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
  },
  headerTitleRow: {
    alignItems: 'center',
    marginBottom: 14,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F9FAFB',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#60A5FA',
    fontWeight: '600',
    marginTop: 2,
  },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 8,
    marginBottom: 14,
  },
  monthYearText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E5E7EB',
  },
  navArrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1C2028',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navArrowText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#9CA3AF',
    lineHeight: 24,
  },
  weekDaysRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1E222B',
    marginBottom: 8,
  },
  weekDayCell: {
    width: '14.285%',
    alignItems: 'center',
  },
  weekDayText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
  },
  dayCellWrapper: {
    width: '14.285%',
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 1,
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleNormal: {
    backgroundColor: 'transparent',
  },
  dayCircleToday: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#3B82F6',
  },
  dayCircleSelected: {
    backgroundColor: '#2563EB',
    elevation: 3,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  dayText: {
    fontSize: 14,
    includeFontPadding: false,
  },
  dayTextNormal: {
    color: '#E5E7EB',
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
  actionsRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
    marginTop: 20,
    paddingHorizontal: 8,
  },
  actionButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#1C2028',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  confirmButton: {
    backgroundColor: '#2563EB',
    elevation: 3,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});

