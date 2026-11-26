"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

export type ShareableWord = {
  word: string;
  part_of_speech: string;
  definition: string;
  english?: string;
};

type Props = {
  word: ShareableWord | null;
  /** The word's card. It gets copied into the letter and folds into the envelope. */
  cardRef: RefObject<HTMLElement | null>;
};

/** A small white envelope beside the house. Seals today's word in a letter, then shares it. */
export default function ShareButton({ word, cardRef }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!word}
        aria-label="Share this word"
        className="group relative inline-flex shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40"
      >
        <svg
          viewBox="0 0 40 40"
          aria-hidden
          className="size-10 origin-bottom drop-shadow-[0_2px_3px_rgb(from_var(--ink)_r_g_b/0.18)] transition-all duration-200 ease-out group-enabled:group-hover:scale-125 group-enabled:group-hover:drop-shadow-[0_10px_14px_rgb(from_var(--ink)_r_g_b/0.32)] group-focus-visible:scale-125 group-active:scale-110"
        >
          {/* Envelope body */}
          <rect x="3.5" y="9" width="33" height="24" rx="3.5" fill="white" stroke="rgb(from var(--ink) r g b / 0.1)" strokeWidth="1" />
          {/* Fold lines */}
          <path d="M5 31 L16 21.5 M35 31 L24 21.5" stroke="rgb(from var(--ink) r g b / 0.1)" strokeWidth="1" strokeLinecap="round" fill="none" />
          {/* Flap: lifts a little on hover */}
          <path
            d="M5 10.5 L20 22 L35 10.5"
            fill="white"
            stroke="rgb(from var(--ink) r g b / 0.16)"
            strokeWidth="1.2"
            strokeLinejoin="round"
            className="origin-[20px_10px] transition-transform duration-300 ease-out group-enabled:group-hover:[transform:scaleY(-0.55)]"
          />
          {/* Wax seal */}
          <circle cx="20" cy="21.5" r="3.6" fill="var(--accent)" className="transition-transform duration-300 ease-out group-enabled:group-hover:-translate-y-[5.5px]" />
        </svg>
        <span
          aria-hidden
          className="pointer-events-none absolute top-full left-1/2 z-10 mt-2 -translate-x-1/2 -translate-y-1 whitespace-nowrap rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-ink opacity-0 shadow-[0_6px_16px_-6px_rgb(from_var(--ink)_r_g_b/0.35)] ring-1 ring-black/[0.06] transition-all duration-200 group-enabled:group-hover:translate-y-0 group-enabled:group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100"
        >
          Share this word
        </span>
      </button>
      {open &&
        word &&
        createPortal(<Letter word={word} cardRef={cardRef} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

const EASE = "cubic-bezier(.22,.8,.24,1)";

function Letter({ word, cardRef, onClose }: { word: ShareableWord; cardRef: RefObject<HTMLElement | null>; onClose: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const envRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const flapRef = useRef<HTMLDivElement>(null);
  const pocketRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const sealRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const closing = useRef(false);
  const [sealed, setSealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [canShare] = useState(() => typeof navigator !== "undefined" && "share" in navigator);

  const url = typeof window !== "undefined" ? window.location.origin : "";
  const message = `My word of the day: “${word.word}” (${word.part_of_speech})${
    word.english && word.english !== word.word ? ` — “${word.english}”` : ""
  }\n${word.definition}`;
  const full = `${message}\n\n${url}`;
  const subject = `A word for you: ${word.word}`;

  // The letter: copy the card, fly it into the envelope, close the flap, press the seal.
  useEffect(() => {
    const card = cardRef.current;
    const env = envRef.current;
    const paper = paperRef.current;
    if (!env || !paper || !backdropRef.current || !flapRef.current || !sealRef.current || !optionsRef.current) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const speed = reduce ? 0 : 1;
    const run: Animation[] = [];
    let cancelled = false;
    const play = (el: Element, frames: Keyframe[], opts: KeyframeAnimationOptions) => {
      const a = el.animate(frames, { fill: "both", easing: EASE, ...opts, duration: (Number(opts.duration) || 0) * speed, delay: (opts.delay ?? 0) * speed });
      run.push(a);
      return a.finished.catch(() => undefined);
    };

    const e = env.getBoundingClientRect();
    const r = card?.getBoundingClientRect() ?? new DOMRect(e.left, e.top - 300, e.width, 260);

    // The page itself becomes the letter.
    if (card) {
      const copy = card.cloneNode(true) as HTMLElement;
      copy.classList.remove("animate-rise", "mt-6");
      copy.inert = true;
      Object.assign(copy.style, { width: `${r.width}px`, height: `${r.height}px`, margin: "0", background: "white" });
      paper.replaceChildren(copy);
      card.style.visibility = "hidden";
    }
    Object.assign(paper.style, { width: `${r.width}px`, height: `${r.height}px` });

    const s = Math.min((e.width * 0.84) / r.width, (e.height * 0.8) / r.height);
    const fx = (e.width - r.width * s) / 2;
    const fy = e.height * 0.14;
    const ay = Math.max(-e.top + 16, -r.height * s - 28);
    const sx = r.left - e.left;
    const sy = r.top - e.top;
    const at = (x: number, y: number, k: number, rot = 0) => `translate(${x}px, ${y}px) rotate(${rot}deg) scale(${k})`;

    const flapOpen = "perspective(900px) rotateX(180deg)";
    const flapShut = "perspective(900px) rotateX(0deg)";

    (async () => {
      play(backdropRef.current!, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: "ease-out" });
      for (const [el, base] of [
        [backRef.current!, ""],
        [pocketRef.current!, ""],
        [flapRef.current!, flapOpen],
      ] as const) {
        play(el, [
          { opacity: 0, transform: `translateY(60px) scale(.94) ${base}` },
          { opacity: 1, transform: `translateY(0) scale(1) ${base}` },
        ], { duration: 650, delay: 120 });
      }
      play(sealRef.current!, [{ opacity: 0 }], { duration: 0 });
      play(optionsRef.current!, [{ opacity: 0, transform: "translateY(12px)" }], { duration: 0 });

      await play(paper, [
        { transform: at(sx, sy, 1), boxShadow: "0 1px 2px rgb(from var(--ink) r g b / .04), 0 12px 32px -16px rgb(from var(--ink) r g b / .18)" },
        { transform: at(sx, sy - 14, 1.015, -0.6), boxShadow: "0 30px 60px -20px rgb(from var(--ink) r g b / .45)", offset: 0.16 },
        { transform: at(fx, ay, s, -3), boxShadow: "0 18px 30px -14px rgb(from var(--ink) r g b / .4)", offset: 0.68 },
        { transform: at(fx, fy, s, 0), boxShadow: "0 2px 6px -2px rgb(from var(--ink) r g b / .25)" },
      ], { duration: 1500, delay: 250, easing: "cubic-bezier(.45,.05,.3,1)" });
      if (cancelled) return;

      // The letter is fully inside; bring the flap in front and fold it down.
      flapRef.current!.style.zIndex = "4";
      await play(flapRef.current!, [{ transform: flapOpen }, { transform: flapShut }], { duration: 520, easing: "cubic-bezier(.5,0,.3,1)" });
      if (cancelled) return;

      await play(sealRef.current!, [
        { opacity: 0, transform: "translate(-50%, -50%) scale(1.9) rotate(-25deg)" },
        { opacity: 1, transform: "translate(-50%, -50%) scale(.9) rotate(4deg)", offset: 0.65 },
        { opacity: 1, transform: "translate(-50%, -50%) scale(1) rotate(0deg)" },
      ], { duration: 420, easing: "cubic-bezier(.3,.7,.4,1)" });
      if (cancelled) return;

      setSealed(true);
      play(env, [
        { transform: "rotate(0deg)" },
        { transform: "rotate(-2.2deg) translateY(-4px)", offset: 0.35 },
        { transform: "rotate(1.2deg)", offset: 0.7 },
        { transform: "rotate(0deg)" },
      ], { duration: 700, easing: "ease-in-out" });
      play(optionsRef.current!, [
        { opacity: 0, transform: "translateY(12px)" },
        { opacity: 1, transform: "translateY(0)" },
      ], { duration: 450, delay: 150 });
    })();

    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelled = true;
      run.forEach((a) => a.cancel());
      document.body.style.overflow = overflow;
      if (card) card.style.visibility = "";
    };
  }, [cardRef]);

  const close = async (send = false) => {
    if (closing.current) return;
    closing.current = true;
    const speed = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1;
    if (send && envRef.current) {
      // Off it goes.
      envRef.current.animate(
        [
          { transform: "translate(0, 0) rotate(0deg) scale(1)", opacity: 1 },
          { transform: "translate(0, 14px) rotate(2deg) scale(1.02)", opacity: 1, offset: 0.2 },
          { transform: "translate(40vw, -110vh) rotate(-18deg) scale(.6)", opacity: 0.9 },
        ],
        { duration: 900 * speed, easing: "cubic-bezier(.5,0,.75,.4)", fill: "forwards" },
      );
      optionsRef.current?.animate([{ opacity: 0 }], { duration: 250 * speed, fill: "forwards" });
      await new Promise((r) => setTimeout(r, 650 * speed));
    }
    await rootRef.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 280 * speed, fill: "forwards" }).finished;
    onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(full);
      setCopied(true);
      setTimeout(() => close(true), 700);
    } catch {
      setCopied(false);
    }
  };

  const more = async () => {
    try {
      await navigator.share({ title: subject, text: message, url });
      close(true);
    } catch {
      // Cancelled: leave the letter open so another option can be picked.
    }
  };

  return (
    <div ref={rootRef} role="dialog" aria-modal="true" aria-label={`Share “${word.word}”`} className="fixed inset-0 z-50">
      <div
        ref={backdropRef}
        onClick={() => close()}
        className="absolute inset-0 bg-stone-950/30 backdrop-blur-[6px]"
      />
      <div className="pointer-events-none relative flex h-full flex-col items-center justify-center gap-8 px-6 pt-[18vh]">
        {/* Envelope. Its parts stack around the letter: back, open flap, letter, pocket, closed flap, seal. */}
        <div ref={envRef} className="relative aspect-[1.55] w-[min(380px,calc(100vw-48px))] origin-bottom">
          <div ref={backRef} className="absolute inset-0 z-0 rounded-[14px] bg-amber-200 shadow-[0_30px_60px_-24px_rgb(from_var(--ink)_r_g_b/0.55)]" />
          <div ref={flapRef} className="absolute inset-x-0 top-0 z-[1] h-[60%] origin-top">
            <svg viewBox="0 0 160 60" preserveAspectRatio="none" className="size-full overflow-visible drop-shadow-[0_3px_3px_rgb(from_var(--ink)_r_g_b/0.18)]">
              <path d="M3 0 H157 Q160 0 157.5 2 L84 56.5 Q80 59.5 76 56.5 L2.5 2 Q0 0 3 0 Z" className="fill-amber-100 stroke-amber-300/60" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
              <path d="M14 3 L80 51 L146 3" fill="none" className="stroke-white/60" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            </svg>
          </div>
          <div ref={paperRef} className="absolute top-0 left-0 z-[2] origin-top-left overflow-hidden rounded-2xl bg-white" />
          <div ref={pocketRef} className="absolute inset-0 z-[3] overflow-hidden rounded-[14px]">
            <svg viewBox="0 0 160 100" preserveAspectRatio="none" className="size-full">
              <path d="M0 0 L80 58 L0 100 Z" className="fill-amber-100" />
              <path d="M160 0 L80 58 L160 100 Z" className="fill-amber-100" />
              <path d="M0 100 L80 54 L160 100 Z" className="fill-amber-50" />
              <path d="M0 0 L80 58 L160 0 M0 100 L80 54 L160 100" fill="none" className="stroke-amber-300/50" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
            </svg>
            <p className="absolute inset-x-0 bottom-[11%] text-center font-serif text-[clamp(0.8rem,3.6vw,1rem)] italic text-amber-900/75">
              A word for you
            </p>
          </div>
          {/* Wax seal at the flap's tip */}
          <div
            ref={sealRef}
            className="absolute top-[57%] left-1/2 z-[5] grid size-[clamp(44px,14vw,58px)] place-items-center rounded-full bg-accent shadow-[0_4px_10px_-2px_rgb(from_var(--ink)_r_g_b/0.45),inset_0_-3px_6px_rgb(0_0_0/0.25),inset_0_3px_5px_rgb(255_255_255/0.3)]"
            style={{ transform: "translate(-50%, -50%)" }}
          >
            <span className="absolute inset-[5px] rounded-full ring-1 ring-white/35" />
            <span className="font-serif text-xl font-semibold text-white/90 drop-shadow-[0_1px_0_rgb(0_0_0/0.25)]">
              {[...word.word][0]?.toUpperCase()}
            </span>
          </div>
        </div>

        <div ref={optionsRef} className={`w-full max-w-md text-center ${sealed ? "pointer-events-auto" : ""}`}>
          <p className="font-serif text-2xl italic text-white drop-shadow-[0_1px_8px_rgb(from_var(--ink)_r_g_b/0.5)]">Sealed. Where should it go?</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2.5">
            <ShareLink href={`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(full)}`} onClick={() => close(true)} icon={<MailIcon />}>
              Email
            </ShareLink>
            <ShareLink href={`sms:?&body=${encodeURIComponent(full)}`} onClick={() => close(true)} icon={<ChatIcon />}>
              Text
            </ShareLink>
            <ShareLink href={`https://wa.me/?text=${encodeURIComponent(full)}`} external onClick={() => close(true)} icon={<WhatsAppIcon />}>
              WhatsApp
            </ShareLink>
            <ShareAction onClick={copy} icon={copied ? <CheckIcon /> : <LinkIcon />}>
              {copied ? "Copied!" : "Copy"}
            </ShareAction>
            {canShare && (
              <ShareAction onClick={more} icon={<MoreIcon />}>
                More apps
              </ShareAction>
            )}
          </div>
          <button type="button" onClick={() => close()} className="mt-5 text-sm font-medium text-white/85 underline decoration-white/40 underline-offset-4 hover:text-white">
            Keep it for later
          </button>
        </div>
      </div>
    </div>
  );
}

