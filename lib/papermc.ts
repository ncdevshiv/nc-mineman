import https from 'https';
import http from 'http';
import fs from 'fs';
import { pipeline } from 'stream/promises';

export async function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const request = url.startsWith('https') ? https : http;

    request.get(url, (response) => {
      if (response.statusCode !== 200) {
        file.close();
        fs.unlink(destPath, () => {});
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      pipeline(response, file).then(() => resolve()).catch(reject);
    }).on('error', (err) => {
      file.close();
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

export async function getLatestBuild(software: string, version: string): Promise<string | null> {
  return new Promise((resolve) => {
    const url = `https://api.papermc.io/v2/projects/${software}/versions/${version}`;
    const request = url.startsWith('https') ? https : http;

    request.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const buildData = JSON.parse(data);
          // PaperMC API returns builds as numbers; some forks return objects with a build field.
          const lastEntry = buildData.builds?.[buildData.builds.length - 1];
          const latestBuild = typeof lastEntry === 'number' ? lastEntry : lastEntry?.build;
          resolve(latestBuild || null);
        } catch {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}
