import React from 'react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message || 'An unexpected error occurred.',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0B0F17] p-6">
          <div className="max-w-lg w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131A26] p-6 space-y-4">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Something interrupted your session
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 break-words">
              {this.state.message}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, message: '' })}
              className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium transition-colors"
            >
              Restore Workspace
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
