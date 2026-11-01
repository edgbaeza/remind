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

import {
  BASE_HOURS,
  BASE_MINUTES,
  formatSelectedTime,
  HOURS_DATA,
  HOURS_MIDDLE_CYCLE,
  ITEM_HEIGHT,
  MINUTES_DATA,
  MINUTES_MIDDLE_CYCLE,
  parseTimeToState,
  PERIODS,
  PICKER_HEIGHT,
  shouldRecenter,
} from '@/utils/wheel-time-utils';

export {
  BASE_HOURS,
  BASE_MINUTES,
  formatSelectedTime,
  HOURS_DATA,
  HOURS_MIDDLE_CYCLE,
  ITEM_HEIGHT,
  MINUTES_DATA,
  MINUTES_MIDDLE_CYCLE,
  parseTimeToState,
  PERIODS,
  PICKER_HEIGHT,
};

export interface WheelTimePickerProps {
  visible: boolean;
  initialTime: string; // "08:00 AM", "6:00 PM", "12:00 AM", etc.
  onConfirm: (formattedTime: string) => void;
  onCancel: () => void;
}

interface WheelColumnProps<T> {
  data: T[];
  baseCount: number;
  selectedBaseIndex: number;
  onSelectBaseIndex: (index: number) => void;
  isInfinite?: boolean;
  middleCycle?: number;
  minCycleRecenteringThreshold?: number;
  maxCycleRecenteringThreshold?: number;
  formatLabel?: (item: T) => string;
  width?: number;
}

