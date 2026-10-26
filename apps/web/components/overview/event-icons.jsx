// Match-event icon set for the events timeline.
//
// Conventions follow the standard livescore vocabulary (Sofascore / Flashscore):
//   football  -> goal          boot      -> assist
//   card rect -> yellow / red  arrows    -> substitution (up = on, down = off)
//   monitor   -> VAR           ball + X  -> missed penalty / disallowed goal
//
// Everything except the card rectangles is drawn in `currentColor` so the
// glyphs stay readable in every desk skin; cards keep their literal colour
// because the colour *is* the meaning.

const STROKE = { fill: "none", strokeLinecap: "round", strokeLinejoin: "round" };

export function BootIcon({ size = 15, className }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M4.6 17.8 V12.6 c0-1.6 1.1-2.7 2.7-3 l3.5-.7 l1.1-2.2 c.3-.6.9-1 1.6-1 .9 0 1.7.6 1.9 1.5 l.5 2.2 l3.2 1.1 c2 .7 3.2 2.4 3.2 4.4 v2.9 H4.6 Z"
        stroke="currentColor"
        strokeWidth="1.7"
        fill="none"
      />
      <path
        d="M7.7 12.5 l2.5-.8 M8.2 14.3 l2.5-.8"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
      />
      <g fill="currentColor">
        <rect x="6.6" y="18.2" width="1.7" height="1.6" rx="0.7" />
        <rect x="10.8" y="18.2" width="1.7" height="1.6" rx="0.7" />
        <rect x="15" y="18.2" width="1.7" height="1.6" rx="0.7" />
        <rect x="19.2" y="18.2" width="1.7" height="1.6" rx="0.7" />
      </g>
    </svg>
  );
}

export function CardIcon({ color, size = 15, className }) {
  const w = Math.round(size * 0.62);
  return (
    <svg
      width={w}
      height={size}
      viewBox="0 0 10 16"
      className={className}
      aria-hidden="true"
    >
      <rect
        x="1.2"
        y="1.2"
        width="7.6"
        height="13.6"
        rx="1.4"
        fill={color}
        stroke="rgba(0,0,0,0.32)"
        strokeWidth="1"
      />
    </svg>
  );
}

export function SubIcon({ size = 15, className }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      fill="none"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5.4 14.5 V6.2" stroke="#16a34a" />
      <path d="M2.9 8.7 L5.4 6.2 L7.9 8.7" stroke="#16a34a" />
      <path d="M18.6 9.5 V17.8" stroke="#dc2626" />
      <path d="M16.1 15.3 L18.6 17.8 L21.1 15.3" stroke="#dc2626" />
    </svg>
  );
}

export function SubOutIcon({ size = 13, className }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      fill="none"
      stroke="#dc2626"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 5 V17.5" />
      <path d="M7 12.5 L12 17.5 L17 12.5" />
    </svg>
  );
}

export function SubInIcon({ size = 13, className }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      fill="none"
      stroke="#16a34a"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 17.5 V5" />
      <path d="M7 10 L12 5 L17 10" />
    </svg>
  );
}

export function VarIcon({ size = 15, className }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2.6" y="4" width="18.8" height="13" rx="2.2" />
      <path d="M12 17 V20.4" />
      <path d="M8.6 20.4 H15.4" />
      <path d="M10.3 8.3 L14.8 11.2 L10.3 14.1 Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function PenaltySpotIcon({ size = 12, className }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9.4" stroke="currentColor" strokeWidth="1.7" fill="none" />
      <circle cx="12" cy="12" r="2.6" fill="currentColor" />
    </svg>
  );
}

export { STROKE };
