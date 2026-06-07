import { Component, type ReactNode } from "react";
import { Building2, RefreshCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-sky-900 p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/20 mx-auto">
            <AlertTriangle className="h-8 w-8 text-red-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Something went wrong</h1>
            <p className="text-slate-400 text-sm mt-2 font-mono bg-slate-800/80 rounded-lg p-3 text-left mt-4 break-all">
              {error.message}
            </p>
          </div>
          <div className="space-y-3 text-left bg-slate-800/60 rounded-xl p-4 text-sm text-slate-300">
            <p className="font-semibold text-white flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Nestlink setup checklist
            </p>
            <ul className="space-y-2 text-slate-400 list-none">
              <li>✓ Install Docker Desktop from docker.com</li>
              <li>✓ Run <code className="bg-slate-700 px-1 rounded">make start</code> to start Supabase</li>
              <li>✓ Run <code className="bg-slate-700 px-1 rounded">make db-reset</code> to apply migrations</li>
              <li>✓ Copy the anon key from <code className="bg-slate-700 px-1 rounded">supabase status</code> into <code className="bg-slate-700 px-1 rounded">apps/web/.env.local</code></li>
              <li>✓ Restart the dev server</li>
            </ul>
          </div>
          <Button
            className="w-full"
            onClick={() => {
              this.setState({ error: null });
              window.location.reload();
            }}
          >
            <RefreshCw className="h-4 w-4" />
            Reload page
          </Button>
        </div>
      </div>
    );
  }
}
