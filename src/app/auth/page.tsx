import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "../../components/auth/AuthForm";
import { hasSupabaseConfig } from "../../lib/supabase/config";

export const metadata: Metadata = { title: "Sign in" };

export default function AuthPage() {
  return (
    <section className="section shell auth-page">
      <div className="app-page-heading auth-heading">
        <p className="eyebrow">moni2go account</p>
        <h1>Keep your money picture available.</h1>
        <p>
          Sign in to save an encrypted-in-transit copy to your private cloud
          workspace.
        </p>
      </div>
      {hasSupabaseConfig() ? (
        <AuthForm />
      ) : (
        <div className="auth-panel setup-panel">
          <h2>Cloud accounts are not configured yet</h2>
          <p>
            Add the Supabase project URL and publishable key to the deployment
            environment. Local mode and demos still work normally.
          </p>
          <Link className="button button-primary button-full" href="/explore">
            Try a demo
          </Link>
        </div>
      )}
    </section>
  );
}
