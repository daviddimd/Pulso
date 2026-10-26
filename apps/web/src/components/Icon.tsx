import type { ReactNode } from 'react';

export type IconName = 'route' | 'plus' | 'car' | 'chart' | 'arrow' | 'refresh' | 'pin' | 'clock' | 'people' | 'check' | 'download' | 'chevron' | 'activity' | 'shield';
const paths: Record<IconName, ReactNode> = {
  route: <><circle cx="5" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 6h8a4 4 0 0 1 0 8H9a4 4 0 0 0 0 8"/><path d="M9 18v4H5"/></>,
  plus: <path d="M12 5v14M5 12h14"/>,
  car: <><path d="m5 7 2-3h10l2 3 2 3v8H3v-8l2-3ZM3 10h18M6 14h2m8 0h2M6 18v2m12-2v2"/></>,
  chart: <><path d="M4 4v16h16M8 15v-4m5 4V7m5 8v-6"/></>,
  arrow: <path d="M5 12h14m-5-5 5 5-5 5"/>,
  refresh: <><path d="M20 11a8 8 0 1 1-2.34-5.66L20 8M20 3v5h-5"/></>,
  pin: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  people: <><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v2"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  download: <><path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4"/></>,
  chevron: <path d="m9 5 7 7-7 7"/>,
  activity: <path d="M3 12h4l3-7 4 14 3-7h4"/>,
  shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/></>,
};
export function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  return <svg className={`ui-icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
