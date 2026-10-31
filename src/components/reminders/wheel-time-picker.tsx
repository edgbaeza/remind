import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const ITEM_HEIGHT = 64;
const VISIBLE_ITEMS = 3;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1); // [1, 2, ..., 12]
const MINUTES = Array.from({ length: 60 }, (_, i) => (i < 10 ? `0${i}` : `${i}`)); // ['00', '01', ..., '59']
const PERIODS: ('a.m.' | 'p.m.')[] = ['a.m.', 'p.m.'];

export interface WheelTimePickerProps {
  visible: boolean;
  initialTime: string; // "08:00 AM", "6:00 PM", "12:00 AM", etc.
  onConfirm: (formattedTime: string) => void;
  onCancel: () => void;
}

interface WheelColumnProps<T> {
  data: T[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  formatLabel?: (item: T) => string;
  width?: number;
}

function WheelColumn<T extends string | number>({
  data,
  selectedIndex,
  onSelect,
  formatLabel,
  width = 76,
}: WheelColumnProps<T>) {
  const listRef = useRef<FlatList>(null);
  const isUserScrolling = useRef(false);

  useEffect(() => {
    if (!isUserScrolling.current) {
      listRef.current?.scrollToOffset({
        offset: selectedIndex * ITEM_HEIGHT,
        animated: false,
      });
    }
  }, [selectedIndex]);

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    isUserScrolling.current = false;
    const offsetY = e.nativeEvent.contentOffset.y;
    const index = Math.round(offsetY / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(data.length - 1, index));
    if (clamped !== selectedIndex) {
      onSelect(clamped);
    }
  };

