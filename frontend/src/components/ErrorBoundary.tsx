import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 m-auto max-w-lg spatial-glass rounded-3xl border border-white/80 shadow-2xl text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Display Notice</h2>
          <p className="text-sm text-slate-600 mb-4">
            {this.props.fallbackMessage || 'An unexpected rendering issue occurred with this view.'}
          </p>
          {this.state.error && (
            <div className="w-full bg-slate-900/5 rounded-xl p-3 text-xs font-mono text-slate-700 text-left mb-6 overflow-x-auto max-h-32">
              {this.state.error.message}
            </div>
          )}
          <button
            onClick={this.handleReset}
            className="spatial-btn-primary px-6 py-3 rounded-xl text-white font-bold text-sm flex items-center gap-2 shadow-lg"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Return to Fitting Room</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
