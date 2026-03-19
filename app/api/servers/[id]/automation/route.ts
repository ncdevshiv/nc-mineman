import { NextResponse } from 'next/server';
import { nodeManager } from '@/lib/server-manager';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const server = nodeManager.getServer(id);

  if (!server) {
    return NextResponse.json({ error: 'Server not found' }, { status: 404 });
  }

  const rulesPath = path.join(server.serverDir, 'automation.json');
  let rules = [];
  if (fs.existsSync(rulesPath)) {
    try {
      rules = JSON.parse(fs.readFileSync(rulesPath, 'utf-8'));
    } catch (e) {}
  }

  const tasksPath = path.join(server.serverDir, 'tasks.json');
  let tasks = [];
  if (fs.existsSync(tasksPath)) {
    try {
      tasks = JSON.parse(fs.readFileSync(tasksPath, 'utf-8'));
    } catch (e) {}
  }

  return NextResponse.json({ rules, tasks });
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

  const data = await request.json();
  data.id = crypto.randomUUID();

  if (data.type === 'task') {
    const tasksPath = path.join(server.serverDir, 'tasks.json');
    let tasks = [];
    if (fs.existsSync(tasksPath)) {
      try {
        tasks = JSON.parse(fs.readFileSync(tasksPath, 'utf-8'));
      } catch (e) {}
    }
    tasks.push(data);
    fs.writeFileSync(tasksPath, JSON.stringify(tasks, null, 2));
    server.loadAutomationRules(); // Reloads tasks too
    return NextResponse.json({ success: true, task: data });
  } else {
    const rulesPath = path.join(server.serverDir, 'automation.json');
    let rules = [];
    if (fs.existsSync(rulesPath)) {
      try {
        rules = JSON.parse(fs.readFileSync(rulesPath, 'utf-8'));
      } catch (e) {}
    }
    rules.push(data);
    fs.writeFileSync(rulesPath, JSON.stringify(rules, null, 2));
    server.loadAutomationRules();
    return NextResponse.json({ success: true, rule: data });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(request.url);
  const ruleId = url.searchParams.get('id');
  const taskId = url.searchParams.get('taskId');
  const server = nodeManager.getServer(id);

  if (!server) {
    return NextResponse.json({ error: 'Server not found' }, { status: 404 });
  }

  if (taskId) {
    const tasksPath = path.join(server.serverDir, 'tasks.json');
    let tasks = [];
    if (fs.existsSync(tasksPath)) {
      try {
        tasks = JSON.parse(fs.readFileSync(tasksPath, 'utf-8'));
      } catch (e) {}
    }
    tasks = tasks.filter((t: any) => t.id !== taskId);
    fs.writeFileSync(tasksPath, JSON.stringify(tasks, null, 2));
    server.loadAutomationRules();
    return NextResponse.json({ success: true });
  } else if (ruleId) {
    const rulesPath = path.join(server.serverDir, 'automation.json');
    let rules = [];
    if (fs.existsSync(rulesPath)) {
      try {
        rules = JSON.parse(fs.readFileSync(rulesPath, 'utf-8'));
      } catch (e) {}
    }
    rules = rules.filter((r: any) => r.id !== ruleId);
    fs.writeFileSync(rulesPath, JSON.stringify(rules, null, 2));
    server.loadAutomationRules();
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'ID not provided' }, { status: 400 });
}
