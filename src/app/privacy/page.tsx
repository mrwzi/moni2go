import type { Metadata } from "next";

import { LocalDataControls } from "../../components/baseline/LocalDataControls";
import { PrivacyNotice } from "../../components/shared/PrivacyNotice";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <section className="section shell prose-shell">
      <div className="section-heading page-heading">
        <p className="eyebrow">Privacy</p>
        <h1>You control where your information is stored</h1>
        <p>
          moni2go works without an account. Cloud backup is optional and only
          occurs when a signed-in user explicitly requests it.
        </p>
      </div>
      <PrivacyNotice />
      <div className="prose-card">
        <h2>What is stored</h2>
        <p>
          Monthly baseline values are saved in local storage. Accounts and the
          financial workspace are saved in this browser&apos;s IndexedDB.
          Clearing browser data removes these local copies.
        </p>
        <p>
          If you create an account, Supabase processes your email and session.
          Financial workspace data is transmitted to Supabase only when you
          choose a cloud save or restore action in Settings. Database policies
          restrict workspace rows to their authenticated owner.
        </p>
        <h2>What is not stored</h2>
        <p>
          Demo selections are synthetic and are not saved into a personal cloud
          workspace. moni2go never requests bank passwords, account numbers,
          transit numbers, card numbers, CVVs, or banking access tokens.
        </p>
        <h2>Deleting information</h2>
        <p>
          Local deletion and cloud deletion are separate. Browser controls
          remove on-device values. Signed-in users can delete their cloud
          financial workspaces from Settings.
        </p>
      </div>
      <LocalDataControls />
    </section>
  );
}
