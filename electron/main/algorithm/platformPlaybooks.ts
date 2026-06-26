import type { Platform } from '@mas/types';

/**
 * Compiled algorithm playbook for one platform.
 * Used by AlgorithmAgent to inject algorithm-aware guidance into AI prompts.
 */
export interface PlatformPlaybook {
  platform: Platform;
  /** Human-readable summary of the platform's current algorithm priorities. */
  algorithmSummary: string;
  /** Best content formats ranked by reach potential. */
  bestFormats: string[];
  /** Optimal posting time windows (US Eastern). */
  optimalTimes: string[];
  /** Hashtag strategy — volume, placement, count. */
  hashtagStrategy: string;
  /** Character/word budget guidance. */
  contentLength: string;
  /** Engagement signals the algorithm rewards (in order of weight). */
  rewardSignals: string[];
  /** Single-sentence hook advice for the opening line. */
  hookAdvice: string;
  /** Any format-specific tips. */
  bonusTips: string[];
}

/**
 * Static playbooks based on publicly available creator documentation and
 * community research (as of early 2025). The AlgorithmAgent can overlay
 * AI-generated updates on top of these defaults.
 */
export const PLATFORM_PLAYBOOKS: Record<Platform, PlatformPlaybook> = {
  facebook: {
    platform: 'facebook',
    algorithmSummary:
      'Facebook prioritizes "meaningful social interactions" — posts that generate discussion and back-and-forth comments rank highest. Native content (posts that keep users on Facebook) outperforms link-outs.',
    bestFormats: [
      'Native video (auto-plays in feed, 4× reach over link posts)',
      'Photo carousels (multi-image posts)',
      'Text posts under 80 words with a direct question',
      'Facebook Reels (boosted in Explore)',
    ],
    optimalTimes: [
      '9 am – 1 pm EST on Tuesdays and Wednesdays',
      '1 pm – 3 pm EST on Fridays',
      'Avoid 8 pm – 8 am (low reach window)',
    ],
    hashtagStrategy:
      'Use 2–3 highly relevant hashtags. Facebook over-tagging (5+) signals spam and reduces distribution.',
    contentLength:
      '40–80 words for peak engagement. Longer posts (200+ words) can work for storytelling but include a strong first sentence.',
    rewardSignals: [
      'Comment replies (back-and-forth threads)',
      'Shares to personal timeline or groups',
      'Reactions beyond likes (Love, Wow, Haha)',
      'Time spent on post / video watch time',
      'Saves',
    ],
    hookAdvice:
      'Open with a relatable statement or direct question that invites a comment within the first 5 words.',
    bonusTips: [
      'Post natively — avoid linking to Instagram or YouTube as the primary action',
      'Groups drive 3–5× organic reach vs. page posts; share content there after publishing',
      'Use Facebook Reels for audience growth; they receive algorithmic distribution to non-followers',
    ],
  },

  instagram: {
    platform: 'instagram',
    algorithmSummary:
      'Instagram rewards Saves and Shares above all other interactions. The Reels feed surfaces content to non-followers. Carousels keep users swiping (dwell time signal) and get a second distribution push when a viewer only saw slide 1.',
    bestFormats: [
      'Carousel posts (3–10 slides, highest average reach)',
      'Reels 15–30 seconds (new audience growth)',
      'Single-image posts with text overlay',
      'Stories for retention + link traffic (swipe-up/link sticker)',
    ],
    optimalTimes: [
      '9 am – 11 am EST, Monday and Thursday',
      '1 pm – 3 pm EST, Tuesday',
      '5 pm – 7 pm EST on Wednesdays',
    ],
    hashtagStrategy:
      'Use 5–10 hashtags. Mix sizes: 1–2 large (1M+), 3–4 medium (100K–1M), 2–3 niche (<100K). Place in caption or first comment.',
    contentLength:
      'Write 125–150 chars before the "more" fold — this is the first impression. Longer captions (300–500 words) perform well for carousels and educational content.',
    rewardSignals: [
      'Saves (strongest signal for feed ranking)',
      'Shares to Stories / DMs',
      'Comments (meaningful, not single-emoji)',
      'Carousel swipes (dwell/session depth)',
      'Profile visits from post',
      'Likes (weakest but still count)',
    ],
    hookAdvice:
      'First line: make a bold statement, ask a surprising question, or tease the outcome ("Here\'s what saved my client $20K…").',
    bonusTips: [
      'Add alt-text to every image — helps accessibility and indexes content for search',
      'End carousels with a strong CTA slide asking to save or share',
      'Collab posts (tag a second creator) double your distribution',
      'Post Reels every 3–4 days for sustained reach to non-followers',
    ],
  },

  twitter: {
    platform: 'twitter',
    algorithmSummary:
      'Twitter/X rewards early engagement velocity — the first 30 minutes define whether a post enters the "For You" algorithmic timeline. Threads and controversial opinions spark replies; reply activity is the top distribution signal.',
    bestFormats: [
      'Single-tweet opinion or hot take (under 200 chars)',
      'Thread (tap "+" to add tweets) for depth and storytelling',
      'Image tweet (native image > embedded link)',
      'Poll for engagement (easy reply proxy)',
    ],
    optimalTimes: [
      '8 am – 10 am EST, Tuesday through Thursday',
      '6 pm – 9 pm EST, Tuesday and Wednesday',
      'Avoid weekends for B2B niches',
    ],
    hashtagStrategy:
      'Use 1–2 hashtags maximum. More than 2 reduces reach. Place at end or mid-sentence naturally.',
    contentLength:
      'Single tweets under 200 chars outperform 280-char ones. For threads, 3–7 tweets is the sweet spot.',
    rewardSignals: [
      'Retweets / Reposts',
      'Reply conversations (especially back-and-forth)',
      'Quote tweets (signal of opinion)',
      'Bookmarks / saves',
      'Profile follows from tweet',
      'Likes',
    ],
    hookAdvice:
      'Open with a claim that will spark disagreement or strong agreement — nuanced opinions outperform neutral statements.',
    bonusTips: [
      'Reply to every comment in the first hour to boost thread activity score',
      'Pinning a top tweet temporarily after posting increases profile visit conversion',
      'Blue verified status increases For You distribution — mention @replies to verified accounts in threads',
    ],
  },

  threads: {
    platform: 'threads',
    algorithmSummary:
      'Threads (Meta) prioritizes conversations and reshares. The algorithm is currently more forgiving of posting frequency than Instagram. Text-first content with a personal voice performs best.',
    bestFormats: [
      'Conversational text posts (200–500 chars)',
      'Short opinion or question post',
      'Image + text combo',
      'Thread chains (reply to your own post)',
    ],
    optimalTimes: [
      '9 am – 12 pm EST, weekdays',
      '5 pm – 8 pm EST, Monday–Wednesday',
    ],
    hashtagStrategy:
      'Threads hashtags are experimental — 1–3 relevant tags. The algorithm currently relies more on text content than hashtag signals.',
    contentLength:
      '300–500 characters is the sweet spot. Short posts under 150 chars also perform well if the hook is sharp.',
    rewardSignals: [
      'Replies and reply chains',
      'Reshares to followers',
      'Profile follows from post',
      'Likes',
    ],
    hookAdvice:
      'Be conversational and direct — Threads rewards authenticity over polish. Start with "Unpopular opinion:", "Hot take:", or a personal anecdote.',
    bonusTips: [
      'Cross-posting from Instagram Reels drives Threads followers for the same piece of content',
      'Reply to comments quickly — Threads currently surfaces active conversations',
    ],
  },

  pinterest: {
    platform: 'pinterest',
    algorithmSummary:
      'Pinterest functions as a visual search engine. SEO-optimized descriptions and titles matter more than follower count. Saves (repins) signal long-term evergreen value and drive sustained distribution.',
    bestFormats: [
      'Vertical static image (2:3 ratio, 1000×1500px)',
      'Infographic / step-by-step guide',
      'Video pin (6–30 sec loop, no sound required)',
      'Idea pin (multi-page story format)',
    ],
    optimalTimes: [
      '8 pm – 11 pm EST, Saturday',
      '8 pm – 11 pm EST, Sunday',
      '2 pm – 4 pm EST, Friday',
    ],
    hashtagStrategy:
      'Use 5–15 keyword-rich hashtags (they function as SEO tags). Include niche, sub-niche, and long-tail terms in the description itself.',
    contentLength:
      'Title: under 100 chars, keyword-first. Description: 150–300 chars, include 2–3 main keywords naturally.',
    rewardSignals: [
      'Saves / repins (highest signal)',
      'Link clicks (if enabled)',
      'Engagement rate (comments + reactions)',
      'Search impression click-through rate',
      'Close-ups on pin',
    ],
    hookAdvice:
      'Write the title as a search query someone would type: "5 Ways to [solve problem]" or "[Adjective] [noun] for [audience]".',
    bonusTips: [
      'Add text overlay to images — pins with text describing the content get 33% more clicks',
      'Rich pins (product / recipe / article) are auto-formatted and get priority in search',
      'Board organization matters: keyword-rich board titles and descriptions improve pin distribution',
    ],
  },

  youtube: {
    platform: 'youtube',
    algorithmSummary:
      'YouTube optimizes for watch time and click-through rate on thumbnails. A 50%+ average view duration is the benchmark for algorithmic push. Suggested video placement (not search) drives 70% of views.',
    bestFormats: [
      'Educational tutorials (8–12 minutes)',
      'Listicles / top-N videos (5–12 minutes)',
      'Documentary / story-driven (15–30 minutes for engaged audiences)',
      'Shorts under 60 seconds for subscriber growth',
    ],
    optimalTimes: [
      '12 pm – 4 pm EST, Thursday and Friday',
      '9 am – 11 am EST, Saturday',
    ],
    hashtagStrategy:
      'Use 3–5 hashtags in the description; they appear above the title. Choose broad category, mid-niche, and specific topic.',
    contentLength:
      'Description: first 150 chars show before "Show more" — include the keyword and main value prop. Full description can be 500–1000 words with timestamps.',
    rewardSignals: [
      'Average view duration / watch time %',
      'Click-through rate on thumbnail (target 4–10%)',
      'Subscriber conversions per view',
      'Comments (especially pinned reply)',
      'Likes relative to dislikes ratio',
    ],
    hookAdvice:
      'The first 30 seconds must restate the promise of the thumbnail and title, and preview what the viewer will learn — avoid long intros.',
    bonusTips: [
      'Chapters (timestamps in description) improve retention and show in Google search',
      'Custom thumbnails with high-contrast colors and 1–3 words of text outperform auto-generated ones',
      'End screens and cards with a strong CTA to subscribe extend session time',
    ],
  },

  tiktok: {
    platform: 'tiktok',
    algorithmSummary:
      'TikTok distributes to non-followers first via a "cold start" bucket (200–500 people). Completion rate (finishing the video) and re-watches are the primary ranking signals. One viral video can bring 100K+ followers regardless of account age.',
    bestFormats: [
      'Vertical video 15–30 seconds (highest completion rate)',
      'Tutorial / "how to" in 60 seconds',
      'Trend participation with a niche twist',
      'Story / personal narrative (30–60 seconds)',
    ],
    optimalTimes: [
      '7 am – 9 am EST (morning scroll)',
      '7 pm – 11 pm EST (peak evening usage)',
      'Any day — TikTok algorithm is time-of-week agnostic vs. other platforms',
    ],
    hashtagStrategy:
      'Use 3–5 hashtags: 1 trending / viral hashtag + 2 niche-specific + 1 evergreen topic. Do not use #fyp #foryou as they are noise.',
    contentLength:
      'Caption: under 150 chars — TikTok users do not read long captions. Let the video speak.',
    rewardSignals: [
      'Video completion rate (>70% = strong signal)',
      'Re-watch rate (video loops)',
      'Shares (DM and other platforms)',
      'Comments (especially questions)',
      'Follows from video',
      'Duet / stitch activity',
    ],
    hookAdvice:
      'The first 1–3 seconds must show or say something surprising, shocking, or irresistible — this determines whether the viewer swipes away.',
    bonusTips: [
      'Post 3–5× per week for algorithmic momentum during growth phase',
      'Reply to every comment with a video reply — this creates a second viral entry point',
      'Captions (subtitles) increase completion rate by 12% as many watch on mute',
    ],
  },

  linkedin: {
    platform: 'linkedin',
    algorithmSummary:
      'LinkedIn rewards content that generates substantive comment discussions, especially back-and-forth threads. The algorithm "gates" content to a small batch first and expands distribution based on engagement velocity in the first 2 hours.',
    bestFormats: [
      'Text-only thought leadership post (150–300 words)',
      'Document / PDF carousel (3–10 pages)',
      'Native video (under 3 minutes)',
      'Single image with insightful caption',
    ],
    optimalTimes: [
      '8 am – 10 am EST, Tuesday',
      '9 am – 12 pm EST, Wednesday',
      '10 am – 12 pm EST, Thursday',
      'Avoid weekends — B2B audience drops off significantly',
    ],
    hashtagStrategy:
      'Use 3–5 professional hashtags. Mix: 1 broad industry (500K+ followers), 2 niche-specific (50–200K), 1 personal brand. Place at the end of the post.',
    contentLength:
      '150–300 words is optimal. Use line breaks aggressively — walls of text get collapsed. Start with a 1-line hook before any line break.',
    rewardSignals: [
      'Comment threads (especially author responses)',
      'Saves / bookmarks',
      'Dwell time on post',
      'Follows from post',
      'Reactions beyond Like (Insightful, Celebrate)',
      'Shares (weakly tracked by algorithm)',
    ],
    hookAdvice:
      'First line = stop-the-scroll line. Before hitting Enter: make a bold claim, share a surprising stat, or ask a professional question. The hook is all that shows before "see more".',
    bonusTips: [
      'Post from a personal profile, not a company page — personal profiles get 8–10× organic reach',
      'Comment on 5–10 posts in your niche in the hour before you post (warms up the algorithm)',
      'Posting a follow-up comment on your own post 2 hours after publishing re-triggers the distribution window',
    ],
  },
};

/** Format a playbook into a concise prompt injection directive. */
export function playbookToPromptHint(playbook: PlatformPlaybook): string {
  return `
[${playbook.platform.toUpperCase()} ALGORITHM GUIDANCE]
Algorithm priority: ${playbook.algorithmSummary}
Best formats: ${playbook.bestFormats.slice(0, 2).join('; ')}.
Content length: ${playbook.contentLength}
Hashtag strategy: ${playbook.hashtagStrategy}
Top reward signals: ${playbook.rewardSignals.slice(0, 3).join(', ')}.
Hook advice: ${playbook.hookAdvice}
`.trim();
}
