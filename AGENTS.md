This is Remind, an Expo/React Native Android reminder app (Expo SDK 58). Prioritize mobile-first patterns, performance, and notification reliability.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo start              # Iniciar el servidor de desarrollo
npx expo lint               # Ejecutar ESLint
npx tsc --noEmit            # Comprobación de tipos TypeScript
npm test                    # Ejecutar tests unitarios (Node.js test runner)
npx expo-doctor             # Diagnosticar problemas de configuración
```

> [!WARNING]
> No ejecutes `npx expo install --fix` ni actualices paquetes automáticamente; puede alterar versiones probadas y romper la compilación de la APK.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Native Builds & Android Environment

- Remind cuenta con una **APK Beta 0.1 funcional** compilada con EAS Build (`preview`, buildType `apk`).
- Remind utiliza alarmas nativas exactas de Android (`delivery: 'alarmClock'`, `SCHEDULE_EXACT_ALARM`, `USE_EXACT_ALARM`, `RECEIVE_BOOT_COMPLETED`). Expo Go **no** soporta la totalidad de estos comportamientos de alarma en segundo plano; las pruebas de notificaciones requieren development builds o la APK compilada.
- Si los directorios `ios/` y `android/` no existen, son generados por Continuous Native Generation (CNG). No los crees ni edites a mano; configura el comportamiento nativo en `app.json` y plugins.
- **No generar APK (`eas build`) sin autorización previa del usuario.**

## Reglas Obligatorias de Remind

1. **Interfaz oscura y en español**: Mantener todos los textos, fechas y componentes en español y con la paleta visual oscura One UI (`#000000`, `#111317`, `#2563EB`).
2. **Compatibilidad de datos en AsyncStorage**: Preservar el esquema `@remind_app/reminders_v1` y la función de migración transparente (`migrateReminder`). Nunca introducir cambios de modelo que rompan recordatorios guardados.
3. **No alterar la lógica de notificaciones sin comprobar consecuencias**: Todo cambio en canales, triggers (`once`, `daily`, `weekly`, `monthly`), cálculo de horizonte 24 meses (días 29-31) o reconciliación debe verificarse minuciosamente con pruebas unitarias y análisis de impacto.
4. **No actualizar Expo ni dependencias innecesariamente**: Mantener las versiones fijadas en `package.json` para no desestabilizar la APK funcional.
5. **Mantener la arquitectura y componentes existentes**: Respetar la modularización en `src/services/`, `src/utils/`, `src/hooks/` y `src/components/reminders/`.
6. **Cambios pequeños y enfocados**: Desarrollar mediante modificaciones acotadas y verificables paso a paso; no realizar refactorizaciones masivas imprevistas.
7. **No generar APK sin autorización**: La compilación en la nube consume tiempo y recursos; solicitar siempre aprobación antes de invocar `eas build`.
8. **Validación estricta de código**: Ejecutar `npx tsc --noEmit` y `npx expo lint` después de cualquier modificación de código antes de dar la tarea por concluida.
9. **Respaldos Git antes de cambios importantes**: Crear un commit o rama de respaldo antes de intervenciones estructurales.
10. **Consultar `docs/PROJECT_CONTEXT.md`**: Leer siempre este documento técnico al inicio de nuevas conversaciones para conocer la arquitectura, los detalles de implementación y el estado del proyecto.
