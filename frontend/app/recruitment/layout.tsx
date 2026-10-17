import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Recruitment 2026–27 | Coding Club BMSIT",
  description:
    "Apply to join the Coding Club BMSIT for 2026–27. Open to students from all branches. Choose from Design, Marketing, Events & Ops, Technical, and Outreach & Sponsorship teams.",
};

export default function RecruitmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
