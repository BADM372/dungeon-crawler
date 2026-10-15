import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STEP, pace, gameTime, pause, resume, setSpeed, step, resetPace } from '../src/game/pace.js';

test('game time follows real time at the chosen speed', () => {
  resetPace();
  assert.equal(gameTime(0.02), 0.02);
  setSpeed(0.25);
  assert.equal(gameTime(0.02), 0.005);
  assert.throws(() => setSpeed(0));
  assert.throws(() => setSpeed(5));
  resetPace();
  assert.equal(pace.speed, 1);
});

test('paused, time stands still; steps run one fixed frame each, then resolve', async () => {
  resetPace();
  pause();
  assert.equal(gameTime(0.02), 0);
  let done = false;
  const stepped = step(3).then(() => { done = true; });
  assert.deepEqual([gameTime(0.02), gameTime(0.02)], [STEP, STEP]);
  await Promise.resolve();
  assert.equal(done, false, 'not before the last step');
  assert.equal(gameTime(0.02), STEP);
  await stepped;
  assert.equal(done, true);
  assert.equal(gameTime(0.02), 0, 'and paused again after them');
  resume();
  assert.equal(gameTime(0.02), 0.02);
});

test('resuming lets go of anyone waiting for steps', async () => {
  resetPace();
  const stepped = step(100);
  resume();
  await stepped;
  assert.equal(pace.paused, false);
});
