import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useProfile } from '@/hooks/use-profile';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    profile,
    updateName,
    updateAvatarPhoto,
    restoreDefaultAvatar,
    isLoading,
  } = useProfile();

  const [prevProfileName, setPrevProfileName] = useState(profile.name);
  const [nameInput, setNameInput] = useState(profile.name);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [isPickingPhoto, setIsPickingPhoto] = useState(false);
  const [photoFeedback, setPhotoFeedback] = useState<string | null>(null);
  const [hasImageError, setHasImageError] = useState(false);

  // Sincronizar input si el perfil externo cambia (patrón oficial de React para ajustar estado derivado)
  if (profile.name !== prevProfileName) {
    setPrevProfileName(profile.name);
    setNameInput(profile.name);
  }

  const handleSave = async () => {
    const trimmed = nameInput.trim();
    if (trimmed.length === 0) {
      setErrorMessage('El nombre no puede estar vacío.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSaveSuccess(false);

    try {
      const result = await updateName(trimmed);
      if (result.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setErrorMessage(result.error ?? 'No fue posible guardar el nombre.');
      }
    } catch {
      setErrorMessage('Ocurrió un error inesperado al guardar el perfil.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePickPhoto = async () => {
    if (isPickingPhoto) return;
    setIsPickingPhoto(true);
    setErrorMessage(null);
    setPhotoFeedback(null);

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedUri = result.assets[0].uri;
        const res = await updateAvatarPhoto(selectedUri);
        if (res.success) {
          setHasImageError(false);
          setPhotoFeedback('✓ Fotografía actualizada correctamente');
          setTimeout(() => setPhotoFeedback(null), 3000);
        } else {
          setErrorMessage(res.error ?? 'No fue posible guardar la fotografía.');
        }
      }
    } catch (err) {
      console.error('[Settings] Error al seleccionar imagen:', err);
      setErrorMessage('No fue posible abrir la galería del dispositivo.');
    } finally {
      setIsPickingPhoto(false);
    }
  };

  const handleRestoreDefault = async () => {
    if (isPickingPhoto) return;
    setIsPickingPhoto(true);
    setErrorMessage(null);
    setPhotoFeedback(null);

    try {
      const res = await restoreDefaultAvatar();
      if (res.success) {
        setHasImageError(false);
        setPhotoFeedback('✓ Avatar predeterminado restaurado');
        setTimeout(() => setPhotoFeedback(null), 3000);
      } else {
        setErrorMessage(res.error ?? 'No fue posible restaurar el avatar.');
      }
    } catch {
      setErrorMessage('Ocurrió un error al restaurar el avatar predeterminado.');
    } finally {
      setIsPickingPhoto(false);
    }
  };

  const isSaveDisabled =
    isSaving ||
    isLoading ||
    nameInput.trim().length === 0 ||
    nameInput.trim() === profile.name;

  const hasCustomPhoto =
    profile.avatarType === 'custom' && Boolean(profile.avatarUri) && !hasImageError;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        {/* Barra superior de navegación */}
        <View style={styles.topBar}>
          <Pressable
            accessibilityHint="Regresa a la pantalla de recordatorios"
            accessibilityLabel="Volver a la pantalla principal"
            accessibilityRole="button"
            hitSlop={12}
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}>
            <Text style={styles.backButtonIcon}>‹</Text>
            <Text style={styles.backButtonText}>Atrás</Text>
          </Pressable>

          <Text style={styles.screenTitle}>Configuración</Text>

          {/* Espaciador para centrar el título */}
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 24) + 16 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {/* Encabezado de la sección Perfil */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionSubtitle}>PERFIL</Text>
          </View>

          {/* Tarjeta de configuración de Perfil */}
          <View style={styles.card}>
            {/* Visualización y Edición del Avatar */}
            <View style={styles.avatarSection}>
              <Pressable
                accessibilityHint="Toca para seleccionar una fotografía desde tu galería"
                accessibilityLabel="Fotografía de perfil. Toca para cambiarla."
                accessibilityRole="button"
                disabled={isPickingPhoto}
                onPress={handlePickPhoto}
                style={({ pressed }) => [
                  styles.avatarLarge,
                  pressed && styles.avatarLargePressed,
                ]}>
                {hasCustomPhoto ? (
                  <Image
                    accessibilityLabel="Foto de perfil del usuario"
                    contentFit="cover"
                    onError={() => setHasImageError(true)}
                    source={{ uri: profile.avatarUri }}
                    style={styles.avatarLargeImage}
                    transition={150}
                  />
                ) : (
                  <SymbolView
                    fallback={<Text style={styles.fallbackAvatarIcon}>👤</Text>}
                    name={{
                      ios: 'person',
                      android: 'person_outline',
                      web: 'person_outline',
                    }}
                    size={38}
                    tintColor="#CBD5E1"
                  />
                )}

                {isPickingPhoto && (
                  <View style={styles.avatarLoadingOverlay}>
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  </View>
                )}
              </Pressable>

              {/* Botones de acción de fotografía */}
              <View style={styles.photoActionsRow}>
                <Pressable
                  accessibilityHint="Abre la galería para cambiar tu foto de perfil"
                  accessibilityLabel="Cambiar foto de perfil"
                  accessibilityRole="button"
                  disabled={isPickingPhoto}
                  hitSlop={6}
                  onPress={handlePickPhoto}
                  style={({ pressed }) => [
                    styles.photoActionButton,
                    pressed && styles.photoActionButtonPressed,
                  ]}>
                  <Text style={styles.photoActionButtonText}>
                    {hasCustomPhoto ? 'Cambiar foto' : 'Seleccionar foto'}
                  </Text>
                </Pressable>

                {hasCustomPhoto && (
                  <Pressable
                    accessibilityHint="Elimina la fotografía y vuelve al icono de usuario predeterminado"
                    accessibilityLabel="Restaurar avatar predeterminado"
                    accessibilityRole="button"
                    disabled={isPickingPhoto}
                    hitSlop={6}
                    onPress={handleRestoreDefault}
                    style={({ pressed }) => [
                      styles.photoActionButton,
                      styles.photoActionDestructiveButton,
                      pressed && styles.photoActionButtonPressed,
                    ]}>
                    <Text style={styles.photoActionDestructiveText}>
                      Restaurar predeterminado
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>

            {/* Mensaje de retroalimentación de fotografía */}
            {photoFeedback ? (
              <View style={styles.successBanner}>
                <Text style={styles.successText}>{photoFeedback}</Text>
              </View>
            ) : null}

            {/* Campo de edición del Nombre */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Nombre</Text>
              <TextInput
                accessibilityLabel="Campo de texto para el nombre de usuario"
                autoCapitalize="words"
                autoCorrect={false}
                maxLength={50}
                onChangeText={(text) => {
                  setNameInput(text);
                  if (errorMessage) setErrorMessage(null);
                  if (saveSuccess) setSaveSuccess(false);
                }}
                placeholder="Ingresa tu nombre"
                placeholderTextColor="#64748B"
                returnKeyType="done"
                style={[styles.input, errorMessage ? styles.inputError : null]}
                value={nameInput}
              />
              <Text style={styles.inputHint}>
                Este nombre aparecerá en la cabecera principal de Remind.
              </Text>
            </View>

            {/* Mensajes de error o éxito del nombre */}
            {errorMessage ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {saveSuccess ? (
              <View style={styles.successBanner}>
                <Text style={styles.successText}>✓ Nombre guardado correctamente</Text>
              </View>
            ) : null}

            {/* Botón Guardar Nombre */}
            <Pressable
              accessibilityHint="Guarda los cambios realizados en el nombre"
              accessibilityLabel="Guardar nombre"
              accessibilityRole="button"
              disabled={isSaveDisabled}
              onPress={handleSave}
              style={({ pressed }) => [
                styles.saveButton,
                isSaveDisabled ? styles.saveButtonDisabled : null,
                pressed && !isSaveDisabled && styles.saveButtonPressed,
              ]}>
              {isSaving ? (
                <View style={styles.savingRow}>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <Text style={styles.saveButtonText}>Guardando...</Text>
                </View>
              ) : (
                <Text
                  style={[
                    styles.saveButtonText,
                    isSaveDisabled ? styles.saveButtonTextDisabled : null,
                  ]}>
                  Guardar nombre
                </Text>
              )}
            </Pressable>
          </View>

          {/* Encabezado de la sección Herramientas */}
          <View style={[styles.sectionHeader, styles.toolsSectionHeader]}>
            <Text style={styles.sectionSubtitle}>HERRAMIENTAS</Text>
          </View>

          {/* Opción: Diagnósticos de notificaciones */}
          <Pressable
            accessibilityHint="Abre la pantalla de pruebas y revisión de notificaciones"
            accessibilityLabel="Diagnósticos de notificaciones. Pruebas y revisión de notificaciones programadas"
            accessibilityRole="button"
            onPress={() => router.push('/diagnostics')}
            style={({ pressed }) => [
              styles.toolRowCard,
              pressed && styles.toolRowCardPressed,
            ]}>
            <View style={styles.toolIconContainer}>
              <SymbolView
                fallback={<Text style={styles.fallbackToolIcon}>🔔</Text>}
                name={{
                  ios: 'bell.badge',
                  android: 'notifications_active',
                  web: 'notifications_active',
                }}
                size={22}
                tintColor="#60A5FA"
              />
            </View>

            <View style={styles.toolTextColumn}>
              <Text style={styles.toolTitle}>Diagnósticos de notificaciones</Text>
              <Text style={styles.toolDescription}>
                Pruebas y revisión de notificaciones programadas
              </Text>
            </View>

            <View style={styles.toolChevronContainer}>
              <SymbolView
                fallback={<Text style={styles.toolChevronFallback}>›</Text>}
                name={{
                  ios: 'chevron.right',
                  android: 'chevron_right',
                  web: 'chevron_right',
                }}
                size={20}
                tintColor="#64748B"
              />
            </View>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },
  flex: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#161922',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingRight: 12,
  },
  backButtonPressed: {
    opacity: 0.7,
  },
  backButtonIcon: {
    fontSize: 28,
    color: '#3B82F6',
    fontWeight: '300',
    lineHeight: 28,
    marginRight: 4,
  },
  backButtonText: {
    fontSize: 16,
    color: '#3B82F6',
    fontWeight: '600',
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  headerSpacer: {
    width: 60,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionHeader: {
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  toolsSectionHeader: {
    marginTop: 24,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.8,
  },
  card: {
    backgroundColor: '#111317',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1E2433',
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1E293B',
    borderWidth: 1.5,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 12,
  },
  avatarLargePressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
  avatarLargeImage: {
    width: '100%',
    height: '100%',
  },
  avatarLoadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackAvatarIcon: {
    fontSize: 32,
    color: '#CBD5E1',
  },
  photoActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  photoActionButton: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#1E2433',
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  photoActionButtonPressed: {
    opacity: 0.7,
  },
  photoActionButtonText: {
    color: '#3B82F6',
    fontSize: 13,
    fontWeight: '600',
  },
  photoActionDestructiveButton: {
    borderColor: 'rgba(239, 68, 68, 0.35)',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  photoActionDestructiveText: {
    color: '#F87171',
    fontSize: 13,
    fontWeight: '600',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E2E8F0',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#181C24',
    borderWidth: 1,
    borderColor: '#2E384D',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#FFFFFF',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  inputHint: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 6,
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 13,
    fontWeight: '500',
  },
  successBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  successText: {
    color: '#6EE7B7',
    fontSize: 13,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  saveButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  saveButtonDisabled: {
    backgroundColor: '#1F242F',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  saveButtonTextDisabled: {
    color: '#4B5563',
  },
  savingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toolRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111317',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#1E2433',
    minHeight: 72,
    gap: 14,
  },
  toolRowCardPressed: {
    opacity: 0.8,
    backgroundColor: '#161922',
  },
  toolIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#182235',
    borderWidth: 1,
    borderColor: '#253552',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackToolIcon: {
    fontSize: 18,
  },
  toolTextColumn: {
    flex: 1,
    gap: 3,
  },
  toolTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  toolDescription: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
  },
  toolChevronContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 4,
  },
  toolChevronFallback: {
    fontSize: 24,
    color: '#64748B',
    fontWeight: '400',
  },
});
