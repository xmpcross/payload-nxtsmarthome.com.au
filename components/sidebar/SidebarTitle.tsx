/**
 * Single-post sidebar block heading: four-point star mark and a 1.2rem title.
 * Ported from bestlooking.skin's SidebarTitle (user request, 17 Oct 2026); the
 * star takes currentColor so it follows the light and dark themes.
 */
export default function SidebarTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-2 text-neutral-900 dark:text-white">
      <svg width={24} height={24} viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
        <path
          d="M0.582044 11.7285C8.79451 13.4712 10.252 14.8614 12.125 22.7372C13.8067 14.8768 15.2308 13.4992 23.4018 11.8279C15.1894 10.0852 13.7319 8.69503 11.8589 0.81924C10.1769 8.67956 8.75306 10.0571 0.582044 11.7285Z"
          fill="currentColor"
        />
      </svg>
      <h2 className="text-[1.2rem] leading-tight font-bold">{children}</h2>
    </div>
  );
}
