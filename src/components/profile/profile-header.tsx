import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export interface ProfileHeaderProps {
  name: string;
  avatarType?: 'default' | 'custom';
  avatarUri?: string;
  onPressSettings: () => void;
}

export function ProfileHeader({
  name,
  avatarType = 'default',
  avatarUri,
  onPressSettings,
}: ProfileHeaderProps) {
  const [prevAvatarKey, setPrevAvatarKey] = useState(`${avatarType}:${avatarUri ?? ''}`);
  const [hasImageError, setHasImageError] = useState(false);

  // Restablecer el estado de error de imagen si cambia el avatar o su URI
  const currentAvatarKey = `${avatarType}:${avatarUri ?? ''}`;
  if (currentAvatarKey !== prevAvatarKey) {
    setPrevAvatarKey(currentAvatarKey);
    setHasImageError(false);
  }

  const shouldShowCustomPhoto =
    avatarType === 'custom' && Boolean(avatarUri) && !hasImageError;

  return (
    <View style={styles.container}>
      {/* Sección Izquierda: Avatar y Nombre */}
      <View style={styles.profileSection}>
        <View
          accessibilityLabel="Avatar de usuario"
          accessibilityRole="image"
          style={styles.avatarContainer}>
          {shouldShowCustomPhoto ? (
            <Image
              accessibilityLabel="Fotografía del perfil"
              contentFit="cover"
              onError={() => setHasImageError(true)}
              source={{ uri: avatarUri }}
              style={styles.avatarImage}
              transition={150}
            />
          ) : (
            <SymbolView
              fallback={<Text style={styles.fallbackIcon}>👤</Text>}
              name={{
                ios: 'person',
                android: 'person_outline',
                web: 'person_outline',
              }}
              size={24}
              tintColor="#CBD5E1"
            />
          )}
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
          style={styles.iconButton}>
          <SymbolView
            fallback={<Text style={styles.fallbackIcon}>🔔</Text>}
            name={{
              ios: 'bell',
              android: 'notifications_none',
              web: 'notifications_none',
            }}
            size={24}
            tintColor="#64748B"
          />
        </View>

        {/* Engranaje: Acceso a Configuración */}
        <Pressable
          accessibilityHint="Abre la pantalla de configuración del perfil"
          accessibilityLabel="Configuración"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onPressSettings}
          style={({ pressed }) => [
            styles.iconButton,
            pressed && styles.iconButtonPressed,
          ]}>
          <SymbolView
            fallback={<Text style={styles.fallbackIcon}>⚙</Text>}
            name={{
              ios: 'gearshape',
              android: 'settings',
              web: 'settings',
            }}
            size={24}
            tintColor="#E5E7EB"
          />
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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1E293B',
    borderWidth: 1.5,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
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
    gap: 4,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  iconButtonPressed: {
    opacity: 0.6,
    transform: [{ scale: 0.95 }],
  },
  fallbackIcon: {
    fontSize: 20,
    color: '#CBD5E1',
  },
});
