(() => {
  'use strict';

  const endpointMeta = document.querySelector('meta[name="freef1-viewer-counter-ws"]');
  const counter = document.getElementById('viewerCounter');
  const countNode = document.getElementById('viewerCount');
  if (!endpointMeta || !counter || !countNode || typeof WebSocket !== 'function') return;

  const isLocalPreview = ['localhost', '127.0.0.1'].includes(window.location.hostname) && window.location.port === '4173';
  let endpoint;
  try {
    endpoint = isLocalPreview
      ? new URL('ws://127.0.0.1:8787/ws')
      : new URL(endpointMeta.content.trim(), window.location.href);
  } catch (_) {
    return;
  }

  const expectedOrigin = isLocalPreview
    ? 'ws://127.0.0.1:8787'
    : 'wss://freef1-viewer-counter.calvinbotha1julie.workers.dev';
  const expectedProtocol = isLocalPreview ? 'ws:' : 'wss:';
  if (endpoint.protocol !== expectedProtocol || endpoint.origin !== expectedOrigin || endpoint.pathname !== '/ws' || endpoint.search || endpoint.hash) return;

  const numberFormat = new Intl.NumberFormat('en-US');
  let socket = null;
  let retryTimer = null;
  let retryAttempt = 0;
  let pageActive = true;

  function setStatus(state, count = null) {
    counter.dataset.state = state;
    if (Number.isSafeInteger(count) && count >= 0) {
      const formatted = numberFormat.format(count);
      countNode.textContent = formatted;
      counter.setAttribute('aria-label', `${formatted} open FreeF1 page connections`);
      counter.title = `Approximate count of open FreeF1 pages (${formatted}); not a count of unique people or active video viewers.`;
      return;
    }

    countNode.textContent = '—';
    counter.setAttribute('aria-label', state === 'connecting'
      ? 'Connecting to the live FreeF1 page count'
      : 'Live FreeF1 page count unavailable');
    counter.title = state === 'offline'
      ? 'The live count is temporarily unavailable. The site works without it.'
      : 'Connecting to the live count of open FreeF1 pages.';
  }

  function clearRetry() {
    if (retryTimer !== null) {
      window.clearTimeout(retryTimer);
      retryTimer = null;
    }
  }

  function scheduleReconnect() {
    if (!pageActive || retryTimer !== null) return;
    retryAttempt = Math.min(retryAttempt + 1, 6);
    const delay = Math.min(30000, 1000 * (2 ** (retryAttempt - 1))) + Math.floor(Math.random() * 750);
    retryTimer = window.setTimeout(() => {
      retryTimer = null;
      connect();
    }, delay);
  }

  function connect() {
    if (!pageActive) return;
    if (socket && (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)) return;

    clearRetry();
    setStatus('connecting');

    let candidate;
    try {
      candidate = new WebSocket(endpoint.href);
    } catch (_) {
      setStatus('offline');
      scheduleReconnect();
      return;
    }

    socket = candidate;
    candidate.addEventListener('message', event => {
      if (socket !== candidate || typeof event.data !== 'string' || event.data.length > 128) return;
      let payload;
      try {
        payload = JSON.parse(event.data);
      } catch (_) {
        return;
      }
      if (!payload || payload.type !== 'count' || !Number.isSafeInteger(payload.count) || payload.count < 0) return;

      retryAttempt = 0;
      setStatus('live', payload.count);
    });

    candidate.addEventListener('close', () => {
      if (socket !== candidate) return;
      socket = null;
      setStatus('offline');
      scheduleReconnect();
    });

    candidate.addEventListener('error', () => {
      if (socket !== candidate || candidate.readyState >= WebSocket.CLOSING) return;
      try {
        candidate.close();
      } catch (_) {
        // The browser may already be closing this connection.
      }
    });
  }

  window.addEventListener('online', () => {
    if (!pageActive || (socket && (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN))) return;
    clearRetry();
    connect();
  });

  window.addEventListener('pagehide', () => {
    pageActive = false;
    clearRetry();
    const current = socket;
    socket = null;
    if (current && current.readyState < WebSocket.CLOSING) {
      try {
        current.close(1000, 'Page navigation');
      } catch (_) {
        // The browser may already be closing this connection.
      }
    }
  });

  window.addEventListener('pageshow', () => {
    if (pageActive) return;
    pageActive = true;
    connect();
  });

  counter.hidden = false;
  setStatus('connecting');
  connect();
})();
