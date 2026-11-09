import test from 'node:test';
import assert from 'node:assert/strict';
import { activityLabel, createActivityReporter } from '../activity.mjs';

function fixture(send) {
  const packets = [], timers = new Set();
  const reporter = createActivityReporter({ send: send ?? ((packet) => packets.push(packet)),
    setIntervalFn: (fn) => { timers.add(fn); return fn; },
    clearIntervalFn: (fn) => timers.delete(fn) });
  return { reporter, packets, timers, tick: () => [...timers].forEach((fn) => fn()) };
}

test('existing status and typing signals reflect task start, heartbeat, and completion', () => {
  const { reporter, packets, timers, tick } = fixture();
  reporter.connect();
  assert.deepEqual(packets.shift(), { type: 'here', where: 'Idle · listening' });
  reporter.update('Working · #general', 'general-id');
  assert.deepEqual(packets.splice(0), [
    { type: 'here', where: 'Working · #general' },
    { type: 'typing', channelId: 'general-id', typing: true }]);
  assert.equal(timers.size, 1);
  tick();
  assert.deepEqual(packets.splice(0), [{ type: 'typing', channelId: 'general-id', typing: true }]);
  reporter.update('Idle · listening');
  assert.deepEqual(packets.splice(0), [
    { type: 'here', where: 'Idle · listening' },
    { type: 'typing', channelId: 'general-id', typing: false }]);
  assert.equal(timers.size, 0);
});

test('working state is restored after reconnect without another task or connection', () => {
  const { reporter, packets, timers, tick } = fixture();
  reporter.update('Working', 'general-id');
  assert.equal(packets.length, 0);
  reporter.connect();
  reporter.disconnect();
  assert.equal(timers.size, 0);
  packets.length = 0; tick();
  assert.equal(packets.length, 0);
  reporter.connect();
  assert.deepEqual(packets, [{ type: 'here', where: 'Working' },
    { type: 'typing', channelId: 'general-id', typing: true }]);
  assert.equal(timers.size, 1);
  reporter.stop();
});

test('channel handoff clears old typing and stop clears the timer', () => {
  const { reporter, packets, timers } = fixture();
  reporter.connect(); reporter.update('Working', 'one'); packets.length = 0;
  reporter.update('Working', 'two');
  assert.deepEqual(packets, [{ type: 'typing', channelId: 'one', typing: false },
    { type: 'typing', channelId: 'two', typing: true }]);
  packets.length = 0; reporter.stop();
  assert.deepEqual(packets, [{ type: 'here', where: 'Offline' },
    { type: 'typing', channelId: 'two', typing: false }]);
  assert.equal(timers.size, 0);
});

test('transport failures do not fail the task and are retried on reconnect', () => {
  let fail = true; const packets = [];
  const { reporter, timers } = fixture((packet) => {
    if (fail) throw new Error('socket closed'); packets.push(packet);
  });
  reporter.update('Working', 'one');
  assert.doesNotThrow(() => reporter.connect());
  assert.equal(timers.size, 0);
  fail = false; reporter.connect();
  assert.deepEqual(packets, [{ type: 'here', where: 'Working' },
    { type: 'typing', channelId: 'one', typing: true }]);
  reporter.stop();
});

test('labels obey the server limit and repeated state does not flood presence', () => {
  assert.equal(activityLabel(' x\n\x00y '), 'x  y');
  assert.equal(activityLabel('x'.repeat(79) + '🚀'), 'x'.repeat(79));
  const { reporter, packets } = fixture(); reporter.connect();
  reporter.update('Idle · listening'); reporter.update('Idle · listening');
  assert.equal(packets.length, 1);
  reporter.stop();
});
