# TrailCatch

Diario móvil de pesca y senderismo. Fase 1 con Expo SDK 58, React Native, TypeScript y SQLite local.

## Probar en Android con Expo Go

Con Node.js 24 y una versión de Expo Go compatible con SDK 58 en el teléfono:

```bash
npm ci
npm start -- --go
```

Ejecuta los comandos desde la raíz del repositorio. Con el teléfono y el equipo en la misma red, abre Expo Go y escanea el QR. Si la red local impide la conexión, ejecuta `npm start -- --go --tunnel` desde un equipo con acceso al servicio de túnel de Expo.

El diario funciona sin cuenta. Las teselas del mapa y las consultas a Open-Meteo necesitan conexión a Internet en el teléfono. La capa estándar muestra teselas de OpenStreetMap. Satélite y relieve dependen del proveedor nativo del mapa. La barra usa Liquid Glass donde iOS lo admite, BlurView en otros dispositivos compatibles y un fondo translúcido en Android anterior a API 31.

## Comprobar el proyecto

```bash
npm run typecheck
npx expo export --platform android
npx expo export --platform ios
```

1. Abre Inicio y comprueba las dos salidas de ejemplo. Prueba Me gusta, comentar y guardar. Las acciones se conservan en el dispositivo.
2. Pulsa **+**, elige **Pesca y ruta**, añade una foto y una captura, y marca un punto. Guarda y abre la ficha desde el feed y el mapa.
3. Abre **Condiciones** para consultar el tiempo. En **Perfil**, consulta las estadísticas, exporta el diario a JSON y borra los ejemplos. Reinicia la app y comprueba que la salida propia se conserva.
4. Comprueba el modo oscuro desde los ajustes del sistema. Si pruebas el borrado total, comprueba que los ejemplos no se vuelven a cargar al reiniciar.

El JSON de exportación contiene las salidas propias y sus fotos codificadas en base64. Los textos de las pantallas y las bases editables de Privacidad y Términos están en `i18n/index.ts`. Español es el idioma inicial y las entradas de inglés y rumano usan español como respaldo hasta añadir sus traducciones. Las fotos de ejemplo son ilustraciones generadas para el diario.

## Cuenta, lugares y feed social

Configura `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en el entorno que ejecuta Metro. Usa la clave publicable del proyecto. El diario SQLite se puede usar con estas variables sin configurar.

Aplica las migraciones en orden a un proyecto Supabase con PostgreSQL 15 o superior y PostGIS. Desde un equipo con Supabase CLI autenticado y acceso al proyecto:

```bash
supabase link --project-ref qvpdedovvbztyfsaznil
supabase db push
supabase functions deploy delete-account
supabase functions deploy report-email
supabase functions deploy notify-push
```

Habilita Google como proveedor de Supabase Auth y registra la URL de retorno de la app, `trailcatch://account` en una compilación instalada. La confirmación por correo requiere que el envío esté configurado en el proyecto.

Para los webhooks, guarda los siguientes nombres en Supabase Vault.

- `trailcatch_report_webhook_url` con la URL de la función `report-email`
- `trailcatch_push_webhook_url` con la URL de la función `notify-push`
- `trailcatch_webhook_secret` con un valor aleatorio, igual a `TRAILCATCH_WEBHOOK_SECRET` en los secretos de las funciones

El correo de reportes requiere `RESEND_API_KEY`, `REPORT_EMAIL_FROM` y `REPORT_EMAIL_TO` en la función. La pantalla administrativa exige `app_metadata.role = "admin"`. Expo Push requiere una compilación de desarrollo o distribución con el proyecto EAS y las credenciales APNs/FCM. Si Expo Push tiene seguridad reforzada habilitada, configura `EXPO_ACCESS_TOKEN` en la función. La lista de notificaciones dentro de la app puede probarse en Expo Go.

`npm run import:osm` importa lagos, embalses y rutas alrededor de Cluj-Napoca. Configura `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y `OSM_IMPORT_USER_ID` en el proceso que ejecuta el script. `OSM_IMPORT_BOUNDS` acepta sur, oeste, norte y este separados por comas. Usa el importador de forma puntual y conserva la atribución de OpenStreetMap. La búsqueda por población usa Nominatim con caché y un intervalo de un segundo por cliente. Para tráfico de producción, aplica el límite global del proveedor en un proxy o usa un proveedor dedicado.

Verifica TypeScript con `npm run typecheck`, lint con `npm run lint` y aplica los archivos de `supabase/tests` en una base de prueba como propietario de las migraciones. Las pruebas revierten sus datos al finalizar.
