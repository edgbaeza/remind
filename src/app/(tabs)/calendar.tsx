import { SymbolView } from 'expo-symbols';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MaxContentWidth, Spacing } from '@/constants/theme';

export default function CalendarScreen() {
  const isDark = useColorScheme() === 'dark';

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.safeArea, isDark ? styles.safeAreaDark : styles.safeAreaLight]}>
      <View style={styles.contentWrapper}>
        {/* Cabecera de la pantalla Calendario */}
        <View style={styles.header}>
          <Text
            numberOfLines={1}
            style={[styles.headerTitle, isDark ? styles.titleDark : styles.titleLight]}>
            Calendario
          </Text>
        </View>

        {/* Estado provisional discreto */}
        <View style={styles.placeholderContainer}>
          <View
            style={[
              styles.iconCircle,
              isDark ? styles.iconCircleDark : styles.iconCircleLight,
            ]}>
            <SymbolView
              fallback={<Text style={styles.fallbackIcon}>📅</Text>}
              name={{
                ios: 'calendar',
                android: 'calendar_month',
                web: 'calendar_month',
              }}
              size={36}
              tintColor="#2563EB"
            />
          </View>

          <Text style={[styles.placeholderMessage, isDark ? styles.messageDark : styles.messageLight]}>
            Aquí podrás consultar tus recordatorios por fecha
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  safeAreaLight: {
    backgroundColor: '#F7F8FA',
  },
  safeAreaDark: {
    backgroundColor: '#111317',
  },
  contentWrapper: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: 16,
  },
  header: {
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  titleLight: {
    color: '#0F172A',
  },
  titleDark: {
    color: '#F8FAFC',
  },
  placeholderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: 18,
  },
  iconCircleDark: {
    backgroundColor: '#182235',
    borderColor: '#253552',
  },
  iconCircleLight: {
    backgroundColor: '#EFF6FF',
    borderColor: '#DBEAFE',
  },
  fallbackIcon: {
    fontSize: 32,
  },
  placeholderMessage: {
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  messageLight: {
    color: '#64748B',
  },
  messageDark: {
    color: '#94A3B8',
  },
});
