import { PustakaSection } from "@/components/PustakaSection";

export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  return <PustakaSection section={decodeURIComponent(section)} />;
}
