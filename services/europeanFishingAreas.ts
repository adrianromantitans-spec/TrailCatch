import type { DiscoveryFeature } from './mapDiscovery';

type Guide = NonNullable<DiscoveryFeature['guide']>;

function area(id: string, name: string, latitude: number, longitude: number, guide: Guide, isAccessPoint = false): DiscoveryFeature {
  return { id: `europe:${id}`, name, point: { latitude, longitude }, lines: [], isArea: !isAccessPoint, requiresPermit: false, guide };
}

// Pins are approximate area references, except where the source identifies a specific access point.
export const europeanFishingAreas = [
  area('ebro', 'Embalse de Mequinenza · Mar de Aragón', 41.372, 0.161, {
    country: 'España', reference: 'Caspe', authority: 'Gobierno de Aragón',
    url: 'https://www.aragon.es/-/planificacion-de-la-pesca',
  }),
  area('lac-du-der', 'Lac du Der-Chantecoq', 48.553, 4.756, {
    country: 'Francia', reference: 'Maison des Pêcheurs, Giffaumont-Champaubert', authority: 'Office de Tourisme du Lac du Der',
    url: 'https://www.lacduder.com/es/organizarse/actividades/todas-las-actividades-de-ocio/pesca/',
  }),
  area('rutland', 'Rutland Water', 52.653, -0.644, {
    country: 'Reino Unido', reference: 'Rutland Water Fishing Lodge, Edith Weston', authority: 'Anglian Water Parks',
    url: 'https://anglianwaterparks.co.uk/rutland-water-park/fishing',
  }),
  area('lomond', 'Loch Lomond', 56.114, -4.613, {
    country: 'Reino Unido', reference: 'Balmaha', authority: 'Loch Lomond Angling Improvement Association',
    url: 'https://www.lochlomondangling.com/',
  }),
  area('corrib', 'Lough Corrib', 53.438, -9.219, {
    country: 'Irlanda', reference: 'Oughterard', authority: 'Inland Fisheries Ireland',
    url: 'https://fishinginireland.info/trout/west/corrib/',
  }),
  area('derg', 'Lough Derg · Shannon', 52.862, -8.418, {
    country: 'Irlanda', reference: 'Killaloe', authority: 'Inland Fisheries Ireland',
    url: 'https://fishinginireland.info/pike/shannon/killaloe/',
  }),
  area('ijsselmeer', 'IJsselmeer', 52.742, 5.407, {
    country: 'Países Bajos', reference: 'Enkhuizen', authority: 'Sportvisunie',
    url: 'https://www.sportvisunie.nl/nl/artikelen/ijsselmeer',
  }),
  area('skjern', 'Skjern Å · Plataforma de Albæk', 55.9419212, 8.5757674, {
    country: 'Dinamarca', reference: 'Albæk', authority: 'Fishing in Denmark',
    url: 'https://fishingindenmark.info/en/fishing-spots',
  }, true),
  area('thingvallavatn', 'Þingvallavatn', 64.181, -21.123, {
    country: 'Islandia', reference: 'Þingvellir', authority: 'Veiðikortið',
    url: 'https://veidikortid.is/veidisvaedi/thingvallavatn/',
  }),
  area('vanern', 'Lago Vänern', 58.806, 13.562, {
    country: 'Suecia', reference: 'Mariestad', authority: 'Lake Vänern',
    url: 'https://www.lakevanern.se/en/life-lake-vanern/fishing/',
  }),
  area('vattern', 'Lago Vättern', 58.325, 14.356, {
    country: 'Suecia', reference: 'Hjo', authority: 'Vätternvårdsförbundet',
    url: 'https://vattern.org/fisk-och-fiske/fiska-i-vattern/',
  }),
  area('inari', 'Lago Inari', 69.063, 27.606, {
    country: 'Finlandia', reference: 'Inari', authority: 'Fishing in Finland',
    url: 'https://fishinginfinland.fi/properties/inari-onnela-wilderness-services/',
  }),
  area('mazury', 'Región de los Grandes Lagos de Masuria', 53.928, 21.638, {
    country: 'Polonia', reference: 'Mikołajki', authority: 'Mazury Travel',
    url: 'https://mazury.travel/wedkarstwo-podlodowe-na-warmii-i-mazurach/',
  }),
  area('garda', 'Lago de Garda · norte', 45.87, 10.875, {
    country: 'Italia', reference: 'Riva del Garda', authority: 'Trentino Marketing',
    url: 'https://www.trentinofishing.it/en',
  }),
  area('soca', 'Río Soča · Čezsoča–Tolmin', 46.236, 13.694, {
    country: 'Eslovenia', reference: 'Tolmin', authority: 'Ribiška družina Tolmin',
    url: 'https://www.ribiskekarte.si/en/rd-tolmin/soca-5',
  }),
  area('balaton', 'Lago Balaton', 46.898, 17.873, {
    country: 'Hungría', reference: 'Balatonfüred', authority: 'Balatoni Halgazdálkodási Zrt.',
    url: 'https://balatonihal.hu/balatoni-horgaszrend',
  }),
  area('danube-delta', 'Delta del Danubio', 45.052, 29.246, {
    country: 'Rumanía', reference: 'Murighiol', authority: 'Reserva de la Biosfera del Delta del Danubio',
    url: 'https://permise.ddbra.ro/',
  }),
];
