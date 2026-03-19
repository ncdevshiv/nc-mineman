import { NextResponse } from 'next/server';
import { nodeManager } from '@/lib/server-manager';
import fs from 'fs';
import path from 'path';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const server = nodeManager.getServer(id);
  if (!server) return NextResponse.json({ error: 'Server not found' }, { status: 404 });

  try {
    const formData = await req.formData();
    const targetPath = (formData.get('path') as string) || '/';
    const files = formData.getAll('file') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    for (const file of files) {
      const rel = (file as any).webkitRelativePath || file.name;
      const destPath = path.join(targetPath, rel);
      const safePath = server.getSafePath(destPath);

      fs.mkdirSync(path.dirname(safePath), { recursive: true });
      const buffer = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(safePath, buffer);
    }

    return NextResponse.json({ success: true, uploaded: files.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
