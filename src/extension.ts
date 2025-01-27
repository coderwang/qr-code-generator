import * as vscode from 'vscode';
import * as qrcode from 'qrcode';
import * as path from 'path';
import * as fs from 'fs';
import { globSync } from 'glob';

export function activate(context: vscode.ExtensionContext) {
  let panel: vscode.WebviewPanel | undefined;

  let disposable = vscode.commands.registerCommand('extension.generateQRCode', (uri) => {
    // 获取当前活动编辑器
    const editor = vscode.window.activeTextEditor;
    // 获取选中的文本
    const selectedText = editor?.document.getText(editor.selection);
    
    if (!panel) {
      // 创建一个Webview面板
      panel = vscode.window.createWebviewPanel(
        'qrCodeGenerator',
        'QRCode Generator',
        vscode.ViewColumn.Two, // 拆分编辑器
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

    // 获取Webview的HTML内容，传入选中的文本
    panel.webview.html = getWebviewContent(uri?.path, selectedText);

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

function getWebviewContent(filePath: string, selectedText?: string) {
  // 如果有选中文本就使用选中文本，否则使用默认值
  const defaultValue = selectedText || 'https://www.google.com';

  console.log('filePath=====>', filePath);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Generate QR Code</title>
      <style>
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

        #qrCodeContainer img {
          cursor: pointer;
          border-radius: 8px;
        }
      </style>
    </head>
    <body>
      <input id="urlInput" value=${defaultValue} type="text" placeholder="Enter a URL">
      <button onclick="generateQRCode()">Generate QR Code</button>
      <div id="qrCodeContainer"></div>

      <script>
        const vscode = acquireVsCodeApi();
        const urlInput = document.getElementById('urlInput');

        function generateQRCode() {
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

        urlInput.addEventListener('keydown', event => {
          if (event.key === 'Enter') {
            generateQRCode();
          }
        })

        // 自动调用一次
        generateQRCode();
      </script>
    </body>
    </html>
  `;
}

export function deactivate() { }
