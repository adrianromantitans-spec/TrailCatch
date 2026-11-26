import type { DiscoveryFeature } from './mapDiscovery';

type Guide = NonNullable<DiscoveryFeature['guide']>;

function route(id: string, name: string, latitude: number, longitude: number, guide: Guide): DiscoveryFeature {
  return { id: `europe-trail:${id}`, name, point: { latitude, longitude }, lines: [], isArea: true, requiresPermit: false, guide };
}

// Overview pins indicate a reference locality. Detailed lines come from the local OpenStreetMap search.
export const europeanTrailAreas = [
  route('camino-frances', 'Camino de Santiago · Camino Francés', 42.708, -7.043, {
    country: 'España', reference: 'O Cebreiro', authority: 'Xunta de Galicia',
    url: 'https://www.caminodesantiago.gal/es/planifica/las-rutas/camino-frances',
  }),
  route('rota-vicentina', 'Rota Vicentina · Aljezur–Arrifana', 37.321, -8.804, {
    country: 'Portugal', reference: 'Aljezur', authority: 'Rota Vicentina',
    url: 'https://rotavicentina.com/en/walking/fishermens-trail-aljezur-arrifana/',
  }),
  route('azores', 'Senderos de São Miguel · Azores', 37.858, -25.794, {
    country: 'Portugal', reference: 'Sete Cidades', authority: 'Visit Azores',
    url: 'https://trails.visitazores.com/en',
  }),
  route('pyrenees-andorra', 'Senderos de los Pirineos · Andorra', 42.547, 1.515, {
    country: 'Andorra', reference: 'La Massana', authority: 'Visit Andorra',
    url: 'https://visitandorra.com/en/nature/hiking/',
  }),
  route('tour-mont-blanc', 'Tour du Mont Blanc', 45.890, 6.799, {
    country: 'Francia', reference: 'Les Houches', authority: 'Autour du Mont Blanc',
    url: 'https://www.autourdumontblanc.com/en/',
  }),
  route('gr20', 'GR20 · Córcega', 42.508, 8.856, {
    country: 'Francia', reference: 'Calenzana', authority: 'Le GR20',
    url: 'https://www.le-gr20.fr/',
  }),
  route('west-highland-way', 'West Highland Way', 55.941, -4.317, {
    country: 'Reino Unido', reference: 'Milngavie', authority: 'West Highland Way',
    url: 'https://www.westhighlandway.org/',
  }),
  route('south-west-coast-path', 'South West Coast Path', 51.209, -3.475, {
    country: 'Reino Unido', reference: 'Minehead', authority: 'South West Coast Path Association',
    url: 'https://www.southwestcoastpath.org.uk/',
  }),
  route('kerry-way', 'Kerry Way', 52.059, -9.507, {
    country: 'Irlanda', reference: 'Killarney', authority: 'Sport Ireland',
    url: 'https://www.sportireland.ie/outdoors/walking/trails/kerry-way',
  }),
  route('via-alpina', 'Via Alpina · Suiza', 46.821, 8.405, {
    country: 'Suiza', reference: 'Engelberg', authority: 'SwitzerlandMobility',
    url: 'https://schweizmobil.ch/en/hiking-in-switzerland/route-1',
  }),
  route('via-francigena', 'Via Francigena · Toscana', 43.467, 11.043, {
    country: 'Italia', reference: 'San Gimignano', authority: 'European Association of the Via Francigena Ways',
    url: 'https://www.viefrancigene.org/en/',
  }),
  route('rheinsteig', 'Rheinsteig', 49.980, 7.925, {
    country: 'Alemania', reference: 'Rüdesheim am Rhein', authority: 'Romantischer Rhein',
    url: 'https://www.rheinsteig.de/rheinsteig',
  }),
  route('rennsteig', 'Rennsteig', 51.006, 10.231, {
    country: 'Alemania', reference: 'Hörschel', authority: 'Rennsteig',
    url: 'https://www.rennsteig.de/',
  }),
  route('pieterpad', 'Pieterpad', 53.400, 6.452, {
    country: 'Países Bajos', reference: 'Pieterburen', authority: 'Stichting Pieterpad',
    url: 'https://www.pieterpad.nl/',
  }),
  route('escapardenne-eislek', 'Escapardenne Éislek Trail', 49.951, 6.016, {
    country: 'Luxemburgo', reference: 'Kautenbach', authority: 'Visit Éislek',
    url: 'https://www.visit-eislek.lu/fr/decouvrir-la-nature/escapardenne',
  }),
  route('escapardenne-ourthe', 'Escapardenne · Ardenas belgas', 50.183, 5.575, {
    country: 'Bélgica', reference: 'La Roche-en-Ardenne', authority: 'Visit Éislek',
    url: 'https://www.visit-eislek.lu/fr/decouvrir-la-nature/escapardenne',
  }),
  route('kungsleden', 'Kungsleden', 68.358, 18.783, {
    country: 'Suecia', reference: 'Abisko Turiststation', authority: 'Swedish Tourist Association',
    url: 'https://www.swedishtouristassociation.com/trails/kungsleden/',
  }),
  route('besseggen', 'Besseggen', 61.496, 8.811, {
    country: 'Noruega', reference: 'Gjendesheim', authority: 'Besseggen',
    url: 'https://besseggen.net/',
  }),
  route('karhunkierros', 'Karhunkierros · Parque Nacional de Oulanka', 66.365, 29.320, {
    country: 'Finlandia', reference: 'Oulanka Visitor Centre', authority: 'Metsähallitus',
    url: 'https://www.luontoon.fi/en/destinations/oulanka-national-park',
  }),
  route('laugavegur', 'Laugavegur', 63.990, -19.061, {
    country: 'Islandia', reference: 'Landmannalaugar', authority: 'Ferðafélag Íslands',
    url: 'https://www.fi.is/en/hiking-trails/trails/view/laugavegur',
  }),
  route('baltic-coastal-ee', 'Baltic Coastal Hiking · Estonia', 58.385, 24.502, {
    country: 'Estonia', reference: 'Pärnu', authority: 'Baltic Trails',
    url: 'https://baltictrails.eu/en/coastal',
  }),
  route('baltic-coastal-lv', 'Baltic Coastal Hiking · Letonia', 56.974, 23.802, {
    country: 'Letonia', reference: 'Jūrmala', authority: 'Baltic Trails',
    url: 'https://baltictrails.eu/en/coastal',
  }),
  route('baltic-coastal-lt', 'Baltic Coastal Hiking · Lituania', 55.306, 20.999, {
    country: 'Lituania', reference: 'Nida', authority: 'Baltic Trails',
    url: 'https://baltictrails.eu/en/coastal',
  }),
  route('stezka-ceskem', 'Stezka Českem · Tramo occidental', 50.224, 12.193, {
    country: 'Chequia', reference: 'Aš', authority: 'Stezka Českem',
    url: 'https://www.stezkaceskem.cz/en/',
  }),
  route('cesta-snp', 'Cesta hrdinov SNP', 48.175, 16.980, {
    country: 'Eslovaquia', reference: 'Devín', authority: 'Cesta SNP',
    url: 'https://cestasnp.sk/',
  }),
  route('trzy-korony', 'Trzy Korony · Parque Nacional de Pieniny', 49.402, 20.417, {
    country: 'Polonia', reference: 'Sromowce Niżne', authority: 'Parque Nacional de Pieniny',
    url: 'https://piepn.gov.pl/szlaki-turystyczne',
  }),
  route('blue-trail', 'Országos Kéktúra · Sendero Azul', 47.138, 17.211, {
    country: 'Hungría', reference: 'Sümeg', authority: 'Magyar Természetjáró Szövetség',
    url: 'https://www.kektura.hu/',
  }),
  route('via-transilvanica', 'Via Transilvanica', 47.868, 25.598, {
    country: 'Rumanía', reference: 'Putna', authority: 'Tășuleasa Social',
    url: 'https://www.viatransilvanica.com/en',
  }),
  route('juliana', 'Juliana Trail · Alpes Julianos', 46.485, 13.785, {
    country: 'Eslovenia', reference: 'Kranjska Gora', authority: 'Kranjska Gora Tourism',
    url: 'https://kranjska-gora.si/en/activities/juliana-trail',
  }),
  route('via-adriatica', 'Via Adriatica · Istria', 44.796, 13.915, {
    country: 'Croacia', reference: 'Premantura', authority: 'Via Adriatica',
    url: 'https://viaadriatica.org/',
  }),
  route('menalon', 'Menalon Trail', 37.557, 22.078, {
    country: 'Grecia', reference: 'Stemnitsa', authority: 'Menalon Trail',
    url: 'https://menalontrail.eu/',
  }),
  route('akamas', 'Senderos de la península de Akamas', 35.056, 32.347, {
    country: 'Chipre', reference: 'Baños de Afrodita', authority: 'Visit Cyprus',
    url: 'https://www.visitcyprus.com/multimedia/nature-trails-and-hiking-map/',
  }),
];
