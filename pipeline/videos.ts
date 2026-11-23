import { YOUTUBE_CHANNELS } from "../config/youtube.ts";
import { decodeEntities, fetchText, log, mapLimit } from "./util.ts";

export interface VideoItem {
  id: string; // "v:<youtubeId>"
  youtubeId: string;
  title: string;
  channel: string;
  published: string;
}

export function parseYouTubeFeed(xml: string, channel: string): VideoItem[] {
  const out: VideoItem[] = [];
  for (const entry of xml.split("<entry>").slice(1)) {
    const youtubeId = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
    const title = entry.match(/<title>([^<]*)<\/title>/)?.[1];
    const published = entry.match(/<published>([^<]+)<\/published>/)?.[1];
    if (!youtubeId || !title || !published) continue;
    // Skip Shorts-style and livestream placeholders where obvious.
    if (/#shorts/i.test(title)) continue;
    out.push({ id: `v:${youtubeId}`, youtubeId, title: decodeEntities(title), channel, published });
  }
  return out;
}

export async function gatherVideos(sinceHours: number): Promise<VideoItem[]> {
  const since = Date.now() - sinceHours * 3600_000;
  const lists = await mapLimit(YOUTUBE_CHANNELS, 8, async (c) => {
    const r = await fetchText(`https://www.youtube.com/feeds/videos.xml?channel_id=${c.id}`, { accept: "application/atom+xml,*/*" });
    return r.ok ? parseYouTubeFeed(r.text, c.name) : [];
  });
  // At most 8 recent uploads per channel.
  const vids = lists.flatMap((l) => l.filter((v) => Date.parse(v.published) >= since).slice(0, 8));
  log(`videos: ${vids.length} recent from ${YOUTUBE_CHANNELS.length} channels`);
  return vids;
}
