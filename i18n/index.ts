export const locales = ['es', 'en', 'ro'] as const;
export type Locale = (typeof locales)[number];

const es = {
  app: 'TrailCatch', home: 'Inicio', map: 'Mapa', explore: 'Explorar', profile: 'Perfil',
  create: 'Nueva salida', search: 'Buscar', notifications: 'Notificaciones', noNotifications: 'Aún no hay notificaciones',
  type: 'Tipo', fishing: 'Pesca', hike: 'Ruta', both: 'Pesca y ruta',
  title: 'Título', date: 'Fecha', dateHint: 'AAAA-MM-DD', notes: 'Notas', location: 'Ubicación',
  pickPoint: 'Toca el mapa para marcar el lugar', myLocation: 'Usar mi posición',
  locationDenied: 'Permite el acceso a la ubicación para marcar tu posición.',
  locationError: 'No se pudo obtener tu ubicación.', photosError: 'No se pudieron añadir las fotos.',
  photos: 'Fotos', photo: 'Foto de la captura', removePhoto: 'Quitar foto',
  gallery: 'Galería', camera: 'Cámara', addingPhotos: 'Preparando fotos…',
  cameraDenied: 'Permite el acceso a la cámara para hacer una foto.',
  cameraError: 'No se pudo abrir la cámara o guardar la foto.', settings: 'Abrir ajustes',
  catches: 'Capturas', addCatch: 'Añadir captura', removeCatch: 'Quitar captura',
  species: 'Especie', size: 'Tamaño (cm)', weight: 'Peso (kg)', bait: 'Cebo o señuelo', time: 'Hora (HH:MM)',
  distance: 'Distancia (km)', duration: 'Duración (min)', ascent: 'Desnivel (m)',
  save: 'Guardar salida', saving: 'Guardando…', required: 'Escribe un título, una fecha válida y marca una ubicación.',
  invalidNumbers: 'Revisa los valores numéricos y las horas de captura.',
  saveError: 'No se pudo guardar la salida.', loadError: 'No se pudieron cargar los datos.',
  retry: 'Reintentar', empty: 'Aún no hay salidas', noResults: 'No hay resultados', loading: 'Cargando…',
  like: 'Me gusta', unlike: 'Quitar Me gusta', comment: 'Comentar', comments: 'Comentarios',
  commentPlaceholder: 'Añade un comentario', send: 'Enviar', noComments: 'Aún no hay comentarios',
  bookmark: 'Guardar publicación', unbookmark: 'Quitar de guardados', share: 'Compartir',
  dateRelative: 'Fecha', back: 'Volver', cancel: 'Cancelar', delete: 'Borrar',
  example: 'Ejemplo', sampleAuthor: 'Diario de ejemplo', sampleFishing: 'Pesca en el lago Tarnița',
  sampleFishingNotes: 'Salida de mañana desde la orilla.', sampleHike: 'Ruta por los montes Apuseni',
  sampleHikeNotes: 'Recorrido por el bosque y las praderas.', sampleFish: 'Perca', sampleBait: 'Cucharilla',
  personal: 'Mi diario', outings: 'Salidas', followers: 'Seguidores', following: 'Seguidos',
  saved: 'Guardados', all: 'Todas', searchPlaceholder: 'Buscar salidas por título o notas',
  standard: 'Estándar', satellite: 'Satélite', terrain: 'Relieve', osm: '© OpenStreetMap contributors',
  weather: 'Condiciones', temperature: 'Temperatura', wind: 'Viento', rain: 'Lluvia', pressure: 'Presión',
  moon: 'Fase lunar', sunrise: 'Amanecer', sunset: 'Atardecer', estimatedMoon: 'Fase lunar estimada',
  moonPhases: ['Luna nueva', 'Creciente', 'Cuarto creciente', 'Gibosa creciente', 'Luna llena', 'Gibosa menguante', 'Cuarto menguante', 'Menguante'],
  weatherError: 'No se pudieron consultar las condiciones.', unavailable: 'Sin datos',
  annual: 'Estadísticas anuales', totalKm: 'Kilómetros', bestMonth: 'Mejor mes', bestBait: 'Mejor cebo',
  bestTime: 'Mejor franja horaria', byMonth: 'Salidas por mes', previousYear: 'Año anterior', nextYear: 'Año siguiente',
  export: 'Exportar JSON', exportError: 'No se pudo exportar el diario.',
  deleteSamples: 'Borrar ejemplos', deleteSamplesPrompt: '¿Borrar las salidas de ejemplo?',
  deleteAll: 'Borrar todos mis datos', deleteAllPrompt: '¿Borrar todas las salidas y sus fotos de este dispositivo?',
  deleteError: 'No se pudieron borrar los datos.',
  privacy: 'Privacidad', terms: 'Términos', profileMenu: 'Menú de perfil', closeMenu: 'Cerrar menú',
  privacyBody: 'Tu diario y tus fotos se guardan en el dispositivo. Si consultas las condiciones, se envían las coordenadas y la fecha a Open-Meteo. El mapa solicita teselas para la zona visible. Puedes exportar o borrar tu diario desde Perfil.',
  termsBody: 'Utiliza TrailCatch respetando las normas locales, las licencias de pesca y el acceso a espacios naturales. Comprueba las condiciones antes de salir.',
  units: { km: 'km', min: 'min', m: 'm', kg: 'kg', cm: 'cm', wind: 'km/h', pressure: 'hPa', rain: 'mm', temp: '°C' },
  yesterday: 'ayer', today: 'hoy', tomorrow: 'mañana',
  daysAgo: (days: number) => `hace ${days} días`,
  inDays: (days: number) => `dentro de ${days} días`,
  likes: (count: number) => count === 1 ? '1 Me gusta' : `${count} Me gusta`,
};

const translations: Record<Locale, Partial<typeof es>> = { es, en: {}, ro: {} };
export const locale: Locale = 'es';
export const t = { ...es, ...translations[locale] };

export function relativeDate(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((Date.UTC(year, month - 1, day) - today) / 86400000);
  if (Math.abs(days) <= 30) {
    // Some Expo Go runtimes provide date formatting but omit RelativeTimeFormat.
    if (typeof Intl.RelativeTimeFormat === 'function') {
      return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(days, 'day');
    }
    if (days === -1) return t.yesterday;
    if (days === 0) return t.today;
    if (days === 1) return t.tomorrow;
    return days < 0 ? t.daysAgo(-days) : t.inDays(days);
  }
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(Date.UTC(year, month - 1, day));
}
