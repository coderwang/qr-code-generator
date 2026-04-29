import * as vscode from 'vscode';
import { generateQRCode } from './utils';

const LAST_QR_CODE_TEXT_KEY = 'lastQRCodeText';
const SAVED_QR_CODES_KEY = 'savedQRCodes';
const MAX_SAVED_QR_CODES = 10;

interface SavedQRCode {
  id: string;
  text: string;
  imagePath: string;
}

export function activate(context: vscode.ExtensionContext) {
  let panel: vscode.WebviewPanel | undefined;

  const getSavedList = (): SavedQRCode[] =>
    context.globalState.get<SavedQRCode[]>(SAVED_QR_CODES_KEY, []);

  const updateSavedList = (list: SavedQRCode[]) =>
    context.globalState.update(SAVED_QR_CODES_KEY, list);

  const postSavedList = () => {
    panel?.webview.postMessage({
      command: 'updateSavedList',
      list: getSavedList(),
      max: MAX_SAVED_QR_CODES,
    });
  };

  let disposable = vscode.commands.registerCommand('extension.generateQRCode', (uri) => {
    // 获取当前活动编辑器
    const editor = vscode.window.activeTextEditor;
    // 获取选中的文本
    const selectedText = editor?.document.getText(editor.selection);
    // 读取上次生成二维码所用的文本
    const lastText = context.globalState.get<string>(LAST_QR_CODE_TEXT_KEY, '');

    if (!panel) {
      // 创建一个Webview面板
      panel = vscode.window.createWebviewPanel(
        'qrCodeGenerator',
        'QRCode Generator',
        vscode.ViewColumn.Beside, // 拆分编辑器
        {
          enableScripts: true,
          retainContextWhenHidden: true,
        }
      );

      // 监听Webview被关闭时，重置panel为undefined
      panel.onDidDispose(() => {
        panel = undefined;
      });
    }

    // 获取Webview的HTML内容，优先使用选中文本，没有则使用上次缓存的文本
    panel.webview.html = getWebviewContent(uri?.path, selectedText?.replace(/\s+/g, '') || lastText);

    // 监听Webview发出的消息
    panel.webview.onDidReceiveMessage((message) => {
      if (message.command === 'generateQRCodeCmd') {
        if (message.text) {
          // 缓存本次用于生成二维码的文本
          context.globalState.update(LAST_QR_CODE_TEXT_KEY, message.text);
          generateQRCode(message.text)
            .then((data) => {
              // 生成二维码后，将二维码图片路径发送给Webview
              panel?.webview.postMessage({ command: 'showQRCode', imagePath: data });
            })
            .catch(() => {
              vscode.window.showErrorMessage('Failed to generate QR Code.');
            });
        } else {
          vscode.window.showWarningMessage('Please enter a URL.');
        }
      }
      if (message.command === 'saveQRCode') {
        if (!message.text || !message.imagePath) {
          vscode.window.showWarningMessage('Please generate a QR Code first.');
          return;
        }
        const list = getSavedList();
        const existingIndex = list.findIndex((item) => item.text === message.text);
        let nextList: SavedQRCode[];
        let infoMessage: string;
        if (existingIndex >= 0) {
          const [existing] = list.splice(existingIndex, 1);
          nextList = [existing, ...list];
          infoMessage = 'QR Code already saved. Moved to top.';
        } else {
          const newItem: SavedQRCode = {
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            text: message.text,
            imagePath: message.imagePath,
          };
          nextList = [newItem, ...list].slice(0, MAX_SAVED_QR_CODES);
          infoMessage = 'QR Code saved.';
        }
        updateSavedList(nextList).then(() => {
          postSavedList();
          vscode.window.showInformationMessage(infoMessage);
        });
      }
      if (message.command === 'deleteQRCode') {
        const list = getSavedList().filter((item) => item.id !== message.id);
        updateSavedList(list).then(() => {
          postSavedList();
          vscode.window.showInformationMessage('Saved QR Code deleted.');
        });
      }
      if (message.command === 'requestSavedList') {
        postSavedList();
      }
      if (message.command === 'copySuccess') {
        vscode.window.showInformationMessage('QR Code image copied to clipboard!');
      }
      if (message.command === 'copyError') {
        vscode.window.showErrorMessage('Failed to copy QR Code to clipboard');
      }
      if (message.command === 'copyTextSuccess') {
        vscode.window.showInformationMessage('Text copied to clipboard!');
      }
      if (message.command === 'copyTextError') {
        vscode.window.showErrorMessage('Failed to copy text to clipboard');
      }
      if (message.command === 'generateSuccess') {
        vscode.window.showInformationMessage('QR Code generated.');
      }
    });
  });

  context.subscriptions.push(disposable);
}

