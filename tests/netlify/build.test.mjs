import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
test('build only publishes an exact allowlist of public assets',async()=>{
  execFileSync(process.execPath,['scripts/netlify-build.mjs'],{cwd:root});
  const expected=['index.html','privacy.html','deletion.html','recovery.html','app.js','account-pages.js','app.css','site.css','brand.svg','config.js','events.js','release.js','spotify.js'].sort();
  const names=(await readdir(new URL('../../dist/',import.meta.url))).sort();
  assert.deepEqual(names,expected);
  for(const name of names){
    assert.deepEqual(await readFile(new URL(`../../dist/${name}`,import.meta.url)),await readFile(new URL(`../../web/${name}`,import.meta.url)));
  }
});
test('release remains unconfigured and Netlify config cannot target an existing site or domain',async()=>{
  const config=await readFile(new URL('../../web/config.js',import.meta.url),'utf8');
  assert.match(config,/"apiBase": ""/);
  const release=JSON.parse(await readFile(new URL('../../release.json',import.meta.url),'utf8'));
  assert.equal(release.releaseReady,false);
  const toml=await readFile(new URL('../../netlify.toml',import.meta.url),'utf8');
  assert.match(toml,/publish = "dist"/);
  assert.match(toml,/functions = "netlify\/functions"/);
  assert.doesNotMatch(toml,/^\s*(site_id|domain|domains)\s*=/m);
  assert.doesNotMatch(toml,/\[\[plugins\]\]/);
});
