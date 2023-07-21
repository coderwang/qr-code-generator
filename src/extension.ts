import * as vscode from 'vscode';
import * as qrcode from 'qrcode';

export function activate(context: vscode.ExtensionContext) {
  let panel: vscode.WebviewPanel | undefined;

  let disposable = vscode.commands.registerCommand('extension.generateQRCode', (uri) => {
    if (!panel) {
      // 创建一个Webview面板
      panel = vscode.window.createWebviewPanel(
        'qrCodeGenerator',
        '小贷二维码生成器',
        vscode.ViewColumn.One, // 不拆分编辑器
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

    // 获取Webview的HTML内容
    panel.webview.html = getWebviewContent(uri?.path);

    // 监听Webview发出的消息
    panel.webview.onDidReceiveMessage((message) => {
      if (message.command === 'generateQRCode') {
        if (message.text) {
          generateQRCode(message.text)
            .then((data) => {
              // 生成二维码后，将二维码图片路径发送给Webview
              panel?.webview.postMessage({ command: 'showQRCode', imagePath: data });
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

function getWebviewContent(filePath: string) {
  const display = filePath ? 'block' : 'none';
  const devBaseUrl = 'https://devstatic.ymm56.com/microweb/#/mw-loan-h5';
  const qaBaseUrl = 'https://qastatic.ymm56.com/microweb/#/mw-loan-h5';
  const prodBaseUrl = 'https://static.ymm56.com/microweb/#/mw-loan-h5';
  let devPath = '';
  let devContainerPath = '';
  let qaPath = '';
  let qaContainerPath = '';
  let prodPath = '';
  let prodContainerPath = '';
  if (filePath) {
    devPath = devBaseUrl + filePath.substring(filePath.indexOf('/mw-loan-h5/src/pages') + 21, filePath.length - 4);
    devContainerPath = 'ymm://view/web?url=' + encodeURIComponent(devPath);
    qaPath = qaBaseUrl + filePath.substring(filePath.indexOf('/mw-loan-h5/src/pages') + 21, filePath.length - 4);
    qaContainerPath = 'ymm://view/web?url=' + encodeURIComponent(qaPath);
    prodPath = prodBaseUrl + filePath.substring(filePath.indexOf('/mw-loan-h5/src/pages') + 21, filePath.length - 4);
    prodContainerPath = 'ymm://view/web?url=' + encodeURIComponent(prodPath);
  }
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Generate QR Code</title>
      <style>
        .base {
          font-size: 18px;
          line-height: 24px;
          color: #e5c785;
          margin-bottom: 12px;
        }
        .dev {
          
        }
        .qa {
          
        }
        .prod {
          
        }
        .divider {
          height: 2px;
          width: 50%;
          background-color: #960505;
          margin: 20px 0;
        }
        input { 
          width: 90%;
          padding: 12px; 
          font-size: 16px;
          border: none;
          outline: none;
          margin-bottom: 10px;
        }
        input:focus {
          border: none;
          outline: none;
        }
        button { 
          width: 90%; 
          padding: 16px; 
          font-size: 16px; 
          background: #FFD338;
          border-radius: 12px;
          border: none;
          cursor: pointer;
        }
        button:active {
          background: #f0af22;
        }
        #qrCodeContainer { text-align: center; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div style="display: ${display}">
        <div class="base dev">dev环境: ${devPath}</div>
        <div class="base dev">容器地址: ${devContainerPath}</div>
        <div class="divider"></div>
        <div class="base qa">qa环境: ${qaPath}</div>
        <div class="base qa">容器地址: ${qaContainerPath}</div>
        <div class="divider"></div>
        <div class="base prod">prod环境: ${prodPath}</div>
        <div class="base prod">容器地址: ${prodContainerPath}</div>
      </div>

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