function escapeHtmlForServer(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getWebviewContent(filePath: string, defaultValue: string = '') {
  const safeDefault = escapeHtmlForServer(defaultValue);
  const initialValueJSON = JSON.stringify(defaultValue);
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Generate QR Code</title>
      <style>
        * { box-sizing: border-box; }

        body {
          margin: 0;
          padding: 24px 20px 180px;
          font-family: var(--vscode-font-family);
          font-size: var(--vscode-font-size);
          color: var(--vscode-foreground);
          background: var(--vscode-editor-background);
        }

        .container {
          max-width: 560px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .input-wrapper {
          position: relative;
          border: 1px solid var(--vscode-input-border, var(--vscode-widget-border, transparent));
          border-radius: 6px;
          background: var(--vscode-input-background);
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .input-wrapper:focus-within {
          border-color: var(--vscode-focusBorder);
          box-shadow: 0 0 0 1px var(--vscode-focusBorder);
        }
        #urlInput {
          width: 100%;
          padding: 10px 12px;
          font-family: var(--vscode-font-family);
          font-size: 13px;
          line-height: 1.5;
          color: var(--vscode-input-foreground);
          background: transparent;
          border: none;
          outline: none;
          resize: none;
          min-height: 96px;
        }
        #urlInput::placeholder {
          color: var(--vscode-input-placeholderForeground);
        }

        .actions {
          display: flex;
          gap: 8px;
        }
        button {
          flex: 1;
          padding: 8px 14px;
          font-family: var(--vscode-font-family);
          font-size: 13px;
          font-weight: 500;
          line-height: 1.4;
          border-radius: 4px;
          border: 1px solid transparent;
          cursor: pointer;
          transition: background 0.15s ease, opacity 0.15s ease;
        }
        button.primary {
          color: var(--vscode-button-foreground);
          background: var(--vscode-button-background);
        }
        button.primary:hover:not(:disabled) {
          background: var(--vscode-button-hoverBackground);
        }
        button.secondary {
          color: var(--vscode-button-secondaryForeground);
          background: var(--vscode-button-secondaryBackground);
        }
        button.secondary:hover:not(:disabled) {
          background: var(--vscode-button-secondaryHoverBackground);
        }
        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .qr-card {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 240px;
          padding: 20px;
          border: 1px dashed var(--vscode-widget-border, var(--vscode-input-border, rgba(128,128,128,0.3)));
          border-radius: 8px;
          background: var(--vscode-editorWidget-background, transparent);
        }
        .qr-card img {
          max-width: 220px;
          width: 100%;
          height: auto;
          border-radius: 6px;
          cursor: pointer;
          background: #fff;
          padding: 8px;
        }
        .qr-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          color: var(--vscode-descriptionForeground);
          font-size: 12px;
          text-align: center;
          user-select: none;
        }
        .qr-placeholder .icon {
          width: 48px;
          height: 48px;
          border-radius: 8px;
          border: 1px dashed currentColor;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          opacity: 0.6;
        }

        .saved-section {
          margin-top: 8px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .saved-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          color: var(--vscode-descriptionForeground);
        }
        #savedCount {
          font-weight: 400;
          letter-spacing: normal;
          text-transform: none;
          padding: 2px 8px;
          border-radius: 10px;
          background: var(--vscode-badge-background);
          color: var(--vscode-badge-foreground);
          font-size: 11px;
        }
        #savedList {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .saved-item {
          position: relative;
          padding: 6px 8px 6px 10px;
          border: 1px solid transparent;
          border-radius: 4px;
          background: transparent;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: border-color 0.15s ease, background 0.15s ease;
        }
        .saved-item:hover {
          border-color: var(--vscode-widget-border, var(--vscode-input-border, rgba(128,128,128,0.25)));
          background: var(--vscode-list-hoverBackground);
        }
        .saved-text {
          flex: 1;
          min-width: 0;
          font-size: 12px;
          line-height: 1.4;
          color: var(--vscode-foreground);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          opacity: 0.9;
          cursor: pointer;
          padding: 2px 6px;
          margin: -2px -6px;
          border-radius: 3px;
          transition: background 0.15s ease, opacity 0.15s ease;
        }
        .saved-text:hover {
          opacity: 1;
          background: var(--vscode-toolbar-hoverBackground, rgba(128,128,128,0.15));
        }
        .saved-text.copied {
          background: var(--vscode-inputValidation-infoBackground, rgba(64,156,255,0.18));
          color: var(--vscode-foreground);
        }
        .qr-thumb {
          position: relative;
          flex-shrink: 0;
          width: 24px;
          height: 24px;
          border-radius: 4px;
          color: var(--vscode-descriptionForeground);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease;
        }
        .qr-thumb:hover {
          background: var(--vscode-toolbar-hoverBackground, rgba(128,128,128,0.15));
          color: var(--vscode-foreground);
        }
        .qr-thumb svg {
          width: 16px;
          height: 16px;
          display: block;
        }
        .qr-preview {
          position: absolute;
          right: 0;
          top: calc(100% + 6px);
          z-index: 10;
          width: 172px;
          height: 172px;
          padding: 6px;
          background: #fff;
          border-radius: 6px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
          opacity: 0;
          visibility: hidden;
          transform: translateY(-4px);
          transition: opacity 0.15s ease, transform 0.15s ease, visibility 0.15s ease;
          pointer-events: none;
        }
        .qr-thumb:hover .qr-preview,
        .qr-thumb:focus-visible .qr-preview {
          opacity: 1;
          visibility: visible;
          transform: translateY(0);
          pointer-events: auto;
        }
        .qr-preview img {
          display: block;
          width: 160px;
          height: 160px;
          max-width: none;
          cursor: pointer;
        }
        .delete-btn {
          flex: 0 0 24px;
          width: 24px;
          height: 24px;
          padding: 0;
          font-size: 14px;
          line-height: 1;
          border-radius: 4px;
          background: transparent;
          color: var(--vscode-descriptionForeground);
          border: none;
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.15s ease, color 0.15s ease, background 0.15s ease;
        }
        .saved-item:hover .delete-btn {
          opacity: 1;
        }
        .delete-btn:hover {
          color: var(--vscode-errorForeground, #f48771);
          background: var(--vscode-toolbar-hoverBackground, var(--vscode-list-hoverBackground));
        }

        #emptyTip {
          padding: 24px 0;
          text-align: center;
          font-size: 12px;
          color: var(--vscode-descriptionForeground);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="input-wrapper">
          <textarea id="urlInput" rows="4" placeholder="Enter text or URL to generate QR Code">${safeDefault}</textarea>
        </div>

        <div class="actions">
          <button id="generateButton" class="primary" title="Generate QR Code (Enter)">Generate</button>
          <button id="saveButton" class="secondary" title="Save current QR Code to the list below">Save</button>
        </div>

        <div id="qrCodeContainer" class="qr-card">
          <div class="qr-placeholder" id="qrPlaceholder">
            <div class="icon">▦</div>
            <div>QR Code will appear here</div>
          </div>
        </div>

        <div class="saved-section">
          <div class="saved-header">
            <span>Saved</span>
            <span id="savedCount">0 / 10</span>
          </div>
          <div id="savedList"></div>
          <div id="emptyTip">No saved QR codes yet.</div>
        </div>
      </div>

      <script>
        const vscode = acquireVsCodeApi();
        const urlInput = document.getElementById('urlInput');
        const qrCodeContainer = document.getElementById('qrCodeContainer');
        const saveButton = document.getElementById('saveButton');
        const savedList = document.getElementById('savedList');
        const savedCount = document.getElementById('savedCount');
        const emptyTip = document.getElementById('emptyTip');

        let currentImagePath = '';
        let currentText = '';
        let maxSaved = 10;
        let savedListData = [];

        function escapeHtml(str) {
          return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        }

        const qrPlaceholderHTML = '<div class="qr-placeholder"><div class="icon">\u25A6</div><div>QR Code will appear here</div></div>';

        function showPlaceholder() {
          qrCodeContainer.innerHTML = qrPlaceholderHTML;
        }

        function handleGenerateQRCode() {
          const text = urlInput.value;
          if(!text) {
            showPlaceholder();
            currentImagePath = '';
            currentText = '';
            updateSaveButton();
          }
          vscode.postMessage({ command: 'generateQRCodeCmd', text });
        }

        function saveQRCode() {
          vscode.postMessage({
            command: 'saveQRCode',
            text: currentText,
            imagePath: currentImagePath,
          });
        }

        function deleteSaved(id) {
          vscode.postMessage({ command: 'deleteQRCode', id });
        }

        function updateSaveButton() {
          saveButton.disabled = false;
          saveButton.title = '';
        }

        function renderSavedList() {
          savedCount.textContent = savedListData.length + ' / ' + maxSaved;
          if (savedListData.length === 0) {
            savedList.innerHTML = '';
            emptyTip.style.display = 'block';
            return;
          }
          emptyTip.style.display = 'none';
          const qrIconSVG = '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">' +
            '<path d="M2 2h5v5H2V2zm1 1v3h3V3H3zm6-1h5v5H9V2zm1 1v3h3V3h-3zM2 9h5v5H2V9zm1 1v3h3v-3H3zm6 0h1v1H9v-1zm2 0h1v1h-1v-1zm-2 2h1v1H9v-1zm2 0h1v1h-1v-1zm2-2h1v1h-1v-1zm0 2h1v1h-1v-1zm-2 2h1v1h-1v-1zm2 0h1v1h-1v-1zM4 4h1v1H4V4zm7 0h1v1h-1V4zM4 11h1v1H4v-1z"/>' +
            '</svg>';
          savedList.innerHTML = savedListData
            .map((item) => {
              const safeText = escapeHtml(item.text);
              const safeId = escapeHtml(item.id);
              const safeImg = escapeHtml(item.imagePath);
              return \`
                <div class="saved-item" data-id="\${safeId}">
                  <div class="saved-text" title="Click to copy text: \${safeText}" data-action="copyText">\${safeText}</div>
                  <div class="qr-thumb" tabindex="0" title="Hover to preview, click to copy QR image" data-action="copy" data-img="\${safeImg}">
                    \${qrIconSVG}
                    <div class="qr-preview">
                      <img src="\${safeImg}" alt="QR Code" data-action="copy" data-img="\${safeImg}" />
                    </div>
                  </div>
                  <button class="delete-btn" data-action="delete" title="Delete this saved QR Code">×</button>
                </div>
              \`;
            })
            .join('');
        }

        async function copyToClipboard(dataUrl) {
          try {
            const response = await fetch(dataUrl);
            const blob = await response.blob();
            const item = new ClipboardItem({ 'image/png': blob });
            await navigator.clipboard.write([item]);
            vscode.postMessage({ command: 'copySuccess' });
          } catch (error) {
            console.error('Failed to copy:', error);
            vscode.postMessage({ command: 'copyError' });
          }
        }

        async function copyTextToClipboard(text, sourceEl) {
          try {
            await navigator.clipboard.writeText(text);
            vscode.postMessage({ command: 'copyTextSuccess' });
            if (sourceEl) {
              sourceEl.classList.add('copied');
              setTimeout(() => sourceEl.classList.remove('copied'), 600);
            }
          } catch (error) {
            console.error('Failed to copy text:', error);
            vscode.postMessage({ command: 'copyTextError' });
          }
        }

        // 监听插件发出的消息
        window.addEventListener('message', event => {
          const message = event.data;
          if (message.command === 'showQRCode') {
            currentImagePath = message.imagePath;
            currentText = urlInput.value;
            const img = document.createElement('img');
            img.src = message.imagePath;
            img.alt = 'QR Code';
            img.title = 'Click to copy QR image to clipboard';
            img.addEventListener('click', () => copyToClipboard(img.src));
            qrCodeContainer.innerHTML = '';
            qrCodeContainer.appendChild(img);
            updateSaveButton();
            vscode.postMessage({ command: 'generateSuccess' });
          }
          if (message.command === 'updateSavedList') {
            savedListData = message.list || [];
            if (typeof message.max === 'number') {
              maxSaved = message.max;
            }
            renderSavedList();
            updateSaveButton();
          }
        });

        urlInput.addEventListener('keydown', event => {
          if (event.key === 'Enter') {
            event.preventDefault();
            handleGenerateQRCode();
          }
        });

        document.getElementById('generateButton').addEventListener('click', handleGenerateQRCode);
        saveButton.addEventListener('click', saveQRCode);

        savedList.addEventListener('click', event => {
          const target = event.target;
          if (!(target instanceof Element)) {
            return;
          }
          const actionEl = target.closest('[data-action]');
          if (!actionEl) {
            return;
          }
          const action = actionEl.getAttribute('data-action');
          const itemEl = actionEl.closest('.saved-item');
          if (!itemEl) {
            return;
          }
          if (action === 'delete') {
            const id = itemEl.getAttribute('data-id');
            if (id) {
              deleteSaved(id);
            }
          } else if (action === 'copy') {
            const img = actionEl.getAttribute('data-img');
            if (img) {
              copyToClipboard(img);
            }
          } else if (action === 'copyText') {
            const id = itemEl.getAttribute('data-id');
            const item = savedListData.find((it) => it.id === id);
            if (item) {
              copyTextToClipboard(item.text, actionEl);
            }
          }
        });

        // 请求已保存列表
        vscode.postMessage({ command: 'requestSavedList' });

        // 自动调用一次
        const __initialValue = ${initialValueJSON};
        if (__initialValue) {
          handleGenerateQRCode();
        }
      </script>
    </body>
    </html>
  `;
}

export function deactivate() { }
