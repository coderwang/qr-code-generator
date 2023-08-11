import * as vscode from 'vscode';
import * as qrcode from 'qrcode';
import * as path from 'path';
import * as fs from 'fs';
import { globSync } from 'glob';

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
  const defaultValue = 'https://www.baidu.com';

  let outerDisplay = 'none';
  let innerDisplay = 'none';

  let devPath = '';
  let devContainerPath = '';
  let qaPath = '';
  let qaContainerPath = '';
  let prodPath = '';
  let prodContainerPath = '';

  let newRoutePath = '';

  let pageTrackName = '';

  let fileWithQuery = '';

  console.log('filePath=====>', filePath);

  // 通过右键打开
  if (filePath) {
    if (filePath.includes('mw-loan-h5')) {
      outerDisplay = 'block';
      innerDisplay = 'block';

      const devBaseUrl = 'https://devstatic.ymm56.com/microweb/#/mw-loan-h5/';
      const qaBaseUrl = 'https://qastatic.ymm56.com/microweb/#/mw-loan-h5/';
      const prodBaseUrl = 'https://static.ymm56.com/microweb/#/mw-loan-h5/';

      const shortPath = filePath.substring(filePath.indexOf('/mw-loan-h5/src/pages') + 22, filePath.length - 4);
      console.log('shortPath=====>', shortPath);

      // 新版路由地址
      newRoutePath = 'ymm://loan/h5/' + shortPath.replace(/\//g, '_').slice(0, -6);

      // 页面地址以及容器地址
      devPath = devBaseUrl + shortPath;
      devContainerPath = 'ymm://view/web?url=' + encodeURIComponent(devPath);
      qaPath = qaBaseUrl + shortPath;
      qaContainerPath = 'ymm://view/web?url=' + encodeURIComponent(qaPath);
      prodPath = prodBaseUrl + shortPath;
      prodContainerPath = 'ymm://view/web?url=' + encodeURIComponent(prodPath);

      // 需要用 fs 模来读取文件内容，而不是 require 和 import
      const fileContent = fs.readFileSync(path.resolve(filePath.substring(0, filePath.indexOf('/src/pages')), 'src/assets/js/track/pageMap.ts'), "utf8");
      // 页面埋点路径
      if (fileContent.includes(shortPath)) {
        const regex = new RegExp(`${shortPath}' = '\(\.\*\)'`);
        pageTrackName = fileContent.match(regex)?.[1] ?? '';
      } else {
        pageTrackName = 'loan_h5_' + shortPath.replace(/\//g, '_');
      }

      // 使用了query参数的页面
      const files = globSync(path.join(path.dirname(filePath), '**/*.ts{,x}'));
      let index = 0;
      files.forEach(item => {
        if (fs.readFileSync(item, "utf8").includes('parseQuery')) {
          index++;
          fileWithQuery += `<div class="base">${index}、${item}</div>`;
        }
      });
    }
    if (filePath.includes('wx-loan-h5')) {
      outerDisplay = 'block';

      const devBaseUrl = 'https://devstatic.ymm56.com/wx-loan-h5/#/';
      const qaBaseUrl = 'https://qastatic.ymm56.com/wx-loan-h5/#/';
      const prodBaseUrl = 'https://static.ymm56.com/wx-loan-h5/#/';

      const shortPath = filePath.substring(filePath.indexOf('/wx-loan-h5/src/pages') + 22, filePath.length - 10);
      console.log('shortPath=====>', shortPath);

      // 页面地址
      devPath = devBaseUrl + shortPath;
      qaPath = qaBaseUrl + shortPath;
      prodPath = prodBaseUrl + shortPath;

      // 页面埋点路径
      pageTrackName = 'wx_loan_h5_' + shortPath.replace(/\//g, '_');

      // 使用了query参数的页面
      const files = globSync(path.join(path.dirname(filePath), '**/*.ts{,x}'));
      let index = 0;
      files.forEach(item => {
        if (fs.readFileSync(item, "utf8").includes('parseQuery')) {
          index++;
          fileWithQuery += `<div class="base">${index}、${item}</div>`;
        }
      });
    }
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
        .divider {
          height: 2px;
          width: 50%;
          background-color: #960505;
          margin: 20px 0;
        }
        i {
          color: #e7dfdf;
        }
        span {
          color: green;
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
      <div style="display: ${outerDisplay};margin-bottom: 24px;">
        <div class="base"><i>埋点名称: </i>${pageTrackName}</div>
        <div class="divider"></div>
        <div class="base"><i>dev: </i>${devPath}</div>
        <div class="base"><i>qa: </i>${qaPath}</div>
        <div class="base"><i>prod: </i>${prodPath}</div>
        <div style="display: ${innerDisplay};">
          <div class="base"><i>新版路由: </i>${newRoutePath}</div>
          <div class="divider"></div>
          <div class="base"><i>dev容器: </i>${devContainerPath}</div>
          <div class="base"><i>qa容器: </i>${qaContainerPath}</div>
          <div class="base"><i>prod容器: </i>${prodContainerPath}</div>
        </div>
        <div class="divider"></div>
        <div class="base">${fileWithQuery ? "以下文件中存在<i> query </i>参数, 请自行拼接" : "该页面不存在query参数"}</div>
        ${fileWithQuery}
        <div class="base" style="display: ${innerDisplay};">转换规则: <span>?</span>name<span>=</span>jack<span>&</span>age=18 👉🏻 <span>%3F</span>name<span>%3D</span>jack<span>%26</span>age%3D18</div>
      </div>

      <input id="urlInput" value=${qaPath || defaultValue} type="text" placeholder="Enter a URL">
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
