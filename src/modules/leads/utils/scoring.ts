import { Lead } from '@/core/domain/Lead';

export type LeadScoreTier = 'hot' | 'warm' | 'cold';

const SCORE_MAP: Record<string, number> = {
  'Nuevo': 10,
  'Contactado': 20,
  'Interesado': 40,
  'Propuesta': 60,
  'Negociación': 80,
  'Ganado': 100,
  'Perdido': 5,
};

const SCORE_BY_DAYS_SINCE_UPDATE: [number, number][] = [
  [1, 30],    // updated within 1 day → +30
  [3, 20],    // within 3 days → +20
  [7, 10],    // within 7 days → +10
  [14, 5],    // within 14 days → +5
];

/**
 * Compute a score (0-100) for a lead based on:
 * - Current stage/status
 * - Estimated value
 * - Recency of activity (updatedAt)
 */
export function computeLeadScore(lead: Lead): number {
  let score = 0;

  // Stage-based score (0-50)
  const stageScore = SCORE_MAP[lead.status] ?? 10;
  score += stageScore * 0.5;

  // Value-based score (0-25)
  if (lead.estimatedValue && lead.estimatedValue > 0) {
    const valueScore = Math.min(lead.estimatedValue / 2000, 25);
    score += valueScore;
  }

  // Recency score (0-25)
  const daysSinceUpdate = daysAgo(lead.updatedAt);
  for (const [days, points] of SCORE_BY_DAYS_SINCE_UPDATE) {
    if (daysSinceUpdate <= days) {
      score += points;
      break;
    }
  }

  return Math.round(Math.min(score, 100));
}

/**
 * Classify a score into hot/warm/cold tier.
 */
export function classifyScore(score: number): LeadScoreTier {
  if (score >= 60) return 'hot';
  if (score >= 30) return 'warm';
  return 'cold';
}

/**
 * Get human-readable label for a tier.
 */
export function scoreLabel(tier: LeadScoreTier): string {
  const labels: Record<LeadScoreTier, string> = {
    hot: 'Caliente',
    warm: 'Tibio',
    cold: 'Frío',
  };
  return labels[tier];
}

/**
 * Get color class for a tier badge.
 */
export function scoreColor(tier: LeadScoreTier): string {
  const colors: Record<LeadScoreTier, string> = {
    hot: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    warm: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    cold: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  };
  return colors[tier];
}

function daysAgo(dateStr: string): number {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}
