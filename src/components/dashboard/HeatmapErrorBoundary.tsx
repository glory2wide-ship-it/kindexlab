"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Keeps the 음식/맛집 (and other) heatmap shell on screen if a tile combo
 * throws during treemap layout. Parent remounts via `resetKey` when filters change.
 */
export class HeatmapErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode; resetKey?: string },
  { error: Error | null; key: string }
> {
  state = { error: null as Error | null, key: this.props.resetKey ?? "" };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  static getDerivedStateFromProps(
    props: { resetKey?: string },
    state: { error: Error | null; key: string },
  ) {
    const nextKey = props.resetKey ?? "";
    if (nextKey !== state.key) return { error: null, key: nextKey };
    return null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("heatmap render failed", error, info.componentStack);
  }

  render() {
    if (this.state.error) return this.props.fallback;
    return this.props.children;
  }
}
