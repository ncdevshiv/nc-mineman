import { NextResponse } from 'next/server';
import { nodeManager } from '@/lib/server-manager';
import fs from 'fs';
import path from 'path';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const server = nodeManager.getServer(id);
  if (!server) return NextResponse.json({ error: 'Server not found' }, { status: 404 });

  const url = new URL(req.url);
  const targetPath = url.searchParams.get('path');

  if (!targetPath) return NextResponse.json({ error: 'Path required' }, { status: 400 });

  try {
    const safePath = server.getSafePath(targetPath);

    if (!fs.existsSync(safePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const stat = fs.statSync(safePath);
    if (stat.isDirectory()) {
      return NextResponse.json({ error: 'Cannot download directory' }, { status: 400 });
    }

    const fileBuffer = fs.readFileSync(safePath);
    const filename = path.basename(safePath);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(fileBuffer.length),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
