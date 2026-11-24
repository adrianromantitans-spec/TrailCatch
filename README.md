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
