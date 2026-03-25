import { NextRequest, NextResponse } from 'next/server';

// SpaceTimeDB is deprecated — libsql is used for all data.
// This stub returns a consistent empty response.
export async function GET(request: NextRequest) {
  return NextResponse.json({ running: false, tables: [] });
}

export async function POST() {
  return NextResponse.json({ error: 'SpaceTimeDB is not available' }, { status: 503 });
}

export async function DELETE() {
  return NextResponse.json({ error: 'SpaceTimeDB is not available' }, { status: 503 });
}
