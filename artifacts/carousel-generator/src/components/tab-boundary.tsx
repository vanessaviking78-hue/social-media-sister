import { Component, type ReactNode } from "react";

// Stops one tab falling over from blanking the whole page. If the app was updated while the page was open, the old tab files are gone, so it reloads once to pick up the new ones.
export class TabBoundary extends Component<{ children: ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  componentDidCatch(err: Error) {
    if (/dynamically imported module|Importing a module script failed|Loading chunk/i.test(err.message)) {
      try {
        if (!sessionStorage.getItem("tab-reloaded")) { sessionStorage.setItem("tab-reloaded", "1"); window.location.reload(); }
      } catch { /* ignore */ }
    }
  }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="m-6 rounded-xl border border-red-400/50 bg-red-500/10 p-5 text-sm space-y-2">
        <div className="font-semibold">This tab hit a snag.</div>
        <div className="text-white/70 break-words">{this.state.err.message}</div>
        <button className="underline" onClick={() => { try { sessionStorage.removeItem("tab-reloaded"); } catch { /* ignore */ } window.location.reload(); }}>Reload the page</button>
      </div>
    );
  }
}