function WheelColumn<T extends string | number>({
  data,
  baseCount,
  selectedBaseIndex,
  onSelectBaseIndex,
  isInfinite = false,
  middleCycle = 0,
  minCycleRecenteringThreshold = 15,
  maxCycleRecenteringThreshold = 45,
  formatLabel,
  width = 76,
}: WheelColumnProps<T>) {
  const initialFullIndex = isInfinite
    ? middleCycle * baseCount + selectedBaseIndex
    : selectedBaseIndex;

  const [currentCenterIndex, setCurrentCenterIndex] = useState(initialFullIndex);
  const listRef = useRef<FlatList>(null);
  const isDraggingRef = useRef(false);
  const isMomentumRef = useRef(false);
  const dragEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Asegura la alineación inicial al montar
  useEffect(() => {
    listRef.current?.scrollToOffset({
      offset: initialFullIndex * ITEM_HEIGHT,
      animated: false,
    });

    return () => {
      if (dragEndTimerRef.current) {
        clearTimeout(dragEndTimerRef.current);
      }
    };
  }, [initialFullIndex]);

  /**
   * Finaliza el desplazamiento, actualiza el valor seleccionado
   * y recentra silenciosamente si la rueda infinita se alejó del centro.
   */
  const settle = (offsetY: number) => {
    const rawIndex = Math.round(offsetY / ITEM_HEIGHT);
    const clampedIndex = Math.max(0, Math.min(data.length - 1, rawIndex));

    // Ajuste pixel-perfect al intervalo más cercano
    listRef.current?.scrollToOffset({
      offset: clampedIndex * ITEM_HEIGHT,
      animated: false,
    });

    setCurrentCenterIndex(clampedIndex);

    // Actualiza el valor base en el componente padre
    const baseIndex = clampedIndex % baseCount;
    onSelectBaseIndex(baseIndex);

    // Recentrado silencioso para ruedas infinitas
    if (isInfinite) {
      const currentCycle = Math.floor(clampedIndex / baseCount);
      if (shouldRecenter(currentCycle, minCycleRecenteringThreshold, maxCycleRecenteringThreshold)) {
        const recenterIndex = middleCycle * baseCount + baseIndex;
        listRef.current?.scrollToOffset({
          offset: recenterIndex * ITEM_HEIGHT,
          animated: false,
        });
        setCurrentCenterIndex(recenterIndex);
      }
    }
  };

  /**
   * Actualiza el elemento central visualmente mientras la rueda gira con inercia
   */
  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = e.nativeEvent.contentOffset.y;
    const rawIndex = Math.round(offsetY / ITEM_HEIGHT);
    const clampedIndex = Math.max(0, Math.min(data.length - 1, rawIndex));
    if (clampedIndex !== currentCenterIndex) {
      setCurrentCenterIndex(clampedIndex);
    }
  };

  const handleScrollBeginDrag = () => {
    isDraggingRef.current = true;
    isMomentumRef.current = false;
    if (dragEndTimerRef.current) {
      clearTimeout(dragEndTimerRef.current);
      dragEndTimerRef.current = null;
    }
  };

  const handleScrollEndDrag = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    isDraggingRef.current = false;
    const velocity = Math.abs(e.nativeEvent.velocity?.y || 0);

    // Si la velocidad fue baja, no habrá inercia o será instantánea.
    // Programamos un breve temporizador de respaldo en caso de que no inicie momentum.
    if (velocity < 0.1) {
      if (dragEndTimerRef.current) {
        clearTimeout(dragEndTimerRef.current);
      }
      dragEndTimerRef.current = setTimeout(() => {
        if (!isMomentumRef.current && !isDraggingRef.current) {
          settle(e.nativeEvent.contentOffset.y);
        }
      }, 100);
    }
  };

  const handleMomentumScrollBegin = () => {
    isMomentumRef.current = true;
    if (dragEndTimerRef.current) {
      clearTimeout(dragEndTimerRef.current);
      dragEndTimerRef.current = null;
    }
  };

  const handleMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    isMomentumRef.current = false;
    settle(e.nativeEvent.contentOffset.y);
  };

  return (
    <View style={[styles.columnWrapper, { width }]}>
      <FlatList
        ref={listRef}
        data={data}
        keyExtractor={(_, index) => index.toString()}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        snapToAlignment="start"
        decelerationRate={0.98}
        disableIntervalMomentum={false}
        bounces={false}
        scrollEventThrottle={16}
        contentContainerStyle={styles.columnContent}
        initialScrollIndex={initialFullIndex}
        getItemLayout={(_, index) => ({
          length: ITEM_HEIGHT,
          offset: ITEM_HEIGHT * index,
          index,
        })}
        windowSize={5}
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        removeClippedSubviews={false}
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleScrollEndDrag}
        onMomentumScrollBegin={handleMomentumScrollBegin}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            listRef.current?.scrollToOffset({
              offset: info.index * ITEM_HEIGHT,
              animated: false,
            });
          }, 30);
        }}
        renderItem={({ item, index }) => {
          const isSelected = index === currentCenterIndex;
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
                setTimeout(() => {
                  settle(index * ITEM_HEIGHT);
                }, 280);
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

  const hourBaseIndex = Math.max(0, BASE_HOURS.indexOf(selectedHour));
  const minuteBaseIndex = Math.max(0, selectedMinute);
  const periodBaseIndex = selectedPeriod === 'p.m.' ? 1 : 0;

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
          {/* Rueda circular infinita de Horas (1-12) */}
          <WheelColumn
            data={HOURS_DATA}
            baseCount={12}
            selectedBaseIndex={hourBaseIndex}
            onSelectBaseIndex={(idx) => setSelectedHour(BASE_HOURS[idx])}
            isInfinite={true}
            middleCycle={HOURS_MIDDLE_CYCLE}
            minCycleRecenteringThreshold={20}
            maxCycleRecenteringThreshold={100}
            width={80}
          />

          {/* Separador de dos puntos ":" */}
          <View style={styles.colonContainer}>
            <Text style={styles.colonText}>:</Text>
          </View>

          {/* Rueda circular infinita de Minutos (00-59) */}
          <WheelColumn
            data={MINUTES_DATA}
            baseCount={60}
            selectedBaseIndex={minuteBaseIndex}
            onSelectBaseIndex={(idx) => setSelectedMinute(parseInt(BASE_MINUTES[idx], 10))}
            isInfinite={true}
            middleCycle={MINUTES_MIDDLE_CYCLE}
            minCycleRecenteringThreshold={10}
            maxCycleRecenteringThreshold={50}
            width={80}
          />

          {/* Rueda de AM / PM */}
          <WheelColumn
            data={PERIODS}
            baseCount={2}
            selectedBaseIndex={periodBaseIndex}
            onSelectBaseIndex={(idx) => setSelectedPeriod(PERIODS[idx])}
            isInfinite={false}
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
