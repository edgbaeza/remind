import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';

type CustomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const ACTIVE_COLOR = '#2563EB';
const INACTIVE_COLOR_DARK = '#94A3B8';
const INACTIVE_COLOR_LIGHT = '#64748B';

function CustomBottomTabBar({
  state,
  descriptors,
  emitter,
  navigateToTab,
  insets,
}: CustomTabBarProps) {
  const isDark = useColorScheme() === 'dark';

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.tabBarContainer,
        isDark ? styles.tabBarDark : styles.tabBarLight,
        { paddingBottom: Math.max(insets.bottom, 8) },
      ]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label =
          typeof options.tabBarLabel === 'string'
            ? options.tabBarLabel
            : options.title !== undefined
            ? options.title
            : route.name;

        const isFocused = state.index === index;
        const inactiveColor = isDark ? INACTIVE_COLOR_DARK : INACTIVE_COLOR_LIGHT;
        const tintColor = isFocused ? ACTIVE_COLOR : inactiveColor;

        const onPress = () => {
          const event = emitter.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigateToTab(route.key);
          }
        };

        const onLongPress = () => {
          emitter.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        const isCalendar = route.name === 'calendar';

        return (
          <Pressable
            key={route.key}
            accessibilityLabel={options.tabBarAccessibilityLabel ?? `Pestaña ${label}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: isFocused }}
            onLongPress={onLongPress}
            onPress={onPress}
            style={({ pressed }) => [styles.tabItem, pressed && styles.tabItemPressed]}>
            <View
              style={[
                styles.iconPill,
                isFocused && (isDark ? styles.iconPillActiveDark : styles.iconPillActiveLight),
              ]}>
              {isCalendar ? (
                <SymbolView
                  fallback={
                    <Text style={[styles.fallbackIcon, { color: tintColor }]}>📅</Text>
                  }
                  name={{
                    ios: 'calendar',
                    android: 'calendar_month',
                    web: 'calendar_month',
                  }}
                  size={22}
                  tintColor={tintColor}
                />
              ) : (
                <SymbolView
                  fallback={
                    <Text style={[styles.fallbackIcon, { color: tintColor }]}>⌂</Text>
                  }
                  name={{
                    ios: isFocused ? 'house.fill' : 'house',
                    android: 'home',
                    web: 'home',
                  }}
                  size={22}
                  tintColor={tintColor}
                />
              )}
            </View>

            <Text
              numberOfLines={1}
              style={[
                styles.tabLabel,
                { color: tintColor },
                isFocused ? styles.tabLabelActive : styles.tabLabelInactive,
              ]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      backBehavior="initialRoute"
      screenOptions={{
        headerShown: false,
      }}
      tabBar={(props) => <CustomBottomTabBar {...props} />}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarAccessibilityLabel: 'Inicio, lista de recordatorios',
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendario',
          tabBarAccessibilityLabel: 'Calendario, consultar recordatorios por fecha',
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 8,
    paddingHorizontal: 16,
    borderTopWidth: 1,
  },
  tabBarDark: {
    backgroundColor: '#0B0D11',
    borderTopColor: '#1E2433',
  },
  tabBarLight: {
    backgroundColor: '#FFFFFF',
    borderTopColor: '#E2E8F0',
  },
  tabItem: {
    flex: 1,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    gap: 4,
  },
  tabItemPressed: {
    opacity: 0.75,
  },
  iconPill: {
    width: 52,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPillActiveDark: {
    backgroundColor: 'rgba(37, 99, 235, 0.16)',
  },
  iconPillActiveLight: {
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
  },
  fallbackIcon: {
    fontSize: 18,
    fontWeight: '700',
  },
  tabLabel: {
    fontSize: 12,
    letterSpacing: 0.1,
  },
  tabLabelActive: {
    fontWeight: '700',
  },
  tabLabelInactive: {
    fontWeight: '600',
  },
});
