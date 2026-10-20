import type { Metadata } from "next";
import { AccountsManager } from "../../components/accounts/AccountsManager";
import { SignedInGate } from "../../components/auth/SignedInGate";

export const metadata: Metadata = { title: "Accounts" };

export default function AccountsPage() {
  return (
    <section className="section shell app-page accounts-page">
      <SignedInGate variant="accounts">
        <div className="app-page-heading">
          <p className="eyebrow">Your money</p>
          <h1>Accounts</h1>
          <p>Add each place you keep money and each amount you owe.</p>
        </div>
        <AccountsManager />
      </SignedInGate>
    </section>
  );
}
