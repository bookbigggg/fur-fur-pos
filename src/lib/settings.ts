// src/lib/settings.ts
"use client";

import { useState, useEffect } from "react";

export interface StoreSettings {
  enableStaffCommission: boolean;
  enableDailyClosing: boolean;
}

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  enableStaffCommission: false,
  enableDailyClosing: false,
};

export const SETTINGS_STORAGE_KEY = "furfur_store_settings";
export const SETTINGS_CHANGED_EVENT = "furfur-settings-changed";

export function getStoreSettings(): StoreSettings {
  if (typeof window === "undefined") {
    return DEFAULT_STORE_SETTINGS;
  }
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_STORE_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      enableStaffCommission:
        typeof parsed.enableStaffCommission === "boolean" ? parsed.enableStaffCommission : false,
      enableDailyClosing:
        typeof parsed.enableDailyClosing === "boolean" ? parsed.enableDailyClosing : false,
    };
  } catch {
    return DEFAULT_STORE_SETTINGS;
  }
}

export function saveStoreSettings(settings: StoreSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent(SETTINGS_CHANGED_EVENT, { detail: settings }));
  } catch (err) {
    console.error("Failed to save store settings:", err);
  }
}

export function useStoreSettings() {
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setSettings(getStoreSettings());
    setIsLoaded(true);

    const handleChanged = () => {
      setSettings(getStoreSettings());
    };

    window.addEventListener(SETTINGS_CHANGED_EVENT, handleChanged);
    window.addEventListener("storage", handleChanged);

    return () => {
      window.removeEventListener(SETTINGS_CHANGED_EVENT, handleChanged);
      window.removeEventListener("storage", handleChanged);
    };
  }, []);

  const updateSettings = (newSettings: Partial<StoreSettings>) => {
    const current = getStoreSettings();
    const merged = { ...current, ...newSettings };
    setSettings(merged);
    saveStoreSettings(merged);
  };

  return { settings, isLoaded, updateSettings };
}
