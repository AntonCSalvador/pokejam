import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

test('every basketball pose has usable frames inside its credited source image', () => {
  const path = 'public/assets/sprites/manifest.json';
  assert.ok(existsSync(path), 'four-character animation manifest is missing');
  const manifest = JSON.parse(readFileSync(path));
  assert.deepEqual(Object.keys(manifest).sort(), ['charizard', 'heatmor', 'machamp', 'tauros']);
  for (const entry of Object.values(manifest)) {
    for (const action of ['idle','run','dribble','pass','shoot','dunk','block','stagger','signature']) {
      for (const direction of ['left', 'right']) {
        const frames = entry.animations[action][direction];
        assert.ok(frames.length > 1, `${action} needs moving poses`);
        for (const frame of frames) {
          assert.ok(entry.sources.some(s => s.image === frame.image && s.authors.length && s.sourceUrl));
          const png = readFileSync(resolve('public', frame.image));
          assert.equal(png.toString('ascii', 12, 16), 'IHDR');
          const [x,y,w,h] = frame.rect;
          assert.ok(x >= 0 && y >= 0 && w > 0 && h > 0 && x+w <= png.readUInt32BE(16) && y+h <= png.readUInt32BE(20));
          assert.ok(frame.durationMs > 0);
          assert.ok([...frame.pivot,...frame.ballAnchor].every(Number.isFinite));
        }
      }
    }
  }
});
