import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { TestNotificationCard } from '@/components/reminders/test-notification-card';
import { MaxContentWidth } from '@/constants/theme';

export default function DiagnosticsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.flex}>
        {/* Barra superior de navegación */}
        <View style={styles.topBar}>
          <Pressable
            accessibilityHint="Regresa a la pantalla de Configuración"
            accessibilityLabel="Volver a Configuración"
            accessibilityRole="button"
            hitSlop={12}
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}>
            <Text style={styles.backButtonIcon}>‹</Text>
            <Text style={styles.backButtonText}>Atrás</Text>
          </Pressable>

          <Text style={styles.screenTitle}>Diagnósticos</Text>

          {/* Espaciador para centrar el título */}
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 24) + 20 },
          ]}
          showsVerticalScrollIndicator={false}>
          <View style={styles.contentWrapper}>
            <Text style={styles.introText}>
              Herramientas técnicas para comprobar el canal de alarmas exactas, inspeccionar los
              disparadores activos en Android y verificar el cálculo de fechas mensuales.
            </Text>

            <TestNotificationCard />
          </View>
        </ScrollView>
      </View>
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
    minHeight: 44,
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
  contentWrapper: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  introText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#94A3B8',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
});
