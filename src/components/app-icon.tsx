/**
 * The app's 40 × 40 icon for the Header: the slot machine, drawn flat in
 * Cute Matcha colours. Its body is sprout, whose edge shows in either theme;
 * the lever is drawn in `text`, so it turns cream in Dark Matcha instead of
 * vanishing. public/favicon.svg is the same drawing in fixed colours.
 */
export const PantryIcon = () => (
  <svg aria-hidden="true" width="40" height="40" viewBox="0 0 32 32">
    <path
      d="M24 19h3.5V9"
      fill="none"
      stroke="var(--text)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle
      cx="27.5"
      cy="7"
      r="2.75"
      fill="var(--danger)"
      stroke="var(--text)"
      strokeWidth="1.5"
    />
    <rect
      x="2"
      y="5"
      width="22"
      height="23"
      rx="5"
      fill="var(--accent-soft)"
      stroke="var(--on-accent)"
      strokeWidth="2"
    />
    <rect x="6" y="7.5" width="14" height="2.5" rx="1.25" fill="#3b4a42" />
    <rect
      x="4.5"
      y="12"
      width="17"
      height="9.5"
      rx="2.5"
      fill="#f7f8de"
      stroke="var(--on-accent)"
      strokeWidth="1.5"
    />
    <path
      d="M10.17 12v9.5M15.83 12v9.5"
      stroke="var(--on-accent)"
      strokeWidth="1.2"
    />
    <circle
      cx="7.33"
      cy="16.75"
      r="1.7"
      fill="var(--moss)"
      stroke="var(--on-accent)"
      strokeWidth=".8"
    />
    <circle
      cx="13"
      cy="16.75"
      r="1.7"
      fill="var(--gold)"
      stroke="var(--on-accent)"
      strokeWidth=".8"
    />
    <circle
      cx="18.67"
      cy="16.75"
      r="1.7"
      fill="var(--terracotta)"
      stroke="var(--on-accent)"
      strokeWidth=".8"
    />
    <rect x="8" y="23.5" width="10" height="2" rx="1" fill="#3b4a42" />
  </svg>
);
