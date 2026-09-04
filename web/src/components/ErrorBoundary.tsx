import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// Without this, any uncaught error while rendering (a bad API response shape, a null
// dereference, whatever) unmounts the entire React tree and leaves a blank white screen with
// no feedback. This catches that and shows something actionable instead.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Uncaught render error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-full flex items-center justify-center bg-court-light px-4">
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-sm p-6 text-center">
            <h1 className="text-lg font-bold text-slate-900 mb-1">Something went wrong</h1>
            <p className="text-sm text-slate-500 mb-4">
              This screen hit an unexpected error. Reloading usually fixes it.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="tap-target bg-court text-white rounded-lg px-4 py-2 font-semibold"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
