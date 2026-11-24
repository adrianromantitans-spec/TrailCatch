export const locales = ['es', 'en', 'ro'] as const;
export type Locale = (typeof locales)[number];

const es = {
  app: 'TrailCatch', home: 'Inicio', map: 'Mapa', explore: 'Explorar', profile: 'Perfil',
  create: 'Nueva salida', search: 'Buscar', notifications: 'Notificaciones', noNotifications: 'Aún no hay notificaciones',
  type: 'Tipo', category: 'Categoría', fishing: 'Pesca', hike: 'Ruta', both: 'Pesca y ruta',
  title: 'Título', date: 'Fecha', dateHint: 'AAAA-MM-DD', notes: 'Notas', location: 'Ubicación',
  pickPoint: 'Toca el mapa para marcar el lugar', myLocation: 'Usar mi posición',
  locationDenied: 'Permite el acceso a la ubicación para marcar tu posición.',
  locationError: 'No se pudo obtener tu ubicación.', photosError: 'No se pudieron añadir las fotos.',
  photos: 'Fotos', photo: 'Foto de la captura', removePhoto: 'Quitar foto',
  gallery: 'Galería', camera: 'Cámara', takePhoto: 'Hacer foto', addMorePhotos: 'Añadir fotos',
  addCatchPhoto: 'Añadir foto', changeCatchPhoto: 'Cambiar foto', allowCamera: 'Permitir cámara', addingPhotos: 'Preparando fotos…',
  cameraDenied: 'Permite el acceso a la cámara para hacer una foto.',
  cameraError: 'No se pudo abrir la cámara o guardar la foto.', settings: 'Abrir ajustes',
  catches: 'Capturas', addCatch: 'Añadir captura', removeCatch: 'Quitar captura',
  species: 'Especie', size: 'Tamaño (cm)', weight: 'Peso (kg)', bait: 'Cebo o señuelo', time: 'Hora (HH:MM)',
  distance: 'Distancia (km)', duration: 'Duración (min)', ascent: 'Desnivel (m)',
  save: 'Guardar salida', saving: 'Guardando…', required: 'Escribe un título, una fecha válida y marca una ubicación.',
  invalidNumbers: 'Revisa los valores numéricos y las horas de captura.',
  saveError: 'No se pudo guardar la salida.', loadError: 'No se pudieron cargar los datos.',
  retry: 'Reintentar', empty: 'Aún no hay salidas', noResults: 'No hay resultados', noCategoryResults: 'No hay salidas en esta categoría', loading: 'Cargando…',
  like: 'Me gusta', unlike: 'Quitar Me gusta', comment: 'Comentar', comments: 'Comentarios',
  commentPlaceholder: 'Añade un comentario', send: 'Enviar', noComments: 'Aún no hay comentarios',
  shareCatch: 'Compartir captura', shareRoute: 'Compartir ruta', shareImage: 'Compartir imagen',
  shareImageError: 'No se pudo compartir la imagen.',
  bookmark: 'Guardar publicación', unbookmark: 'Quitar de guardados', share: 'Compartir',
  dateRelative: 'Fecha', back: 'Volver', cancel: 'Cancelar', delete: 'Borrar',
  example: 'Ejemplo', sampleAuthor: 'Diario de ejemplo', sampleFishing: 'Pesca en el lago Tarnița',
  sampleFishingNotes: 'Salida de mañana desde la orilla.', sampleHike: 'Ruta por los montes Apuseni',
  sampleHikeNotes: 'Recorrido por el bosque y las praderas.', sampleFish: 'Perca', sampleBait: 'Cucharilla',
  personal: 'Mi diario', outings: 'Salidas', followers: 'Seguidores', following: 'Seguidos',
  saved: 'Guardados', all: 'Todas', searchPlaceholder: 'Buscar salidas por título o notas',
  standard: 'Estándar', satellite: 'Satélite', terrain: 'Relieve', osm: '© OpenStreetMap contributors',
  discoverMap: 'Explorar mapa', mappedTrails: 'Senderos', mappedFishing: 'Pesca', unnamedTrail: 'Sendero',
  fishingPlace: 'Lugar de pesca', searchMapArea: 'Buscar en esta zona', zoomDiscovery: 'El mapa se acercará para buscar alrededor del centro.',
  discoverMapError: 'No se pudieron consultar los datos del mapa. Vuelve a intentarlo.',
  noMappedTrails: 'No hay senderos registrados en esta zona del mapa.',
  noMappedFishing: 'No hay lugares señalados para pescar en esta zona del mapa.',
  selectMapFeature: 'Toca un marcador para ver cómo llegar.', closeMapFeature: 'Cerrar ficha del lugar',
  trailAccessWarning: 'El marcador señala un punto del sendero. Comprueba el acceso y el estado del camino antes de salir.',
  fishingMapWarning: 'Comprueba el acceso, las vedas y la licencia de pesca antes de ir.',
  fishingMapPermit: 'El mapa indica que hace falta un permiso. Comprueba los requisitos locales antes de ir.',
  viewMapArea: 'Ver zona en Maps', directionsToTrail: 'Cómo llegar al sendero',
  mapLocationDenied: 'Permite el acceso a la ubicación para centrar el mapa cerca de ti.',
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
  diary: 'Diario', followingFeed: 'Siguiendo', nearbyFeed: 'Cerca de mí', noPosts: 'Aún no hay publicaciones',
  post: 'Publicación', posts: 'Publicaciones', createMenu: 'Crear', shareLocation: 'Compartir ubicación de la salida', newPost: 'Nueva publicación', publishPost: 'Publicar', caption: 'Descripción',
  more: 'Más', less: 'Menos', follow: 'Seguir', unfollow: 'Dejar de seguir', reply: 'Responder',
  replying: 'Respuesta', viewReplies: 'Ver respuestas', deleteComment: 'Borrar comentario',
  deletePost: 'Borrar publicación', deleteCommentPrompt: '¿Borrar este comentario?', deletePostPrompt: '¿Borrar esta publicación?',
  commentLimit: 'Has alcanzado el límite de 30 comentarios por hora.', reportPost: 'Reportar publicación', reportComment: 'Reportar comentario',
  linkSpot: 'Vincular lugar', linkOuting: 'Vincular salida', openOuting: 'Ver salida', noLink: 'Sin vínculo', postError: 'No se pudo publicar.',
  users: 'Personas', searchUsers: 'Buscar personas', openProfile: 'Ver perfil',
  markRead: 'Marcar como leída', markAllRead: 'Marcar todas como leídas',
  notificationLike: 'Le gustó tu publicación', notificationComment: 'Comentó tu publicación',
  notificationFollow: 'Empezó a seguirte', enablePush: 'Activar notificaciones push',
  pushDenied: 'Permite las notificaciones en los ajustes del teléfono.',
  pushUnavailable: 'Las notificaciones push requieren una compilación de la app configurada.',
  pushEnabled: 'Notificaciones activadas.', publish: 'Publicar en el feed', reportAlready: 'Ya reportaste este contenido.',
  continueAsGuest: 'Entrar como invitado', welcomeBack: 'Bienvenido de nuevo',
  splashSubtitle: 'Diario de pesca y senderismo', skipIntro: 'Saltar animación', brandTrail: 'Trail', brandCatch: 'Catch',
  rememberMe: 'Mantener sesión iniciada', forgotPassword: '¿Olvidaste la contraseña?',
  resetPassword: 'Restablecer contraseña', resetEmail: 'Enviar enlace', resetSent: 'Si la cuenta existe, recibirás un enlace por correo.',
  invalidResetLink: 'El enlace no está disponible o ha caducado. Solicita uno nuevo.',
  newPassword: 'Nueva contraseña', updatePassword: 'Guardar contraseña',
  showPassword: 'Mostrar contraseña', hidePassword: 'Ocultar contraseña',
  orContinueWith: 'O continúa con', google: 'Google', apple: 'Apple',
  providerUnavailable: 'Este método todavía no está habilitado.',
  noAccountYet: '¿No tienes cuenta?', haveAccount: '¿Ya tienes cuenta?', registerLink: 'Regístrate',
  account: 'Cuenta', signIn: 'Iniciar sesión', signUp: 'Registrarse', signOut: 'Cerrar sesión',
  signInGoogle: 'Continuar con Google', email: 'Correo electrónico', password: 'Contraseña',
  saveProfile: 'Guardar perfil', displayName: 'Nombre', bio: 'Biografía', avatarUrl: 'Enlace del avatar', accountSaved: 'Perfil actualizado.',
  checkEmail: 'Revisa tu correo para confirmar la cuenta.', accountError: 'No se pudo completar la operación.',
  backendUnavailable: 'El servicio en línea no está configurado.', signInRequired: 'Inicia sesión para continuar.',
  removeAccount: 'Borrar cuenta', removeAccountPrompt: '¿Borrar la cuenta y su contenido en línea?',
  spots: 'Lugares', openSpot: 'Ver lugar', newSpot: 'Nuevo lugar', spotName: 'Nombre del lugar', spotDescription: 'Descripción',
  spotSpecies: 'Especies separadas por comas', spotDifficulty: 'Dificultad', easy: 'Fácil', moderate: 'Moderada', hard: 'Difícil',
  season: 'Temporada', directions: 'Cómo llegar', permit: 'Requiere permiso o licencia',
  visibility: 'Visibilidad', private: 'Privado', friends: 'Amigos', public: 'Público',
  approximate: 'Ubicación aproximada', saveSpot: 'Guardar lugar', spotMissing: 'El lugar no está disponible.',
  spotError: 'No se pudo guardar el lugar.', spotsEmpty: 'No hay lugares en esta zona.',
  spotSearch: 'Buscar lugares', placeSearch: 'Buscar población o zona', spotFilters: 'Filtros', nearMe: 'Cerca de mí', spotWarning: 'Las rutas son orientativas. Comprueba la normativa y las condiciones antes de salir.',
  report: 'Reportar', reportSpot: 'Reportar lugar', reportUser: 'Reportar usuario', block: 'Bloquear', reportReason: 'Motivo', reportSent: 'Reporte enviado.', reports: 'Reportes', adminReportSubject: 'TrailCatch · Nuevo reporte', noReports: 'No hay reportes.',
  blockPrompt: '¿Bloquear a este usuario?', actionError: 'No se pudo completar la acción.',
  privacy: 'Privacidad', terms: 'Términos', profileMenu: 'Menú de perfil', closeMenu: 'Cerrar menú',
  privacyBody: 'Tu diario y tus fotos se guardan en el dispositivo. Si consultas las condiciones, se envían las coordenadas y la fecha a Open-Meteo. El mapa solicita teselas para la zona visible. Puedes exportar o borrar tu diario desde Perfil. Las tarjetas compartidas incluyen la foto y los datos visibles de la captura o ruta. Si usas una cuenta, guardamos tus publicaciones, comentarios, seguidores, guardados y notificaciones. El token push se registra al activarlas. Puedes borrar la cuenta y su contenido en línea desde Cuenta.',
  termsBody: 'Utiliza TrailCatch respetando las normas locales, las licencias de pesca y el acceso a espacios naturales. Comprueba las condiciones antes de salir. Debes tener al menos 16 años. Publica solo contenido propio o autorizado. Se prohíben el acoso y el contenido ilegal u ofensivo. Puedes reportar contenido, bloquear usuarios y borrar tu cuenta y sus publicaciones, comentarios y Me gusta.',
  units: { km: 'km', min: 'min', m: 'm', kg: 'kg', cm: 'cm', wind: 'km/h', pressure: 'hPa', rain: 'mm', temp: '°C' },
  yesterday: 'ayer', today: 'hoy', tomorrow: 'mañana',
  daysAgo: (days: number) => `hace ${days} días`,
  inDays: (days: number) => `dentro de ${days} días`,
  likes: (count: number) => count === 1 ? '1 Me gusta' : `${count} Me gusta`,
};

