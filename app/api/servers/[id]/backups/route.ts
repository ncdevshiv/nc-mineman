import { NextResponse } from 'next/server';
import { nodeManager } from '@/lib/server-manager';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { pipeline } from 'stream/promises';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const server = nodeManager.getServer(id);

  if (!server) {
    return NextResponse.json({ error: 'Server not found' }, { status: 404 });
  }

  const backupsDir = path.join(process.cwd(), 'backups', id);
  if (!fs.existsSync(backupsDir)) {
    return NextResponse.json({ backups: [] });
  }

  try {
    const files = fs.readdirSync(backupsDir);
    const backups = files
      .filter(f => f.endsWith('.zip'))
      .map(file => {
        const stats = fs.statSync(path.join(backupsDir, file));
        return {
          name: file,
          size: stats.size,
          createdAt: stats.birthtime,
        };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return NextResponse.json({ backups });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const server = nodeManager.getServer(id);

  if (!server) {
    return NextResponse.json({ error: 'Server not found' }, { status: 404 });
  }

  const { name } = await request.json().catch(() => ({}));

  const backupsDir = path.join(process.cwd(), 'backups', id);
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const namePrefix = name || 'Backup';
  const backupName = `${namePrefix}-${timestamp}.zip`;
  const backupPath = path.join(backupsDir, backupName);

  try {
    await new Promise<void>((resolve, reject) => {
      const output = fs.createWriteStream(backupPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      archive.on('error', (err: Error) => reject(err));

      output.on('close', () => resolve());
      output.on('error', (err: Error) => reject(err));

      archive.pipe(output);

      const excludeDirs = new Set(['backups', 'playit', '.restore_temp']);
      const items = fs.readdirSync(server.serverDir, { withFileTypes: true });
      for (const item of items) {
        if (excludeDirs.has(item.name)) continue;
        const itemPath = path.join(server.serverDir, item.name);
        if (item.isDirectory()) {
          archive.directory(itemPath, item.name);
        } else {
          archive.file(itemPath, { name: item.name });
        }
      }

      archive.finalize();
    });

    return NextResponse.json({ success: true, backup: backupName });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(request.url);
  const filename = url.searchParams.get('filename');
  const server = nodeManager.getServer(id);

  if (!server || !filename) {
    return NextResponse.json({ error: 'Server or filename not found' }, { status: 404 });
  }

  const backupPath = path.join(process.cwd(), 'backups', id, filename);

  try {
    if (fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath);
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
