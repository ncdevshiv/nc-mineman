import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getGuildRoles, getRoleMappings, getBotGuilds } from '@/lib/discord';
import { sql, escapeStr } from '@/lib/database';

export async function GET() {
  const user = await getSession();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch Discord guild roles
    const discordRoles = await getGuildRoles();

    // Get current role mappings from database
    const mappings = await sql('SELECT * FROM discord_role_mappings ORDER BY discord_role_name');
    const currentMappings = mappings.length > 0 ? mappings[0].rows : [];

    // Fetch guild info
    const botGuilds = await getBotGuilds();
    const guild = botGuilds.find((g: any) => g.id === process.env.DISCORD_GUILD_ID);

    return NextResponse.json({
      roles: discordRoles.map(role => ({
        id: role.id,
        name: role.name,
        color: role.color,
        position: role.position,
        managed: role.managed,
        mentionable: role.mentionable,
      })),
      mappings: currentMappings,
      guild: guild || { id: process.env.DISCORD_GUILD_ID, name: process.env.DISCORD_GUILD_NAME },
    });
  } catch (error: any) {
    console.error('[Admin/Discord] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getSession();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, mappings } = body;

    if (action === 'save_mappings') {
      // Clear existing mappings
      await sql('DELETE FROM discord_role_mappings');

      // Insert new mappings
      for (const mapping of mappings) {
        await sql(
          `INSERT INTO discord_role_mappings (discord_role_id, discord_role_name, site_role, sync_direction)
           VALUES ('${escapeStr(mapping.discordRoleId)}', '${escapeStr(mapping.discordRoleName)}', '${escapeStr(mapping.siteRole)}', '${escapeStr(mapping.direction || 'discord-to-site')}')`
        );
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('[Admin/Discord] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
