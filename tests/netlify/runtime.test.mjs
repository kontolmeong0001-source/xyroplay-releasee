import test from 'node:test';
import assert from 'node:assert/strict';
import {getPool} from '../../netlify/lib/database.mjs';

test('native database resolves at function runtime without the NETLIFY build marker', async()=>{
  const connection=process.env.TEST_DATABASE_URL;
  assert.ok(connection);
  const url=new URL(connection);
  assert.ok(['127.0.0.1','localhost','[::1]'].includes(url.hostname));
  assert.match(url.pathname,/_test$/);
  const previous=globalThis.Netlify;
  globalThis.Netlify={env:{get:key=>key==='NETLIFY_DB_URL'?connection:undefined}};
  let pool;
  try{
    pool=await getPool({XYRO_ALLOW_LOCAL_DB:'true'});
    assert.ok(pool,'SDK must resolve native runtime environment without env.NETLIFY');
    assert.equal((await pool.query('SELECT 1 AS ready')).rows[0].ready,1);
  }finally{
    if(pool)await pool.end();
    if(previous===undefined)delete globalThis.Netlify;else globalThis.Netlify=previous;
  }
});
