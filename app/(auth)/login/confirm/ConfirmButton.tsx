"use client";

import { useState } from "react";

export function ConfirmButton({ callbackUrl }: { callbackUrl: string }) {
  const [going, setGoing] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        setGoing(true);
        window.location.href = callbackUrl;
      }}
      disabled={going}
      className="block w-full rounded-full bg-primary px-6 py-4 text-base font-semibold text-fg-inverse shadow-md hover:bg-primary-dark hover:shadow-lg transition-all disabled:opacity-60"
    >
      {going ? "Entrando…" : "Entrar"}
    </button>
  );
}
