import { MUSIC } from "@/lib/music";
import { HomeFeed } from "@/components/HomeFeed";
import type { HomeShelf } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let shelves: HomeShelf[] = [];
  try {
    shelves = (await MUSIC.home()) as unknown as HomeShelf[];
  } catch {
    shelves = [];
  }

  return <HomeFeed shelves={shelves} />;
}
