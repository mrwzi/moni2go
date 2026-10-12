# ADR-006: Versioned plain-JSON local export

## Status

Accepted

## Context

Browser-local data can be lost when storage is cleared or a device changes. Users need a portable backup. Encryption adds password recovery, cryptographic format, and implementation risks that are not required for the initial release.

## Decision

Initial V2 export is a locally generated UTF-8 JSON document:

```ts
type Moni2GoExport = Readonly<{
  format: "moni2go-local-export";
  formatVersion: 1;
  dataSchemaVersion: number;
  exportedAt: string;
  applicationVersion: string;
  workspace: unknown; // validated workspace bundle in the concrete schema
  integrity: { algorithm: "SHA-256"; digest: string };
}>;
```

Following the product rename, new files use `moni2go-local-export`. The import
boundary continues to accept the former `monevero-local-export` and
`finscope-local-export` identifiers so existing user-created backups remain
restorable. Parsed legacy envelopes are normalized to the current identifier;
no financial values are rewritten.

Before download, the UI must state: “This file contains personal financial information.” It should also explain that the file is not encrypted by moni2go and should be stored securely. The file contains no application secret, token, credential, cache entry, analytics identifier, or browser metadata unrelated to restoration.

## Consequences

- Export/import can be deterministic, inspectable, and version migrated.
- The digest detects accidental corruption; it is not authentication or encryption.
- Import validates format, schema version, integrity, and every entity before offering merge/replace.
- Export generation and import parsing remain local.

## Alternatives considered

- **Encrypted/password-protected export:** deferred because password UX and cryptographic lifecycle require a separate design.
- **CSV as complete backup:** rejected because relational entities and metadata cannot round-trip safely.
- **Cloud backup:** rejected because V2 has no account or cloud persistence requirement.

## Future extension path

A separately versioned encrypted envelope may wrap the same validated payload. Plain exports remain importable. Encryption must use reviewed browser cryptography and cannot silently upload keys or data.
