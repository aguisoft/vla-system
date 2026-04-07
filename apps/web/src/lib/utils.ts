import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { PresenceStatusEnum } from '@vla/shared';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const STATUS_CONFIG: Record<PresenceStatusEnum, { label: string; color: string; emoji: string; pulse: boolean }> = {
  [PresenceStatusEnum.AVAILABLE]: { label: 'Disponible', color: '#00C853', emoji: '🟢', pulse: true },
  [PresenceStatusEnum.BUSY]: { label: 'Ocupado', color: '#FFB300', emoji: '🟡', pulse: false },
  [PresenceStatusEnum.IN_MEETING]: { label: 'En reunión', color: '#F44336', emoji: '🔴', pulse: false },
  [PresenceStatusEnum.FOCUS]: { label: 'Enfocado', color: '#9C27B0', emoji: '🎯', pulse: false },
  [PresenceStatusEnum.LUNCH]: { label: 'Almorzando', color: '#FF7043', emoji: '🍽️', pulse: false },
  [PresenceStatusEnum.BRB]: { label: 'Vuelvo pronto', color: '#78909C', emoji: '⏰', pulse: false },
  [PresenceStatusEnum.OFFLINE]: { label: 'Sin conexión', color: '#9E9E9E', emoji: '⚫', pulse: false },
};

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName[0]}${lastName[0]}`.toUpperCase();
}
