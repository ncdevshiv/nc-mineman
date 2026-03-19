import { NextResponse } from 'next/server';
import { nodeManager } from '@/lib/server-manager';
import https from 'https';
import http from 'http';
import { pipeline } from 'stream/promises';
import fs from 'fs';
import path from 'path';

export async function GET() {
  const servers = Array.from(nodeManager.servers.values()).map(s => ({
    id: s.config.id,
    name: s.config.name,
    software: s.config.software,
    version: s.config.version,
    ram: s.config.ram,
    cpuLimit: s.config.cpuLimit,
    status: s.status,
    tunnelStatus: s.tunnelStatus,
  }));
  return NextResponse.json(servers);
}

async function downloadFile(url: string, destPath: string): Promise<void> {
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

async function getLatestBuild(software: string, version: string): Promise<string | null> {
  return new Promise((resolve) => {
    const url = `https://api.papermc.io/v2/projects/${software}/versions/${version}`;
    const request = url.startsWith('https') ? https : http;
    
    https.get(url, async (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const buildData = JSON.parse(data);
          const latestBuild = buildData.builds[buildData.builds.length - 1]?.build;
          resolve(latestBuild || null);
        } catch {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

export async function POST(request: Request) {
  const { name, software, version } = await request.json();

  if (!name || !software || !version) {
    return NextResponse.json({ error: 'name, software, and version are required' }, { status: 400 });
  }

  const supportedSoftware = ['paper', 'folia', 'velocity'];
  if (!supportedSoftware.includes(software)) {
    return NextResponse.json({ error: `Unsupported software. Only ${supportedSoftware.join(', ')} are supported.` }, { status: 400 });
  }

  try {
    const instance = nodeManager.createServer(name, software, version);
    
    const latestBuild = await getLatestBuild(software, version);
    if (latestBuild) {
      const downloadUrl = `https://api.papermc.io/v2/projects/${software}/versions/${version}/builds/${latestBuild}/downloads/${software}-${version}-${latestBuild}.jar`;
      const jarPath = path.join(instance.serverDir, 'server.jar');
      try {
        await downloadFile(downloadUrl, jarPath);
      } catch (e) {
        console.error('Failed to auto-download software:', e);
      }
    }

    return NextResponse.json({
      success: true,
      server: {
        id: instance.config.id,
        name: instance.config.name,
        software: instance.config.software,
        version: instance.config.version,
        ram: instance.config.ram,
        status: instance.status,
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
