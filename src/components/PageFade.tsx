"use client";

import { usePathname } from "next/navigation";

/* fade halus setiap ganti rute */
export function PageFade({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div key={path} className="page-fade">
      {children}
    </div>
  );
}
