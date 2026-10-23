"use client";

import { useState } from "react";

export function DeleteAccount() {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)}>
        Delete my account
      </button>
    );
  }

  return (
    <form action="/api/account/delete" method="post">
      <p role="alert">
        This permanently deletes your account and your saved Google Drive connection, and removes
        this app&apos;s access to your Drive. It cannot be undone.
      </p>
      <button type="submit">Yes, delete my account</button>{" "}
      <button type="button" onClick={() => setConfirming(false)}>
        Cancel
      </button>
    </form>
  );
}
