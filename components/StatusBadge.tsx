import React from 'react';
import { ProjectStatus } from '../types';
import { CircleDashed, CheckCircle2, Clock, PlayCircle, Loader2, Image as ImageIcon } from 'lucide-react';

interface StatusBadgeProps {
  status: ProjectStatus;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const config: Record<ProjectStatus, { color: string; icon: any; label: string; animate?: boolean }> = {
    [ProjectStatus.DRAFT_INTAKE]: { color: 'text-slate-400 bg-slate-400/10', icon: CircleDashed, label: 'Drafting' },
    [ProjectStatus.PROMPT_DRAFTED]: { color: 'text-orange-400 bg-orange-400/10', icon: Clock, label: 'Concept Review' },
    [ProjectStatus.GENERATING_ASSETS]: { color: 'text-blue-400 bg-blue-400/10', icon: Loader2, label: 'Generating', animate: true },
    [ProjectStatus.THUMBNAIL_SELECTION]: { color: 'text-pink-400 bg-pink-400/10', icon: ImageIcon, label: 'Thumbnail' },
    [ProjectStatus.PREVIEW_READY]: { color: 'text-purple-400 bg-purple-400/10', icon: PlayCircle, label: 'Preview Ready' },
    [ProjectStatus.PUBLISHING]: { color: 'text-yellow-400 bg-yellow-400/10', icon: Loader2, label: 'Publishing', animate: true },
    [ProjectStatus.PUBLISHED]: { color: 'text-green-400 bg-green-400/10', icon: CheckCircle2, label: 'Published' },
    [ProjectStatus.FAILED]: { color: 'text-red-400 bg-red-400/10', icon: CircleDashed, label: 'Failed' },
  };

  const { color, icon: Icon, label, animate } = config[status] || config[ProjectStatus.DRAFT_INTAKE];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-transparent ${color}`}>
      <Icon size={14} className={animate ? "animate-spin" : ""} />
      {label}
    </span>
  );
};