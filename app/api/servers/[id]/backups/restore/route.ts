import { NextResponse } from 'next/server';
import { nodeManager } from '@/lib/server-manager';
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const server = nodeManager.getServer(id);

  if (!server) {
    return NextResponse.json({ error: 'Server not found' }, { status: 404 });
  }

  if (server.status !== 'stopped') {
    return NextResponse.json({ error: 'Server must be stopped to restore a backup' }, { status: 400 });
  }

  const { filename } = await request.json();
  if (!filename) {
    return NextResponse.json({ error: 'Filename is required' }, { status: 400 });
  }

  const backupPath = path.join(process.cwd(), 'backups', id, filename);

  if (!fs.existsSync(backupPath)) {
    return NextResponse.json({ error: 'Backup file not found' }, { status: 404 });
  }

  try {
    const tempDir = path.join(server.serverDir, '.restore_temp');
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDir, { recursive: true });

    const zip = new AdmZip(backupPath);
    zip.extractAllTo(tempDir, true);

    const excludeDirs = new Set(['backups', 'playit', '.restore_temp']);

    const items = fs.readdirSync(server.serverDir, { withFileTypes: true });
    for (const item of items) {
      if (excludeDirs.has(item.name)) continue;
      const itemPath = path.join(server.serverDir, item.name);
      if (item.isDirectory()) {
        fs.rmSync(itemPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(itemPath);
      }
    }

    const tempItems = fs.readdirSync(tempDir, { withFileTypes: true });
    for (const item of tempItems) {
      const srcPath = path.join(tempDir, item.name);
      const destPath = path.join(server.serverDir, item.name);
      if (item.isDirectory()) {
        copyDirRecursive(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }

    fs.rmSync(tempDir, { recursive: true, force: true });

    server.loadAutomationRules();

    return NextResponse.json({ success: true, message: 'Backup restored successfully. Restart the server to apply changes.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function copyDirRecursive(src: string, dest: string) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const items = fs.readdirSync(src, { withFileTypes: true });
  for (const item of items) {
    const srcPath = path.join(src, item.name);
    const destPath = path.join(dest, item.name);
    if (item.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