const translations: Record<Locale, Partial<typeof es>> = {
  es,
  en: {
    discoverMap: 'Explore map', mappedTrails: 'Trails', mappedFishing: 'Fishing', unnamedTrail: 'Trail',
    fishingPlace: 'Fishing spot', searchMapArea: 'Search this area', zoomDiscovery: 'The map will zoom in and search around the centre.',
    discoverMapError: 'Could not load map data. Try again.', noMappedTrails: 'No trails are mapped in this area.',
    noMappedFishing: 'No fishing spots are marked in this area.', selectMapFeature: 'Tap a marker for directions.',
    closeMapFeature: 'Close place details', trailAccessWarning: 'The marker shows a point on the trail. Check access and trail conditions before you go.',
    fishingMapWarning: 'Check access, closures and fishing licence requirements before you go.',
    fishingMapPermit: 'The map indicates a permit is required. Check local requirements before you go.',
    viewMapArea: 'View area in Maps', directionsToTrail: 'Directions to the trail',
    mapLocationDenied: 'Allow location access to centre the map near you.',
  },
  ro: {
    discoverMap: 'Explorează harta', mappedTrails: 'Trasee', mappedFishing: 'Pescuit', unnamedTrail: 'Traseu',
    fishingPlace: 'Loc de pescuit', searchMapArea: 'Caută în această zonă', zoomDiscovery: 'Harta se va mări pentru a căuta în jurul centrului.',
    discoverMapError: 'Datele hărții nu au putut fi încărcate. Încearcă din nou.', noMappedTrails: 'Nu sunt trasee înregistrate pe hartă în această zonă.',
    noMappedFishing: 'Nu sunt locuri de pescuit marcate în această zonă.', selectMapFeature: 'Atinge un marcaj pentru indicații.',
    closeMapFeature: 'Închide detaliile locului', trailAccessWarning: 'Marcajul indică un punct pe traseu. Verifică accesul și starea traseului înainte de plecare.',
    fishingMapWarning: 'Verifică accesul, perioadele de prohibiție și permisul de pescuit înainte de plecare.',
    fishingMapPermit: 'Harta indică faptul că ai nevoie de permis. Verifică cerințele locale înainte de plecare.',
    viewMapArea: 'Vezi zona în Maps', directionsToTrail: 'Cum ajungi la traseu',
    mapLocationDenied: 'Permite accesul la locație pentru a centra harta în apropierea ta.',
  },
};
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
