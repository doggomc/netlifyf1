(() => {
  'use strict';

  const STORAGE_KEY = 'freef1.help.ticket.v1';
  const MAX_LOCAL_MESSAGES = 100;
  const isHelpPage = Boolean(document.getElementById('helpRequestForm'));
  const apiMeta = document.querySelector('meta[name="freef1-help-api"]');
  const host = window.location.hostname;
  const apiBase = ['localhost', '127.0.0.1'].includes(host)
    ? 'http://127.0.0.1:3000'
    : String(apiMeta?.content || 'https://f1admin.onrender.com').trim().replace(/\/+$/, '');

  function emptyState() {
    return { version: 1, token: '', ticketId: '', name: '', category: '', messages: [], lastSeenStaffMessageId: '', unread: false, draft: {} };
  }

  function readState() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!stored || stored.version !== 1 || typeof stored !== 'object') return emptyState();
      return {
        ...emptyState(),
        token: typeof stored.token === 'string' ? stored.token : '',
        ticketId: typeof stored.ticketId === 'string' ? stored.ticketId : '',
        name: typeof stored.name === 'string' ? stored.name : '',
        category: typeof stored.category === 'string' ? stored.category : '',
        messages: Array.isArray(stored.messages) ? stored.messages.slice(-MAX_LOCAL_MESSAGES) : [],
        lastSeenStaffMessageId: typeof stored.lastSeenStaffMessageId === 'string' ? stored.lastSeenStaffMessageId : '',
        unread: stored.unread === true,
        draft: stored.draft && typeof stored.draft === 'object' ? stored.draft : {},
      };
    } catch (_) {
      return emptyState();
    }
  }

  let state = readState();
  let serviceAvailable = false;
  let streamController = null;
  let reconnectTimer = null;
  let reconnectAttempt = 0;
  let streamHasConnected = false;
  let pageActive = true;
  let sending = false;
  let creating = false;

  function saveState() {
    state.messages = state.messages.slice(-MAX_LOCAL_MESSAGES);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (_) { showNotice('This browser could not save the ticket key. Keep this tab open until the issue is resolved.', 'offline'); }
    updateNotificationDot();
  }

  function updateNotificationDot() {
    document.querySelectorAll('.help-notification-dot').forEach(dot => {
      dot.hidden = !state.unread;
      if (state.unread) {
        dot.setAttribute('title', 'New reply from FreeF1 Support');
        dot.setAttribute('role', 'img');
        dot.setAttribute('aria-label', 'Unread support reply');
      } else {
        dot.removeAttribute('title');
        dot.removeAttribute('role');
        dot.removeAttribute('aria-label');
      }
    });
  }

  function showNotice(message, stateName = '') {
    const status = document.getElementById('helpStatus');
    if (status) {
      status.textContent = message;
      status.dataset.state = stateName;
    }
  }

  function showError(id, message) {
    const node = document.getElementById(id);
    if (!node) return;
    node.textContent = message;
    node.hidden = !message;
  }

  function makeToken() {
    if (!window.crypto?.getRandomValues) throw new Error('This browser cannot safely create a ticket key. Please use a modern browser over HTTPS.');
    const bytes = new Uint8Array(32);
    window.crypto.getRandomValues(bytes);
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function authorizationHeaders() {
    const headers = new Headers({ Accept: 'application/json' });
    if (state.token) headers.set('Authorization', `Bearer ${state.token}`);
    return headers;
  }

  async function request(path, options = {}) {
    const headers = authorizationHeaders();
    if (options.headers) new Headers(options.headers).forEach((value, key) => headers.set(key, value));
    if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    let response;
    try {
      response = await fetch(`${apiBase}${path}`, {
        ...options,
        headers,
        credentials: 'omit',
        cache: 'no-store',
      });
    } catch (_) {
      const error = new Error('The support service could not be reached. Your draft and saved ticket remain in this browser.');
      error.offline = true;
      throw error;
    }
    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) {
      const error = new Error(String(data.error || `Support returned ${response.status}.`));
      error.status = response.status;
      error.retryAfter = Number(response.headers.get('Retry-After')) || 0;
      throw error;
    }
    return data;
  }

  function diagnostics() {
    const browser = String(navigator.userAgent || 'Unknown browser').slice(0, 160);
    const platform = String(navigator.platform || 'Unknown platform').slice(0, 80);
    const scr = window.screen || {};
    let timezone = 'Unknown';
    try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || timezone; } catch (_) {}
    return {
      browser,
      platform,
      screen: `${Number(scr.width) || 0}×${Number(scr.height) || 0}`,
      viewport: `${window.innerWidth}×${window.innerHeight}`,
      language: String(navigator.language || 'Unknown').slice(0, 24),
      timezone: String(timezone).slice(0, 80),
      route: String(window.location.pathname || '/help.html').slice(0, 80),
      online: navigator.onLine ? 'online' : 'offline',
    };
  }

  function normalizeMessage(message) {
    if (!message || typeof message !== 'object') return null;
    const id = String(message.id || '');
    const role = message.role === 'staff' ? 'staff' : 'visitor';
    const text = String(message.text || '').slice(0, role === 'staff' ? 2000 : 4000);
    if (!id || !text) return null;
    return {
      id,
      role,
      author: role === 'staff' ? 'FreeF1 Support' : 'You',
      text,
      createdAt: Number(message.createdAt) || Date.now(),
    };
  }

  function mergeMessage(raw, { fromStream = false } = {}) {
    const message = normalizeMessage(raw);
    if (!message) return false;
    if (state.messages.some(item => String(item.id) === message.id)) return false;
    state.messages.push(message);
    state.messages = state.messages.slice(-MAX_LOCAL_MESSAGES);
    if (message.role === 'staff') {
      if (isHelpPage && !document.hidden) {
        state.lastSeenStaffMessageId = message.id;
        state.unread = false;
      } else {
        state.unread = true;
      }
    }
    saveState();
    if (isHelpPage) renderMessages();
    if (fromStream) window.dispatchEvent(new CustomEvent('freef1:help-message', { detail: message }));
    return true;
  }

  function setPanels(hasTicket) {
    const requestPanel = document.getElementById('helpRequestPanel');
    const ticketPanel = document.getElementById('activeTicketPanel');
    if (requestPanel) requestPanel.hidden = hasTicket;
    if (ticketPanel) ticketPanel.hidden = !hasTicket;
  }

  function formatTime(timestamp) {
    try { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp)); }
    catch (_) { return ''; }
  }

  function renderMessages() {
    const list = document.getElementById('chatMessages');
    if (!list) return;
    list.replaceChildren();
    if (!state.messages.length) {
      const empty = document.createElement('p');
      empty.className = 'chat-empty';
      empty.textContent = 'Your ticket is open. Send a message here and FreeF1 Support will reply in this conversation.';
      list.append(empty);
      return;
    }
    for (const message of state.messages.slice(-MAX_LOCAL_MESSAGES)) {
      const bubble = document.createElement('article');
      bubble.className = `chat-message ${message.role === 'staff' ? 'staff' : 'visitor'}`;
      const head = document.createElement('div');
      head.className = 'chat-message-head';
      const author = document.createElement('span');
      author.textContent = message.role === 'staff' ? 'FreeF1 Support' : 'You';
      const time = document.createElement('time');
      time.dateTime = new Date(message.createdAt).toISOString();
      time.textContent = formatTime(message.createdAt);
      head.append(author, time);
      const text = document.createElement('p');
      text.className = 'chat-message-text';
      text.textContent = message.text;
      bubble.append(head, text);
      list.append(bubble);
    }
    list.scrollTop = list.scrollHeight;
  }

  function updateTicketHeading(ticket) {
    const id = document.getElementById('ticketId');
    if (id) id.textContent = ticket?.id || state.ticketId || 'Ticket';
    const category = document.getElementById('ticketCategory');
    if (category) {
      const labels = { website: 'Website issue', playback: 'Playback issue', timing: 'Timing or results', discord: 'Discord or account help', other: 'Other' };
      category.textContent = labels[ticket?.category || state.category] || '';
    }
  }

  function handleStaffEvent(message) {
    mergeMessage({ ...message, role: 'staff' }, { fromStream: true });
  }

  async function loadTicket() {
    if (!state.token) return false;
    try {
      const result = await request('/api/help/ticket');
      state.ticketId = result.ticket?.id || state.ticketId;
      state.name = result.ticket?.name || state.name;
      state.category = result.ticket?.category || state.category;
      state.messages = (Array.isArray(result.messages) ? result.messages : []).map(normalizeMessage).filter(Boolean).slice(-MAX_LOCAL_MESSAGES);
      const latestStaff = [...state.messages].reverse().find(message => message.role === 'staff');
      state.lastSeenStaffMessageId = latestStaff?.id || result.ticket?.latestStaffMessageId || state.lastSeenStaffMessageId;
      state.unread = false;
      saveState();
      setPanels(true);
      updateTicketHeading(result.ticket);
      renderMessages();
      const status = document.getElementById('ticketStatus');
      if (status) { status.textContent = 'Connected to your private support ticket.'; status.dataset.state = 'ready'; }
      startEventStream();
      return true;
    } catch (error) {
      if (error.status === 404) {
        stopEventStream();
        state.ticketId = '';
        state.messages = [];
        state.unread = false;
        saveState();
        setPanels(false);
        return false;
      }
      if (state.ticketId) {
        setPanels(true);
        updateTicketHeading(null);
        renderMessages();
        const status = document.getElementById('ticketStatus');
        if (status) { status.textContent = 'Support is offline. Your saved conversation is still available in this browser; sending and new replies will resume when support is back.'; status.dataset.state = 'offline'; }
      }
      return false;
    }
  }

  async function refreshTicketStatus() {
    if (!state.token) return false;
    try {
      const result = await request('/api/help/ticket/status');
      if (!result.open || !result.ticket) return false;
      state.ticketId = result.ticket.id || state.ticketId;
      state.name = result.ticket.name || state.name;
      state.category = result.ticket.category || state.category;
      const latest = String(result.ticket.latestStaffMessageId || '');
      if (latest && latest !== state.lastSeenStaffMessageId) state.unread = true;
      saveState();
      startEventStream();
      return true;
    } catch (error) {
      if (error.status === 404) {
        stopEventStream();
        state.ticketId = '';
        state.unread = false;
        saveState();
        if (isHelpPage) setPanels(false);
      } else if (isHelpPage && (error.offline || Number(error.status) >= 500)) {
        const status = document.getElementById('ticketStatus');
        if (status) { status.textContent = 'Support is offline. Your saved conversation remains in this browser; sending and new replies will resume when support is back.'; status.dataset.state = 'offline'; }
      }
      return false;
    }
  }

  async function syncHelpPage() {
    const available = await refreshTicketStatus();
    if (!available) return false;
    if (isHelpPage && state.unread) return loadTicket();
    if (isHelpPage) {
      setPanels(true);
      updateTicketHeading(null);
      const status = document.getElementById('ticketStatus');
      if (status) { status.textContent = 'Connected to your private support ticket.'; status.dataset.state = 'ready'; }
    }
    return true;
  }

  function scheduleReconnect() {
    if (!pageActive || document.hidden || !state.token || reconnectTimer !== null) return;
    reconnectAttempt = Math.min(reconnectAttempt + 1, 6);
    const delay = Math.min(30000, 1000 * (2 ** (reconnectAttempt - 1))) + Math.floor(Math.random() * 500);
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      startEventStream();
    }, delay);
  }

  function parseSseFrame(frame) {
    let eventName = 'message';
    const data = [];
    for (const line of frame.split(/\r?\n/)) {
      if (line.startsWith('event:')) eventName = line.slice(6).trim();
      else if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
    }
    if (!data.length) return;
    let payload;
    try { payload = JSON.parse(data.join('\n')); } catch (_) { return; }
    if (eventName === 'staff-message') {
      reconnectAttempt = 0;
      handleStaffEvent(payload);
    } else if (eventName === 'closed') {
      stopEventStream();
      state.ticketId = '';
      state.unread = false;
      saveState();
      if (isHelpPage) {
        setPanels(false);
        showNotice('This ticket has been closed.', 'offline');
      }
    }
  }

  async function runEventStream(controller) {
    let buffer = '';
    const decoder = new TextDecoder();
    try {
      const response = await fetch(`${apiBase}/api/help/events`, {
        headers: new Headers({ Accept: 'text/event-stream', Authorization: `Bearer ${state.token}` }),
        credentials: 'omit',
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok || !response.body) throw new Error(`Support stream returned ${response.status}.`);
      const reconnecting = streamHasConnected;
      streamHasConnected = true;
      reconnectAttempt = 0;
      if (reconnecting) {
        if (isHelpPage) await syncHelpPage();
        else await refreshTicketStatus();
        if (controller.signal.aborted) return;
      }
      const reader = response.body.getReader();
      while (pageActive && !controller.signal.aborted) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let boundary;
        while ((boundary = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          if (frame.trim()) parseSseFrame(frame);
        }
      }
    } catch (_) {
      // No polling is used. Reconnect only after a failed event stream.
    } finally {
      if (streamController === controller) streamController = null;
      if (!controller.signal.aborted) scheduleReconnect();
    }
  }

  function startEventStream() {
    if (!state.token || !pageActive || document.hidden || streamController) return;
    if (reconnectTimer !== null) { window.clearTimeout(reconnectTimer); reconnectTimer = null; }
    const controller = new AbortController();
    streamController = controller;
    void runEventStream(controller);
  }

  function stopEventStream() {
    if (reconnectTimer !== null) { window.clearTimeout(reconnectTimer); reconnectTimer = null; }
    streamHasConnected = false;
    const controller = streamController;
    streamController = null;
    if (controller && !controller.signal.aborted) controller.abort();
  }

  async function checkAvailability() {
    if (!isHelpPage) return;
    try {
      const config = await request('/api/help/config', { headers: { Accept: 'application/json' } });
      serviceAvailable = config.available === true;
      const status = document.getElementById('helpStatus');
      if (serviceAvailable) showNotice('Support is online. Your ticket will open in a private Discord channel.', 'ready');
      else showNotice('Support is not configured or is temporarily offline. Your form draft stays in this browser; you can still use FreeF1.', 'offline');
      const submit = document.getElementById('helpSubmit');
      if (submit) submit.disabled = !serviceAvailable;
    } catch (error) {
      serviceAvailable = false;
      showNotice(error.message, 'offline');
      const submit = document.getElementById('helpSubmit');
      if (submit) submit.disabled = true;
    }
  }

  function restoreDraft() {
    const draft = state.draft || {};
    const name = document.getElementById('helpName');
    const category = document.getElementById('helpCategory');
    const message = document.getElementById('helpMessage');
    if (name) name.value = String(draft.name || state.name || '').slice(0, 48);
    if (category) category.value = String(draft.category || state.category || '');
    if (message) message.value = String(draft.message || '').slice(0, 4000);
    const count = document.getElementById('helpMessageCount');
    if (count && message) count.textContent = `${message.value.length} / 4,000`;
  }

  function saveDraftFromForm() {
    const name = document.getElementById('helpName');
    const category = document.getElementById('helpCategory');
    const message = document.getElementById('helpMessage');
    state.draft = {
      name: String(name?.value || '').slice(0, 48),
      category: String(category?.value || '').slice(0, 32),
      message: String(message?.value || '').slice(0, 4000),
    };
    saveState();
  }

  async function submitTicket(event) {
    event.preventDefault();
    if (creating) return;
    saveDraftFromForm();
    if (!serviceAvailable) {
      showError('helpFormError', 'The support service is offline. Your draft is saved here; please try again later.');
      return;
    }
    const name = String(document.getElementById('helpName')?.value || '').trim();
    const category = String(document.getElementById('helpCategory')?.value || '');
    const message = String(document.getElementById('helpMessage')?.value || '').trim();
    if (name.length < 2 || !category || message.length < 10) {
      showError('helpFormError', 'Please enter your name, choose a category, and describe the issue in at least 10 characters.');
      return;
    }
    creating = true;
    const button = document.getElementById('helpSubmit');
    if (button) { button.disabled = true; button.dataset.original = button.textContent; button.textContent = 'Opening private ticket…'; }
    showError('helpFormError', '');
    try {
      if (!state.token) state.token = makeToken();
      state.name = name.slice(0, 48);
      state.category = category;
      saveState();
      const includeDiagnostics = document.getElementById('includeDiagnostics')?.checked !== false;
      const result = await request('/api/help/tickets', {
        method: 'POST',
        body: JSON.stringify({ name, category, message, diagnostics: includeDiagnostics ? diagnostics() : {} }),
      });
      state.ticketId = result.ticket?.id || '';
      state.name = result.ticket?.name || name;
      state.category = result.ticket?.category || category;
      state.messages = (Array.isArray(result.messages) ? result.messages : []).map(normalizeMessage).filter(Boolean).slice(-MAX_LOCAL_MESSAGES);
      state.lastSeenStaffMessageId = '';
      state.unread = false;
      state.draft = {};
      saveState();
      setPanels(true);
      updateTicketHeading(result.ticket);
      renderMessages();
      const ticketStatus = document.getElementById('ticketStatus');
      if (ticketStatus) { ticketStatus.textContent = 'Your private ticket is open. Replies will appear here.'; ticketStatus.dataset.state = 'ready'; }
      startEventStream();
    } catch (error) {
      if (error.status === 409) {
        await loadTicket();
        return;
      }
      showError('helpFormError', error.message || 'Could not open a ticket. Your draft is still saved in this browser.');
      if (error.offline) showNotice('Support is offline. Your draft is safe in this browser; FreeF1 playback is unaffected.', 'offline');
    } finally {
      creating = false;
      if (button) { button.textContent = 'Submit ticket'; button.disabled = !serviceAvailable; }
    }
  }

  async function sendChatMessage(event) {
    event.preventDefault();
    if (sending || !state.token || !state.ticketId) return;
    const field = document.getElementById('chatMessage');
    const text = String(field?.value || '').trim();
    if (!text) return;
    if (text.length > 2000) { showError('chatError', 'Keep each message to 2,000 characters or fewer.'); return; }
    sending = true;
    const button = document.getElementById('chatSend');
    if (button) button.disabled = true;
    showError('chatError', '');
    try {
      const result = await request('/api/help/ticket/messages', { method: 'POST', body: JSON.stringify({ text }) });
      mergeMessage(result.message);
      if (field) field.value = '';
    } catch (error) {
      showError('chatError', error.message || 'Message could not be sent. It remains in the text box.');
    } finally {
      sending = false;
      if (button) button.disabled = false;
    }
  }

  async function deleteTicket() {
    if (!state.token || !state.ticketId) return;
    if (!window.confirm('Delete this ticket? The private Discord channel and its conversation will be deleted.')) return;
    const button = document.getElementById('deleteTicket');
    if (button) button.disabled = true;
    try {
      await request('/api/help/ticket', { method: 'DELETE' });
      stopEventStream();
      state = emptyState();
      saveState();
      setPanels(false);
      showNotice('Ticket deleted. You can open a new request if you need help again.', 'ready');
      restoreDraft();
    } catch (error) {
      const status = document.getElementById('ticketStatus');
      if (status) { status.textContent = error.message || 'The ticket could not be deleted. It remains open.'; status.dataset.state = 'error'; }
    } finally {
      if (button) button.disabled = false;
    }
  }

  function bindHelpForm() {
    if (!isHelpPage) return;
    restoreDraft();
    const form = document.getElementById('helpRequestForm');
    form?.addEventListener('submit', submitTicket);
    const draftFields = ['helpName', 'helpCategory', 'helpMessage'];
    for (const id of draftFields) document.getElementById(id)?.addEventListener('input', saveDraftFromForm);
    const textarea = document.getElementById('helpMessage');
    textarea?.addEventListener('input', () => {
      const count = document.getElementById('helpMessageCount');
      if (count) count.textContent = `${textarea.value.length} / 4,000`;
    });
    document.getElementById('chatForm')?.addEventListener('submit', sendChatMessage);
    document.getElementById('deleteTicket')?.addEventListener('click', deleteTicket);
  }

  updateNotificationDot();
  bindHelpForm();
  if (isHelpPage) {
    void checkAvailability();
    restoreDraft();
  }

  if (state.token) {
    if (isHelpPage) void loadTicket();
    else void refreshTicketStatus();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopEventStream();
    else if (state.token) {
      if (isHelpPage) void syncHelpPage();
      else { void refreshTicketStatus(); startEventStream(); }
    }
  });
  window.addEventListener('pagehide', () => { pageActive = false; stopEventStream(); });
  window.addEventListener('pageshow', () => {
    if (pageActive) return;
    pageActive = true;
    if (state.token) {
      if (isHelpPage) void syncHelpPage();
      else void refreshTicketStatus();
    }
  });
  window.addEventListener('storage', event => {
    if (event.key !== STORAGE_KEY) return;
    state = readState();
    updateNotificationDot();
    if (isHelpPage) {
      setPanels(Boolean(state.token && state.ticketId));
      updateTicketHeading(null);
      renderMessages();
      if (state.token && state.ticketId) startEventStream();
      else stopEventStream();
    } else if (!state.token) stopEventStream();
  });
})();
