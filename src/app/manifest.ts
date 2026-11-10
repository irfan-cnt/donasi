import type { MetadataRoute } from "next";
import { SITE_NAME, THEME_COLOR } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: "Platform donasi & crowdfunding Islami.",
    start_url: "/",
    display: "standalone",
    background_color: "#FAF9F5",
    theme_color: THEME_COLOR,
    lang: "id",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
