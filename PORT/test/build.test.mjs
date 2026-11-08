import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {root,pages} from '../scripts/check.mjs';

test('a replaced CV is kept in a backup and excluded from later public builds',() => {
  const fixture = fs.mkdtempSync(
    path.join(os.tmpdir(),'portfolio-build-regression-')
  );

  fs.mkdirSync(path.join(fixture,'scripts'));

  fs.writeFileSync(
    path.join(fixture,'package.json'),
    '{"type":"module"}'
  );

  for (const file of ['build.mjs','check.mjs']) {
    fs.copyFileSync(
      path.join(root,'scripts',file),
      path.join(fixture,'scripts',file)
    );
  }

  for (const file of pages) {
    fs.writeFileSync(
      path.join(fixture,file),
      'Current page fixture'
    );
  }

  for (const name of ['assets','cv','pfp','pp']) {
    fs.mkdirSync(path.join(fixture,name));
  }

  fs.writeFileSync(
    path.join(fixture,'cv/LEONARD DACPANO CV.pdf'),
    'Current PDF fixture'
  );

  fs.mkdirSync(
    path.join(fixture,'dist/cv'),
    {recursive:true}
  );

  fs.writeFileSync(
    path.join(fixture,'dist/cv/MyCV.docx'),
    'Previous CV fixture'
  );

  const build = () => {
    const result = spawnSync(
      process.execPath,
      ['scripts/build.mjs'],
      {cwd:fixture,encoding:'utf8'}
    );

    assert.equal(result.status,0,result.stdout + result.stderr);
  };

  build();

  const backups = () => fs
    .readdirSync(fixture)
    .filter(name => name.startsWith('.portfolio-build-backups-'));

  assert.equal(backups().length,1);

  const previous = path.join(
    fixture,
    backups()[0],
    'cv/MyCV.docx'
  );

  assert.equal(
    fs.readFileSync(previous,'utf8'),
    'Previous CV fixture'
  );

  assert.equal(
    fs.existsSync(path.join(fixture,'dist/cv/MyCV.docx')),
    false
  );

  assert.equal(
    fs.readFileSync(
      path.join(fixture,'dist/cv/LEONARD DACPANO CV.pdf'),
      'utf8'
    ),
    'Current PDF fixture'
  );

  build();

  assert.equal(backups().length,1);

  assert.equal(
    fs.readFileSync(previous,'utf8'),
    'Previous CV fixture'
  );
});
