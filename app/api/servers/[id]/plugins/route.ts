import { NextResponse } from 'next/server';
import { nodeManager } from '@/lib/server-manager';
import fs from 'fs';
import path from 'path';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const server = nodeManager.getServer(id);
  if (!server) return NextResponse.json({ error: 'Server not found' }, { status: 404 });

  try {
    const pluginsDir = server.getSafePath('/plugins');
    if (!fs.existsSync(pluginsDir)) {
      return NextResponse.json({ plugins: [] });
    }

    const files = fs.readdirSync(pluginsDir, { withFileTypes: true })
      .filter(dirent => !dirent.isDirectory() && dirent.name.endsWith('.jar'))
      .map(dirent => {
        const stat = fs.statSync(path.join(pluginsDir, dirent.name));
        return {
          name: dirent.name,
          size: stat.size,
          modifiedAt: stat.mtime,
        };
      });

    return NextResponse.json({ plugins: files });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { url, filename } = await req.json();
  const server = nodeManager.getServer(id);
  if (!server) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    await server.installPlugin(url, filename);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const server = nodeManager.getServer(id);
  if (!server) return NextResponse.json({ error: 'Server not found' }, { status: 404 });

  const url = new URL(req.url);
  const filename = url.searchParams.get('filename');

  if (!filename || !filename.endsWith('.jar')) {
    return NextResponse.json({ error: 'Invalid plugin filename' }, { status: 400 });
  }

  try {
    const safePath = server.getSafePath(path.join('/plugins', filename));
    if (fs.existsSync(safePath)) {
      fs.unlinkSync(safePath);
    }
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
