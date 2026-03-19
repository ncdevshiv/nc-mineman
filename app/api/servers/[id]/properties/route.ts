import { NextResponse } from 'next/server';
import { nodeManager } from '@/lib/server-manager';
import fs from 'fs';
import path from 'path';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const server = nodeManager.getServer(id);

  if (!server) {
    return NextResponse.json({ error: 'Server not found' }, { status: 404 });
  }

  const propsPath = path.join(server.serverDir, 'server.properties');
  let properties: Record<string, string> = {};

  if (fs.existsSync(propsPath)) {
    const content = fs.readFileSync(propsPath, 'utf-8');
    content.split('\n').forEach(line => {
      line = line.trim();
      if (line && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        if (key) {
          properties[key.trim()] = valueParts.join('=').trim();
        }
      }
    });
  }

  return NextResponse.json({ properties });
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

  const { properties } = await request.json();
  const propsPath = path.join(server.serverDir, 'server.properties');
  
  let existingProps: Record<string, string> = {};
  let lines: string[] = [];

  if (fs.existsSync(propsPath)) {
    const content = fs.readFileSync(propsPath, 'utf-8');
    lines = content.split('\n');
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key) {
          existingProps[key.trim()] = valueParts.join('=').trim();
        }
      }
    });
  }

  // Update properties
  const newProps = { ...existingProps, ...properties };
  
  // Reconstruct file
  const newLines = [];
  const handledKeys = new Set<string>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key] = trimmed.split('=');
      const k = key.trim();
      if (k && newProps[k] !== undefined) {
        newLines.push(`${k}=${newProps[k]}`);
        handledKeys.add(k);
      } else {
        newLines.push(line);
      }
    } else {
      newLines.push(line);
    }
  }

  // Add new keys
  for (const [key, value] of Object.entries(newProps)) {
    if (!handledKeys.has(key)) {
      newLines.push(`${key}=${value}`);
    }
  }

  fs.writeFileSync(propsPath, newLines.join('\n'));

  return NextResponse.json({ success: true });
}
