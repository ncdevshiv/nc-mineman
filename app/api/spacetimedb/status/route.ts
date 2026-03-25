import { NextResponse } from 'next/server';

// SpaceTimeDB is deprecated — libsql is used for all data.
// This stub returns a consistent response so client hooks don't error.
export async function GET() {
  return NextResponse.json({ running: false, tables: [] });
}
