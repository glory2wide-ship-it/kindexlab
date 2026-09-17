/**
 * Smoke test: DebouncedGeminiBatchChat keepalive + drain must keep the
 * process alive while a sibling promise has no ref'd handles (the failure
 * mode behind Daily briefings run 35137943576).
 *
 * Run: npx tsx scripts/_check-gemini-batch-keepalive.ts
 */
import assert from "node:assert/strict";
import { DebouncedGeminiBatchChat } from "../src/lib/gemini/batch-chat";

async function main() {
  const transport = new DebouncedGeminiBatchChat(50, 100);
  let resolved = false;

  // Hang a promise with no underlying handle — classic empty-event-loop bait.
  const hung = new Promise<void>(() => {
    /* never settles */
  });

  const race = Promise.race([
    hung.then(() => "hung"),
    new Promise<string>((resolve) => {
      setTimeout(() => resolve("keepalive-ok"), 200);
    }),
  ]);

  // Transport keepalive must still be holding the process open.
  const winner = await race;
  assert.equal(winner, "keepalive-ok");

  // Close should reject leftover chatJson waiters.
  const pending = transport.chatJson({
    system: "x",
    user: "y",
    step: "smoke",
    model: "gemini-3.6-flash",
    logger: {
      step: () => undefined,
      warn: () => undefined,
    } as never,
  });
  setTimeout(() => transport.close("smoke-close"), 10);
  await assert.rejects(pending, /smoke-close|closed/);
  resolved = true;

  assert.equal(resolved, true);
  console.log("gemini-batch keepalive smoke OK");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
