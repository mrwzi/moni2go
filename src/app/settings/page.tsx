import Link from "next/link";
import { CloudWorkspaceControls } from "../../components/auth/CloudWorkspaceControls";
import { LocalWorkspaceTransfer } from "../../components/settings/LocalWorkspaceTransfer";
import { hasSupabaseConfig } from "../../lib/supabase/config";

export default function SettingsPage() {
  return (
    <section className="section shell app-page settings-page">
      <div className="app-page-heading">
        <p className="eyebrow">Your account</p>
        <h1>Settings</h1>
        <p>Account, privacy, and data controls.</p>
      </div>
      <section
        className="app-card cloud-settings"
        aria-labelledby="cloud-heading"
      >
        <p className="eyebrow">Backup</p>
        <h2 id="cloud-heading">Cloud workspace</h2>
        {hasSupabaseConfig() ? (
          <CloudWorkspaceControls />
        ) : (
          <>
            <p>Cloud accounts are not configured for this deployment yet.</p>
            <Link className="button button-secondary" href="/auth">
              View account setup
            </Link>
          </>
        )}
      </section>
      <details className="app-card settings-details">
        <summary>Move or import local data</summary>
        <div className="settings-details-content">
          <p className="eyebrow">Manual transfer</p>
          <h2>Local backup file</h2>
          <LocalWorkspaceTransfer />
        </div>
      </details>
      <details className="app-card settings-details">
        <summary>Privacy and technical details</summary>
        <nav className="settings-list" aria-label="Settings information">
          <Link href="/privacy">
            <span>
              <strong>Privacy</strong>
              <small>How your financial information is handled</small>
            </span>
            <span aria-hidden="true">›</span>
          </Link>
          <Link href="/methodology">
            <span>
              <strong>How calculations work</strong>
              <small>Definitions, formulas, and sources</small>
            </span>
            <span aria-hidden="true">›</span>
          </Link>
          <Link href="/build">
            <span>
              <strong>Local scenario data</strong>
              <small>Review or delete values saved on this device</small>
            </span>
            <span aria-hidden="true">›</span>
          </Link>
        </nav>
      </details>
    </section>
  );
}
