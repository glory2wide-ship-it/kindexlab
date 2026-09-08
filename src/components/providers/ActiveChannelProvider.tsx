"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { isPostChannel } from "@/lib/posts/channels";
import type { PostChannel } from "@/lib/posts/types";

type ActiveChannelContextValue = {
  channel: PostChannel | undefined;
  setChannel: (channel: PostChannel | undefined) => void;
};

const ActiveChannelContext = createContext<ActiveChannelContextValue>({
  channel: undefined,
  setChannel: () => undefined,
});

export function ActiveChannelProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const [channel, setChannelState] = useState<PostChannel | undefined>();

  const setChannel = useCallback((next: PostChannel | undefined) => {
    setChannelState(next);
  }, []);

  // Drop detail overrides when the route already encodes a desk (or home).
  useEffect(() => {
    const segment = pathname.split("/").filter(Boolean)[0];
    if (!segment || isPostChannel(segment)) {
      setChannelState(undefined);
    }
  }, [pathname]);

  const value = useMemo(() => ({ channel, setChannel }), [channel, setChannel]);

  return (
    <ActiveChannelContext.Provider value={value}>{children}</ActiveChannelContext.Provider>
  );
}

export function useActiveChannelOverride(): PostChannel | undefined {
  return useContext(ActiveChannelContext).channel;
}

/** Pin the sticky category chip while this tree is mounted (entity detail pages). */
export function SetActiveChannel({ channel }: { channel: PostChannel }) {
  const { setChannel } = useContext(ActiveChannelContext);

  useEffect(() => {
    setChannel(channel);
    return () => setChannel(undefined);
  }, [channel, setChannel]);

  return null;
}
