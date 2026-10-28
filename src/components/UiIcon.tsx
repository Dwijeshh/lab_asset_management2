import type { ReactNode, SVGProps } from 'react';

type IconName = 'asset' | 'lab' | 'users' | 'check' | 'activity' | 'tool' | 'pin' | 'plus' | 'arrow' | 'bell';

const paths: Record<IconName, ReactNode> = {
  asset: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4.5 7.5 7.5 4.3 7.5-4.3M12 12v9"/></>,
  lab: <><path d="M8 3h8M10 3v6l-5.4 8.1A2.5 2.5 0 0 0 6.7 21h10.6a2.5 2.5 0 0 0 2.1-3.9L14 9V3"/><path d="M7.5 16h9"/></>,
  users: <><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2H3ZM17 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 5v1h-4"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  activity: <><path d="M3 12h4l3-7 4 14 3-7h4"/></>,
  tool: <><path d="M14 5a5 5 0 0 0-6 6l-5 5a2.5 2.5 0 0 0 3.5 3.5l5-5a5 5 0 0 0 6-6l-3 3-3-3 2.5-3.5Z"/></>,
  pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
  plus: <path d="M12 5v14M5 12h14"/>,
  arrow: <path d="M5 12h14m-6-6 6 6-6 6"/>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
};

export default function UiIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" width="20" height="20" {...props}>{paths[name]}</svg>;
}
