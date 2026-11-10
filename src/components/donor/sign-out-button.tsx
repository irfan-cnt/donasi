"use client";

import { LogOut } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" disabled={pending}>
      <LogOut aria-hidden />
      Keluar
    </Button>
  );
}
