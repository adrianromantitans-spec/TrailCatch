import type { SQLiteDatabase } from 'expo-sqlite';
import { t } from '../i18n';
import { localDate, Outing, OutingType, PAGE_SIZE } from './model';

type Row = { data: string };
type Filter = { query?: string; type?: OutingType; saved?: boolean };

function seed(): Outing[] {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return [
    {
      id: 'example-lake', type: 'fishing', title: t.sampleFishing, date: localDate(),
      notes: t.sampleFishingNotes, point: { latitude: 46.732, longitude: 23.281 },
      photos: [{ sample: 'lake' }],
      catches: [{ species: t.sampleFish, size: 28, weight: 0.36, bait: t.sampleBait, time: '08:25' }],
      sample: true, likes: 24, liked: false, saved: false, comments: [],
    },
    {
      id: 'example-trail', type: 'hike', title: t.sampleHike, date: localDate(yesterday),
      notes: t.sampleHikeNotes, point: { latitude: 46.598, longitude: 23.183 },
      photos: [{ sample: 'trail' }], catches: [], route: { distance: 8.4, duration: 155, ascent: 320 },
      sample: true, likes: 16, liked: false, saved: false, comments: [],
    },
  ];
}

const insertSql = 'INSERT INTO outings (id, date, type, sample, search_text, data) VALUES (?, ?, ?, ?, ?, ?)';

function outingValues(outing: Outing) {
  const search = [outing.title, outing.notes, ...outing.catches.map((item) => item.species)].join(' ');
  return [outing.id, outing.date, outing.type, Number(!!outing.sample), normalize(search), JSON.stringify(outing)];
}

export async function initialize(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL');
  await db.withExclusiveTransactionAsync(async (tx) => {
    const version = (await tx.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version ?? 0;
    if (version >= 2) return;
    await tx.execAsync(`
      CREATE TABLE IF NOT EXISTS outings (
        id TEXT PRIMARY KEY NOT NULL, date TEXT NOT NULL, type TEXT NOT NULL,
        sample INTEGER NOT NULL, search_text TEXT NOT NULL, data TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS outings_order ON outings (date DESC, id DESC);
      DELETE FROM outings WHERE rowid IN (
        SELECT rowid FROM (
          SELECT rowid, ROW_NUMBER() OVER (PARTITION BY id ORDER BY date DESC, rowid DESC) AS duplicate_rank
          FROM outings
        ) WHERE duplicate_rank > 1
      );
      DELETE FROM outings WHERE rowid IN (
        SELECT rowid FROM (
          SELECT rowid, ROW_NUMBER() OVER (
            PARTITION BY COALESCE(NULLIF(json_extract(data, '$.id'), ''), id)
            ORDER BY (id = json_extract(data, '$.id')) DESC, date DESC, rowid DESC
          ) AS duplicate_rank
          FROM outings
        ) WHERE duplicate_rank > 1
      );
      UPDATE outings SET data = json_set(data, '$.id', id)
      WHERE json_extract(data, '$.id') IS NOT id;
    `);
    // A normal installation already enforces this through the primary key.
    const idColumn = await tx.getFirstAsync<{ pk: number }>("SELECT pk FROM pragma_table_info('outings') WHERE name = 'id'");
    if (!idColumn?.pk) await tx.execAsync('CREATE UNIQUE INDEX IF NOT EXISTS outings_unique_id ON outings(id)');
    if (version === 0) {
      for (const outing of seed()) {
        await tx.runAsync(`${insertSql} ON CONFLICT(id) DO NOTHING`, ...outingValues(outing));
      }
    }
    await tx.execAsync('PRAGMA user_version = 2');
  });
}

export async function insertOuting(db: SQLiteDatabase, outing: Outing) {
  await db.runAsync(insertSql, ...outingValues(outing));
}

export async function putOuting(db: SQLiteDatabase, outing: Outing) {
  await db.runAsync(
    `${insertSql}
     ON CONFLICT(id) DO UPDATE SET date=excluded.date, type=excluded.type, sample=excluded.sample,
     search_text=excluded.search_text, data=excluded.data`,
    ...outingValues(outing),
  );
}

function normalize(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

export async function allOutings(db: SQLiteDatabase) {
  const rows = await db.getAllAsync<Row>('SELECT data FROM outings ORDER BY date DESC, id DESC');
  return rows.map(({ data }) => JSON.parse(data) as Outing);
}

export async function pageOutings(db: SQLiteDatabase, page: number, filter: Filter = {}, pageCount = 1) {
  const limit = PAGE_SIZE * pageCount;
  const rows = await db.getAllAsync<Row>(
    `SELECT data FROM outings WHERE instr(search_text, ?) > 0
     AND (? IS NULL OR type = ?)
     AND (? = 0 OR json_extract(data, '$.saved') = 1)
     ORDER BY date DESC, id DESC LIMIT ? OFFSET ?`,
    normalize(filter.query?.trim() ?? ''), filter.type ?? null, filter.type ?? null, Number(!!filter.saved),
    limit + 1, page * PAGE_SIZE,
  );
  return { items: rows.slice(0, limit).map(({ data }) => JSON.parse(data) as Outing), more: rows.length > limit };
}

export async function getOuting(db: SQLiteDatabase, id: string) {
  const row = await db.getFirstAsync<Row>('SELECT data FROM outings WHERE id = ?', id);
  return row ? JSON.parse(row.data) as Outing : null;
}

export async function updateOuting(db: SQLiteDatabase, id: string, update: (value: Outing) => Outing) {
  await db.withExclusiveTransactionAsync(async (tx) => {
    const row = await getOuting(tx, id);
    if (row) await putOuting(tx, update(row));
  });
}

export async function deleteOutings(db: SQLiteDatabase, samplesOnly: boolean) {
  if (samplesOnly) await db.runAsync('DELETE FROM outings WHERE sample = 1');
  else await db.runAsync('DELETE FROM outings');
}
