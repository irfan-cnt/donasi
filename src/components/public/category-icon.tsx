import {
  CloudLightning,
  Flag,
  GraduationCap,
  HandHeart,
  HeartPulse,
  Landmark,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";

// Nama ikon disimpan di campaign_categories.icon (seed reference-data).
const ICONS: Record<string, LucideIcon> = {
  "graduation-cap": GraduationCap,
  "heart-pulse": HeartPulse,
  "hand-heart": HandHeart,
  landmark: Landmark,
  users: Users,
  "cloud-lightning": CloudLightning,
  flag: Flag,
  sparkles: Sparkles,
};

export function CategoryIcon({ name, className }: { name: string | null; className?: string }) {
  const Icon = (name && ICONS[name]) || Sparkles;
  return <Icon className={className} aria-hidden />;
}
