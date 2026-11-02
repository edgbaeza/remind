import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export interface ProfileHeaderProps {
  name: string;
  onPressSettings: () => void;
}

export function ProfileHeader({ name, onPressSettings }: ProfileHeaderProps) {
  return (
    <View style={styles.container}>
      {/* Sección Izquierda: Avatar y Nombre */}
      <View style={styles.profileSection}>
        <View
          accessibilityLabel="Avatar de usuario"
          accessibilityRole="image"
          style={styles.avatarContainer}>
          <Text style={styles.avatarIcon}>👤</Text>
        </View>

        <View style={styles.nameWrapper}>
          <Text
            ellipsizeMode="tail"
            numberOfLines={1}
            style={styles.nameText}>
            {name || 'Mi perfil'}
          </Text>
        </View>
      </View>

      {/* Sección Derecha: Acciones (Campana pendiente y Engranaje de Configuración) */}
      <View style={styles.actionsSection}>
        {/* Campana: Función pendiente (no interactiva, sin contadores falsos) */}
        <View
          accessibilityHint="Esta función estará disponible en próximas versiones"
          accessibilityLabel="Notificaciones (próximamente)"
          accessibilityState={{ disabled: true }}
          style={[styles.actionButton, styles.bellButton]}>
          <Text style={styles.bellIcon}>🔔</Text>
        </View>

        {/* Engranaje: Acceso a Configuración */}
        <Pressable
          accessibilityHint="Abre la pantalla de configuración del perfil"
          accessibilityLabel="Configuración"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onPressSettings}
          style={({ pressed }) => [
            styles.actionButton,
            styles.settingsButton,
            pressed && styles.actionButtonPressed,
          ]}>
          <Text style={styles.actionIcon}>⚙️</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginBottom: 8,
  },
  profileSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#1E293B',
    borderWidth: 1.5,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarIcon: {
    fontSize: 20,
  },
  nameWrapper: {
    flex: 1,
    marginLeft: 12,
  },
  nameText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    letterSpacing: -0.2,
  },
  actionsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#181C24',
    borderWidth: 1,
    borderColor: '#262D3D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellButton: {
    opacity: 0.6,
  },
  settingsButton: {
    backgroundColor: '#1E2433',
  },
  actionButtonPressed: {
    opacity: 0.7,
    backgroundColor: '#262E40',
    transform: [{ scale: 0.95 }],
  },
  bellIcon: {
    fontSize: 17,
  },
  actionIcon: {
    fontSize: 18,
  },
});
