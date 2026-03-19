import { NextResponse } from 'next/server';
import { nodeManager } from '@/lib/server-manager';
import fs from 'fs';
import path from 'path';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const server = nodeManager.getServer(id);
  if (!server) return NextResponse.json({ error: 'Server not found' }, { status: 404 });

  const url = new URL(req.url);
  const targetPath = url.searchParams.get('path') || '/';

  try {
    const safePath = server.getSafePath(targetPath);
    
    if (!fs.existsSync(safePath)) {
      return NextResponse.json({ error: 'Path not found' }, { status: 404 });
    }

    const stat = fs.statSync(safePath);
    if (stat.isDirectory()) {
      const files = fs.readdirSync(safePath, { withFileTypes: true }).map(dirent => ({
        name: dirent.name,
        isDirectory: dirent.isDirectory(),
        size: dirent.isDirectory() ? 0 : fs.statSync(path.join(safePath, dirent.name)).size,
        modifiedAt: fs.statSync(path.join(safePath, dirent.name)).mtime,
      }));
      return NextResponse.json({ type: 'directory', files });
    } else {
      const content = fs.readFileSync(safePath, 'utf-8');
      return NextResponse.json({ type: 'file', content });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const server = nodeManager.getServer(id);
  if (!server) return NextResponse.json({ error: 'Server not found' }, { status: 404 });

  try {
    const body = await req.json();
    const { path: targetPath, content, action } = body;
    const safePath = server.getSafePath(targetPath);
    
    if (action === 'createFolder') {
      if (!fs.existsSync(safePath)) {
        fs.mkdirSync(safePath, { recursive: true });
      }
      return NextResponse.json({ success: true });
    }

    fs.writeFileSync(safePath, content, 'utf-8');
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const server = nodeManager.getServer(id);
  if (!server) return NextResponse.json({ error: 'Server not found' }, { status: 404 });

  const url = new URL(req.url);
  const targetPath = url.searchParams.get('path');

  if (!targetPath) return NextResponse.json({ error: 'Path required' }, { status: 400 });

  try {
    const safePath = server.getSafePath(targetPath);
    if (safePath === server.serverDir) {
      return NextResponse.json({ error: 'Cannot delete root directory' }, { status: 400 });
    }
    
    fs.rmSync(safePath, { recursive: true, force: true });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
