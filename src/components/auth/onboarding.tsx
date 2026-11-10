"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { checkUsernameAction, finishOnboardingAction, saveOnboardingProfileAction } from "@/app/actions/profile";
import { Avatar } from "@/components/profile/avatar";
import { Button } from "@/components/ui/button";
import { chipClass } from "@/components/ui/chip";
import { useToast } from "@/components/ui/toast";
import type { Profile } from "@/lib/types";
import { USERNAME_RE, cn } from "@/lib/utils";
import { OnboardingBooks } from "./onboarding-books";

const STEPS = ["you", "taste", "read", "next", "people"] as const;

export function Onboarding({ viewer, genres, authorIdeas }: { viewer: Profile; genres: string[]; authorIdeas: string[] }) {
  // Coming back halfway? Pick up after the parts already saved (name and taste are saved at step two).
  const [step, setStep] = useState(viewer.username && viewer.favouriteGenres.length ? 2 : 0);
  const [displayName, setDisplayName] = useState(viewer.displayName);
  const [username, setUsername] = useState(viewer.username ?? "");
  const [bio, setBio] = useState(viewer.bio);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [picked, setPicked] = useState<string[]>(viewer.favouriteGenres);
  const [authors, setAuthors] = useState<string[]>(viewer.favouriteAuthors);
  const [authorDraft, setAuthorDraft] = useState("");
  const [goal, setGoal] = useState<string>(viewer.readingGoal ? String(viewer.readingGoal) : "24");
  const [suggested, setSuggested] = useState<Profile[]>([]);
  const [follow, setFollow] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  const validUsername = USERNAME_RE.test(username);

  useEffect(() => {
    if (!validUsername) return;
    const t = setTimeout(async () => {
      const res = await checkUsernameAction(username);
      setAvailable(res.ok ? res.data.available : null);
      setChecking(false);
    }, 350);
    return () => clearTimeout(t);
  }, [username, validUsername]);

  const toggle = (list: string[], set: (v: string[]) => void, value: string) =>
    set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);

  const addAuthor = () => {
    const a = authorDraft.trim();
    if (a && !authors.includes(a) && authors.length < 12) setAuthors([...authors, a]);
    setAuthorDraft("");
  };

  const saveTaste = () =>
    start(async () => {
      const res = await saveOnboardingProfileAction({
        username, displayName, bio, genres: picked, authors, readingGoal: goal ? Math.max(1, Math.min(1000, Number(goal))) : null,
      });
      if (!res.ok) return toast(res.error, "error");
      setSuggested(res.data);
      setFollow(new Set(res.data.slice(0, 3).map((p) => p.id)));
      setStep(2);
    });

  // Readers to suggest when someone resumes past the taste step (suggestions come with saving taste).
  useEffect(() => {
    if (step !== 4 || suggested.length) return;
    let live = true;
    saveOnboardingProfileAction({ username, displayName, bio, genres: picked, authors, readingGoal: goal ? Math.max(1, Math.min(1000, Number(goal))) : null }).then((res) => {
      if (!live || !res.ok) return;
      setSuggested(res.data);
      setFollow(new Set(res.data.slice(0, 3).map((p) => p.id)));
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when arriving at the people step
  }, [step]);

  const finish = () =>
    start(async () => {
      const res = await finishOnboardingAction([...follow]);
      if (!res.ok) return toast(res.error, "error");
      router.push("/home");
    });

  return (
    <div className="w-full max-w-2xl">
      <ol className="mb-6 flex items-center gap-3" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-3">
            <span className={cn("flex size-7 items-center justify-center rounded-full border font-mono text-xs", i <= step ? "border-burgundy bg-burgundy text-paper" : "border-line-strong text-ink-faint")} aria-current={i === step ? "step" : undefined}>
              {i < step ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span className={cn("meta", i === step && "text-ink")}>{s}</span>
            {i < STEPS.length - 1 && <span className="h-px w-8 bg-line-strong sm:w-14" aria-hidden />}
          </li>
        ))}
      </ol>

      <div className="paper dogear relative px-5 py-8 sm:px-10">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.22 }}>
            {step === 0 && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (validUsername && available && displayName.trim()) setStep(1);
                }}
                className="space-y-5"
              >
                <div>
                  <p className="meta text-burgundy">step one</p>
                  <h1 className="mt-1 text-4xl">Who&rsquo;s holding the pencil?</h1>
                  <p className="mt-1 text-sm text-ink-soft">This is how other readers will find you.</p>
                </div>
                <div className="flex items-center gap-4">
                  <Avatar profile={{ displayName: displayName || "?", username, avatarUrl: viewer.avatarUrl }} size="lg" />
                  <p className="hand text-2xl text-ink-soft">{displayName ? `hello, ${displayName.split(" ")[0]}!` : "hello, stranger"}</p>
                </div>
                <label className="block">
                  <span className="meta mb-1.5 block">Your name</span>
                  <input className="field" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={60} required autoFocus placeholder="Margo Ellison" />
                </label>
                <label className="block">
                  <span className="meta mb-1.5 block">Username</span>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint">@</span>
                    <input
                      className="field pl-7"
                      value={username}
                      onChange={(e) => { setUsername(e.target.value.toLowerCase().replace(/\s/g, "")); setAvailable(null); setChecking(true); }}
                      maxLength={24}
                      required
                      aria-describedby="username-help"
                      aria-invalid={username.length > 0 && (!validUsername || available === false)}
                      placeholder="margo"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2">{checking && <Loader2 className="size-4 animate-spin text-ink-faint" />}</span>
                  </div>
                  <span id="username-help" className={cn("mt-1 block text-xs", available === false || (username && !validUsername) ? "text-burgundy" : "text-ink-faint")} aria-live="polite">
                    {username && !validUsername
                      ? "3–24 characters: lowercase letters, numbers, dots and underscores."
                      : available === false
                        ? "Someone already has that one."
                        : available
                          ? "That's yours if you want it ✓"
                          : "dogear.app/u/your-name"}
                  </span>
                </label>
                <label className="block">
                  <span className="meta mb-1.5 block">A line about you <span className="normal-case tracking-normal text-ink-faint">(optional)</span></span>
                  <textarea className="field resize-none" rows={2} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={280} placeholder="Annotating in pencil since 2009…" />
                </label>
                <div className="flex justify-end">
                  <Button type="submit" size="lg" disabled={!validUsername || !available || !displayName.trim()}>Next: your taste →</Button>
                </div>
              </form>
            )}

            {step === 1 && (
              <div className="space-y-7">
                <div>
                  <p className="meta text-burgundy">step two</p>
                  <h1 className="mt-1 text-4xl">What do you love to read?</h1>
                  <p className="mt-1 text-sm text-ink-soft">Pick as many as feel right. We&rsquo;ll use them to find your people.</p>
                </div>
                <fieldset>
                  <legend className="meta mb-3">Genres</legend>
                  <div className="flex flex-wrap gap-2">
                    {genres.map((g, i) => (
                      <button key={g} type="button" aria-pressed={picked.includes(g)} onClick={() => toggle(picked, setPicked, g)} className={chipClass((["sage", "rose", "butter", "paper"] as const)[i % 4], picked.includes(g), "py-1.5")}>
                        {picked.includes(g) && <Check className="size-3.5" />}{g}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <fieldset>
                  <legend className="meta mb-3">Favourite authors</legend>
                  <div className="flex flex-wrap gap-2">
                    {[...new Set([...authors, ...authorIdeas])].map((a) => (
                      <button key={a} type="button" aria-pressed={authors.includes(a)} onClick={() => toggle(authors, setAuthors, a)} className={chipClass("paper", authors.includes(a))}>
                        {authors.includes(a) && <Check className="size-3.5" />}{a}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <label className="sr-only" htmlFor="author-draft">Add another author</label>
                    <input id="author-draft" className="field" value={authorDraft} onChange={(e) => setAuthorDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addAuthor())} placeholder="Someone else…" maxLength={80} />
                    <Button variant="paper" onClick={addAuthor} disabled={!authorDraft.trim()}>Add</Button>
                  </div>
                </fieldset>
                <label className="flex flex-wrap items-center gap-3">
                  <span className="meta">Reading goal this year</span>
                  <input className="field w-24" inputMode="numeric" value={goal} onChange={(e) => setGoal(e.target.value.replace(/\D/g, "").slice(0, 4))} />
                  <span className="hand text-xl text-ink-soft">books (no pressure)</span>
                </label>
                <div className="flex justify-between gap-3">
                  <Button variant="ghost" onClick={() => setStep(0)}>← Back</Button>
                  <Button size="lg" onClick={saveTaste} disabled={pending || picked.length === 0}>{pending ? "Saving…" : "Next: your shelves →"}</Button>
                </div>
              </div>
            )}

            {step === 2 && (
              <OnboardingBooks
                status="read"
                step="step three"
                title="Three books you've already read"
                blurb="They go straight onto your Read shelf, and help us find readers like you. Tap again to take one back."
                target={3}
                starter={authors[0] ?? picked[0] ?? ""}
                onBack={() => setStep(1)}
                onNext={() => setStep(3)}
              />
            )}

            {step === 3 && (
              <OnboardingBooks
                status="want_to_read"
                step="step four"
                title="What's next on your pile?"
                blurb="A few books you'd like to read. They wait on your Want to read shelf."
                target={3}
                starter={picked[0] ?? authors[1] ?? ""}
                onBack={() => setStep(2)}
                onNext={() => setStep(4)}
              />
            )}

            {step === 4 && (
              <div className="space-y-6">
                <div>
                  <p className="meta text-burgundy">step five</p>
                  <h1 className="mt-1 text-4xl">Readers you might get along with</h1>
                  <p className="mt-1 text-sm text-ink-soft">Your home feed is made of the people you follow. You can always change this later.</p>
                </div>
                {suggested.length === 0 ? (
                  <p className="hand text-2xl text-ink-soft">You&rsquo;re early — the first reader here. Others will find you.</p>
                ) : (
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {suggested.map((p) => {
                      const on = follow.has(p.id);
                      const shared = p.favouriteGenres.filter((g) => picked.includes(g));
                      return (
                        <li key={p.id}>
                          <button
                            type="button"
                            aria-pressed={on}
                            onClick={() => setFollow((s) => { const n = new Set(s); if (on) n.delete(p.id); else n.add(p.id); return n; })}
                            className={cn("flex w-full items-start gap-3 border p-3 text-left transition-colors", on ? "border-burgundy bg-rose/20" : "border-line-strong hover:border-ink")}
                          >
                            <Avatar profile={p} size="md" />
                            <span className="min-w-0 flex-1">
                              <span className="block font-medium">{p.displayName}</span>
                              <span className="meta block normal-case tracking-normal">@{p.username}</span>
                              <span className="mt-1 line-clamp-2 block text-xs text-ink-soft">{p.bio}</span>
                              {shared.length > 0 && <span className="hand mt-1 block text-lg text-burgundy">you both love {shared.slice(0, 2).join(" & ")}</span>}
                            </span>
                            <span className={cn("mt-1 flex size-5 shrink-0 items-center justify-center rounded-full border", on ? "border-burgundy bg-burgundy text-paper" : "border-line-strong")}>{on && <Check className="size-3" />}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <div className="flex justify-between gap-3">
                  <Button variant="ghost" onClick={() => setStep(3)}>← Back</Button>
                  <Button size="lg" variant="burgundy" onClick={finish} disabled={pending}>{pending ? "Opening the doors…" : follow.size ? `Follow ${follow.size} & start reading` : "Start reading"}</Button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
