import { NextRequest, NextResponse } from 'next/server';

// SpaceTimeDB is deprecated — libsql is used for all data.
export async function GET(request: NextRequest) {
  return NextResponse.json([]);
}

export async function POST() {
  return NextResponse.json({ error: 'SpaceTimeDB is not available' }, { status: 503 });
}
