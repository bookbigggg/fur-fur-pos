"use client";

import React, { useEffect, useRef, useState } from "react";

interface A4PreviewWrapperProps {
  children: React.ReactNode;
}

const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = 1123;

export default function A4PreviewWrapper({ children }: A4PreviewWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number>(1);

  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;
      const availableWidth = containerRef.current.clientWidth;
      if (availableWidth > 0 && availableWidth < A4_WIDTH_PX) {
        setScale(availableWidth / A4_WIDTH_PX);
      } else {
        setScale(1);
      }
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    window.addEventListener("resize", updateScale);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateScale);
    };
  }, []);

  const childArray = React.Children.toArray(children);

  return (
    <div
      ref={containerRef}
      className="w-full max-w-[794px] mx-auto flex flex-col items-center gap-6 print:max-w-none print:gap-0 print:block"
    >
      {childArray.map((child, idx) => (
        <div
          key={idx}
          className="a4-preview-slot relative overflow-hidden rounded-2xl shadow-lg border border-stone-200/90 bg-white print:rounded-none print:shadow-none print:border-none print:overflow-visible"
          style={{
            width: scale < 1 ? `${Math.round(A4_WIDTH_PX * scale)}px` : `${A4_WIDTH_PX}px`,
            height: scale < 1 ? `${Math.round(A4_HEIGHT_PX * scale)}px` : `${A4_HEIGHT_PX}px`,
          }}
        >
          <div
            className="a4-preview-scaler origin-top-left print:!transform-none"
            style={{
              width: `${A4_WIDTH_PX}px`,
              height: `${A4_HEIGHT_PX}px`,
              transform: scale < 1 ? `scale(${scale})` : "none",
            }}
          >
            {child}
          </div>
        </div>
      ))}
    </div>
  );
}
