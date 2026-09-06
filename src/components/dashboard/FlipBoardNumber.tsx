"use client";

import { useEffect, useRef, useState } from "react";
import { formatScore } from "@/lib/format";

function isFlappable(char: string): boolean {
  return /[0-9]/.test(char);
}

function FlipGlyph({
  from,
  to,
  play,
  delayMs,
  force = false,
}: {
  from: string;
  to: string;
  play: boolean;
  delayMs: number;
  force?: boolean;
}) {
  const [cycle, setCycle] = useState(0);
  const shouldFlip = play && isFlappable(to) && (force || from !== to);

  useEffect(() => {
    if (shouldFlip) setCycle((value) => value + 1);
  }, [shouldFlip, from, to, force]);

  if (!isFlappable(to)) {
    return (
      <span className="flip-punct" aria-hidden="true">
        {to === " " ? "\u00a0" : to}
      </span>
    );
  }

  return (
    <span
      className="flip-glyph"
      style={{ ["--flip-delay" as string]: `${delayMs}ms` }}
      aria-hidden="true"
    >
      <span className="flip-half flip-half-top">
        <span className="flip-glyph-face">{to}</span>
      </span>
      <span className="flip-half flip-half-bottom">
        <span className="flip-glyph-face">{shouldFlip ? from : to}</span>
      </span>
      {shouldFlip ? (
        <>
          <span key={`top-${cycle}`} className="flip-leaf flip-leaf-top">
            <span className="flip-glyph-face">{from}</span>
          </span>
          <span key={`bot-${cycle}`} className="flip-leaf flip-leaf-bottom">
            <span className="flip-glyph-face">{to}</span>
          </span>
        </>
      ) : null}
    </span>
  );
}

export function FlipBoardText({
  text,
  playToken = 0,
}: {
  text: string;
  playToken?: number;
}) {
  const previous = useRef(text);
  const lastToken = useRef(playToken);
  const [from, setFrom] = useState(text);
  const [display, setDisplay] = useState(text);
  const [playing, setPlaying] = useState(false);
  const [force, setForce] = useState(false);

  useEffect(() => {
    const textChanged = text !== previous.current;
    const tokenBumped = playToken !== lastToken.current && playToken > 0;
    if (!textChanged && !tokenBumped) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setFrom(previous.current);
    setDisplay(text);
    previous.current = text;
    lastToken.current = playToken;
    setForce(!textChanged && tokenBumped);
    if (reduced) {
      setPlaying(false);
      return;
    }
    setPlaying(true);
    const timeout = window.setTimeout(() => {
      setPlaying(false);
      setForce(false);
    }, 900);
    return () => window.clearTimeout(timeout);
  }, [playToken, text]);

  const width = Math.max(from.length, display.length);
  const fromPadded = from.padStart(width, " ");
  const toPadded = display.padStart(width, " ");
  let flipIndex = 0;

  return (
    <>
      <span className="sr-only">{display}</span>
      <span
        className="flip-board"
        aria-hidden="true"
      >
        {Array.from(toPadded, (char, index) => {
          const source = fromPadded[index] ?? " ";
          const delay =
            isFlappable(char) && (force || source !== char) ? flipIndex++ * 45 : 0;
          return (
            <FlipGlyph
              key={`${index}-${width}`}
              from={source}
              to={char}
              play={playing}
              force={force}
              delayMs={delay}
            />
          );
        })}
      </span>
    </>
  );
}

export function FlipBoardNumber({
  value,
  playToken = 0,
}: {
  value: number;
  playToken?: number;
}) {
  return <FlipBoardText text={formatScore(value)} playToken={playToken} />;
}
