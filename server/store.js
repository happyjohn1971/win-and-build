import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import {SAMPLE_COMPETITIONS,OLD_SEED_IDS} from './seed-data.js';

function cloneSeed(){
  return SAMPLE_COMPETITIONS.map(record=>({...record,questions:record.questions.map(q=>({...q,options:[...q.options]}))}));
}

/** True when the store still holds the original three starter prizes at revision 1 (never admin-edited). */
export function isUntouchedOldSeed(records){
  if(!Array.isArray(records)||records.length!==OLD_SEED_IDS.length)return false;
  const expected=new Set(OLD_SEED_IDS);
  const seen=new Set();
  for(const record of records){
    if(!expected.has(record.id)||record.revision!==1||seen.has(record.id))return false;
    seen.add(record.id);
  }
  return seen.size===OLD_SEED_IDS.length;
}

function createFileStore(directory){
  const file=path.join(directory,'competitions.json');
  function read(){
    if(!fs.existsSync(file))return [];
    const records=JSON.parse(fs.readFileSync(file,'utf8'));
    if(!Array.isArray(records))throw Error('Invalid competition store');
    return records;
  }
  function write(records){
    fs.mkdirSync(directory,{recursive:true,mode:0o700});
    const temp=file+'.tmp';
    fs.writeFileSync(temp,JSON.stringify(records),{mode:0o600});
    fs.renameSync(temp,file);
  }
  return {
    async list(){return read();},
    async save(records){write(records);},
    async close(){}
  };
}

function createPostgresStore(databaseUrl){
  const pool=new pg.Pool({connectionString:databaseUrl,max:5});
  let ready;
  async function ensureTable(){
    if(ready)return ready;
    ready=pool.query(`CREATE TABLE IF NOT EXISTS competitions (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL
    )`);
    await ready;
    return ready;
  }
  return {
    async list(){
      await ensureTable();
      const {rows}=await pool.query('SELECT data FROM competitions ORDER BY (data->>\'updatedAt\') ASC NULLS FIRST');
      return rows.map(row=>row.data);
    },
    async save(records){
      await ensureTable();
      const client=await pool.connect();
      try{
        await client.query('BEGIN');
        await client.query('DELETE FROM competitions');
        for(const record of records){
          await client.query('INSERT INTO competitions (id, data) VALUES ($1, $2::jsonb)',[record.id,JSON.stringify(record)]);
        }
        await client.query('COMMIT');
      }catch(error){
        await client.query('ROLLBACK');
        throw error;
      }finally{
        client.release();
      }
    },
    async close(){await pool.end();}
  };
}

export async function createCompetitionStore(env){
  if(env.DATABASE_URL){
    return createPostgresStore(env.DATABASE_URL);
  }
  const directory=env.ADMIN_DATA_DIR||new URL('./data/',import.meta.url).pathname;
  return createFileStore(directory);
}

export async function ensureSeeded(store){
  const records=await store.list();
  if(!records.length||isUntouchedOldSeed(records)){
    const seeded=cloneSeed();
    await store.save(seeded);
    return seeded;
  }
  return records;
}
