// Uses Game Table's existing member status and typing messages on a helper's own socket.
// It never opens another connection, sends chat, or inspects prompts/tool output.
export function activityLabel(value) {
  const label = String(value ?? '').replace(/[\x00-\x1f\x7f]/g, ' ').trim().slice(0, 80);
  return /[\uD800-\uDBFF]$/.test(label) ? label.slice(0, -1) : label;
}

export function createActivityReporter({ send, heartbeatMs = 2_000,
  setIntervalFn = setInterval, clearIntervalFn = clearInterval }) {
  let connected = false, label = 'Idle · listening', channelId = null;
  let sentLabel, sentChannel = null, timer;
  const clearTimer = () => { if (timer !== undefined) clearIntervalFn(timer); timer = undefined; };
  const publish = () => {
    if (!connected) return;
    try {
      if (label !== sentLabel) {
        send({ type: 'here', where: label });
        sentLabel = label;
      }
      if (sentChannel && sentChannel !== channelId) {
        send({ type: 'typing', channelId: sentChannel, typing: false });
        sentChannel = null;
      }
      if (channelId) {
        send({ type: 'typing', channelId, typing: true });
        sentChannel = channelId;
      }
    } catch {
      // A status update must not fail the task. The owner reconnects the socket.
      connected = false;
      clearTimer();
    }
  };
  const schedule = () => {
    clearTimer();
    if (connected && channelId) {
      timer = setIntervalFn(publish, heartbeatMs);
      timer?.unref?.();
    }
  };
  return {
    update(nextLabel, nextChannelId = null) {
      label = activityLabel(nextLabel);
      const next = typeof nextChannelId === 'string' && nextChannelId ? nextChannelId : null;
      const changed = label !== sentLabel || next !== channelId;
      channelId = next;
      if (changed) { publish(); schedule(); }
    },
    connect() {
      connected = true; sentLabel = undefined; sentChannel = null;
      publish(); schedule();
    },
    disconnect() { connected = false; sentLabel = undefined; sentChannel = null; clearTimer(); },
    stop() {
      label = 'Offline'; channelId = null;
      publish(); connected = false; clearTimer();
    },
  };
}
