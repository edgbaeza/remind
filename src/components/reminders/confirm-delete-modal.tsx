import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export interface ConfirmDeleteModalProps {
  visible: boolean;
  reminderTitle: string;
  isDeleting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDeleteModal({
  visible,
  reminderTitle,
  isDeleting = false,
  onConfirm,
  onCancel,
}: ConfirmDeleteModalProps) {
  if (!visible) return null;

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={!isDeleting ? onCancel : undefined}
      statusBarTranslucent>
      <View style={styles.overlay}>
        {/* Fondo táctil exterior para cancelar */}
        <Pressable
          accessibilityLabel="Cerrar confirmación"
          accessibilityRole="button"
          disabled={isDeleting}
          onPress={onCancel}
          style={styles.backdrop}
        />

        {/* Tarjeta modal centrada */}
        <View
          accessibilityLiveRegion="polite"
          accessibilityViewIsModal
          style={styles.card}>
          {/* Icono de papelera en contenedor rojo tenue */}
          <View style={styles.iconContainer}>
            <Text style={styles.iconText}>🗑️</Text>
          </View>

          {/* Título */}
          <Text style={styles.title}>¿Eliminar recordatorio?</Text>

          {/* Mensaje descriptivo con el nombre del recordatorio */}
          <Text style={styles.message}>
            ¿Estás seguro de que deseas eliminar &quot;{reminderTitle}&quot;? Esta acción no se puede deshacer.
          </Text>

          {/* Botones de acción horizontales */}
          <View style={styles.actionsRow}>
            {/* Botón Cancelar */}
            <Pressable
              accessibilityLabel="Cancelar eliminación"
              accessibilityRole="button"
              disabled={isDeleting}
              onPress={onCancel}
              style={({ pressed }) => [
                styles.button,
                styles.cancelButton,
                pressed && !isDeleting && styles.buttonPressed,
                isDeleting && styles.buttonDisabled,
              ]}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </Pressable>

            {/* Botón Eliminar */}
            <Pressable
              accessibilityLabel="Confirmar eliminación"
              accessibilityRole="button"
              disabled={isDeleting}
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.button,
                styles.deleteButton,
                pressed && !isDeleting && styles.buttonPressed,
                isDeleting && styles.buttonDisabled,
              ]}>
              {isDeleting ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <Text style={styles.deleteButtonText}>Eliminando...</Text>
                </View>
              ) : (
                <Text style={styles.deleteButtonText}>Eliminar</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
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
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#1C2028',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#2A313E',
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.28)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconText: {
    fontSize: 24,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  message: {
    fontSize: 14,
    fontWeight: '400',
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 6,
  },
  actionsRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#262C38',
    borderWidth: 1,
    borderColor: '#374151',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#E5E7EB',
  },
  deleteButton: {
    backgroundColor: '#DC2626',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

