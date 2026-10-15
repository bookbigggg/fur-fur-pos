import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Fur Fur & POS",
    short_name: "Fur Fur &",
    description: "ระบบคิดเงินและบริหารร้าน Fur Fur & (เฟอ เฟอ แอนด์)",
    start_url: "/pos",
    display: "standalone",
    background_color: "#f5f5f4",
    theme_color: "#ffffff",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
