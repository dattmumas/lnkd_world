/**
 * Voice grounding for the growth dashboard's content drafting (convex/xPosts.ts,
 * convex/voiceProfile.ts) and the weekly review (convex/weeklyReview.ts).
 *
 * The drafting prompt is built from REAL tweets, not invented style rules: the
 * account's own top posts anchor the voice, and the niche's current winners
 * (with engagement counts) anchor what actually earns reach. Hand-written text
 * here is limited to topic lenses and hard format guardrails.
 */

export type Pillar = "health" | "finance" | "startup";

export const PILLARS: Pillar[] = ["health", "finance", "startup"];

export const PILLAR_LABEL: Record<Pillar, string> = {
  health: "Health & Longevity",
  finance: "Finance & Deals",
  startup: "Startup",
};

// What each pillar covers — a topic lens, not a tone prescription.
export const PILLAR_TOPIC: Record<Pillar, string> = {
  health:
    "The business and science of health and longevity: startups, funding rounds, deals, FDA/clinical news, and rigorous science with business implications. Audience: founders, operators, and investors in the longevity economy.",
  finance:
    "Finance, M&A, ETA (entrepreneurship through acquisition), and small-business deals: multiples, deal structures, diligence, and what buyers, sellers, and searchers actually face.",
  startup:
    "Building in public: what was shipped, tried, and measured on a real project, with real numbers including the bad ones.",
};

// Per-pillar niche searches for pulling the current top performers (getXAPI
// advanced_search syntax, engagement-ranked via product:"Top"). Edit to retune
// what "the niche" means for a pillar.
export const PILLAR_NICHE_QUERY: Record<Pillar, string> = {
  health:
    '(longevity OR healthspan OR biotech OR peptides OR "metabolic health" OR GLP-1 OR "health tech" OR "life sciences") -is:retweet -is:reply lang:en',
  finance:
    '("search fund" OR "bought a business" OR "buying a business" OR SMB OR "small business acquisition" OR "seller financing" OR "due diligence" OR "LOI") -is:retweet -is:reply lang:en',
  startup:
    '("build in public" OR "building in public" OR MRR OR "side project" OR "first customer" OR shipped OR launched) -is:retweet -is:reply lang:en',
};

// One real tweet used as a voice/pattern exemplar.
export interface VoiceExample {
  text: string;
  author?: string; // omitted for the account's own posts
  followers?: number;
  likes: number;
  replies: number;
  reposts: number;
  views?: number;
}

export interface VoiceProfileData {
  ownPosts: VoiceExample[]; // the account's own top posts — the voice anchor
  nicheWinners: VoiceExample[]; // the pillar's current top performers
}

function exampleBlock(examples: VoiceExample[]): string {
  return examples
    .map((e, i) => {
      const stats = [
        e.author ? `@${e.author}` : null,
        e.followers != null ? `${e.followers} followers` : null,
        `${e.likes} likes`,
        `${e.replies} replies`,
        `${e.reposts} reposts`,
        e.views ? `${e.views} views` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      return `${i + 1}. [${stats}]\n"""${e.text}"""`;
    })
    .join("\n\n");
}

// Hard format guardrails + output contract. Everything about tone comes from
// the real examples injected below, not from rules here.
const FORMAT_RULES = `Hard rules:
- Each tweet or thread part must be under 280 characters.
- No hashtags. No em-dashes (use a period or comma).
- Ground claims in real, verifiable specifics (studies, numbers, names, prices, dates). Never invent data; if the topic or source material doesn't supply a specific, write around it rather than fabricating one.

Output ONLY JSON, nothing else:
- Single post: {"body": "<the tweet>", "altHooks": ["<alt opening line>", "<alt opening line>"]}
- Thread: {"body": "<part 1, the hook>", "threadParts": ["<part 2>", ...], "altHooks": [...]} (4-7 parts total; the last part lands the takeaway)
altHooks: 2-3 alternate versions of the OPENING LINE only — same substance, different shapes (question-led, number-led, contrarian). Under 280 chars each. The hook decides everything; give real options, not paraphrases.`;

/**
 * Build the drafting system prompt for a pillar from real-tweet grounding.
 * `pipelineTop` = the account's best posts from this pillar's own pipeline
 * (empty until the pipeline has posted-with-metrics history).
 */
export function draftSystemPrompt(
  pillar: Pillar,
  profile: VoiceProfileData | null,
  pipelineTop: string[],
): string {
  const sections: string[] = [
    `You draft original X posts for a personal account. Pillar: ${PILLAR_TOPIC[pillar]}`,
  ];

  const own: VoiceExample[] = [
    ...pipelineTop.map((text) => ({ text, likes: 0, replies: 0, reposts: 0 })),
    ...(profile?.ownPosts ?? []),
  ].slice(0, 8);
  if (own.length > 0) {
    sections.push(
      `THE ACCOUNT'S OWN POSTS — this is the person you are writing as. Match their vocabulary, sentence rhythm, and stance exactly. The draft must be indistinguishable from these:\n\n${exampleBlock(own)}`,
    );
  }

  if (profile && profile.nicheWinners.length > 0) {
    sections.push(
      `CURRENT TOP-PERFORMING POSTS IN THIS NICHE — real posts with real engagement. Study what structurally earns this reach (the hook, the specificity, the shape) and apply those patterns. Do NOT copy their wording or impersonate these authors:\n\n${exampleBlock(profile.nicheWinners)}`,
    );
  }

  if (own.length === 0 && (!profile || profile.nicheWinners.length === 0)) {
    sections.push(
      "No real-post examples are available yet. Write plainly and concretely, like a practitioner talking to peers, not like marketing copy.",
    );
  }

  sections.push(FORMAT_RULES);
  return sections.join("\n\n");
}


export const REVIEW_SYSTEM = `You write a short weekly review of an X (Twitter) growth effort. You get the week's raw data as JSON, pulled from BOTH the operator's dashboard and X itself:
- followerSeries: daily follower counts (one point per day)
- postsOnX: every post the account actually published on X this week, with real metrics — this is ground truth (the pipelinePosts list only covers posts made through the dashboard; posts can exist on X without appearing there)
- repliesPerDay + repliesDetail: every reply sent on X this week (tracked from X, includes replies made outside the dashboard), with text, target account, and likes
- gainedFollowers: who actually followed this week (name, handle, their follower count)
- pillarAverages: pipeline performance by content pillar
- nicheNow: posts currently winning in the account's niches, for context on the meta

Write clean markdown with these sections:
1. **The week** — follower delta and the one-sentence story. If notable accounts followed (size, relevance), name them.
2. **Posts** — judge postsOnX (ground truth), not just the pipeline. Quote first lines, call out what performed and what flopped, with the actual numbers.
3. **Replies** — volume vs the 15-20/day target, but also QUALITY: which replies earned likes, which targets were worth it (cross-reference repliesDetail against gainedFollowers where possible).
4. **The niche this week** — one or two sentences on what's winning right now (from nicheNow) and whether the account's content matches that meta.
5. **Next week** — 2-3 concrete, specific suggestions grounded in THIS data. Name real accounts to keep engaging, real topics from the niche pulse. No generic advice.

Keep it under 450 words. Direct, no hedging, no filler. If the data is thin (early days), say so plainly and keep it short rather than padding it.`;
