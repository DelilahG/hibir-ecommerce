import type { ReactNode } from 'react';

/*
 * Icons are drawn on a 24px grid with a 1.5px rounded stroke.
 * To use Iconly (iconly.pro) icons instead, export them as SVG from your Iconly account and
 * save them as src/icons/iconly/<name>.svg (for example search.svg). Any file found there
 * replaces the built-in drawing of the same name; see src/icons/README.md.
 */
const iconly = import.meta.glob<string>('../icons/iconly/*.svg', { query: '?raw', import: 'default', eager: true });

const paths: Record<string, ReactNode> = {
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  bag: (
    <>
      <path d="M5 8h14l-1 12.5H6L5 8Z" />
      <path d="M9 10V7a3 3 0 0 1 6 0v3" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" />
    </>
  ),
  arrowRight: <path d="M4 12h16m-6-6 6 6-6 6" />,
  arrowLeft: <path d="M20 12H4m6-6-6 6 6 6" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  menu: <path d="M4 7h16M4 12h16M4 17h10" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  trash: (
    <>
      <path d="M4.5 7h15M10 4h4M6.5 7l.8 12.5h9.4L17.5 7" />
      <path d="M10 11v5M14 11v5" />
    </>
  ),
  truck: (
    <>
      <path d="M3 6.5h11v10H3zM14 10h3.5l3 3v3.5H14" />
      <circle cx="7" cy="18" r="1.8" />
      <circle cx="17" cy="18" r="1.8" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.5 19 6v5.5c0 4.3-2.9 7.6-7 9-4.1-1.4-7-4.7-7-9V6l7-2.5Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  box: (
    <>
      <path d="M3.5 7.5 12 3.5l8.5 4v9L12 20.5l-8.5-4v-9Z" />
      <path d="M3.5 7.5 12 11.5l8.5-4M12 11.5v9" />
    </>
  ),
  wallet: (
    <>
      <path d="M4 6.5h14.5a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18V6.5Z" />
      <path d="M4 6.5 15.5 4v2.5M15 13h2" />
    </>
  ),
  filter: <path d="M4 6h16M7 12h10M10 18h4" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  alert: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v5.5M12 16.2v.3" />
    </>
  ),
  grid: (
    <>
      <path d="M4 4h6.5v6.5H4zM13.5 4H20v6.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z" />
    </>
  ),
  chart: <path d="M4 20V10M10 20V4M16 20v-7M21 20H3" />,
  list: <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />,
  tag: (
    <>
      <path d="M3.5 12.5V4h8.5l8.5 8.5-8.5 8.5-8.5-8.5Z" />
      <circle cx="8" cy="8.5" r="1.3" />
    </>
  ),
  logout: <path d="M14 4.5H6.5v15H14M10.5 12H21m-3.5-3.5L21 12l-3.5 3.5" />,
  image: (
    <>
      <path d="M4 5h16v14H4z" />
      <path d="m4 16 5-5 4 4 2.5-2.5L20 17" />
      <circle cx="15.5" cy="9" r="1.3" />
    </>
  ),
};

export type IconName = keyof typeof paths;

interface Props {
  name: IconName;
  size?: number;
  className?: string;
  label?: string;
}

export function Icon({ name, size = 20, className, label }: Props) {
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true as const };
  const override = iconly[`../icons/iconly/${name}.svg`];
  if (override) {
    return (
      <span
        className={`icon ${className ?? ''}`}
        style={{ width: size, height: size }}
        {...a11y}
        // Local SVG files committed to the repository, not user input.
        dangerouslySetInnerHTML={{ __html: override }}
      />
    );
  }
  return (
    <svg
      className={`icon ${className ?? ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...a11y}
    >
      {paths[name]}
    </svg>
  );
}
