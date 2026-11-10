"use client";

import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h6a5.1 5.1 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.2-4.8 3.2-7.9z"
      />
      <path
        fill="#34A853"
        d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z"
      />
      <path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9l3.7-2.8z" />
      <path
        fill="#EA4335"
        d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z"
      />
    </svg>
  );
}

export function GoogleSignInButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="outline"
      size="lg"
      disabled={pending}
      aria-busy={pending}
      className="mt-6 h-12 w-full gap-3 text-base font-semibold"
    >
      {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <GoogleIcon />}
      Lanjutkan dengan Google
    </Button>
  );
}
