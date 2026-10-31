import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import {
  addNotificationReceivedListener,
  cancelNotification,
  getAllScheduledNotifications,
  scheduleTestNotification,
  setupNotificationChannel,
} from '@/services/notification-service';

export function TestNotificationCard() {
  const isDark = useColorScheme() === 'dark';

  const [scheduledId, setScheduledId] = useState<string | null>(null);
  const [isScheduling, setIsScheduling] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

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
    const list = await getAllScheduledNotifications();
    if (list.length === 0) {
      Alert.alert(
        'Notificaciones en el sistema',
        'No hay ninguna notificación programada en el sistema actualmente.',
        [{ text: 'Entendido' }]
      );
      return;
    }

    const itemsSummary = list
      .map((item, index) => {
        const title = item.content.title || '(Sin título)';
        const idSnippet = item.identifier.slice(0, 8);
        const data = item.content.data as { repeatType?: string; dayKey?: string } | undefined;
        let tag = '';
        if (data?.repeatType === 'weekly' && data.dayKey) {
          tag = ` [Semanal • ${data.dayKey}]`;
        } else if (data?.repeatType === 'daily') {
          tag = ' [Diario]';
        } else if (data?.repeatType === 'once') {
          tag = ' [Una vez]';
        }
        return `${index + 1}. "${title}"${tag} (${idSnippet}...)`;
      })
      .join('\n');

    Alert.alert(
      `Notificaciones programadas (${list.length})`,
      itemsSummary,
      [{ text: 'Cerrar' }]
    );
  };

  return (
    <View style={[styles.container, isDark ? styles.containerDark : styles.containerLight]}>
      {/* Cabecera de la tarjeta de prueba */}
      <View style={styles.headerRow}>
        <View style={styles.titleWithIcon}>
          <Text style={styles.icon}>🔔</Text>
          <Text style={[styles.title, isDark ? styles.titleDark : styles.titleLight]}>
            Prueba de notificación local
          </Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>60 seg</Text>
        </View>
      </View>

      <Text style={[styles.description, isDark ? styles.descDark : styles.descLight]}>
        Comprueba la recepción de alertas en primer plano o sal al escritorio de Android para recibirla en segundo plano.
      </Text>

      {/* Estado cuando está programada */}
      {scheduledId ? (
        <View style={[styles.scheduledBox, isDark ? styles.scheduledBoxDark : styles.scheduledBoxLight]}>
          <View style={styles.scheduledInfo}>
            <Text style={styles.scheduledTimer}>
              ⏱️ Disparo en: <Text style={styles.timerHighlight}>{secondsRemaining}s</Text>
            </Text>
            <Text
              numberOfLines={1}
              ellipsizeMode="middle"
              style={[styles.scheduledIdText, isDark ? styles.idTextDark : styles.idTextLight]}>
              ID: {scheduledId}
            </Text>
          </View>

          <Pressable
            accessibilityLabel="Cancelar notificación de prueba"
            onPress={handleCancel}
            style={({ pressed }) => [styles.cancelBtn, pressed && styles.cancelBtnPressed]}>
            <Text style={styles.cancelBtnText}>Cancelar</Text>
          </Pressable>
        </View>
      ) : (
        /* Botón para programar */
        <Pressable
          accessibilityLabel="Probar notificación"
          disabled={isScheduling}
          onPress={handleSchedule}
          style={({ pressed }) => [
            styles.actionButton,
            isScheduling && styles.actionButtonDisabled,
            pressed && !isScheduling && styles.actionButtonPressed,
          ]}>
          {isScheduling ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.actionButtonIcon}>🚀</Text>
              <Text style={styles.actionButtonText}>Probar notificación (60s)</Text>
            </>
          )}
        </Pressable>
      )}

      {/* Botón de inspección de notificaciones programadas */}
      <Pressable
        accessibilityLabel="Ver notificaciones programadas en el sistema"
        onPress={handleInspectScheduled}
        style={({ pressed }) => [
          styles.inspectButton,
          isDark ? styles.inspectButtonDark : styles.inspectButtonLight,
          pressed && styles.inspectButtonPressed,
        ]}>
        <Text style={[styles.inspectButtonText, isDark ? styles.inspectTextDark : styles.inspectTextLight]}>
          🔍 Consultar notificaciones en el sistema
        </Text>
      </Pressable>

      {/* Mensaje de retroalimentación */}
      {statusMessage && (
        <View
          style={[
            styles.statusMessageCard,
            statusMessage.type === 'success' && (isDark ? styles.msgSuccessDark : styles.msgSuccessLight),
            statusMessage.type === 'error' && (isDark ? styles.msgErrorDark : styles.msgErrorLight),
            statusMessage.type === 'info' && (isDark ? styles.msgInfoDark : styles.msgInfoLight),
          ]}>
          <Text
            style={[
              styles.statusMessageText,
              statusMessage.type === 'success' && (isDark ? styles.msgTextSuccessDark : styles.msgTextSuccessLight),
              statusMessage.type === 'error' && (isDark ? styles.msgTextErrorDark : styles.msgTextErrorLight),
              statusMessage.type === 'info' && (isDark ? styles.msgTextInfoDark : styles.msgTextInfoLight),
            ]}>
            {statusMessage.type === 'success' ? '✅ ' : statusMessage.type === 'error' ? '⚠️ ' : 'ℹ️ '}
            {statusMessage.text}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
  },
  containerLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  containerDark: {
    backgroundColor: '#1E232E',
    borderColor: '#2F3646',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  icon: {
    fontSize: 16,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
  },
  titleLight: {
    color: '#0F172A',
  },
  titleDark: {
    color: '#F8FAFC',
  },
  badge: {
    backgroundColor: '#2563EB20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3B82F6',
  },
  description: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  descLight: {
    color: '#64748B',
  },
  descDark: {
    color: '#94A3B8',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 8,
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  actionButtonIcon: {
    fontSize: 14,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  inspectButton: {
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  inspectButtonLight: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  inspectButtonDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  inspectButtonPressed: {
    opacity: 0.75,
  },
  inspectButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  inspectTextLight: {
    color: '#334155',
  },
  inspectTextDark: {
    color: '#CBD5E1',
  },
  scheduledBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  scheduledBoxLight: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  scheduledBoxDark: {
    backgroundColor: '#161922',
    borderColor: '#2D3444',
  },
  scheduledInfo: {
    flex: 1,
    marginRight: 10,
  },
  scheduledTimer: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3B82F6',
    marginBottom: 2,
  },
  timerHighlight: {
    color: '#10B981',
    fontWeight: '800',
  },
  scheduledIdText: {
    fontSize: 10,
    fontFamily: 'monospace',
  },
  idTextLight: {
    color: '#64748B',
  },
  idTextDark: {
    color: '#94A3B8',
  },
  cancelBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#EF444420',
    borderWidth: 1,
    borderColor: '#EF444450',
  },
  cancelBtnPressed: {
    opacity: 0.7,
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
  },
  statusMessageCard: {
    marginTop: 10,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusMessageText: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '500',
  },
  msgSuccessLight: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  msgSuccessDark: {
    backgroundColor: '#064E3B40',
    borderColor: '#065F46',
  },
  msgTextSuccessLight: {
    color: '#065F46',
  },
  msgTextSuccessDark: {
    color: '#6EE7B7',
  },
  msgErrorLight: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  msgErrorDark: {
    backgroundColor: '#7F1D1D40',
    borderColor: '#991B1B',
  },
  msgTextErrorLight: {
    color: '#991B1B',
  },
  msgTextErrorDark: {
    color: '#FCA5A5',
  },
  msgInfoLight: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  msgInfoDark: {
    backgroundColor: '#1E3A8A40',
    borderColor: '#1D4ED8',
  },
  msgTextInfoLight: {
    color: '#1E40AF',
  },
  msgTextInfoDark: {
    color: '#93C5FD',
  },
});
