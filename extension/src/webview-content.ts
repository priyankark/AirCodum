import { randomBytes } from 'crypto';

export function getWebviewContent(): string {
  const nonce = randomBytes(24).toString('hex');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AirCodum</title>
  <style>
    :root { color-scheme: light dark; }
    * { box-sizing: border-box; }
    [hidden] { display: none !important; }
    body { margin: 0; padding: 28px 24px; font: 13px/1.5 var(--vscode-font-family, system-ui, sans-serif); color: var(--vscode-foreground, #d4d4d4); background: var(--vscode-editor-background, #1e1e1e); }
    main { max-width: 600px; margin: auto; }
    h1, h2, h3, p { margin: 0; }
    h1 { font-size: 20px; font-weight: 650; letter-spacing: -.5px; }
    h2 { font-size: 19px; font-weight: 600; letter-spacing: -.3px; }
    h3 { font-size: 14px; font-weight: 600; }
    button, input { font: inherit; }
    button { cursor: pointer; border: 1px solid transparent; border-radius: 5px; padding: 8px 13px; line-height: 1.4; }
    button:disabled { opacity: .5; cursor: default; }
    button:focus-visible, input:focus-visible, summary:focus-visible { outline: 2px solid var(--vscode-focusBorder, #75beff); outline-offset: 3px; }
    .primary { background: var(--vscode-button-background, #0078d4); color: var(--vscode-button-foreground, white); font-weight: 600; }
    .primary:hover:not(:disabled) { background: var(--vscode-button-hoverBackground, #026ec1); }
    .secondary { background: var(--vscode-button-secondaryBackground, #313131); color: var(--vscode-button-secondaryForeground, #eee); }
    .secondary:hover:not(:disabled) { background: var(--vscode-button-secondaryHoverBackground, #454545); }
    .quiet { color: var(--vscode-textLink-foreground, #75beff); background: transparent; padding: 4px 0; }
    .quiet:hover { text-decoration: underline; }
    .muted { color: var(--vscode-descriptionForeground, #aaa); }
    .brand { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 24px; }
    .brand p { font-size: 12px; margin-top: 2px; }
    .status { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; white-space: nowrap; }
    .status::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: var(--vscode-descriptionForeground, #aaa); }
    .status[data-state="ready"]::before { background: var(--vscode-charts-blue, #75beff); }
    .status[data-state="connected"]::before { background: var(--vscode-testing-iconPassed, #73c991); }
    .tabs { display: flex; gap: 22px; border-bottom: 1px solid var(--vscode-panel-border, #363636); margin-bottom: 24px; }
    .tabs button { background: transparent; color: var(--vscode-descriptionForeground, #aaa); border-radius: 0; padding: 10px 0; border-bottom: 2px solid transparent; }
    .tabs button[aria-selected="true"] { color: var(--vscode-foreground, #eee); border-bottom-color: var(--vscode-focusBorder, #75beff); }
    .card { border: 1px solid var(--vscode-panel-border, #363636); border-radius: 10px; padding: 22px; }
    .intro { margin: 6px 0 20px; }
    .address { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; margin: 0 0 22px; padding: 10px 12px; background: var(--vscode-textCodeBlock-background, #252526); border-radius: 5px; font-size: 12px; }
    code { font-family: var(--vscode-editor-font-family, monospace); overflow-wrap: anywhere; text-align: right; }
    .methods { display: flex; padding: 3px; gap: 3px; border-radius: 6px; background: var(--vscode-textCodeBlock-background, #252526); margin-bottom: 20px; }
    .methods button { flex: 1; background: transparent; color: var(--vscode-descriptionForeground, #aaa); }
    .methods button[aria-selected="true"] { background: var(--vscode-button-secondaryBackground, #393939); color: var(--vscode-button-secondaryForeground, #fff); border-color: var(--vscode-focusBorder, #75beff); }
    .pairing { text-align: center; }
    .pairing p { max-width: 360px; margin: 0 auto 16px; }
    #pairingQr { display: block; width: min(240px, 100%); height: auto; margin: 0 auto 16px; border-radius: 8px; background: white; }
    .caption { font-size: 12px; margin-top: 12px !important; }
    dl { margin: 0 0 18px; }
    .detail { display: grid; grid-template-columns: 90px minmax(0, 1fr); gap: 12px; padding: 8px 0; }
    dt { color: var(--vscode-descriptionForeground, #aaa); }
    dd { margin: 0; overflow-wrap: anywhere; font-weight: 500; }
    .manual-help { margin-bottom: 16px; }
    .settings { margin-top: 16px; border: 1px solid var(--vscode-panel-border, #363636); border-radius: 8px; }
    summary { cursor: pointer; padding: 14px 16px; font-weight: 500; }
    summary::marker { color: var(--vscode-descriptionForeground, #aaa); }
    .settings-body { padding: 0 16px 16px; }
    .setting-row { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 13px 0; border-top: 1px solid var(--vscode-panel-border, #363636); }
    .setting-row p { font-size: 12px; margin-top: 3px; }
    .setting-row button { flex-shrink: 0; }
    .power { padding: 14px 0; border-top: 1px solid var(--vscode-panel-border, #363636); }
    .power label { display: flex; align-items: center; gap: 8px; cursor: pointer; }
    input[type="checkbox"] { margin: 0; accent-color: var(--vscode-focusBorder, #75beff); width: 16px; height: 16px; }
    .power p { margin: 7px 0 0 24px; font-size: 12px; }
    .tools { border-top: 1px solid var(--vscode-panel-border, #363636); padding-top: 12px; }
    .empty { padding: 30px 16px; text-align: center; }
    .empty p { margin-top: 8px; }
    .content { white-space: pre-wrap; overflow-wrap: anywhere; overflow: auto; max-height: 420px; padding: 14px; margin-top: 12px; background: var(--vscode-textCodeBlock-background, #252526); border-radius: 5px; }
    #image { display: block; max-width: 100%; height: auto; margin-top: 14px; }
    .received + .received { margin-top: 16px; }
    .actions { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 12px; }
    .form-row { display: flex; align-items: stretch; gap: 8px; margin-top: 8px; }
    input[type="text"], input[type="password"] { min-width: 0; width: 100%; padding: 9px 10px; border: 1px solid var(--vscode-input-border, #565656); border-radius: 5px; background: var(--vscode-input-background, #3c3c3c); color: var(--vscode-input-foreground, #eee); }
    .form-row button { flex-shrink: 0; }
    .api-settings { padding-bottom: 18px; margin-bottom: 18px; border-bottom: 1px solid var(--vscode-panel-border, #363636); }
    #apiKeyForm { margin-top: 12px; }
    #apiKeyStatus { margin-top: 4px; font-size: 12px; }
    .error { display: flex; align-items: start; gap: 12px; padding: 12px; margin-bottom: 16px; border: 1px solid var(--vscode-inputValidation-errorBorder, #be6262); background: var(--vscode-inputValidation-errorBackground, #402626); border-radius: 6px; }
    .error span { flex: 1; overflow-wrap: anywhere; }
    .error button { color: inherit; background: none; padding: 0 4px; }
    @media (max-width: 400px) { body { padding: 18px 12px; } .card { padding: 16px; } .brand { align-items: start; } .brand p { max-width: 160px; } .address { flex-direction: column; gap: 3px; } .form-row { flex-wrap: wrap; } .form-row button { width: 100%; } }
    @media (forced-colors: active) { .methods button[aria-selected="true"] { border-color: Highlight; } .status::before { background: CanvasText; } }
  </style>
</head>
<body>
<main>
  <header class="brand"><div><h1>AirCodum</h1><p class="muted">Your phone, connected to VS Code.</p></div><span id="serverState" class="status" role="status">Loading…</span></header>
  <nav class="tabs" role="tablist" aria-label="AirCodum tools">
    <button id="connectionTab" role="tab" aria-selected="true" aria-controls="connectionPanel" data-tab="connectionPanel">Connection</button>
    <button id="workspaceTab" role="tab" aria-selected="false" aria-controls="workspacePanel" tabindex="-1" data-tab="workspacePanel">Files &amp; AI<span id="receivedBadge" hidden> · New</span></button>
  </nav>
  <div id="errorContainer" class="error" role="alert" hidden><span id="errorText"></span><button data-action="dismissError" aria-label="Dismiss error">×</button></div>
  <section id="connectionPanel" role="tabpanel" aria-labelledby="connectionTab">
    <div class="card">
      <h2 id="connectionTitle">Connect your phone</h2>
      <p id="connectionHint" class="intro muted">Loading your connection settings…</p>
      <div class="address"><span id="addressKind" class="muted">Server address</span><code id="serverAddress">—</code></div>
      <div class="methods" role="tablist" aria-label="Pairing method">
        <button id="qrTab" role="tab" aria-selected="true" aria-controls="qrPanel" data-tab="qrPanel">QR code</button>
        <button id="manualTab" role="tab" aria-selected="false" aria-controls="manualPanel" tabindex="-1" data-tab="manualPanel">Enter manually</button>
      </div>
      <div id="qrPanel" class="pairing" role="tabpanel" aria-labelledby="qrTab">
        <div id="pairingQrContainer" hidden><img id="pairingQr" alt="Scan this pairing code with AirCodum on your phone"></div>
        <p id="qrHint" class="muted">Choose a local Wi-Fi or Tailscale connection.</p>
        <button id="pairingAction" class="primary" data-action="pair" disabled>Show QR code</button>
        <p class="caption muted">On your phone: AirCodum → Scan QR to connect.<br><span id="mobileVersionHint">Requires mobile version 2.4.1 or later.</span></p>
      </div>
      <div id="manualPanel" role="tabpanel" aria-labelledby="manualTab" hidden>
        <p class="manual-help muted">Enter these details in AirCodum on your phone, then paste the pairing key.</p>
        <dl><div class="detail"><dt>Host</dt><dd id="ipAddress">—</dd></div><div class="detail"><dt>Port</dt><dd id="serverPort">—</dd></div><div class="detail"><dt>Method</dt><dd id="transportLabel">Tailscale</dd></div></dl>
        <button class="primary" id="copyPairingKey" data-action="copyPairingToken">Copy pairing key</button>
        <p id="manualHint" class="caption muted"></p>
      </div>
    </div>
    <details class="settings" id="serverSettings">
      <summary>Server settings &amp; troubleshooting</summary>
      <div class="settings-body">
        <div class="setting-row"><div><h3>Connection address</h3><p class="muted">Local Wi-Fi, Tailscale, or a TLS proxy.</p></div><button class="secondary" data-action="configureConnection">Change</button></div>
        <div class="setting-row"><div><h3>Server</h3><p class="muted" id="serverControlHint">Loading…</p></div><button id="serverControl" class="secondary" data-action="toggleServer" disabled>Start server</button></div>
        <div id="powerSettings" class="power" hidden>
          <label><input id="keepAwake" type="checkbox">Keep Mac awake while the server runs</label>
          <p id="powerStatus" class="muted" role="status"></p>
          <p class="muted">Prevents idle sleep. Closing the lid can still put your Mac to sleep. For lid-closed use, connect power, an external display, and a keyboard and mouse.</p>
        </div>
        <div class="tools"><button class="quiet" data-action="showConnectionLog">Open connection log</button><p class="caption muted">See why a connection failed. Pairing keys are never logged.</p></div>
      </div>
    </details>
  </section>
  <section id="workspacePanel" role="tabpanel" aria-labelledby="workspaceTab" hidden>
    <div id="waitingMessage" class="card empty"><h2>Ready to receive</h2><p class="muted">Send a file, image, or voice note from your phone.<br>It will appear here.</p></div>
    <section id="fileContainer" class="card received" hidden><h2>Received file</h2><div id="fileContent" class="content"></div><img id="image" alt="Received image" hidden></section>
    <section id="transcriptionContainer" class="card received" hidden><h2>Transcription</h2><pre id="transcription" class="content"></pre><div class="actions"><button class="quiet" data-action="copyToClipboard" data-target="transcription">Copy text</button><button class="quiet" data-action="addToCurrentFile" data-target="transcription">Insert into editor</button></div></section>
    <details id="chatContainer" class="settings"><summary>AI assistant <span class="muted">· Optional</span></summary><div class="settings-body">
      <div class="api-settings"><p class="muted">Ask about received files and code using your OpenAI API key. Phone pairing does not need an API key.</p><p id="apiKeyStatus" class="muted" role="status">No API key saved.</p><button class="quiet" data-action="editApiKey" id="editApiKey">Set up AI</button>
        <form id="apiKeyForm" hidden><label for="apiKeyInput">OpenAI API key</label><div class="form-row"><input type="password" id="apiKeyInput" placeholder="Paste your API key" autocomplete="off" required maxlength="1024"><button class="secondary" type="submit">Save key</button></div></form>
      </div>
      <form id="chatForm"><label for="chatInput">Ask about your file or code</label><div class="form-row"><input type="text" id="chatInput" placeholder="What would you like to know?" maxlength="4096" required><button id="sendChat" class="primary" type="submit">Send</button></div></form>
      <div id="chatResponse" class="content" hidden></div><div id="chatActions" class="actions" hidden><button class="quiet" data-action="copyToClipboard" data-target="chatResponse">Copy response</button><button class="quiet" data-action="addToCurrentFile" data-target="chatResponse">Insert into editor</button></div>
    </div></details>
  </section>
</main>
<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  const el = id => document.getElementById(id);
  let connection, connectionIdentity, qrRequested = false, apiKeySaved = false;
  const post = command => vscode.postMessage({ command });
  const hideQr = () => { qrRequested = false; el('pairingQrContainer').hidden = true; el('pairingQr').removeAttribute('src'); };
  const isLocal = host => host === 'localhost' || host === '::1' || host.startsWith('127.');
  function renderConnection() {
    if (!connection) return;
    const c = connection, local = isLocal(c.host), lan = c.localNetwork, count = c.running ? c.clients : 0;
    el('serverState').textContent = count ? 'Connected' : c.running ? 'Server running' : 'Server stopped';
    el('serverState').dataset.state = count ? 'connected' : c.running ? 'ready' : 'stopped';
    el('connectionTitle').textContent = count ? "You're connected" : 'Connect your phone';
    el('connectionHint').textContent = count ? count + (count === 1 ? ' active connection. Your phone is ready to use.' : ' active connections. Your devices are ready to use.') : 'Use QR pairing or enter the connection details yourself.';
    el('serverAddress').textContent = (c.host.includes(':') ? '[' + c.host + ']' : c.host) + ':' + c.port;
    el('addressKind').textContent = local ? 'Local server' : lan ? 'Local Wi-Fi address' : 'Tailscale address';
    el('ipAddress').textContent = c.host;
    el('serverPort').textContent = String(c.port);
    el('transportLabel').textContent = local ? 'Localhost / your TLS proxy' : lan ? 'Local Wi-Fi' : 'Tailscale';
    el('manualHint').textContent = !c.running ? 'The server is stopped. Start it in Server settings below.' : local ? 'This address only works on this computer. For phone access, choose your local Wi-Fi or Tailscale address below, or use your configured TLS proxy.' : lan ? 'Use mobile 2.4.2 or later and choose Local Wi-Fi. Both devices must be on the same local network. Traffic is not encrypted; use a network you trust.' : 'Choose Tailscale on your phone (called Tailscale / localhost (ws) in older versions). Connect both devices to the same Tailscale account.';
    el('qrHint').textContent = !c.running ? 'Start the server, then pair your phone.' : local ? 'Choose your local Wi-Fi or Tailscale address so your phone can reach this computer.' : lan ? (qrRequested ? 'Scan with AirCodum on the same Wi-Fi. Traffic is not encrypted; use a network you trust.' : 'Connect both devices to the same Wi-Fi or local network, then scan to pair. Traffic is not encrypted; use a network you trust.') : qrRequested ? 'Open AirCodum on your phone and scan this code.' : 'Connect both devices to the same Tailscale account, then scan to pair.';
    const action = el('pairingAction');
    action.disabled = qrRequested && el('pairingQrContainer').hidden;
    action.textContent = !c.running ? 'Start server' : local ? 'Choose connection' : qrRequested ? (el('pairingQrContainer').hidden ? 'Creating QR code…' : 'Hide QR code') : count ? 'Pair another phone' : 'Show QR code';
    el('mobileVersionHint').textContent = lan ? 'Local Wi-Fi requires mobile version 2.4.2 or later.' : 'Requires mobile version 2.4.1 or later.';
    el('serverControl').textContent = c.running ? 'Stop server' : 'Start server';
    el('serverControl').disabled = false;
    el('serverControlHint').textContent = c.running ? 'Stopping disconnects your phone.' : 'Start to accept connections.';
    el('powerSettings').hidden = !c.mac;
  }
  function chooseTab(button, focus = false) {
    const group = button.parentElement;
    group.querySelectorAll('[role="tab"]').forEach(tab => {
      const selected = tab === button;
      tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1;
      el(tab.dataset.tab).hidden = !selected;
    });
    if (button.id === 'manualTab' || button.id === 'workspaceTab') { hideQr(); renderConnection(); }
    if (button.id === 'workspaceTab') el('receivedBadge').hidden = true;
    if (focus) button.focus();
  }
  document.querySelectorAll('[role="tablist"]').forEach(group => {
    group.querySelectorAll('[role="tab"]').forEach(tab => tab.addEventListener('click', () => chooseTab(tab)));
    group.addEventListener('keydown', event => {
      const tabs = [...group.querySelectorAll('[role="tab"]')], index = tabs.indexOf(document.activeElement);
      if (index < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      chooseTab(tabs[event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length], true);
    });
  });
  function showError(message) { el('errorText').textContent = message; el('errorContainer').hidden = false; }
  const actions = {
    pair: () => {
      if (!connection) return;
      if (!connection.running) return post('startServer');
      if (isLocal(connection.host)) return post('configureConnection');
      if (qrRequested) hideQr(); else { qrRequested = true; post('showPairingQr'); }
      renderConnection();
    },
    toggleServer: () => post(connection?.running ? 'stopServer' : 'startServer'),
    configureConnection: () => post('configureConnection'),
    copyPairingToken: () => post('copyPairingToken'),
    showConnectionLog: () => post('showConnectionLog'),
    dismissError: () => { el('errorContainer').hidden = true; },
    editApiKey: () => { el('apiKeyForm').hidden = !el('apiKeyForm').hidden; if (!el('apiKeyForm').hidden) el('apiKeyInput').focus(); },
    copyToClipboard: target => navigator.clipboard.writeText(el(target).textContent).then(() => vscode.postMessage({ command: 'showInfo', message: 'Copied to clipboard.' })).catch(() => showError('Could not copy to the clipboard.')),
    addToCurrentFile: target => vscode.postMessage({ command: 'addToCurrentFile', text: el(target).textContent }),
  };
  document.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => actions[button.dataset.action](button.dataset.target)));
  el('keepAwake').addEventListener('change', () => { el('keepAwake').disabled = true; post('toggleKeepAwake'); });
  el('apiKeyForm').addEventListener('submit', event => { event.preventDefault(); const key = el('apiKeyInput').value.trim(); if (!key) return; vscode.postMessage({ command: 'saveApiKey', key }); el('apiKeyInput').value = ''; });
  el('chatForm').addEventListener('submit', event => {
    event.preventDefault();
    if (!apiKeySaved) { el('apiKeyForm').hidden = false; el('apiKeyInput').focus(); return; }
    const prompt = el('chatInput').value.trim(); if (!prompt) return;
    vscode.postMessage({ command: 'chat', prompt }); el('chatInput').value = '';
  });
  function received() { el('waitingMessage').hidden = true; el('receivedBadge').hidden = !el('workspacePanel').hidden; }
  window.addEventListener('message', event => {
    const m = event.data;
    switch (m.type) {
      case 'connection': {
        const identity = JSON.stringify([m.host, m.port, m.running]);
        if (identity !== connectionIdentity) hideQr();
        connectionIdentity = identity; connection = m; renderConnection(); break;
      }
      case 'pairingQr':
        if (!qrRequested || !connection?.running || el('qrPanel').hidden || el('connectionPanel').hidden) break;
        el('pairingQr').src = m.dataUrl; el('pairingQrContainer').hidden = false; el('errorContainer').hidden = true; renderConnection(); break;
      case 'power':
        el('keepAwake').checked = m.enabled; el('keepAwake').disabled = false;
        el('powerStatus').textContent = m.active ? 'On — idle sleep is prevented.' : m.enabled ? 'On — will activate when the server starts.' : 'Off — your normal sleep settings apply.'; break;
      case 'apiKeyStatus':
        apiKeySaved = m.saved; el('apiKeyStatus').textContent = m.saved ? 'API key saved securely.' : 'No API key saved.';
        el('editApiKey').textContent = m.saved ? 'Change API key' : 'Set up AI'; if (m.saved) el('apiKeyForm').hidden = true; break;
      case 'pairingKeyCopied':
        el('copyPairingKey').textContent = 'Pairing key copied'; setTimeout(() => { el('copyPairingKey').textContent = 'Copy pairing key'; }, 3500); break;
      case 'file':
        if (m.fileType === 'image') { el('image').src = 'data:image/png;base64,' + m.content; el('image').hidden = false; el('fileContent').hidden = true; }
        else { el('fileContent').textContent = m.content; el('fileContent').hidden = false; el('image').hidden = true; el('image').removeAttribute('src'); el('transcriptionContainer').hidden = true; }
        el('fileContainer').hidden = false; received(); break;
      case 'transcription': el('transcription').textContent = m.text; el('transcriptionContainer').hidden = false; received(); break;
      case 'chatResponse': el('chatResponse').textContent = m.response; el('chatResponse').hidden = false; el('chatActions').hidden = false; break;
      case 'error': hideQr(); renderConnection(); el('keepAwake').disabled = false; showError(m.message); break;
    }
  });
  post('connection');
</script>
</body>
</html>`;
}
