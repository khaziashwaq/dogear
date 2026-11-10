import Link from "next/link";

const MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/**
 * The year's goal as a quiet line on Home: progress, what's left, this month. Encouraging only:
 * no streaks, nothing about being "behind".
 */
export function ReadingGoal({ goal, done, thisMonth, month, recapHref, settingsHref }: {
  goal: number | null;
  done: number;
  thisMonth: number;
  /** 0-based. */
  month: number;
  recapHref: string;
  settingsHref: string;
}) {
  if (!goal) {
    return (
      <Link href={settingsHref} className="text-xs text-ink-soft hover:text-ink sm:text-sm">
        {done ? `${done} finished this year · ` : ""}<span className="link-underline">set a reading goal</span>
      </Link>
    );
  }
  const pct = Math.min(100, Math.round((done / goal) * 100));
  const left = Math.max(0, goal - done);
  const note =
    pct >= 100 ? "goal reached ✦" : pct >= 75 ? "nearly there" : pct >= 50 ? "past halfway" : pct >= 25 ? "a quarter of the way" : done ? "off to a start" : "the year's first page";
  return (
    <Link href={recapHref} className="group flex items-center gap-3 text-xs sm:text-sm" aria-label={`${done} of ${goal} books this year, ${left} to go. ${thisMonth} in ${MONTH[month]}.`}>
      <span className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-paper-shade sm:block" aria-hidden>
        <span className="block h-full rounded-full bg-burgundy transition-[width]" style={{ width: `${pct}%` }} />
      </span>
      <span className="text-ink-soft group-hover:text-ink">
        <strong className="font-serif text-base font-normal text-ink">{done}</strong> of {goal}
        {left ? <span className="hidden md:inline"> · {left} to go</span> : null}
        <span className="hidden lg:inline"> · {thisMonth} in {MONTH[month]}</span>
      </span>
      <span className="hand hidden text-lg text-burgundy sm:inline">{note}</span>
    </Link>
  );
}
