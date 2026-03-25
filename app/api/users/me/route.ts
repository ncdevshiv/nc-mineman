import { getSession, createSession } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { getSiteUser, upsertSiteUser, getUserByMinecraftUsername } from '@/lib/db-frontend';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const user = await getSiteUser(session.id);
    return NextResponse.json(user);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const currUser = await getSiteUser(session.id);
    
    if (!currUser) return NextResponse.json({ error: 'User not found in DB' }, { status: 404 });

    const isAdmin = session.roles.some(r => ['owner', 'admin', 'god'].includes(r));
    const isModerator = session.roles.includes('helper');

    // Check if trying to change Minecraft username
    if (body.mc_username && body.mc_username !== currUser.mc_username) {
      // Check if username already exists (case-insensitive) in the system
      const existingUser = await getUserByMinecraftUsername(body.mc_username);
      if (existingUser && existingUser.id !== session.id) {
        return NextResponse.json({ 
          error: 'This Minecraft username is already linked to another account.',
          field: 'mc_username'
        }, { status: 409 });
      }
    }

    // Discord username is auto-fetched from OAuth on first login and NEVER changes
    // This prevents username impersonation
    const discordUsername = currUser.discord_username || body.discord_username || session.discord_username || '';

    // Minecraft username: can be set once, then locked (requires admin to change)
    let mcUsername = currUser.mc_username;
    if (body.mc_username && body.mc_username !== currUser.mc_username) {
      if (currUser.mc_username && !isAdmin) {
        return NextResponse.json({
          error: 'You cannot change your Minecraft username. Please contact an administrator.',
          field: 'mc_username'
        }, { status: 403 });
      }
      // First-time set OR admin changing it
      mcUsername = body.mc_username;
    }

    await upsertSiteUser({
      id: session.id,
      email: session.email,
      mc_username: mcUsername,
      discord_username: discordUsername,
      phone_number: body.phone_number ?? currUser.phone_number,
      site_name: body.site_name || currUser.site_name,
    });

    // Re-mint the session JWT so the mc_username is available in the payload without hitting DB every request
    await createSession({
      id: session.id,
      email: session.email,
      firstName: session.firstName,
      lastName: session.lastName,
      mc_username: mcUsername || undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[PROFILE] Update failed:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
