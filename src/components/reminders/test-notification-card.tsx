import { SymbolView } from 'expo-symbols';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  addNotificationReceivedListener,
  cancelNotification,
  getAllScheduledNotifications,
  getNextMonthlyTriggerDate,
  scheduleTestNotification,
  setupNotificationChannel,
} from '@/services/notification-service';
import {
  calculateMonthlyOccurrences,
  formatDateSpanish,
} from '@/utils/reminder-dates';

interface ScheduledInspectionItem {
  index: number;
  title: string;
  tag: string;
  idSnippet: string;
  fullId: string;
}

interface MonthlyPreviewData {
  next28: string;
  dates31: { index: number; formatted: string; effectiveDay: number }[];
}

export function TestNotificationCard() {
  const [scheduledId, setScheduledId] = useState<string | null>(null);
  const [isScheduling, setIsScheduling] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  // Estado para resultados de inspección del sistema (evita truncamiento en listas largas)
  const [isInspecting, setIsInspecting] = useState(false);
  const [scheduledItems, setScheduledItems] = useState<ScheduledInspectionItem[] | null>(null);

  // Estado para resultados de fechas mensuales
  const [isLoadingMonthly, setIsLoadingMonthly] = useState(false);
  const [monthlyPreview, setMonthlyPreview] = useState<MonthlyPreviewData | null>(null);

  // Marca de tiempo absoluta para calcular el tiempo restante sin depender de ticks de segundo plano
  const targetTimestampRef = useRef<number | null>(null);

  // Sincroniza el tiempo restante con el reloj real (Date.now())
  const syncRemainingTime = useCallback(() => {
    if (!targetTimestampRef.current) {
      return;
    }
    const remaining = Math.max(0, Math.ceil((targetTimestampRef.current - Date.now()) / 1000));
    if (remaining <= 0) {
      targetTimestampRef.current = null;
      setScheduledId(null);
      setSecondsRemaining(null);
      setStatusMessage({
        type: 'info',
        text: 'El tiempo de espera expiró. La notificación debe haber aparecido en tu barra de estado.',
      });
    } else {
      setSecondsRemaining(remaining);
    }
  }, []);

  // Inicialización de canales y escucha de notificaciones en primer plano
  useEffect(() => {
    setupNotificationChannel();

    const subscription = addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data;
      if (data && data.type === 'test_notification') {
        targetTimestampRef.current = null;
        setStatusMessage({
          type: 'success',
          text: '¡Notificación recibida exitosamente en la aplicación!',
        });
        setScheduledId(null);
        setSecondsRemaining(null);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Detecta cuando la aplicación regresa a primer plano (desbloqueo de pantalla / cambio de app)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        syncRemainingTime();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [syncRemainingTime]);

  // Actualización periódica en primer plano basada en el reloj absoluto
  useEffect(() => {
    if (!scheduledId) {
      return;
    }

    const interval = setInterval(() => {
      syncRemainingTime();
    }, 500);

    return () => {
      clearInterval(interval);
    };
  }, [scheduledId, syncRemainingTime]);

  const handleSchedule = async () => {
    if (isScheduling || scheduledId) {
      return;
    }

    setIsScheduling(true);
    setStatusMessage(null);

    const result = await scheduleTestNotification(60);
    setIsScheduling(false);

    if (result.success && result.notificationId) {
      targetTimestampRef.current = Date.now() + 60 * 1000;
      setScheduledId(result.notificationId);
      setSecondsRemaining(60);
      setStatusMessage({
        type: 'success',
        text: 'Notificación programada para dentro de 60 segundos.',
      });
    } else if (result.error === 'PERMISSION_DENIED') {
      targetTimestampRef.current = null;
      const errorMsg =
        result.errorMessage ||
        'Permiso de notificaciones denegado. Para probarlas, habilita las notificaciones en Ajustes de Android.';
      setStatusMessage({
        type: 'error',
        text: errorMsg,
      });
      Alert.alert(
        'Permiso de notificaciones necesario',
        'Remind requiere permiso para mostrar notificaciones. Por favor, actívalas en la configuración de la app en Android.',
        [{ text: 'Entendido' }]
      );
    } else {
      targetTimestampRef.current = null;
      setStatusMessage({
        type: 'error',
        text: `Error al programar: ${result.errorMessage || 'Error desconocido'}`,
      });
    }
  };

  const handleCancel = async () => {
    if (!scheduledId) return;

    const idToCancel = scheduledId;
    targetTimestampRef.current = null;
    setScheduledId(null);
    setSecondsRemaining(null);

    const success = await cancelNotification(idToCancel);
    if (success) {
      setStatusMessage({
        type: 'info',
        text: 'La notificación de prueba fue cancelada correctamente.',
      });
    }
  };

  const handleInspectScheduled = async () => {
    if (isInspecting) return;
    setIsInspecting(true);
    try {
      const list = await getAllScheduledNotifications();
      const parsed: ScheduledInspectionItem[] = list.map((item, index) => {
        const title = item.content.title || '(Sin título)';
        const idSnippet = item.identifier.slice(0, 8);
        const data = item.content.data as
          | { repeatType?: string; dayKey?: string; dayOfMonth?: number; mode?: string }
          | undefined;
        let tag = 'Sistema';
        if (data?.repeatType === 'weekly' && data.dayKey) {
          tag = `Semanal • ${data.dayKey}`;
        } else if (data?.repeatType === 'daily') {
          tag = 'Diario';
        } else if (data?.repeatType === 'once') {
          tag = 'Una vez';
        } else if (data?.repeatType === 'monthly') {
          tag =
            data.mode === 'native_monthly'
              ? `Mensual • Día ${data.dayOfMonth}`
              : `Mensual • D${data.dayOfMonth}`;
        }
        return {
          index: index + 1,
          title,
          tag,
          idSnippet,
          fullId: item.identifier,
        };
      });
      setScheduledItems(parsed);
    } finally {
      setIsInspecting(false);
    }
  };

  const handlePreviewMonthlyDates = async () => {
    if (isLoadingMonthly) return;
    setIsLoadingMonthly(true);
    try {
      // 1. Próximas 6 fechas calculadas para día 31
      const dates31 = calculateMonthlyOccurrences(31, '09:00 AM', 6);
      const formatted31 = dates31.map((d, i) => ({
        index: i + 1,
        formatted: formatDateSpanish(d),
        effectiveDay: d.getDate(),
      }));

      // 2. Próximo disparo nativo para día 28
      const next28 = await getNextMonthlyTriggerDate(28, '09:00 AM');
      const preview28 = next28 ? formatDateSpanish(next28) : 'No disponible en este entorno';

      setMonthlyPreview({
        next28: preview28,
        dates31: formatted31,
      });
    } finally {
      setIsLoadingMonthly(false);
    }
  };

  return (
    <View style={styles.wrapper}>
      {/* SECCIÓN 1: PRUEBA DE NOTIFICACIÓN DE 60 SEGUNDOS */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>PRUEBA DE ALERTA</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.iconContainer}>
            <SymbolView
              fallback={<Text style={styles.fallbackIcon}>🔔</Text>}
              name={{
                ios: 'bell.badge',
                android: 'notifications_active',
                web: 'notifications_active',
              }}
              size={22}
              tintColor="#60A5FA"
            />
          </View>
          <View style={styles.cardHeaderTextGroup}>
            <View style={styles.titleBadgeRow}>
              <Text style={styles.cardTitle}>Prueba de notificación (60s)</Text>
              {scheduledId ? (
                <View style={styles.activePill}>
                  <Text style={styles.activePillText}>{secondsRemaining}s</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.cardDescription}>
              Programa una alerta local a 60 segundos para comprobar la recepción en primer plano,
              segundo plano o con pantalla bloqueada.
            </Text>
          </View>
        </View>

        {/* Estado cuando la notificación de prueba está programada */}
        {scheduledId ? (
          <View style={styles.scheduledBox}>
            <View style={styles.scheduledDetails}>
              <Text style={styles.scheduledTimerLabel}>
                ⏱️ Disparo en:{' '}
                <Text style={styles.timerHighlight}>{secondsRemaining} segundos</Text>
              </Text>
              <Text
                ellipsizeMode="middle"
                numberOfLines={1}
                style={styles.scheduledIdText}>
                ID: {scheduledId}
              </Text>
            </View>

            <Pressable
              accessibilityHint="Cancela la notificación de prueba en curso"
              accessibilityLabel="Cancelar notificación de prueba"
              accessibilityRole="button"
              onPress={handleCancel}
              style={({ pressed }) => [styles.cancelBtn, pressed && styles.cancelBtnPressed]}>
              <Text style={styles.cancelBtnText}>Cancelar prueba</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            accessibilityHint="Programa una notificación de prueba que sonará en 60 segundos"
            accessibilityLabel="Probar notificación en 60 segundos"
            accessibilityRole="button"
            accessibilityState={{ disabled: isScheduling, busy: isScheduling }}
            disabled={isScheduling}
            onPress={handleSchedule}
            style={({ pressed }) => [
              styles.primaryButton,
              isScheduling && styles.primaryButtonDisabled,
              pressed && !isScheduling && styles.buttonPressed,
            ]}>
            {isScheduling ? (
              <View style={styles.buttonContentRow}>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={styles.primaryButtonText}>Programando...</Text>
              </View>
            ) : (
              <View style={styles.buttonContentRow}>
                <SymbolView
                  fallback={<Text style={styles.buttonFallbackIcon}>🚀</Text>}
                  name={{
                    ios: 'paperplane.fill',
                    android: 'send',
                    web: 'send',
                  }}
                  size={18}
                  tintColor="#FFFFFF"
                />
                <Text style={styles.primaryButtonText}>Probar notificación (60s)</Text>
              </View>
            )}
          </Pressable>
        )}

        {/* Mensaje de estado accesible */}
        {statusMessage ? (
          <View
            accessibilityLiveRegion="polite"
            style={[
              styles.statusBanner,
              statusMessage.type === 'success' && styles.statusSuccess,
              statusMessage.type === 'error' && styles.statusError,
              statusMessage.type === 'info' && styles.statusInfo,
            ]}>
            <Text
              style={[
                styles.statusBannerText,
                statusMessage.type === 'success' && styles.statusTextSuccess,
                statusMessage.type === 'error' && styles.statusTextError,
                statusMessage.type === 'info' && styles.statusTextInfo,
              ]}>
              {statusMessage.type === 'success'
                ? '✓ '
                : statusMessage.type === 'error'
                ? '⚠️ '
                : 'ℹ️ '}
              {statusMessage.text}
            </Text>
          </View>
        ) : null}
      </View>

      {/* SECCIÓN 2: INSPECCIÓN DE NOTIFICACIONES PROGRAMADAS */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>INSPECCIÓN DEL SISTEMA</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.iconContainer}>
            <SymbolView
              fallback={<Text style={styles.fallbackIcon}>🔍</Text>}
              name={{
                ios: 'list.bullet.rectangle',
                android: 'fact_check',
                web: 'fact_check',
              }}
              size={22}
              tintColor="#60A5FA"
            />
          </View>
          <View style={styles.cardHeaderTextGroup}>
            <View style={styles.titleBadgeRow}>
              <Text style={styles.cardTitle}>Notificaciones en el sistema</Text>
              {scheduledItems !== null ? (
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{scheduledItems.length}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.cardDescription}>
              Consulta todas las alarmas actualmente registradas por Remind en el programador nativo
              de Android.
            </Text>
          </View>
        </View>

        <Pressable
          accessibilityHint="Consulta las notificaciones activas registradas en Android"
          accessibilityLabel="Ver notificaciones programadas en el sistema"
          accessibilityRole="button"
          accessibilityState={{ disabled: isInspecting, busy: isInspecting }}
          disabled={isInspecting}
          onPress={handleInspectScheduled}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && !isInspecting && styles.buttonPressed,
          ]}>
          {isInspecting ? (
            <ActivityIndicator color="#93C5FD" size="small" />
          ) : (
            <Text style={styles.secondaryButtonText}>
              {scheduledItems === null
                ? 'Ver notificaciones en el sistema'
                : 'Actualizar lista del sistema'}
            </Text>
          )}
        </Pressable>

        {scheduledItems !== null ? (
          <View style={styles.resultsPanel}>
            <View style={styles.resultsPanelHeader}>
              <Text style={styles.resultsPanelTitle}>
                {scheduledItems.length === 0
                  ? 'Sin notificaciones programadas'
                  : `${scheduledItems.length} ${
                      scheduledItems.length === 1
                        ? 'notificación registrada'
                        : 'notificaciones registradas'
                    }`}
              </Text>
              <Pressable
                accessibilityLabel="Ocultar lista de notificaciones del sistema"
                accessibilityRole="button"
                hitSlop={10}
                onPress={() => setScheduledItems(null)}>
                <Text style={styles.clearPanelLink}>Ocultar</Text>
              </Pressable>
            </View>

            {scheduledItems.length === 0 ? (
              <Text style={styles.emptyResultsText}>
                No hay ninguna notificación programada en el sistema actualmente.
              </Text>
            ) : (
              <View style={styles.itemsList}>
                {scheduledItems.map((item) => (
                  <View key={item.fullId} style={styles.scheduledItemRow}>
                    <View style={styles.scheduledItemTop}>
                      <Text style={styles.scheduledItemIndex}>#{item.index}</Text>
                      <Text numberOfLines={2} style={styles.scheduledItemTitle}>
                        {item.title}
                      </Text>
                    </View>
                    <View style={styles.scheduledItemMeta}>
                      <View style={styles.tagPill}>
                        <Text style={styles.tagPillText}>{item.tag}</Text>
                      </View>
                      <Text style={styles.snippetText}>ID: {item.idSnippet}...</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : null}
      </View>

      {/* SECCIÓN 3: PREVISUALIZACIÓN DE FECHAS MENSUALES */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>CALENDARIO Y FIN DE MES</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.iconContainer}>
            <SymbolView
              fallback={<Text style={styles.fallbackIcon}>📅</Text>}
              name={{
                ios: 'calendar',
                android: 'calendar_month',
                web: 'calendar_month',
              }}
              size={22}
              tintColor="#60A5FA"
            />
          </View>
          <View style={styles.cardHeaderTextGroup}>
            <Text style={styles.cardTitle}>Fechas mensuales calculadas</Text>
            <Text style={styles.cardDescription}>
              Revisa el próximo disparo del activador nativo (día 28) y las próximas 6 ocurrencias
              del horizonte para el día 31.
            </Text>
          </View>
        </View>

        <Pressable
          accessibilityHint="Muestra las próximas fechas calculadas para recordatorios mensuales"
          accessibilityLabel="Previsualizar próximas fechas mensuales"
          accessibilityRole="button"
          accessibilityState={{ disabled: isLoadingMonthly, busy: isLoadingMonthly }}
          disabled={isLoadingMonthly}
          onPress={handlePreviewMonthlyDates}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && !isLoadingMonthly && styles.buttonPressed,
          ]}>
          {isLoadingMonthly ? (
            <ActivityIndicator color="#93C5FD" size="small" />
          ) : (
            <Text style={styles.secondaryButtonText}>
              {monthlyPreview === null
                ? 'Calcular próximas fechas mensuales'
                : 'Recalcular fechas mensuales'}
            </Text>
          )}
        </Pressable>

        {monthlyPreview !== null ? (
          <View style={styles.resultsPanel}>
            <View style={styles.resultsPanelHeader}>
              <Text style={styles.resultsPanelTitle}>Simulación de horario (09:00 AM)</Text>
              <Pressable
                accessibilityLabel="Ocultar fechas mensuales calculadas"
                accessibilityRole="button"
                hitSlop={10}
                onPress={() => setMonthlyPreview(null)}>
                <Text style={styles.clearPanelLink}>Ocultar</Text>
              </Pressable>
            </View>

            <View style={styles.monthlySubgroup}>
              <Text style={styles.monthlySubgroupLabel}>Día 28 (Activador mensual nativo)</Text>
              <Text style={styles.monthlySubgroupValue}>
                Próximo disparo: {monthlyPreview.next28}
              </Text>
            </View>

            <View style={styles.monthlyDivider} />

            <View style={styles.monthlySubgroup}>
              <Text style={styles.monthlySubgroupLabel}>
                Día 31 (Próximas 6 ocurrencias del horizonte)
              </Text>
              <View style={styles.monthlyDatesList}>
                {monthlyPreview.dates31.map((d) => (
                  <View key={d.index} style={styles.monthlyDateRow}>
                    <Text style={styles.monthlyDateIndex}>{d.index}.</Text>
                    <Text style={styles.monthlyDateText}>{d.formatted}</Text>
                    <View style={styles.tagPill}>
                      <Text style={styles.tagPillText}>Día {d.effectiveDay}</Text>
                    </View>
                  </View>
                ))}
              </View>
              <Text style={styles.monthlyFootnote}>
                Nota: Los meses más cortos (ej. febrero o abril) se ajustan al último día del mes
                sin alterar el día 31 en los meses posteriores.
              </Text>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  sectionHeader: {
    marginBottom: 8,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.8,
  },
  card: {
    backgroundColor: '#111317',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1E2433',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#182235',
    borderWidth: 1,
    borderColor: '#253552',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  fallbackIcon: {
    fontSize: 18,
  },
  cardHeaderTextGroup: {
    flex: 1,
  },
  titleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    lineHeight: 22,
  },
  cardDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: '#94A3B8',
  },
  activePill: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  activePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#34D399',
  },
  countBadge: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#93C5FD',
  },
  primaryButton: {
    minHeight: 48,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  buttonContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonFallbackIcon: {
    fontSize: 15,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    minHeight: 48,
    backgroundColor: '#181C24',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2E384D',
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#93C5FD',
    fontSize: 14,
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.99 }],
  },
  scheduledBox: {
    backgroundColor: '#161A23',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2B3448',
    padding: 14,
    gap: 12,
  },
  scheduledDetails: {
    gap: 4,
  },
  scheduledTimerLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#E2E8F0',
  },
  timerHighlight: {
    color: '#34D399',
    fontWeight: '800',
  },
  scheduledIdText: {
    fontSize: 12,
    color: '#94A3B8',
    fontFamily: 'monospace',
  },
  cancelBtn: {
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  cancelBtnPressed: {
    opacity: 0.75,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F87171',
  },
  statusBanner: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusBannerText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  statusSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  statusTextSuccess: {
    color: '#6EE7B7',
  },
  statusError: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  statusTextError: {
    color: '#FCA5A5',
  },
  statusInfo: {
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  statusTextInfo: {
    color: '#93C5FD',
  },
  resultsPanel: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#1E2433',
  },
  resultsPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  resultsPanelTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#CBD5E1',
  },
  clearPanelLink: {
    fontSize: 13,
    fontWeight: '600',
    color: '#60A5FA',
  },
  emptyResultsText: {
    fontSize: 13,
    color: '#94A3B8',
    fontStyle: 'italic',
    paddingVertical: 6,
  },
  itemsList: {
    gap: 8,
  },
  scheduledItemRow: {
    backgroundColor: '#161A23',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#242B3A',
    gap: 6,
  },
  scheduledItemTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  scheduledItemIndex: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 1,
  },
  scheduledItemTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#F1F5F9',
    lineHeight: 19,
  },
  scheduledItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagPill: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  tagPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#93C5FD',
  },
  snippetText: {
    fontSize: 11,
    color: '#64748B',
    fontFamily: 'monospace',
  },
  monthlySubgroup: {
    gap: 6,
  },
  monthlySubgroupLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  monthlySubgroupValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F8FAFC',
    backgroundColor: '#161A23',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#242B3A',
  },
  monthlyDivider: {
    height: 1,
    backgroundColor: '#1E2433',
    marginVertical: 12,
  },
  monthlyDatesList: {
    gap: 6,
    marginTop: 2,
  },
  monthlyDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161A23',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#242B3A',
    gap: 8,
  },
  monthlyDateIndex: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    width: 18,
  },
  monthlyDateText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  monthlyFootnote: {
    fontSize: 12,
    lineHeight: 17,
    color: '#64748B',
    marginTop: 8,
  },
});