const pill =
  "inline-flex items-center gap-2 rounded-full bg-white py-2 ps-2 pe-4 text-sm font-semibold text-ink shadow-[0_8px_20px_-10px_rgb(from_var(--ink)_r_g_b/0.5)] ring-1 ring-black/[0.06] transition hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-10px_rgb(from_var(--ink)_r_g_b/0.55)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

function Badge({ children }: { children: ReactNode }) {
  return <span className="grid size-7 place-items-center rounded-full bg-accent-soft text-accent">{children}</span>;
}

function ShareLink({ href, external, onClick, icon, children }: { href: string; external?: boolean; onClick: () => void; icon: ReactNode; children: ReactNode }) {
  return (
    <a href={href} onClick={onClick} className={pill} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      <Badge>{icon}</Badge>
      {children}
    </a>
  );
}

function ShareAction({ onClick, icon, children }: { onClick: () => void; icon: ReactNode; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={pill}>
      <Badge>{icon}</Badge>
      {children}
    </button>
  );
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}
const MailIcon = () => <Icon><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 6.5 8.5 6.5 8.5-6.5" /></Icon>;
const ChatIcon = () => <Icon><path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4v-4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" /></Icon>;
const WhatsAppIcon = () => <Icon><path d="M3.5 20.5 5 16a8.5 8.5 0 1 1 3 3Z" /><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .8a4 4 0 0 1-1.8-1.8l.8-1-1-2Z" /></Icon>;
const LinkIcon = () => <Icon><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></Icon>;
const CheckIcon = () => <Icon><path d="m5 12.5 4.5 4.5L19 7" /></Icon>;
const MoreIcon = () => <Icon><path d="M12 15V3M7.5 7.5 12 3l4.5 4.5" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></Icon>;
