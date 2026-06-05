import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/lib/supabase/server';
import { getToday, FREE_DAILY_LIMIT } from '@/lib/date';
import { getEffectiveSubscription, isProActive } from '@/lib/subscription';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createClient(req, res);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      // Return default free tier for unauthenticated users
      return res.status(200).json({
        remaining: 0,
        total: FREE_DAILY_LIMIT,
        isUnlimited: false,
        isAuthenticated: false,
      });
    }

    const subscription = await getEffectiveSubscription(supabase, user.id);

    if (isProActive(subscription)) {
      return res.status(200).json({
        remaining: -1, // -1 indicates unlimited
        total: -1,
        isUnlimited: true,
        isAuthenticated: true,
        planType: subscription?.plan_type,
      });
    }

    // Check credit packages
    const { data: credits } = await supabase
      .from('credit_packages')
      .select('credits_remaining')
      .eq('user_id', user.id)
      .gt('credits_remaining', 0);

    const totalCredits =
      credits?.reduce((sum, pkg) => sum + pkg.credits_remaining, 0) || 0;

    // Check today's free usage
    const today = getToday();
    const { data: dailyUsage } = await supabase
      .from('daily_usage')
      .select('count')
      .eq('user_id', user.id)
      .eq('usage_date', today);

    const usedToday =
      dailyUsage?.reduce((sum, r) => sum + (r.count || 0), 0) || 0;
    const freeRemaining = Math.max(0, FREE_DAILY_LIMIT - usedToday);

    return res.status(200).json({
      remaining: freeRemaining + totalCredits,
      freeRemaining,
      paidCredits: totalCredits,
      total: FREE_DAILY_LIMIT,
      isUnlimited: false,
      isAuthenticated: true,
      planType: subscription?.plan_type || 'free',
    });
  } catch (error) {
    console.error('Usage check error:', error);
    return res.status(500).json({ error: 'Failed to check usage' });
  }
}
