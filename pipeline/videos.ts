import { YOUTUBE_CHANNELS } from "../config/youtube.ts";
import { decodeEntities, fetchText, log, mapLimit } from "./util.ts";

export interface VideoItem {
  id: string; // "v:<youtubeId>"
  youtubeId: string;
  title: string;
  channel: string;
  published: string;
}

interface PlaylistItems {
  items?: { snippet?: { title?: string; publishedAt?: string; resourceId?: { videoId?: string } }; contentDetails?: { videoPublishedAt?: string } }[];
}

export function parsePlaylistItems(json: string, channel: string): VideoItem[] {
  const out: VideoItem[] = [];
  for (const it of (JSON.parse(json) as PlaylistItems).items ?? []) {
    const youtubeId = it.snippet?.resourceId?.videoId;
    const title = it.snippet?.title;
    const published = it.contentDetails?.videoPublishedAt ?? it.snippet?.publishedAt;
    if (!youtubeId || !title || !published || /#shorts/i.test(title)) continue;
    out.push({ id: `v:${youtubeId}`, youtubeId, title: decodeEntities(title), channel, published });
  }
  return out;
}

/**
 * Recent uploads from the news channels, through the YouTube Data API (YOUTUBE_API_KEY; about
 * 20 of the free 10,000 daily quota units). YouTube's robots.txt disallows its channel feeds
 * and its terms bar other automated access, so without a key there are no videos.
 */
export async function gatherVideos(sinceHours: number): Promise<VideoItem[]> {
  const key = process.env.YOUTUBE_API_KEY?.trim();
  if (!key) {
    log("videos: skipped (no YOUTUBE_API_KEY)");
    return [];
  }
  const since = Date.now() - sinceHours * 3600_000;
  const lists = await mapLimit(YOUTUBE_CHANNELS, 4, async (c) => {
    // Every channel's uploads playlist is its ID with "UC" swapped for "UU".
    const playlist = `UU${c.id.slice(2)}`;
    const r = await fetchText(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&maxResults=8&playlistId=${playlist}&key=${encodeURIComponent(key)}`,
      { accept: "application/json" },
    );
    if (!r.ok) {
      log(`videos: ${c.name} ${r.status}`);
      return [];
    }
    return parsePlaylistItems(r.text, c.name);
  });
  // At most 8 recent uploads per channel.
  const vids = lists.flatMap((l) => l.filter((v) => Date.parse(v.published) >= since).slice(0, 8));
  log(`videos: ${vids.length} recent from ${YOUTUBE_CHANNELS.length} channels`);
  return vids;
}
