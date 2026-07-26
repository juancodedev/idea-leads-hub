import { NextResponse } from 'next/server';
import { createClient } from '@/infrastructure/database/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const now = new Date().toISOString();

  const { count: pendingActivities } = await supabase
    .from('activities')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('completed', false);

  const { count: overdueActivities } = await supabase
    .from('activities')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('completed', false)
    .lt('due_date', now);

  return NextResponse.json({
    pendingActivities: pendingActivities ?? 0,
    overdueActivities: overdueActivities ?? 0,
  });
}
