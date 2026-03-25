import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSiteUser } from '@/lib/db-frontend';

export async function GET() {
  const user = await getSession();
  if (!user) {
    return NextResponse.json(null, { status: 401 });
  }

  // Fetch additional user data from database
  const dbUser = await getSiteUser(user.id);
  if (dbUser) {
    return NextResponse.json({
      ...user,
      phone_number: dbUser.phone_number,
      site_name: dbUser.site_name,
      avatar_url: dbUser.avatar_url,
    });
  }

  return NextResponse.json(user);
}
