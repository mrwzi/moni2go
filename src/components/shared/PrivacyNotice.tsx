export function PrivacyNotice() {
  return (
    <aside className="trust-card" aria-labelledby="privacy-notice-heading">
      <span className="trust-icon" aria-hidden="true">
        ✓
      </span>
      <div>
        <h2 id="privacy-notice-heading">Private by default</h2>
        <p>
          No account or bank connection is required. Information remains in your
          browser when you use moni2go without signing in. Cloud backup is
          optional because signing in is optional; when you are signed in, your
          workspace synchronizes automatically.
        </p>
      </div>
    </aside>
  );
}
