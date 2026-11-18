import { useEffect, useState } from "react";
import { loadProfile, type Profile } from "./profile.js";

// 공유 프로필 구독 훅 — MyInfoBar에서 저장하면 unse-profile-change 이벤트로 전 화면이 재계산.
export function useProfile(): Profile | null {
  const [p, setP] = useState<Profile | null>(loadProfile);
  useEffect(() => {
    const h = () => setP(loadProfile());
    window.addEventListener("unse-profile-change", h);
    return () => window.removeEventListener("unse-profile-change", h);
  }, []);
  return p;
}
