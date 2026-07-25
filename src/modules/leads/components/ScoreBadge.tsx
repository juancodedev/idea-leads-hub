import { Lead } from '@/core/domain/Lead';
import { computeLeadScore, classifyScore, scoreLabel, scoreColor } from '../utils/scoring';
import { Flame, Thermometer, Snowflake } from 'lucide-react';

interface ScoreBadgeProps {
  lead: Lead;
  showIcon?: boolean;
  size?: 'sm' | 'md';
}

const ICON_MAP = {
  hot: Flame,
  warm: Thermometer,
  cold: Snowflake,
};

export function ScoreBadge({ lead, showIcon = true, size = 'sm' }: ScoreBadgeProps) {
  const score = computeLeadScore(lead);
  const tier = classifyScore(score);
  const Icon = showIcon ? ICON_MAP[tier] : null;

  const sizeClasses = size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-sm px-2 py-1';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${sizeClasses} ${scoreColor(tier)}`}
      title={`Score: ${score}/100`}
    >
      {Icon && <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />}
      {scoreLabel(tier)}
    </span>
  );
}