  return (
    <View style={[styles.columnWrapper, { width }]}>
      <FlatList
        ref={listRef}
        data={data}
        keyExtractor={(_, index) => index.toString()}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        bounces={false}
        contentContainerStyle={styles.columnContent}
        initialScrollIndex={selectedIndex}
        getItemLayout={(_, index) => ({
          length: ITEM_HEIGHT,
          offset: ITEM_HEIGHT * index,
          index,
        })}
        onScrollBeginDrag={() => {
          isUserScrolling.current = true;
        }}
        onScrollEndDrag={handleScrollEnd}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            listRef.current?.scrollToIndex({ index: info.index, animated: false });
          }, 30);
        }}
        renderItem={({ item, index }) => {
          const isSelected = index === selectedIndex;
          const label = formatLabel ? formatLabel(item) : `${item}`;

          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${label}`}
              onPress={() => {
                listRef.current?.scrollToOffset({
                  offset: index * ITEM_HEIGHT,
                  animated: true,
                });
                onSelect(index);
              }}
              style={styles.itemContainer}>
              <Text
                style={[
                  styles.itemText,
                  isSelected ? styles.itemTextSelected : styles.itemTextDimmed,
                ]}>
                {label}
              </Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

/**
 * Convierte cualquier string de hora ("08:00 AM", "6:00 PM", "12:00 AM")
 * a estado interno seguro en formato 24 horas y sus componentes 12h correspondientes.
 */
function parseTimeToState(timeStr: string): { hour12: number; minute: number; period: 'a.m.' | 'p.m.' } {
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM|a\.?\s*m\.?|p\.?\s*m\.?)?$/i);
  let hours24 = 8;
  let minutes = 0;

  if (match) {
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const ampm = match[3]?.toLowerCase();

    const isPM = ampm && (ampm.includes('p') || ampm === 'pm');
    const isAM = ampm && (ampm.includes('a') || ampm === 'am');

    if (isPM && h < 12) h += 12;
    if (isAM && h === 12) h = 0;

    hours24 = Math.max(0, Math.min(23, h));
    minutes = Math.max(0, Math.min(59, m));
  }

  // De 24h a 12h
  const isPM = hours24 >= 12;
  let hour12 = hours24 % 12;
  if (hour12 === 0) hour12 = 12;

  return {
    hour12,
    minute: minutes,
    period: isPM ? 'p.m.' : 'a.m.',
  };
}

/**
 * Convierte la selección de 12 horas a string final formateado para Remind: "08:00 AM" / "12:00 PM"
 */
function formatSelectedTime(hour12: number, minute: number, period: 'a.m.' | 'p.m.'): string {
  const ampm = period === 'p.m.' ? 'PM' : 'AM';
  const hStr = hour12 < 10 ? `0${hour12}` : `${hour12}`;
  const mStr = minute < 10 ? `0${minute}` : `${minute}`;
  return `${hStr}:${mStr} ${ampm}`;
}

interface ContentProps {
  initialTime: string;
  onConfirm: (formattedTime: string) => void;
  onCancel: () => void;
}

function WheelPickerContent({ initialTime, onConfirm, onCancel }: ContentProps) {
  const parsed = parseTimeToState(initialTime);

  const [selectedHour, setSelectedHour] = useState(parsed.hour12);
  const [selectedMinute, setSelectedMinute] = useState(parsed.minute);
  const [selectedPeriod, setSelectedPeriod] = useState<'a.m.' | 'p.m.'>(parsed.period);

  const hourIndex = Math.max(0, HOURS.indexOf(selectedHour));
  const minuteIndex = Math.max(0, selectedMinute);
  const periodIndex = selectedPeriod === 'p.m.' ? 1 : 0;

  const handleConfirm = () => {
    const formatted = formatSelectedTime(selectedHour, selectedMinute, selectedPeriod);
    onConfirm(formatted);
  };

  return (
    <View style={styles.modalOverlay}>
      <Pressable style={styles.backdrop} onPress={onCancel} />

      <View style={styles.pickerCard}>
        <Text style={styles.headerTitle}>Establecer hora</Text>

        {/* Área principal de ruedas verticales estilo Samsung One UI */}
        <View style={styles.wheelsContainer}>
          {/* Rueda de Horas (1-12) */}
          <WheelColumn
            data={HOURS}
            selectedIndex={hourIndex}
            onSelect={(idx) => setSelectedHour(HOURS[idx])}
            width={80}
          />

          {/* Separador de dos puntos ":" */}
          <View style={styles.colonContainer}>
            <Text style={styles.colonText}>:</Text>
          </View>

          {/* Rueda de Minutos (00-59) */}
          <WheelColumn
            data={MINUTES}
            selectedIndex={minuteIndex}
            onSelect={(idx) => setSelectedMinute(parseInt(MINUTES[idx], 10))}
            width={80}
          />

          {/* Rueda de AM / PM */}
          <WheelColumn
            data={PERIODS}
            selectedIndex={periodIndex}
            onSelect={(idx) => setSelectedPeriod(PERIODS[idx])}
            width={90}
          />
        </View>

        {/* Botones de Cancelar y Aceptar */}
        <View style={styles.actionsRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancelar selección de hora"
            onPress={onCancel}
            style={({ pressed }) => [styles.actionButton, styles.cancelButton, pressed && styles.buttonPressed]}>
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Aceptar hora seleccionada"
            onPress={handleConfirm}
            style={({ pressed }) => [styles.actionButton, styles.confirmButton, pressed && styles.buttonPressed]}>
            <Text style={styles.confirmButtonText}>Aceptar</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export function WheelTimePicker({
  visible,
  initialTime,
  onConfirm,
  onCancel,
}: WheelTimePickerProps) {
  if (!visible) return null;

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onCancel}>
      <WheelPickerContent
        key={initialTime}
        initialTime={initialTime}
        onConfirm={onConfirm}
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
    padding: 20,
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
    paddingVertical: 24,
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#E5E7EB',
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  wheelsContainer: {
    height: PICKER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  columnWrapper: {
    height: PICKER_HEIGHT,
  },
  columnContent: {
    paddingVertical: ITEM_HEIGHT,
  },
  colonContainer: {
    height: PICKER_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    width: 24,
  },
  colonText: {
    fontSize: 42,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 46,
    marginBottom: 4,
  },
  itemContainer: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemText: {
    textAlign: 'center',
    includeFontPadding: false,
  },
  itemTextSelected: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  itemTextDimmed: {
    fontSize: 32,
    fontWeight: '600',
    color: '#4B5563',
    opacity: 0.5,
  },
  actionsRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
    marginTop: 24,
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
