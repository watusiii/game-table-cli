import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { WebSocketServer } from 'ws';

test('activity CLI uses existing here message and waits for its own member acknowledgement', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'table-activity-'));
  const server = new WebSocketServer({ port: 0, host: '127.0.0.1' });
  await once(server, 'listening');
  const packets = [];
  let acknowledged = false;
  server.on('connection', (socket) => {
    socket.on('message', (raw) => {
      const packet = JSON.parse(raw.toString()); packets.push(packet);
      if (packet.type === 'join') {
        socket.send(JSON.stringify({ type: 'snapshot', youId: 'self', roomName: 'Test',
          role: 'member', can: [], members: [], messages: [], channels: [] }));
        socket.send(JSON.stringify({ type: 'preview' }));
      } else if (packet.type === 'here') {
        // An unrelated member with the same label is not our receipt.
        socket.send(JSON.stringify({ type: 'members', members: [{ id: 'other', where: packet.where }] }));
        setTimeout(() => {
          acknowledged = true;
          socket.send(JSON.stringify({ type: 'members', members: [{ id: 'self', where: packet.where }] }));
        }, 40);
      }
    });
  });
  await mkdir(join(directory, '.game-table'));
  await writeFile(join(directory, '.game-table/agent.json'), JSON.stringify({
    server: `ws://127.0.0.1:${server.address().port}/ws`, roomId: 'test-room',
    clientId: 'test-client', inviteKey: 'test-only', name: 'Test Helper' }));
  const child = spawn(process.execPath, ['table.mjs', 'activity', 'Working · #general'],
    { cwd: new URL('..', import.meta.url), env: { ...process.env, TABLE_HOME: directory }, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '', errors = '';
  child.stdout.on('data', (data) => { output += data; });
  child.stderr.on('data', (data) => { errors += data; });
  t.after(async () => {
    child.kill(); for (const socket of server.clients) socket.terminate();
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  });
  const [code] = await once(child, 'exit');
  assert.equal(code, 0, errors);
  assert.equal(acknowledged, true);
  assert.equal(output.trim(), 'Activity set: Working · #general');
  assert.deepEqual(packets.map((packet) => packet.type), ['join', 'here']);
  assert.equal(packets[0].agent, true);
});
