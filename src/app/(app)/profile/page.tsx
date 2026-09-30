import type { Metadata } from "next";
import { ProfileContainer } from "@/containers/profile_container";

export const metadata: Metadata = { title: "Perfil" };

export default function ProfilePage() {
  return <ProfileContainer />;
}
