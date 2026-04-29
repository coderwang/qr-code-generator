import * as qrcode from 'qrcode';

export async function generateQRCode(text: string): Promise<string> {
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