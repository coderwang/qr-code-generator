import * as vscode from 'vscode';
import * as qrcode from 'qrcode';

export function activate(context: vscode.ExtensionContext) {
  let panel: vscode.WebviewPanel | undefined;

  let disposable = vscode.commands.registerCommand('extension.generateQRCode', () => {
    if (!panel) {
      // 创建一个Webview面板
      panel = vscode.window.createWebviewPanel(
        'qrCodeGenerator',
        'QR Code Generator',
        vscode.ViewColumn.One,
        {
          enableScripts: true
        }
      );

      // 监听Webview被关闭时，重置panel为undefined
      panel.onDidDispose(() => {
        panel = undefined;
      });
    }

    // 获取Webview的HTML内容
    panel.webview.html = getWebviewContent(panel.webview);

    // 监听Webview发出的消息
    panel.webview.onDidReceiveMessage((message) => {
      if (message.command === 'generateQRCode') {
        if (message.text) {
          generateQRCode(message.text)
            .then((data) => {
              // 生成二维码后，将二维码图片路径发送给Webview
              panel?.webview.postMessage({ command: 'showQRCode', imagePath: data });
              vscode.window.showErrorMessage(data);
            })
            .catch((error) => {
              vscode.window.showErrorMessage('Failed to generate QR Code.');
            });
        } else {
          vscode.window.showWarningMessage('Please enter a URL.');
        }
      }
    });
  });

  context.subscriptions.push(disposable);
}

async function generateQRCode(text: string): Promise<string> {
  return new Promise((resolve, reject) => {
    qrcode.toDataURL(text, (err, url) => {
      if (err) {
        reject(err);
      } else {
        resolve(url);
      }
    });
  });
}

function getWebviewContent(webview: vscode.Webview) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Generate QR Code</title>
      <style>
        body { font-family: Arial, sans-serif; }
        input { width: 100%; padding: 5px; font-size: 16px; margin-bottom: 10px; }
        button { width: 100%; padding: 10px; font-size: 16px; }
        #qrCodeContainer { text-align: center; margin-top: 20px; }
      </style>
    </head>
    <body>
      <input id="urlInput" type="text" placeholder="Enter a URL">
      <button onclick="generateQRCode()">Generate QR Code</button>
      <div id="qrCodeContainer"></div>

      <script>
        const vscode = acquireVsCodeApi();

        function generateQRCode() {
          const urlInput = document.getElementById('urlInput');
          const text = urlInput.value;
          vscode.postMessage({ command: 'generateQRCode', text });
        }

        // 监听插件发出的消息
        window.addEventListener('message', event => {
          const message = event.data;
          if (message.command === 'showQRCode') {
            const qrCodeContainer = document.getElementById('qrCodeContainer');
            qrCodeContainer.innerHTML = \`<img src="\${message.imagePath}" alt="QR Code" />\`;
          }
        });
      </script>
    </body>
    </html>
  `;
}

export function deactivate() { }
