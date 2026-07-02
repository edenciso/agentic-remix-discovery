import React, { useState, useEffect, useMemo, useRef, Fragment } from "react";
import {
  Play, Loader2, CheckCircle2, XCircle, AlertCircle, ChevronRight, ChevronDown,
  FileText, MessageSquareWarning, Eye, Target, Wrench,
  X, Info, Activity, Quote, Copy, RefreshCw,
  Layers, GitBranch, Sparkles, Shield, Lightbulb, Hammer, Microscope, MinusCircle,
  Users, BookOpen, HelpCircle
} from "lucide-react";

/* =========================================================================
   REMIX DISCOVERY STUDIO — MVP
   Customer Discovery Synthesis for Brightline (fictional B2B SaaS analytics)

   Orchestrates a six-agent pipeline:
     Ingestion → Theme → Contradiction → Recommendation → Critic → Memo
   against a synthetic interview corpus of 35 chunks across 14 interviews.

   Runs in two modes:
     · Live  — calls the Anthropic API via a same-origin proxy
     · Demo  — plays back hand-curated outputs (for offline demos)

   Model: claude-opus-4-7 by default. Swap via the MODEL constant below.
   ========================================================================= */

// Swap this if you want to test against a different model.
// claude-opus-4-7 is the gold-run target; claude-sonnet-4-6 runs ~3× faster
// at lower cost with a meaningful quality drop on the synthesis depth.
const MODEL = "claude-opus-4-7";

// Product scenario — the fictional company Matt P. is doing discovery for.
const PRODUCT = {
  name: "Brightline",
  category: "Self-serve product analytics for non-engineering teams",
  stage: "Series B (~150 employees, 4 years post-launch)",
  round_label: "Discovery Round · April 2026",
  research_question:
    "Existing customers love the daily-use experience but aren't pulling new teams in or upgrading to higher tiers. What's actually blocking expansion?",
  pm_owner: "Matt P., Senior PM, Growth",
  cohort_summary:
    "14 interviews · 3 power users · 4 stalled champions · 5 secondary teammates · 2 churned/downgraded",
};

/* -------------------------------------------------------------------------
   1. THE INTERVIEW CORPUS — 35 chunks across 14 interviews
   Composition: 12 pain_observation · 8 desired_outcome · 8 behavior_observation
                · 4 workaround · 3 quote
   Engineered patterns: 4 real themes + 1 noise-flagged theme,
   3 contradictions (said-vs-did, cross-segment, leading-question artifact).
   ------------------------------------------------------------------------- */

// 2. SOURCE METADATA
// Five categories matching how working PMs code interview chunks. Each
// gets an icon (assigned in the UI section) and a short label. The
// distinction that does the most work in the pipeline:
//   - pain_observation = TOLD me there was friction
//   - behavior_observation = SHOWED me the friction (highest evidence weight)
// The said-vs-did contradiction agent leans heavily on this gap.
// -------------------------------------------------------------------------

const SOURCE_META = {
  pain_observation:     { label: "Pain (told)",        short: "PAIN",  icon: MessageSquareWarning },
  behavior_observation: { label: "Behavior (shown)",   short: "BHVR",  icon: Eye },
  desired_outcome:      { label: "Desired outcome",    short: "WANT",  icon: Target },
  workaround:           { label: "Workaround",         short: "WORK",  icon: Wrench },
  quote:                { label: "Notable quote",      short: "QUOTE", icon: Quote },
};

// -------------------------------------------------------------------------
// 3. THE 35 INTERVIEW CHUNKS
// Each chunk = one coded moment from a transcript. Chunks share an
// `interview_id` when they came from the same conversation. Engineered
// patterns (see README "Dataset design"):
//   - Theme A "Second user problem": chunks 1, 4, 9, 12, 16, 19, 22, 25, 30
//   - Theme B "Power users plateaued": chunks 3, 7, 10, 18, 24
//   - Theme C "Champions are tired": chunks 5, 11, 17, 26, 31
//   - Theme D (noise): "Mobile is a barrier": chunks 6, 20, 28
//   - Theme E "AI-native tools eating use cases": chunks 33, 34, 35
//   - Said-vs-did contradiction: said=chunks 2,8,15,23,29 / did=chunks 3,7,10,18,24
//   - Cross-segment contradiction: champions=11,17,26 / teammates=4,15,32
//   - Leading-question artifact: chunks 13, 21, 27
// -------------------------------------------------------------------------

const SIGNALS = [
  // -------- Interview 1: Sarah, PM, power user @ MidCorp (mid_market, 18 mo) --------
  {
    id: "chunk_001",
    source_type: "pain_observation",
    interview_id: "int_01",
    date: "2026-04-02",
    participant: { role: "PM", segment: "power_user", company_size: "mid_market", tenure_months: 18 },
    task_context: "Talking through how her team uses Brightline week-to-week.",
    summary:
      "Says she invites teammates regularly but most never log in a second time. Doesn't know why; assumes they're 'too busy'.",
    quote: "I add people to dashboards all the time. Maybe two of them ever come back.",
    evidence_strength: 4,
    sentiment: "negative",
    topic_tags: ["secondary_user", "onboarding", "adoption"],
    pm_note: ""
  },
  {
    id: "chunk_002",
    source_type: "desired_outcome",
    interview_id: "int_01",
    date: "2026-04-02",
    participant: { role: "PM", segment: "power_user", company_size: "mid_market", tenure_months: 18 },
    task_context: "When asked what's missing.",
    summary:
      "Wants 'more advanced segmentation' and 'better cohort comparisons'. Couldn't name a specific cohort question she's failed to answer in the last month.",
    quote: "I just feel like I'm always hitting the limits.",
    evidence_strength: 2,
    sentiment: "neutral",
    topic_tags: ["features", "segmentation", "cohorts"],
    pm_note: "Aspiration, not a specific blocked task. Watch for said-vs-did."
  },
  {
    id: "chunk_003",
    source_type: "behavior_observation",
    interview_id: "int_01",
    date: "2026-04-02",
    participant: { role: "PM", segment: "power_user", company_size: "mid_market", tenure_months: 18 },
    task_context: "Shared screen and walked through her actual weekly workflow.",
    summary:
      "Used three dashboards she built 8 months ago. Hasn't touched the segmentation builder since onboarding. Funnel comparison feature (shipped Feb) — never used.",
    quote: "",
    evidence_strength: 5,
    sentiment: "neutral",
    topic_tags: ["plateau", "feature_adoption", "stable_workflow"],
    pm_note: "Direct contradiction with chunk_002. Used 0 of the segmentation features she said she wanted."
  },
  {
    id: "chunk_034",
    source_type: "workaround",
    interview_id: "int_01",
    date: "2026-04-02",
    participant: { role: "PM", segment: "power_user", company_size: "mid_market", tenure_months: 18 },
    task_context: "Asked if she'd done any analysis recently that Brightline didn't quite handle.",
    summary:
      "Last month she expensed Hex Pro for one project — needed to combine onboarding cohort data with billing data, used Hex's AI assistant to write the SQL. Took half a day. Said she'd have spent 'days' trying to do it in Brightline.",
    quote: "I expensed it for that one analysis. It paid for itself in an afternoon.",
    evidence_strength: 5,
    sentiment: "neutral",
    topic_tags: ["competitive_ai", "expensed_competitor", "deep_analysis"],
    pm_note: ""
  },

  // -------- Interview 2: Tom, IC engineer, secondary teammate @ MidCorp --------
  {
    id: "chunk_004",
    source_type: "pain_observation",
    interview_id: "int_02",
    date: "2026-04-03",
    participant: { role: "Engineer", segment: "secondary_teammate", company_size: "mid_market", tenure_months: 18 },
    task_context: "Asked when he last opened Brightline.",
    summary:
      "Last logged in 3 weeks ago. Sarah (his PM) had shared a dashboard but he 'couldn't find what was being asked'. Closed the tab.",
    quote: "I don't know what any of these charts mean. I'm not going to bother her about it.",
    evidence_strength: 5,
    sentiment: "negative",
    topic_tags: ["secondary_user", "onboarding", "abandonment", "dashboard_clarity"],
    pm_note: ""
  },
  {
    id: "chunk_005",
    source_type: "pain_observation",
    interview_id: "int_03",
    date: "2026-04-03",
    participant: { role: "PM", segment: "stalled_champion", company_size: "mid_market", tenure_months: 22 },
    task_context: "Discussing his team's growth in usage over the past year.",
    summary:
      "Says he's stopped creating new dashboards because every dashboard he makes generates 4-5 'how do I read this' Slack messages. Calls it a 'support tax'.",
    quote: "Every chart I build is a meeting I have to take.",
    evidence_strength: 4,
    sentiment: "negative",
    topic_tags: ["champion_burnout", "support_tax", "secondary_user"],
    pm_note: ""
  },

  // -------- Interview 3: Priya, Founder, power user @ TinyCo (smb, 9 mo) --------
  {
    id: "chunk_006",
    source_type: "pain_observation",
    interview_id: "int_04",
    date: "2026-04-04",
    participant: { role: "Founder", segment: "power_user", company_size: "smb", tenure_months: 9 },
    task_context: "Asked about pain points.",
    summary:
      "Hates the mobile experience. Often wants to glance at metrics on the way to a meeting. Pinch-zoom on charts is 'unusable'.",
    quote: "If I'm not at my desk, I might as well not be a customer.",
    evidence_strength: 4,
    sentiment: "negative",
    topic_tags: ["mobile", "founder", "on_the_go"],
    pm_note: ""
  },
  {
    id: "chunk_007",
    source_type: "behavior_observation",
    interview_id: "int_04",
    date: "2026-04-04",
    participant: { role: "Founder", segment: "power_user", company_size: "smb", tenure_months: 9 },
    task_context: "Walking through her dashboard while we talked.",
    summary:
      "Has 2 dashboards, both built in onboarding 9 months ago. When I asked about the new annotations feature she said 'wait there's annotations?'.",
    quote: "",
    evidence_strength: 5,
    sentiment: "neutral",
    topic_tags: ["plateau", "feature_awareness", "stable_workflow"],
    pm_note: ""
  },
  {
    id: "chunk_008",
    source_type: "desired_outcome",
    interview_id: "int_04",
    date: "2026-04-04",
    participant: { role: "Founder", segment: "power_user", company_size: "smb", tenure_months: 9 },
    task_context: "Open-ended 'what would make Brightline more valuable for you'.",
    summary:
      "Asks for 'AI insights that just tell me what's important'. When pressed for a concrete example, gave a vague hand-wave.",
    quote: "Like, just tell me what changed and why I should care.",
    evidence_strength: 2,
    sentiment: "positive",
    topic_tags: ["ai_insights", "features", "aspirational"],
    pm_note: ""
  },

  // -------- Interview 4: Marcus, Analyst, secondary teammate @ MidCorp --------
  {
    id: "chunk_009",
    source_type: "behavior_observation",
    interview_id: "int_05",
    date: "2026-04-05",
    participant: { role: "Analyst", segment: "secondary_teammate", company_size: "mid_market", tenure_months: 14 },
    task_context: "Asked him to open Brightline and find one number he uses for his work.",
    summary:
      "Took 90 seconds to find the dashboard he was looking for. Used the URL in his bookmarks rather than navigating in-app. Said 'I never figured out the menu structure'.",
    quote: "",
    evidence_strength: 5,
    sentiment: "negative",
    topic_tags: ["navigation", "secondary_user", "muscle_memory"],
    pm_note: ""
  },
  {
    id: "chunk_010",
    source_type: "behavior_observation",
    interview_id: "int_06",
    date: "2026-04-05",
    participant: { role: "PM", segment: "power_user", company_size: "enterprise", tenure_months: 30 },
    task_context: "Walked through her active dashboards and queries.",
    summary:
      "5 dashboards, 4 of which she built in her first 90 days. Queries from the last 60 days are minor variations on a single base query.",
    quote: "",
    evidence_strength: 5,
    sentiment: "neutral",
    topic_tags: ["plateau", "stable_workflow", "long_tenure"],
    pm_note: ""
  },

  // -------- Interview 5: Diego, PM, stalled champion @ Acme (mid_market, 16 mo) --------
  {
    id: "chunk_011",
    source_type: "quote",
    interview_id: "int_07",
    date: "2026-04-07",
    participant: { role: "PM", segment: "stalled_champion", company_size: "mid_market", tenure_months: 16 },
    task_context: "When asked how he describes Brightline to colleagues.",
    summary:
      "Calls Brightline 'way more intuitive than Mixpanel was'. Memorable framing — the comparison is doing the work.",
    quote: "Way more intuitive than what we had. Way more.",
    evidence_strength: 3,
    sentiment: "positive",
    topic_tags: ["champion_view", "intuitive", "comparison"],
    pm_note: ""
  },
  {
    id: "chunk_012",
    source_type: "pain_observation",
    interview_id: "int_07",
    date: "2026-04-07",
    participant: { role: "PM", segment: "stalled_champion", company_size: "mid_market", tenure_months: 16 },
    task_context: "Why his team's seat count has been flat for 6 months.",
    summary:
      "Says he 'gave up' on inviting more teammates after the third Marketing person abandoned. Now treats Brightline as a personal tool.",
    quote: "I'd rather just send screenshots in Slack than walk someone through it.",
    evidence_strength: 4,
    sentiment: "negative",
    topic_tags: ["secondary_user", "expansion_blocked", "champion_burnout"],
    pm_note: ""
  },
  {
    id: "chunk_013",
    source_type: "desired_outcome",
    interview_id: "int_07",
    date: "2026-04-07",
    participant: { role: "PM", segment: "stalled_champion", company_size: "mid_market", tenure_months: 16 },
    task_context: "I asked: 'would AI-generated insights help your workflow?'",
    summary:
      "Said yes, would be 'really cool', could see Marketing finding it 'super useful'. No specific use case described.",
    quote: "Yeah, that sounds great. Marketing would love it.",
    evidence_strength: 1,
    sentiment: "positive",
    topic_tags: ["ai_insights", "leading_question", "aspirational"],
    pm_note: "I asked the leading version. Customer agreed enthusiastically. Don't trust this signal alone."
  },

  // -------- Interview 6: Jenna, Designer, secondary teammate @ Acme --------
  {
    id: "chunk_014",
    source_type: "behavior_observation",
    interview_id: "int_08",
    date: "2026-04-08",
    participant: { role: "Designer", segment: "secondary_teammate", company_size: "mid_market", tenure_months: 16 },
    task_context: "Asked her to find the dashboard Diego shared with her.",
    summary:
      "Couldn't find it. Searched 'design metrics' in app search — no results. Tried bookmarks — wasn't there. Asked me how to find shared dashboards.",
    quote: "",
    evidence_strength: 5,
    sentiment: "negative",
    topic_tags: ["secondary_user", "navigation", "share_visibility"],
    pm_note: ""
  },
  {
    id: "chunk_015",
    source_type: "pain_observation",
    interview_id: "int_08",
    date: "2026-04-08",
    participant: { role: "Designer", segment: "secondary_teammate", company_size: "mid_market", tenure_months: 16 },
    task_context: "After failing to find the dashboard.",
    summary:
      "Said the product is 'really confusing' and uses 'a lot of jargon I'm not familiar with'. Mentioned 'event' as a confusing term — she doesn't know what counts.",
    quote: "It's like everyone here speaks a language I never learned.",
    evidence_strength: 4,
    sentiment: "negative",
    topic_tags: ["jargon", "vocabulary", "secondary_user"],
    pm_note: "Direct contradiction with chunk_011. Same product, opposite words."
  },
  {
    id: "chunk_016",
    source_type: "desired_outcome",
    interview_id: "int_08",
    date: "2026-04-08",
    participant: { role: "Designer", segment: "secondary_teammate", company_size: "mid_market", tenure_months: 16 },
    task_context: "Asked what would make her actually use Brightline.",
    summary:
      "Wants 'a tour I can take whenever I get added to a new dashboard' and 'someone explaining what these numbers mean for design'.",
    quote: "If I open a dashboard I just want it to walk me through what I'm looking at.",
    evidence_strength: 4,
    sentiment: "neutral",
    topic_tags: ["secondary_user", "onboarding", "guidance"],
    pm_note: ""
  },

  // -------- Interview 7: Ravi, PM, stalled champion @ EnterpriseCo (enterprise, 28 mo) --------
  {
    id: "chunk_017",
    source_type: "pain_observation",
    interview_id: "int_09",
    date: "2026-04-09",
    participant: { role: "PM", segment: "stalled_champion", company_size: "enterprise", tenure_months: 28 },
    task_context: "Why his team has gone from 8 seats to 6 over the past year.",
    summary:
      "Two PMs left the company; he didn't push to backfill the seats. Says 'it would just be more dashboards I'd end up maintaining for them'.",
    quote: "It's not worth the support work to grow the team on it.",
    evidence_strength: 4,
    sentiment: "negative",
    topic_tags: ["champion_burnout", "expansion_blocked", "support_tax"],
    pm_note: ""
  },
  {
    id: "chunk_018",
    source_type: "behavior_observation",
    interview_id: "int_09",
    date: "2026-04-09",
    participant: { role: "PM", segment: "stalled_champion", company_size: "enterprise", tenure_months: 28 },
    task_context: "Walked through what he opened in the last week.",
    summary:
      "Same 4 dashboards every day. 0 new dashboards in past 6 months. Has a saved query he's been editing in-place rather than creating new queries.",
    quote: "",
    evidence_strength: 5,
    sentiment: "neutral",
    topic_tags: ["plateau", "stable_workflow", "long_tenure"],
    pm_note: ""
  },
  {
    id: "chunk_019",
    source_type: "workaround",
    interview_id: "int_09",
    date: "2026-04-09",
    participant: { role: "PM", segment: "stalled_champion", company_size: "enterprise", tenure_months: 28 },
    task_context: "How does his eng team consume metrics he gathers?",
    summary:
      "He copies numbers into Notion docs each Monday. The docs are 'where eng actually looks'. Brightline is his data source but not his eng team's surface.",
    quote: "",
    evidence_strength: 4,
    sentiment: "neutral",
    topic_tags: ["secondary_user", "workaround", "consumption_surface"],
    pm_note: "Big — second users aren't getting Brightline at all, they're getting Notion."
  },
  {
    id: "chunk_033",
    source_type: "workaround",
    interview_id: "int_09",
    date: "2026-04-09",
    participant: { role: "PM", segment: "stalled_champion", company_size: "enterprise", tenure_months: 28 },
    task_context: "Asked how he interprets the numbers he pulls.",
    summary:
      "Pastes screenshots of Brightline charts into Claude or ChatGPT and asks 'what's interesting here'. Says it's 'faster than thinking about it myself'. Does this 2-3 times a week.",
    quote: "I just dump it into Claude. It tells me what to look at.",
    evidence_strength: 4,
    sentiment: "neutral",
    topic_tags: ["competitive_ai", "interpretation_layer", "workaround"],
    pm_note: "The interpretation step has left the platform. He's still our customer for data — but not for thinking."
  },

  // -------- Interview 8: Wei, Marketing Manager, churned customer (mid_market, 11 mo, downgraded last quarter) --------
  {
    id: "chunk_020",
    source_type: "pain_observation",
    interview_id: "int_10",
    date: "2026-04-10",
    participant: { role: "Marketer", segment: "churned", company_size: "mid_market", tenure_months: 11 },
    task_context: "Asked about her team's experience before downgrading.",
    summary:
      "Mobile experience came up — said her exec wanted dashboards on his phone, never worked, blamed her for the tool choice.",
    quote: "He'd ask me 'why is this so terrible on my phone' and I had no answer.",
    evidence_strength: 3,
    sentiment: "negative",
    topic_tags: ["mobile", "exec_user", "churn_factor"],
    pm_note: ""
  },
  {
    id: "chunk_021",
    source_type: "desired_outcome",
    interview_id: "int_10",
    date: "2026-04-10",
    participant: { role: "Marketer", segment: "churned", company_size: "mid_market", tenure_months: 11 },
    task_context: "I asked: 'do you wish there were AI features that did some of the analysis for you?'",
    summary:
      "She said yes — 'that's what we ended up using [Competitor X] for instead'. But couldn't articulate what AI features actually solved her problem.",
    quote: "Yeah we use [Competitor X] partly because it has the AI thing.",
    evidence_strength: 2,
    sentiment: "neutral",
    topic_tags: ["ai_insights", "leading_question", "competitor"],
    pm_note: ""
  },
  {
    id: "chunk_022",
    source_type: "pain_observation",
    interview_id: "int_10",
    date: "2026-04-10",
    participant: { role: "Marketer", segment: "churned", company_size: "mid_market", tenure_months: 11 },
    task_context: "Why the team didn't expand into Brightline more before downgrading.",
    summary:
      "Says her copywriters 'never could figure it out'. She gave up trying to onboard them after a couple of attempts. Calls Brightline 'a PM tool, not a marketing tool'.",
    quote: "It's PM software. Marketers don't think in funnels the same way.",
    evidence_strength: 4,
    sentiment: "negative",
    topic_tags: ["secondary_user", "marketing_persona", "vocabulary"],
    pm_note: ""
  },
  {
    id: "chunk_035",
    source_type: "behavior_observation",
    interview_id: "int_10",
    date: "2026-04-10",
    participant: { role: "Marketer", segment: "churned", company_size: "mid_market", tenure_months: 11 },
    task_context: "Asked what they're using now for the same workflows.",
    summary:
      "Adopted Inflexion (AI-native marketing analytics) two months before downgrading Brightline. Showed me her current weekly review — she types questions in plain English and it generates the views. 'I don't make charts anymore. I ask.'",
    quote: "I don't make charts anymore. I ask.",
    evidence_strength: 5,
    sentiment: "positive",
    topic_tags: ["competitive_ai", "substitution", "natural_language", "churn_factor"],
    pm_note: "Inflexion adoption preceded our downgrade by 2 months. Substitution is real, not aspirational."
  },

  // -------- Interview 9: Tomás, Engineering Lead, secondary teammate @ EnterpriseCo --------
  {
    id: "chunk_023",
    source_type: "desired_outcome",
    interview_id: "int_11",
    date: "2026-04-11",
    participant: { role: "Engineer", segment: "secondary_teammate", company_size: "enterprise", tenure_months: 28 },
    task_context: "Open-ended: 'what would Brightline need to be for your team to actually use it'.",
    summary:
      "Wants 'a real API and webhook system'. Says his team would build their own dashboards if they could pipe data into their own tooling.",
    quote: "Give me an API and we'll do the rest.",
    evidence_strength: 3,
    sentiment: "neutral",
    topic_tags: ["api", "developer_persona", "secondary_user"],
    pm_note: ""
  },
  {
    id: "chunk_024",
    source_type: "behavior_observation",
    interview_id: "int_11",
    date: "2026-04-11",
    participant: { role: "Engineer", segment: "secondary_teammate", company_size: "enterprise", tenure_months: 28 },
    task_context: "Asked when he last logged in.",
    summary:
      "Couldn't remember. Pulled up his SSO history and the last successful login was 7 weeks ago. Says he doesn't think about Brightline as a tool he uses.",
    quote: "",
    evidence_strength: 5,
    sentiment: "negative",
    topic_tags: ["secondary_user", "abandonment", "long_dormant"],
    pm_note: "Strong: 28-month-tenure customer's eng lead has effectively churned individually."
  },

  // -------- Interview 10: Hana, PM, stalled champion @ MidCo2 (mid_market, 14 mo) --------
  {
    id: "chunk_025",
    source_type: "pain_observation",
    interview_id: "int_12",
    date: "2026-04-12",
    participant: { role: "PM", segment: "stalled_champion", company_size: "mid_market", tenure_months: 14 },
    task_context: "Talking through her team's structure.",
    summary:
      "Has invited 11 people in 14 months. 3 still active. The other 8 'showed up once and then disappeared'. Sees a pattern but doesn't have a theory.",
    quote: "I keep adding people. They keep leaving.",
    evidence_strength: 4,
    sentiment: "negative",
    topic_tags: ["secondary_user", "expansion_blocked", "adoption"],
    pm_note: "Quantified second-user pattern. ~73% bounce rate of invited users."
  },
  {
    id: "chunk_026",
    source_type: "quote",
    interview_id: "int_12",
    date: "2026-04-12",
    participant: { role: "PM", segment: "stalled_champion", company_size: "mid_market", tenure_months: 14 },
    task_context: "Reflecting on her own role.",
    summary:
      "Says she's become 'the chart lady' — describes a recurring frustration that being good at Brightline has become her informal job.",
    quote: "I didn't sign up to be the chart lady, but here we are.",
    evidence_strength: 4,
    sentiment: "negative",
    topic_tags: ["champion_burnout", "support_tax", "role_strain"],
    pm_note: ""
  },

  // -------- Interview 11: David, PM, churned/downgraded customer (smb, 8 mo) --------
  {
    id: "chunk_027",
    source_type: "desired_outcome",
    interview_id: "int_13",
    date: "2026-04-14",
    participant: { role: "PM", segment: "churned", company_size: "smb", tenure_months: 8 },
    task_context: "I asked specifically: 'would AI insights have made you stay?'",
    summary:
      "Said 'maybe, yeah'. Then immediately said the actual reason they left was budget. Doesn't actually believe AI features would have changed it.",
    quote: "Honestly probably not. We were going to cut it either way.",
    evidence_strength: 2,
    sentiment: "neutral",
    topic_tags: ["ai_insights", "leading_question", "churn_reason"],
    pm_note: "Caught myself in a leading question. He corrected the record himself."
  },
  {
    id: "chunk_028",
    source_type: "pain_observation",
    interview_id: "int_13",
    date: "2026-04-14",
    participant: { role: "PM", segment: "churned", company_size: "smb", tenure_months: 8 },
    task_context: "Asked about pain points before they downgraded.",
    summary:
      "Mobile dashboards 'never worked right' — particularly when sharing with non-technical stakeholders.",
    quote: "I'd send a board member a chart and they'd reply with 'I can't read this on my phone'.",
    evidence_strength: 3,
    sentiment: "negative",
    topic_tags: ["mobile", "stakeholder_user", "churn_factor"],
    pm_note: "Mobile complaint #3. Pattern across 3 interviews. But: all 3 are founder-or-stakeholder use cases."
  },
  {
    id: "chunk_029",
    source_type: "desired_outcome",
    interview_id: "int_13",
    date: "2026-04-14",
    participant: { role: "PM", segment: "churned", company_size: "smb", tenure_months: 8 },
    task_context: "Open-ended on what was missing.",
    summary:
      "Said 'better collaboration' — when pressed, described wanting to leave comments on charts. Doesn't appear to know we shipped that 4 months ago.",
    quote: "I wanted to be able to have conversations on the dashboards.",
    evidence_strength: 3,
    sentiment: "neutral",
    topic_tags: ["features", "feature_awareness", "collaboration"],
    pm_note: ""
  },

  // -------- Interview 12: Sasha, Marketer, secondary teammate @ MidCo2 --------
  {
    id: "chunk_030",
    source_type: "workaround",
    interview_id: "int_14",
    date: "2026-04-15",
    participant: { role: "Marketer", segment: "secondary_teammate", company_size: "mid_market", tenure_months: 14 },
    task_context: "How does she get the marketing metrics she needs?",
    summary:
      "Asks Hana (PM) to send screenshots in Slack every Monday. Hasn't logged into Brightline in 2 months even though she has access.",
    quote: "",
    evidence_strength: 4,
    sentiment: "neutral",
    topic_tags: ["secondary_user", "workaround", "consumption_surface"],
    pm_note: ""
  },
  {
    id: "chunk_031",
    source_type: "pain_observation",
    interview_id: "int_14",
    date: "2026-04-15",
    participant: { role: "Marketer", segment: "secondary_teammate", company_size: "mid_market", tenure_months: 14 },
    task_context: "Asked why she doesn't go in directly.",
    summary:
      "Tried for the first month after being invited. 'Too much terminology, too many menus, didn't know where to start'. Says she's an Excel person and Brightline 'isn't built for me'.",
    quote: "I'm an Excel person. This isn't built for me.",
    evidence_strength: 4,
    sentiment: "negative",
    topic_tags: ["secondary_user", "vocabulary", "marketing_persona"],
    pm_note: ""
  },
  {
    id: "chunk_032",
    source_type: "quote",
    interview_id: "int_14",
    date: "2026-04-15",
    participant: { role: "Marketer", segment: "secondary_teammate", company_size: "mid_market", tenure_months: 14 },
    task_context: "Closing question — what's one word for Brightline.",
    summary: "She said 'Hana's tool'.",
    quote: "Hana's tool.",
    evidence_strength: 5,
    sentiment: "neutral",
    topic_tags: ["secondary_user", "champion_view", "framing"],
    pm_note: "Devastating one-word summary. The product belongs to its champion, not to the team."
  },
];

const SIGNAL_BY_ID = Object.fromEntries(SIGNALS.map((s) => [s.id, s]));

/* -------------------------------------------------------------------------
   2. AGENT SYSTEM PROMPTS — one per agent, strict JSON contracts
   ------------------------------------------------------------------------- */

const PROMPTS = {

  ingestion: `You are the Ingestion Agent for a customer-discovery synthesis pipeline.

You are auditing a coded interview corpus. Each "chunk" represents one moment from one transcript — a coded observation, quote, behavior, or stated desire from a participant.

Your job is to produce a quality report that downstream agents can rely on. Look for:
- Coverage by source_type, segment, and role
- Average evidence_strength (a key signal for the said-vs-did pattern detection later)
- High-evidence chunks (evidence_strength >= 4) — these are load-bearing
- Anomalies that would change how a careful PM reads the rest of the corpus

Discovery-specific anomalies to flag:
- Same interview contains a chunk where the participant said one thing but a behavior_observation chunk shows different behavior
- Source-type imbalance (e.g. mostly told-me evidence, very few showed-me chunks)
- Segments under-represented relative to the research question
- Leading questions detectable from the task_context field (questions that prompt the answer)

Return STRICT JSON ONLY, no preamble, no markdown fences:

{
  "quality_report": {
    "total_chunks": 35,
    "total_interviews": 14,
    "by_source": { "pain_observation": 12, "behavior_observation": 8, "desired_outcome": 8, "workaround": 4, "quote": 3 },
    "by_segment": { "power_user": 8, "stalled_champion": 10, "secondary_teammate": 10, "churned": 7 },
    "by_role": { "PM": 18, "Marketer": 6, "Engineer": 4, "Designer": 3, "Founder": 3, "Analyst": 1 },
    "date_range": { "start": "2026-04-02", "end": "2026-04-15" },
    "avg_evidence_strength": 3.7,
    "high_evidence_count": 22,
    "anomalies": [
      "<short specific string, e.g. 'Interview int_01: chunk_002 stated desire contradicts chunk_003 observed behavior'>"
    ],
    "coverage_notes": "<1-2 sentence read on whether the corpus supports the research question>"
  }
}

Rules:
- All count fields are integers.
- avg_evidence_strength is a float, 1 decimal.
- Do not invent anomalies; flag only what's actually in the data.
- coverage_notes is a single concise paragraph, not a list.`,


  theme: `You are the Theme Agent. Cluster the interview corpus into 3-5 user pain clusters or behavior patterns.

A valid theme has BOTH:
- Evidence from at least 2 segments (power_user, stalled_champion, secondary_teammate, churned)
- At least 4 supporting chunks

Treat all source types as equivalent evidence. Do NOT weight behavior_observation chunks more heavily than pain_observation or desired_outcome chunks at the theme level. The Critic agent will assess told-me vs showed-me balance separately. Your job here is pattern detection, not evidence-quality calibration.

For each theme, assess noise risk: is this an actual cross-segment pattern, or is one vocal cohort (e.g., founders, or one specific persona) driving the apparent pattern? Flag with noise_flag: true if so.

Return STRICT JSON ONLY:

{
  "themes": [
    {
      "id": "theme_01",
      "title": "<8-15 word headline — specific, not generic. 'Secondary users abandon shared dashboards because terminology is opaque' beats 'Onboarding'>",
      "summary": "<2-3 sentences describing the pattern, what it shows about user behavior>",
      "why_it_matters": "<1-2 sentences on the strategic implication for the product team>",
      "evidence": ["chunk_001", "chunk_004", "chunk_009"],
      "source_types": ["pain_observation", "behavior_observation"],
      "segments": ["power_user", "secondary_teammate"],
      "strength": 5,
      "trend": "rising",
      "noise_flag": false,
      "noise_note": ""
    }
  ]
}

Allowed values:
- "strength": integer 1-5 (5 = systemic, multi-segment, behavior-evidenced; 1 = thin)
- "trend": one of "rising" | "falling" | "steady" | "new"
- "source_types" entries: one of "pain_observation" | "behavior_observation" | "desired_outcome" | "workaround" | "quote"
- "segments" entries: one of "power_user" | "stalled_champion" | "secondary_teammate" | "churned"
- "noise_note": empty "" if noise_flag is false; 1-sentence rationale if true
- "evidence": flat array of chunk IDs at the top level of each theme

Order themes by strength, strongest first. Produce one noise-flagged theme if (and only if) the data plausibly supports doing so.`,


  contradiction: `You are the Contradiction Agent. Surface NON-TRIVIAL tensions in the interview corpus that a sharp PM would want flagged before drawing conclusions.

Three contradiction types to look for, in priority order:

TYPE 1 — Said-vs-did (highest priority for discovery work):
A pain_observation or desired_outcome chunk says one thing, but a behavior_observation chunk from the same participant or segment shows something different. Example: power users SAY they need more advanced features, but their observed behavior shows they only use 3-4 features built in their first 90 days.

TYPE 2 — Cross-segment disagreement:
Same product, different segments describe it incompatibly. Example: champions describe the product as "intuitive"; their teammates separately describe it as "confusing and full of jargon." Both are honest — they're different vantage points on the same artifact.

TYPE 3 — Leading-question artifact:
Customer enthusiasm appears strong but is downstream of how the PM framed the question (look at task_context). Compare prompted enthusiasm against unprompted mentions of the same topic.

For each contradiction:
- Both sides must cite specific chunk IDs
- side_a/side_b each have a "label" (short descriptor like "Power users (stated)" / "Power users (observed)" or "Champions" / "Teammates")
- Severity = how much this contradiction would change a product decision (1-5)
- so_what = what a reader should DO with this contradiction (1-2 sentences, concrete)

Produce 2-4 contradictions. Quality over quantity — do not invent tensions that aren't in the evidence.

Return STRICT JSON ONLY:

{
  "contradictions": [
    {
      "id": "contra_01",
      "title": "<10-15 word headline framing the tension>",
      "type": "said_vs_did",
      "side_a": {
        "label": "<short descriptor>",
        "claim": "<1-2 sentences>",
        "evidence": ["chunk_002", "chunk_008"]
      },
      "side_b": {
        "label": "<short descriptor>",
        "claim": "<1-2 sentences>",
        "evidence": ["chunk_003", "chunk_007"]
      },
      "severity": 5,
      "so_what": "<1-2 sentences — what the reader should do with this contradiction>"
    }
  ]
}

Allowed values:
- "type": one of "said_vs_did" | "cross_segment" | "leading_question_artifact"
- "severity": integer 1-5
- "evidence" inside side_a/side_b: flat array of chunk IDs

If you identify a leading-question artifact, your "so_what" should explicitly recommend re-asking the question without the leading frame in a follow-up round.`,


  recommendation: `You are the Recommendation Agent. Produce 4-6 decision-ready recommendations for a product trio (PM, Designer, Engineering Lead) based on the themes and contradictions surfaced upstream.

Every recommendation falls into exactly ONE of three categories:
- "build" — ship something concrete in the product
- "research" — gather more signal before deciding (the answer is "we don't know enough yet")
- "deprioritize" — explicitly stop or scale down a current bet

Aim to use all three categories where the evidence supports it. The "deprioritize" category is the one teams skip when they should not — so consider seriously whether any deprioritize recommendations are warranted by the evidence. But do not force a recommendation into a category just to fill it; if the evidence doesn't support a deprioritize call, don't manufacture one.

For each recommendation:
- Owner is a ROLE in the product trio: PM, Designer, Engineering Lead, Research Lead. Not "the team" — pick one.
- Confidence is 0-1, calibrated: 0.9 = "I'd commit a sprint to this on these grounds"; 0.7 = "worth doing, would be more confident with one more round of evidence"; 0.5 = "suggestion not recommendation."
- Include exactly one hard_call: true — something the team probably doesn't want to hear but the evidence supports.
- Cite both signal IDs (chunk_NNN) AND theme/contradiction IDs the rec draws from.

Return STRICT JSON ONLY. Note the FLAT structure for evidence/links and explicit hard_call boolean:

{
  "recommendations": [
    {
      "id": "rec_01",
      "title": "<8-14 word imperative>",
      "category": "build",
      "what": "<2-4 sentences on the concrete action>",
      "why": "<2-3 sentences drawing on themes/contradictions by id>",
      "risk_if_wrong": "<1-2 sentences>",
      "owner": "PM",
      "horizon": "this sprint",
      "confidence": 0.85,
      "hard_call": false,
      "links_to_themes": ["theme_01"],
      "links_to_contradictions": ["contra_01"],
      "evidence": ["chunk_004", "chunk_014"]
    }
  ]
}

Allowed values:
- "category": one of "build" | "research" | "deprioritize"
- "owner": one of "PM" | "Designer" | "Engineering Lead" | "Research Lead"
- "horizon": one of "this sprint" | "this quarter" | "this half" (with spaces, lowercase)
- "confidence": float 0-1
- "hard_call": boolean — exactly ONE recommendation in the set must have this true
- "evidence", "links_to_themes", "links_to_contradictions": FLAT arrays of strings at top level (NOT nested inside an "evidence" object)

Sort recommendations by decreasing confidence within each category. Output in build → research → deprioritize category order, skipping any category with no recommendations.`,


  critic: `You are the Critic Agent. Stress-test the upstream synthesis. You are the adversarial check on PM optimism and on synthesis tools that confidently turn weak evidence into strong-sounding conclusions.

Run these checks for every theme, contradiction, and recommendation:

DISCOVERY-SPECIFIC STRESS TESTS:
1. Are themes built mostly on told-me evidence (pain_observation, desired_outcome) when showed-me evidence (behavior_observation) is available? If so, flag — those themes are weaker than they look.
2. Are recommendations leaping past what the evidence supports? "Customers want X" claims that rest on prompted desires rather than unprompted needs are suspect.
3. Has the synthesis missed a leading-question artifact? Look for chunks where the task_context describes a leading question.
4. What questions does this round NOT answer that a sharp reader would still need? This becomes the "open questions" output for the memo.

GENERAL CHECKS:
- Themes with thin evidence flagged as strong
- Contradictions where one side is much weaker than framed
- Recommendations whose "why" doesn't actually follow from cited evidence
- Confidence mis-calibration (both over and under)
- Missing context — segment-specific signals over-generalized
- Sample size honesty (a "pattern" of 3 chunks should not be presented as systemic)

For each item, write a SPECIFIC note. "chunk_019 is a single chunk and the theme rests heavily on it" beats "evidence is thin."

Return STRICT JSON ONLY — top-level fields, NO wrapping "critique" key, ID field names are theme_id / contradiction_id / recommendation_id:

{
  "theme_notes": [
    { "theme_id": "theme_01", "note": "<1-2 sentence specific critique>" }
  ],
  "contradiction_notes": [
    { "contradiction_id": "contra_01", "note": "<1-2 sentence specific critique>" }
  ],
  "recommendation_notes": [
    { "recommendation_id": "rec_01", "note": "<1-2 sentence specific critique>" }
  ],
  "overall_confidence": 0.78,
  "caveats": [
    "<short specific caveat>",
    "<another>"
  ],
  "blind_spot": "<2-3 sentences on what the evidence cannot tell us — what's missing from this corpus that a sharp reader would still need to know>",
  "open_questions": [
    "<question this round did not answer that should drive the next research cycle>"
  ]
}

Rules:
- overall_confidence reflects the weakest load-bearing link in the synthesis, not the average
- caveats: 2-4 items
- open_questions: 2-4 items, each phrased as a researchable question for a future round
- blind_spot is a paragraph, not a list`,


  memo: `You are the Memo Agent. Compile a single discovery-synthesis brief from the upstream agent outputs. The audience is a product trio (PM, Designer, Engineering Lead) who will act on this brief in their next planning meeting.

Voice: senior PM writing to peers. Clear, calibrated, opinionated. Cites chunk IDs in square brackets like [evidence: chunk_004, chunk_014]. Names the hard call out loud. Doesn't pretend to certainty it doesn't have.

Structure (markdown, EXACTLY these section headers):

# <Brief title — 6-10 words specific to this round>

## What we learned
<TL;DR — 4-6 sentences. Lead with the single most important read of the round. Name the hard call here, not just in the recommendations section.>

## User pain clusters
<For each theme: open with the theme headline in **bold**, state the pattern, name what makes it strategic, cite evidence. One short paragraph each.>

## Said vs did
<Open with the said-vs-did contradiction (if present), then any cross-segment or leading-question contradictions. For each: bold headline framing the tension, brief description of both sides, specific recommendation for resolution. This section is what makes discovery synthesis valuable — give it weight.>

## What to build, research, deprioritize
<Group recommendations under three subheadings (### Build / ### Research more / ### Deprioritize). For each rec: headline with owner and horizon and confidence in parentheses; then short bullet sub-points for What / Why / Risk if wrong. Mark the hard call clearly.>

## Caveats & open questions
<Bulleted: caveats from the critic; the blind spot called out with **Blind spot:** prefix; the open questions for next research round called out with **For next round:** prefix.>

Rules:
- 700-1000 words total
- Every factual claim ties to at least one chunk ID
- Output the markdown only — no preamble, no fences, nothing after the final section
- Use **bold** for theme headlines and key framings; use _italic_ very sparingly`,

};

/* -------------------------------------------------------------------------
   3. DEMO-MODE OUTPUTS — hand-curated gold-run for the Brightline corpus
   These play back instantly without an API call. They are also the
   calibration target for live runs against claude-opus-4-7.
   ------------------------------------------------------------------------- */

const DEMO_OUTPUTS = {

  // -----------------------------------------------------------------------
  // INGESTION — quality_report wrapper, matches PROMPTS.ingestion schema
  // -----------------------------------------------------------------------
  ingestion: {
    quality_report: {
      total_chunks: 35,
      total_interviews: 14,
      by_source: {
        pain_observation: 12,
        desired_outcome: 8,
        behavior_observation: 8,
        workaround: 4,
        quote: 3,
      },
      by_segment: {
        stalled_champion: 10,
        secondary_teammate: 10,
        power_user: 8,
        churned: 7,
      },
      by_role: {
        PM: 18,
        Marketer: 6,
        Engineer: 4,
        Designer: 3,
        Founder: 3,
        Analyst: 1,
      },
      date_range: { start: "2026-04-02", end: "2026-04-15" },
      avg_evidence_strength: 3.7,
      high_evidence_count: 22,
      anomalies: [
        "Interview int_01 (Sarah, power user): chunk_002 stated desire for 'more advanced segmentation' contradicts chunk_003 observed behavior (hasn't used segmentation builder since onboarding). High-confidence said-vs-did marker.",
        "Interview int_07 (Diego, stalled champion): chunk_011 calls Brightline 'way more intuitive'; chunk_012 same person describes giving up on inviting teammates. Tension worth flagging.",
        "Three chunks (013, 021, 027) explicitly note PM-asked leading questions about AI. Same topic appears unprompted only in chunks 033, 034, 035 — and those describe substitution behavior, not desire for Brightline-native AI. Important asymmetry.",
        "Source type imbalance: 12 pain_observation (told-me) vs 8 behavior_observation (showed-me) — corpus is healthy but skewed toward reported pain over observed pain. Critic should weight accordingly.",
      ],
      coverage_notes:
        "Strong cross-segment coverage — all four expansion-relevant segments well-represented with multiple chunks each. Marketers under-sampled relative to their importance in the second-user pattern (only 6 chunks across 2 interviews). Worth fielding 2-3 additional marketer interviews in next round.",
    },
  },

  // -----------------------------------------------------------------------
  // THEMES — 5 themes, ordered by strength (5,4,4,4,2)
  // -----------------------------------------------------------------------
  themes: {
    themes: [
      {
        id: "theme_01",
        title: "Secondary teammates can't onboard themselves into shared dashboards",
        summary:
          "Across 9 chunks spanning all four segments, the same pattern emerges: power users invite teammates to dashboards, teammates either never log in or use it once and bounce. The mechanism is consistent — dashboards are built for the inviter's mental model, terminology assumes Brightline-native vocabulary, and there's no orientation for new viewers. Receivers don't ask for help; they quietly stop.",
        why_it_matters:
          "This is the proximate cause of the expansion plateau. Champions can't grow seat counts because new seats don't stick. The 'Hana's tool' framing (chunk_032) — a one-word summary from a teammate who has access but hasn't logged in for 2 months — captures the failure cleanly: the product belongs to its champion, not to the team.",
        evidence: ["chunk_001", "chunk_004", "chunk_009", "chunk_012", "chunk_016", "chunk_019", "chunk_022", "chunk_025", "chunk_030"],
        source_types: ["pain_observation", "behavior_observation", "desired_outcome", "workaround", "quote"],
        segments: ["power_user", "stalled_champion", "secondary_teammate", "churned"],
        strength: 5,
        trend: "rising",
        noise_flag: false,
        noise_note: "",
      },
      {
        id: "theme_02",
        title: "Power users plateaued in their first 90 days and haven't deepened since",
        summary:
          "Five chunks, four of them behavior_observation: power users with 9-30 month tenure are using the same 3-5 dashboards they built in their first quarter. They haven't tried the segmentation builder, funnel comparisons, annotations, or other features shipped in the last 6 months. When asked what they want, they describe missing capabilities — but observed behavior shows they're not exploring what's already there.",
        why_it_matters:
          "Pricing tiers are predicated on usage depth — advanced features unlock higher tiers. If power users plateau, ARPU stays flat and the upgrade path doesn't activate. Combined with theme 5 below, this also raises the question of whether Brightline's interpretation layer is being substituted by AI tools.",
        evidence: ["chunk_003", "chunk_007", "chunk_010", "chunk_018", "chunk_024"],
        source_types: ["behavior_observation"],
        segments: ["power_user", "stalled_champion"],
        strength: 4,
        trend: "steady",
        noise_flag: false,
        noise_note: "",
      },
      {
        id: "theme_03",
        title: "Champions have become the help desk and stopped creating",
        summary:
          "Five chunks describe the same arc: a champion advocates internally, builds dashboards, gets adoption-by-association — then becomes the team's de facto support function. Every dashboard they create generates 'how do I read this' questions. Eventually they stop creating dashboards proactively. Two memorable framings: 'the chart lady' (chunk_026) and 'every chart I build is a meeting I have to take' (chunk_005). Quantified: chunk_017 describes seat count going 8→6 because the champion didn't push to backfill the loss.",
        why_it_matters:
          "This is theme 1 from the champion's vantage point. Together they describe a self-reinforcing failure: champions stop creating because creating is taxed; teammates stop using because content stops being created. The expansion ceiling is a relational dynamic, not a feature gap.",
        evidence: ["chunk_005", "chunk_011", "chunk_017", "chunk_026", "chunk_031"],
        source_types: ["pain_observation", "quote"],
        segments: ["stalled_champion", "secondary_teammate"],
        strength: 4,
        trend: "rising",
        noise_flag: false,
        noise_note: "",
      },
      {
        id: "theme_05",
        title: "AI-native tools are eating specific use cases — interpretation has left the platform",
        summary:
          "Three chunks describe an emerging pattern that doesn't appear in any prior Brightline research: customers are routing specific analytical work around Brightline to AI-native tools. Ravi (long-tenure enterprise champion) pastes Brightline screenshots into Claude 2-3x weekly to ask 'what's interesting here' (chunk_033). Sarah expensed Hex Pro for one cohort×billing analysis last month — quote: 'It paid for itself in an afternoon' (chunk_034). Wei adopted Inflexion two months *before* downgrading Brightline (chunk_035). The temporal sequence in Wei's case rules out post-hoc rationalization — substitution preceded the downgrade.",
        why_it_matters:
          "The most strategically loaded theme in the round and the newest. It complements theme 2: power users may not be plateauing because they're satisfied — they may be plateauing because the thinking layer of their analytics work has migrated to AI tools, leaving Brightline as a system of record. If that's the right read, the expansion question and the AI question are the same question.",
        evidence: ["chunk_033", "chunk_034", "chunk_035"],
        source_types: ["workaround", "behavior_observation"],
        segments: ["power_user", "stalled_champion", "churned"],
        strength: 4,
        trend: "new",
        noise_flag: false,
        noise_note: "",
      },
      {
        id: "theme_04",
        title: "Mobile experience friction (narrow — founder/exec persona only)",
        summary:
          "Three chunks complain about mobile experience. Looks like a theme by count — but examining the evidence shows all three complaints come from a specific persona: founders or executive stakeholders who want to glance at metrics on the go. Power users (PMs, analysts) work on desktop and don't surface mobile complaints.",
        why_it_matters:
          "Treating this as a real expansion theme would misallocate roadmap capacity. The signal is real but narrow — it's a niche segment requirement, not a broad pattern. Watch for whether this expands beyond the founder-stakeholder cohort in future rounds.",
        evidence: ["chunk_006", "chunk_020", "chunk_028"],
        source_types: ["pain_observation"],
        segments: ["power_user", "churned"],
        strength: 2,
        trend: "steady",
        noise_flag: true,
        noise_note:
          "All three mobile complaints are from founders or marketers reporting executive complaints. PMs and analysts in the corpus do not raise mobile as an issue; they work on desktop. High visibility ≠ broad strategic weight.",
      },
    ],
  },

  // -----------------------------------------------------------------------
  // CONTRADICTIONS — 3 contradictions, ordered by severity
  // -----------------------------------------------------------------------
  contradictions: {
    contradictions: [
      {
        id: "contra_01",
        title: "Power users say they're missing features. Their behavior shows stable workflows from months 1-3.",
        type: "said_vs_did",
        side_a: {
          label: "Power users (stated)",
          claim:
            "Missing advanced segmentation, cohort comparisons, AI insights. Quote from chunk_002: 'I just feel like I'm always hitting the limits.'",
          evidence: ["chunk_002", "chunk_008", "chunk_015", "chunk_023", "chunk_029"],
        },
        side_b: {
          label: "Power users (observed)",
          claim:
            "Stable workflows built in their first 90 days. Have not used segmentation builder (chunk_003), annotations shipped 6 months ago (chunk_007), funnel comparisons shipped Feb. chunk_029 wants commenting — doesn't know we shipped it 4 months ago.",
          evidence: ["chunk_003", "chunk_007", "chunk_010", "chunk_018", "chunk_024"],
        },
        severity: 5,
        so_what:
          "Don't build features against the stated request. The stated desires are aspirational gloss; the real expansion blocker is that power users have stopped exploring the product. Before shipping segmentation v2, run a feature-discovery study (REC 3) — do power users not use existing features because the features are insufficient, or because they're undiscoverable? The answer routes the next quarter.",
      },
      {
        id: "contra_02",
        title: "Champions describe Brightline as 'intuitive'; their teammates describe it as full of jargon they never learned",
        type: "cross_segment",
        side_a: {
          label: "Champions",
          claim:
            "Describe Brightline as 'way more intuitive than [old tool]' (chunk_011). Recommend it confidently. Have been the internal advocate.",
          evidence: ["chunk_011", "chunk_017", "chunk_026"],
        },
        side_b: {
          label: "Teammates (secondary users)",
          claim:
            "'It's like everyone here speaks a language I never learned' (chunk_015). 'I'm an Excel person. This isn't built for me' (chunk_031). 'Hana's tool' (chunk_032). Cannot self-onboard, abandon after first session.",
          evidence: ["chunk_004", "chunk_015", "chunk_031", "chunk_032"],
        },
        severity: 4,
        so_what:
          "Both sides are reporting honestly. Champions experienced the learning curve over months and have forgotten what it cost. Teammates hit the same curve cold and don't have the runway. The fix is not 'make the product easier in general' (champions don't need that) but 'make first-session-as-receiver radically different from first-session-as-creator' — see REC 1.",
      },
      {
        id: "contra_03",
        title: "AI insights showed up in answers — but only when prompted. Unprompted, AI appears as substitution.",
        type: "leading_question_artifact",
        side_a: {
          label: "Prompted enthusiasm",
          claim:
            "Chunks 013, 021, 027 are all responses to leading questions ('would AI insights help?'). All three customers said yes. Read flat, this looks like demand for Brightline-native AI features.",
          evidence: ["chunk_013", "chunk_021", "chunk_027"],
        },
        side_b: {
          label: "Unprompted reality",
          claim:
            "AI never appears as a desired feature in unprompted responses. Where it appears unprompted (chunks 033, 034, 035), it's substitution — customers describing tools they're already using instead of Brightline. Two prompted-enthusiasm customers walked back their answer when given space (chunk_027: 'honestly probably not'; chunk_021: their team had already adopted the competitor for the AI use case).",
          evidence: ["chunk_033", "chunk_034", "chunk_035", "chunk_027", "chunk_021"],
        },
        severity: 3,
        so_what:
          "This is a methodology flag, not a product flag. Re-ask the AI questions in the next round without the leading frame — for example, 'tell me about the last analysis you did that you wished was easier.' This contradiction does not dismiss the AI question — Theme 5 settles that AI matters strategically. The contradiction is specifically about how the questions were asked, and feeds into REC 4's research scope.",
      },
    ],
  },

  // -----------------------------------------------------------------------
  // RECOMMENDATIONS — 5 recs, ordered build → research → deprioritize,
  // decreasing confidence within each category. Exactly one hard_call.
  // -----------------------------------------------------------------------
  recommendations: {
    recommendations: [
      {
        id: "rec_01",
        title: "Redesign first-session-as-receiver as a distinct flow from first-session-as-creator",
        category: "build",
        what:
          "Ship a guided walk-through that fires when a user opens a dashboard for the first time as a viewer (not a creator). Inline definitions of every term used in the dashboard the first time it's encountered. A 'what is this number, in plain English' tooltip on every chart. Persists in lightweight form for the first several viewing sessions, then fades.",
        why:
          "Theme 1 (second-user problem) and Contradiction 2 (champions vs teammates) both point here. Teammates fail their first session because the creator's mental model is invisible to them. Chunk_016 explicitly requested this: 'If I open a dashboard I just want it to walk me through what I'm looking at.' Chunk_014 demonstrated the failure mode (designer searched 'design metrics' — no results, gave up). The fix is mechanically clear and the evidence is unusually concrete.",
        risk_if_wrong:
          "Low. The investment is bounded (~1 quarter), the failure mode is 'users find it patronizing' (mitigatable by allowing dismissal), and the alternative is continued silent abandonment.",
        owner: "Designer",
        horizon: "this quarter",
        confidence: 0.88,
        hard_call: false,
        links_to_themes: ["theme_01"],
        links_to_contradictions: ["contra_02"],
        evidence: ["chunk_004", "chunk_014", "chunk_015", "chunk_016", "chunk_022", "chunk_031"],
      },
      {
        id: "rec_02",
        title: "Add a no-Slack handoff path: dashboards that explain themselves when shared",
        category: "build",
        what:
          "Make sharing a dashboard generate an automatic plain-English summary: what's in it, why the creator built it, what the receiver should pay attention to. Editable by the creator before sending. Surfaces inline when the receiver opens the link.",
        why:
          "Theme 3 (champion burnout) is the case. Champions stop creating because every dashboard creates support load. The mechanism is clear: receivers can't self-orient, they ask the creator, the creator becomes the bottleneck. If the dashboard self-explains, the support tax drops and creators resume creating. Chunk_005 ('every chart I build is a meeting I have to take') and chunk_017 ('not worth the support work to grow the team on it') name the cost in the champion's own words.",
        risk_if_wrong:
          "Medium. The auto-summary needs to be good enough that creators trust it. A lukewarm summary that creators won't ship is worse than no summary at all.",
        owner: "PM",
        horizon: "this quarter",
        confidence: 0.78,
        hard_call: false,
        links_to_themes: ["theme_03"],
        links_to_contradictions: [],
        evidence: ["chunk_005", "chunk_017", "chunk_026"],
      },
      {
        id: "rec_04",
        title: "Field a focused round on the shape of the AI bet — not whether, but which form",
        category: "research",
        what:
          "Two parallel research tracks, four-week stretch target. Track A: 6-8 customer interviews specifically probing how analytical work is being divided between Brightline and AI-native tools, with explicit attention to which use cases have already migrated and which are still in play. Track B: a focused competitive teardown of Inflexion, Hex's AI features, and one or two more, oriented around which specific use cases are being unbundled. Decision the round needs to answer: not whether to invest in AI capabilities (the substitution evidence makes that obvious), but which form the investment should take — Brightline-native AI insights, AI workflow integrations that pipe to/from tools customers already use, or a more fundamental AI-native rebuild of the product surface.",
        why:
          "Theme 5 is the most strategically loaded finding in the round and it's based on three chunks. The temporal evidence in chunk_035 (Inflexion adopted before downgrade) makes it impossible to dismiss as aspirational — substitution is happening now, not coming. Three chunks is enough to commit to researching the shape but not enough to commit a quarter of roadmap to a specific form. The four-week investment in answering the shape question is small relative to the cost of building the wrong AI feature and watching customers continue to use Inflexion for the same use case anyway.",
        risk_if_wrong:
          "Four-week delay on the AI build commitment. Mitigatable: team can run the research in parallel with foundational AI infrastructure work (data plumbing, model integration baseline) that any of the three forms would need.",
        owner: "PM",
        horizon: "this quarter",
        confidence: 0.88,
        hard_call: false,
        links_to_themes: ["theme_05", "theme_02"],
        links_to_contradictions: ["contra_03"],
        evidence: ["chunk_033", "chunk_034", "chunk_035", "chunk_013", "chunk_021", "chunk_027"],
      },
      {
        id: "rec_03",
        title: "Run a feature-discoverability study before shipping any new analytical features",
        category: "research",
        what:
          "A short structured study (8-10 sessions, 2 weeks). Show power users a list of features shipped in the last 12 months. For each one they don't recognize, probe: never noticed, noticed but not relevant, noticed but couldn't figure out the entry point. Compare results across power users at different tenure cohorts.",
        why:
          "Contradiction 1 (said vs did) makes the case. Power users describe missing features; behavior shows unused existing features. Before deciding whether to build segmentation v2, we have to know which side of 'feature gap vs feature discoverability' we're on. The cost of getting this wrong is one full quarter of engineering pointed at the wrong problem.",
        risk_if_wrong:
          "Two-week delay on a roadmap decision. Cheap.",
        owner: "Research Lead",
        horizon: "this sprint",
        confidence: 0.85,
        hard_call: false,
        links_to_themes: ["theme_02"],
        links_to_contradictions: ["contra_01"],
        evidence: ["chunk_002", "chunk_003", "chunk_007", "chunk_008", "chunk_010", "chunk_018", "chunk_029"],
      },
      {
        id: "rec_05",
        title: "Pull mobile improvements off the active roadmap until evidence broadens beyond founder/exec personas",
        category: "deprioritize",
        what:
          "Explicitly remove mobile-experience improvements from active Q3 roadmap consideration. Communicate the deprioritization in this week's planning so designers and engineers stop scoping mobile fixes that won't ship. Add a specific evidence trigger for revisiting the call: if mobile complaints appear in the next round from non-founder/non-exec personas (PMs, analysts, marketers using mobile in their actual workflows), reopen.",
        why:
          "This is the hard call because mobile complaints are the most viscerally relatable kind of feedback — every team member has had a bad mobile experience with a tool — and the three chunks (006, 020, 028) feel emotionally heavy. But the evidence is unambiguously narrow: every complaint comes from a founder or executive stakeholder reporting on-the-go usage. Power users (PMs, analysts) work on desktop and don't surface mobile as friction. Building mobile improvements against this signal means optimizing for a narrow persona while the broader expansion blockers (themes 1, 2, 3, 5) sit unaddressed. This is a deprioritize call rather than a kill call: founder/exec usage does matter for retention at the account level even when narrow. We're not declaring mobile irrelevant; we're declaring that current evidence doesn't justify roadmap capacity, and we're naming the trigger that would change that.",
        risk_if_wrong:
          "If the mobile pattern is actually a leading indicator that broadens to power users in the next 1-2 quarters, we lose 3-6 months on starting mobile work. Mitigatable: the next discovery round is scoped to surface this if it's real, and the trigger is specific.",
        owner: "PM",
        horizon: "this quarter",
        confidence: 0.82,
        hard_call: true,
        links_to_themes: ["theme_04"],
        links_to_contradictions: [],
        evidence: ["chunk_006", "chunk_020", "chunk_028"],
      },
    ],
  },

  // -----------------------------------------------------------------------
  // CRITIC — flat top-level fields (no wrapping "critique" key)
  // -----------------------------------------------------------------------
  critique: {
    theme_notes: [
      { theme_id: "theme_01", note: "Strongest theme in the corpus. 9 chunks, all four segments, behavior_observation evidence in 4 of 9 chunks. Confidence justified." },
      { theme_id: "theme_02", note: "5 chunks, 4 of them behavior_observation — strongly evidenced for what it claims. Watch that 'stable workflow' doesn't get conflated with 'satisfied user'; theme 5 may explain the mechanism." },
      { theme_id: "theme_03", note: "5 chunks, mostly told-me. Two memorable quotes carry interpretive weight — make sure that interpretation isn't going further than the evidence supports." },
      { theme_id: "theme_05", note: "3 chunks. The temporal evidence in chunk_035 is doing heavy lifting. Strength 4 is on the high end for 3 chunks — defensible because of evidence quality and strategic novelty, but a sharp reader could reasonably argue strength 3." },
      { theme_id: "theme_04", note: "Noise flag is correct. 3 chunks, all founder-or-stakeholder personas. Should not drive roadmap decisions in current shape. Source-type imbalance check: this theme is 100% pain_observation (told-me only) — another reason not to elevate it." },
    ],
    contradiction_notes: [
      { contradiction_id: "contra_01", note: "Cleanest said-vs-did contradiction in the corpus. Both sides solidly evidenced from same participants. Highest-leverage contradiction to act on." },
      { contradiction_id: "contra_02", note: "Real and well-evidenced, but lower severity than framed in the so_what — both sides are honest. Severity 4 may be high; severity 3 might fit better." },
      { contradiction_id: "contra_03", note: "The leading-question framing is the right call and feeds correctly into REC 4's research scope. Watch that the contradiction note doesn't dismiss the AI question entirely — the methodology problem is with how the questions were asked, not with whether AI matters strategically (Theme 5 settles that)." },
    ],
    recommendation_notes: [
      { recommendation_id: "rec_01", note: "Highest-confidence rec, evidence concentrated. Designer ownership is right. Minor: the 'first several viewing sessions' duration is a guess; spec should leave that as a measurement, not a constant." },
      { recommendation_id: "rec_02", note: "Owner choice (PM) is right because this requires product judgment about what to auto-include in summaries; risk_if_wrong is honest." },
      { recommendation_id: "rec_03", note: "Sprint-horizon for a research recommendation is realistic only if the team has interview-fielding capacity. Confirm before committing." },
      { recommendation_id: "rec_04", note: "The most expensive rec (combining customer research and competitive teardown) and the most strategically loaded. The 4-week stretch goal is aggressive — if interview scheduling slips, this becomes 6 weeks. Worth it given what it routes. Confidence 0.88 is calibrated to evidence + strategic stakes; defensible." },
      { recommendation_id: "rec_05", note: "This is the hard call and it's correctly framed. Confidence 0.82 reflects honest uncertainty — mobile might broaden to power users, and we'd want to catch that early if so. The named evidence trigger ('non-founder/exec personas in next round') is the right way to keep the deprioritization revisitable rather than permanent." },
    ],
    overall_confidence: 0.78,
    caveats: [
      "Single discovery round — no longitudinal evidence, no comparison to prior rounds.",
      "Marketer segment is under-sampled (6 chunks across 2 interviews). Theme 1's marketing angle (chunks 022, 031, 035) deserves a dedicated round before treating 'marketing-persona problem' as fully understood.",
      "Source-type imbalance (12 told-me vs 8 showed-me) means several themes lean on stated reports more than observed behavior. Theme 3 in particular.",
      "No usage-telemetry or product-analytics data was used as part of this round — interviews only. Cross-referencing claims against telemetry would strengthen most themes meaningfully.",
    ],
    blind_spot:
      "This round did not investigate willingness-to-pay or contract-renewal dynamics. We've described why customers aren't expanding, but not whether that translates to churn risk on the renewal date or just a flat-but-loyal account. The expansion-plateau question and the renewal-risk question are distinct, and the latter has different roadmap implications.",
    open_questions: [
      "Is the 'AI substitution' pattern specific to certain use cases (cohort analysis, marketing analytics) or general? Answers whether to build defensively or accept structural unbundling.",
      "What does usage telemetry show about feature adoption rates? Pairs with REC 3 to settle the discoverability vs feature-gap question.",
      "Are customers who plateau deepening eventually (slow ramp) or permanently stuck (true plateau)? The mechanism matters for whether to invest in unblocking depth or accept the pattern.",
      "Does the second-user problem look different for customers who came in via marketing-led vs PM-led adoption? The GTM implications diverge.",
    ],
  },

  // -----------------------------------------------------------------------
  // MEMO — markdown string, ~900 words, follows memo prompt structure
  // -----------------------------------------------------------------------
  memo: `# What's Blocking Brightline's Expansion — And What to Do About It

## What we learned

The expansion plateau is not a feature gap. It's a **second-user problem**: power users invite teammates to dashboards, and most of those teammates quietly bounce because they can't self-orient — the creator's mental model is invisible, the terminology is opaque, and there's no path to learn it without leaning on the champion. Champions, in turn, have stopped creating because every dashboard generates a support tax. The expansion ceiling is a relational dynamic, not a missing feature. Separately and importantly, AI-native tools are already eating specific analytical use cases — three customers in this round described routing analytical work *around* Brightline to Claude, Hex, or Inflexion, with one churn case where the AI substitution preceded the downgrade by two months. The hard call this round is to **deprioritize mobile improvements** — the only mobile complaints come from founders and execs, and the broader expansion blockers deserve the capacity instead.

## User pain clusters

**Secondary teammates can't onboard themselves into shared dashboards.** Nine chunks across all four segments. Power users invite, teammates either never log in or use it once and bounce. The most damning evidence is one teammate's one-word answer when asked to describe Brightline: "Hana's tool." [evidence: chunk_004, chunk_014, chunk_015, chunk_016, chunk_022, chunk_032]

**Power users plateaued in their first 90 days and haven't deepened since.** Five chunks, four of them observed-behavior. Long-tenure users are using the same 3-5 dashboards they built in their first quarter — they haven't tried features shipped in the last six months. Pricing tiers depend on usage depth, so this caps ARPU. [evidence: chunk_003, chunk_007, chunk_010, chunk_018, chunk_024]

**Champions have become the help desk and stopped creating.** Every dashboard a champion creates generates "how do I read this" questions. Eventually they stop creating. Memorable phrasing: "every chart I build is a meeting I have to take" and "the chart lady." Quantified by chunk_017 — seat count went 8→6 because the champion didn't push to backfill. [evidence: chunk_005, chunk_011, chunk_017, chunk_026, chunk_031]

**AI-native tools are eating specific use cases — interpretation has left the platform.** Newest theme. Three chunks describe substitution behavior already underway: dumping screenshots into Claude, expensing Hex Pro for one-off deep dives, and adopting Inflexion *before* downgrading. The temporal evidence in chunk_035 makes this impossible to dismiss. [evidence: chunk_033, chunk_034, chunk_035]

**Mobile experience friction (narrow — noise-flagged).** Three chunks complain about mobile, all from founders or executive stakeholders. Power users work on desktop and do not surface mobile as friction. Real signal but narrow — see the deprioritize recommendation. [evidence: chunk_006, chunk_020, chunk_028]

## Said vs did

**Power users say they need more features. Their behavior shows stable workflows from their first 90 days.** Five chunks of stated desires for advanced segmentation, cohort comparisons, AI insights — paired with five behavior_observation chunks showing untouched segmentation builders, unused annotations, and unaware-of-shipped commenting. The strongest contradiction in the corpus. _Don't build features against the stated request_ until we know whether the gap is feature-insufficiency or feature-undiscoverability. [evidence: chunk_002 vs chunk_003; chunk_008 vs chunk_007; chunk_029 vs chunk_018]

**Champions say Brightline is "intuitive"; their teammates say it's full of jargon they never learned.** Both sides are reporting honestly. Champions have forgotten what the learning curve cost. Teammates hit it cold. The fix is not "make the product easier in general" — it's making first-session-as-receiver radically different from first-session-as-creator. [evidence: chunk_011 vs chunk_015, chunk_031, chunk_032]

**AI insights showed up in answers — but only when prompted.** Three customers said yes to leading questions about AI; two walked back the answer when given space. Where AI appears unprompted, it's substitution behavior, not Brightline-native demand. This is a methodology flag, not a product flag. The signal that *does* matter is in Theme 5 — substitution is happening. [evidence: chunk_013, chunk_021, chunk_027 vs chunk_033, chunk_034, chunk_035]

## What to build, research, deprioritize

### Build

1. **Redesign first-session-as-receiver as a distinct flow** (Designer, this quarter, conf 0.88) — Guided walk-through for first-time viewers, plain-English tooltips on every chart, persists for first several sessions then fades. _Why:_ proximate fix for the second-user problem; _Risk if wrong:_ low — bounded investment, dismissable.

2. **Dashboards that explain themselves when shared** (PM, this quarter, conf 0.78) — Auto-generated plain-English summary on share, editable before send. _Why:_ breaks the champion-as-help-desk loop; _Risk if wrong:_ medium — auto-summary quality has to be good enough that creators trust it.

### Research more

3. **Run a feature-discoverability study** (Research Lead, this sprint, conf 0.85) — 8-10 sessions probing why power users don't use shipped features. _Why:_ settles the said-vs-did question before we commit a quarter to segmentation v2; _Risk if wrong:_ two-week delay, cheap.

4. **Field a focused round on the *shape* of the AI bet** (PM, this quarter, 4-week stretch, conf 0.88) — 6-8 customer interviews + competitive teardown. Decision the round needs to answer: not whether to invest in AI (substitution evidence makes that obvious), but which form — Brightline-native AI insights, AI workflow integrations, or a more fundamental AI-native rebuild. _Risk if wrong:_ four weeks; team can run foundational AI infrastructure work in parallel.

### Deprioritize

5. **Pull mobile improvements off the active roadmap** (PM, this quarter, conf 0.82) **— HARD CALL.** Trigger to revisit: mobile complaints from non-founder/non-exec personas in next round. _Why:_ every mobile complaint is from a founder or exec; broader expansion blockers deserve the capacity. Not a kill — a deprioritization with a specific reopen trigger. _Risk if wrong:_ if mobile broadens beyond founders, we lose 3-6 months on starting work.

## Caveats & open questions

- Single discovery round — no longitudinal baseline; rising/falling labels are inferred.
- Marketer segment under-sampled (6 chunks across 2 interviews); the marketing angle on Theme 1 deserves a dedicated round.
- Source-type imbalance: 12 told-me vs 8 showed-me. Theme 3 in particular leans on stated reports.
- No telemetry data used; cross-referencing claims against usage data would strengthen most themes.
- **Blind spot:** This round did not investigate willingness-to-pay or renewal dynamics. We've described why customers don't expand, not whether they're at renewal risk. Different mechanism, different roadmap implications.
- **For next round:** (1) is AI substitution pattern-specific or general; (2) what telemetry shows about feature adoption; (3) do plateaued users eventually deepen or permanently stick; (4) does the second-user problem look different in marketing-led vs PM-led accounts.

— Matt P., Senior PM, Growth · Brightline · April 2026`,
};

/* -------------------------------------------------------------------------
   5. UTILITIES — API transport + JSON extraction
   ------------------------------------------------------------------------- */

// Robust JSON extraction. LLMs sometimes wrap JSON in fences or add a
// preamble despite instructions. We strip fences first, then try the
// whole string, then fall back to the first { ... last } or [ ... ]
// balanced slice.
//
// On failure, we attach a ~500-char excerpt of the raw input to the
// thrown error. This is essential for debugging live calls — without
// the raw output you're guessing at what the model actually returned.
function extractJSON(text) {
  if (!text || typeof text !== "string") {
    throw new Error("extractJSON: empty or non-string input");
  }

  // Strip markdown code fences
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  cleaned = cleaned.trim();

  // Helper to produce a diagnostic excerpt on any failure path
  const excerpt = () => {
    const head = text.slice(0, 200);
    const tail = text.length > 400 ? text.slice(-200) : "";
    return tail
      ? ` [head: ${JSON.stringify(head)} … tail: ${JSON.stringify(tail)}]`
      : ` [raw: ${JSON.stringify(head)}]`;
  };

  // First attempt: parse whole thing
  try {
    return JSON.parse(cleaned);
  } catch (_) { /* continue */ }

  // Find first JSON structure — whichever of { or [ comes first
  const firstObj = cleaned.indexOf("{");
  const firstArr = cleaned.indexOf("[");
  let start = -1;
  let openCh = "";
  let closeCh = "";
  if (firstObj === -1 && firstArr === -1) {
    throw new Error("extractJSON: no JSON structure found." + excerpt());
  }
  if (firstObj === -1 || (firstArr !== -1 && firstArr < firstObj)) {
    start = firstArr;
    openCh = "[";
    closeCh = "]";
  } else {
    start = firstObj;
    openCh = "{";
    closeCh = "}";
  }

  // Walk the string tracking depth, respecting strings & escapes, to
  // find the matching close bracket.
  let depth = 0;
  let inStr = false;
  let esc = false;
  let end = -1;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (ch === "\\") { esc = true; continue; }
      if (ch === '"') { inStr = false; }
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === openCh) depth++;
    else if (ch === closeCh) {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end === -1) {
    throw new Error(
      "extractJSON: unbalanced JSON structure — response likely truncated by max_tokens." +
      excerpt()
    );
  }

  const slice = cleaned.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch (e) {
    throw new Error(`extractJSON: slice failed to parse (${e.message}).` + excerpt());
  }
}

// Fetch wrapper for the Anthropic API. Posts to the same-origin proxy
// which adds the API key server-side (see functions/api/claude.js).
//
// Surfaces upstream errors verbatim and detects max_tokens truncation
// explicitly — if stop_reason is "max_tokens", the response is cut off
// mid-generation and any JSON it contains is guaranteed invalid.
async function callClaude(system, user, maxTokens = 4000) {
  const response = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`API ${response.status}: ${body.slice(0, 500)}`);
  }
  const data = await response.json();

  // Concatenate text blocks (Opus 4.7 streams thinking blocks too; we
  // only want text content).
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  // Explicit truncation detection — `stop_reason: "max_tokens"` means
  // the model ran out of output budget mid-response. The resulting
  // text is guaranteed to be malformed JSON or truncated markdown.
  // Log to console so the browser devtools show the partial output
  // alongside our user-facing error.
  if (data.stop_reason === "max_tokens") {
    // eslint-disable-next-line no-console
    console.warn("[callClaude] Response truncated at max_tokens =", maxTokens,
      "· output usage:", data.usage,
      "· last 400 chars:", text.slice(-400));
    throw new Error(
      `Response truncated — max_tokens (${maxTokens}) was insufficient. ` +
      `Raise the agent's max_tokens value. Model: ${MODEL}. ` +
      `Output tokens used: ${data.usage?.output_tokens ?? "unknown"}.`
    );
  }

  return { text, usage: data.usage || null, stop_reason: data.stop_reason };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* -------------------------------------------------------------------------
   6. AGENT WRAPPERS
   Each agent: composes its user prompt from upstream state, calls Claude,
   parses JSON. Demo mode short-circuits to DEMO_OUTPUTS with a sleep to
   preserve the sense of work being done.
   ------------------------------------------------------------------------- */

async function runIngestion(signals, mode) {
  if (mode === "demo") { await sleep(700); return DEMO_OUTPUTS.ingestion; }
  const user = `Here are the coded interview chunks to audit:\n\n${JSON.stringify(signals, null, 2)}\n\nReturn the JSON object specified in your instructions.`;
  const { text } = await callClaude(PROMPTS.ingestion, user, 4000);
  return extractJSON(text);
}

async function runThemes(signals, ingestion, mode) {
  if (mode === "demo") { await sleep(1100); return DEMO_OUTPUTS.themes; }
  const user = `Ingestion report:\n${JSON.stringify(ingestion, null, 2)}\n\nSignals:\n${JSON.stringify(signals, null, 2)}\n\nReturn the JSON object specified in your instructions.`;
  const { text } = await callClaude(PROMPTS.theme, user, 6000);
  return extractJSON(text);
}

async function runContradictions(signals, themes, mode) {
  if (mode === "demo") { await sleep(900); return DEMO_OUTPUTS.contradictions; }
  const user = `Themes identified:\n${JSON.stringify(themes, null, 2)}\n\nSignals:\n${JSON.stringify(signals, null, 2)}\n\nReturn the JSON object specified in your instructions.`;
  const { text } = await callClaude(PROMPTS.contradiction, user, 5000);
  return extractJSON(text);
}

async function runRecommendations(signals, themes, contradictions, mode) {
  if (mode === "demo") { await sleep(1000); return DEMO_OUTPUTS.recommendations; }
  const user = `Themes:\n${JSON.stringify(themes, null, 2)}\n\nContradictions:\n${JSON.stringify(contradictions, null, 2)}\n\nProduct context:\n${JSON.stringify(PRODUCT, null, 2)}\n\nReturn the JSON object specified in your instructions.`;
  const { text } = await callClaude(PROMPTS.recommendation, user, 6000);
  return extractJSON(text);
}

async function runCritic(themes, contradictions, recommendations, signals, mode) {
  if (mode === "demo") { await sleep(850); return DEMO_OUTPUTS.critique; }
  const user = `Themes:\n${JSON.stringify(themes, null, 2)}\n\nContradictions:\n${JSON.stringify(contradictions, null, 2)}\n\nRecommendations:\n${JSON.stringify(recommendations, null, 2)}\n\nSignals available:\n${JSON.stringify(signals.map(s => ({ id: s.id, source_type: s.source_type, summary: s.summary, evidence_strength: s.evidence_strength })), null, 2)}\n\nReturn the JSON object specified in your instructions.`;
  const { text } = await callClaude(PROMPTS.critic, user, 5000);
  return extractJSON(text);
}

async function runMemo(ingestion, themes, contradictions, recommendations, critique, mode) {
  if (mode === "demo") { await sleep(1100); return DEMO_OUTPUTS.memo; }
  const user = `Product:\n${JSON.stringify(PRODUCT, null, 2)}\n\nIngestion:\n${JSON.stringify(ingestion, null, 2)}\n\nThemes:\n${JSON.stringify(themes, null, 2)}\n\nContradictions:\n${JSON.stringify(contradictions, null, 2)}\n\nRecommendations:\n${JSON.stringify(recommendations, null, 2)}\n\nCritique:\n${JSON.stringify(critique, null, 2)}\n\nReturn the markdown memo only, no preamble.`;
  const { text } = await callClaude(PROMPTS.memo, user, 6000);
  return text.trim();
}

/* -------------------------------------------------------------------------
   7. ORCHESTRATOR
   Sequential agent pipeline with per-agent status callbacks so the UI
   can visualize progression.
   ------------------------------------------------------------------------- */

const AGENT_SEQUENCE = [
  { id: "ingestion",       label: "Ingestion",       icon: Layers,      desc: "Audit & categorize" },
  { id: "themes",          label: "Theme",           icon: Activity,    desc: "Cluster recurring signals" },
  { id: "contradictions",  label: "Contradiction",   icon: GitBranch,   desc: "Surface internal conflicts" },
  { id: "recommendations", label: "Recommendation",  icon: Lightbulb,   desc: "Draft action set" },
  { id: "critic",          label: "Critic",          icon: Shield,      desc: "Red-team & confidence" },
  { id: "memo",            label: "Memo",            icon: FileText,    desc: "Compile exec brief" },
];

async function runPipeline(signals, mode, callbacks = {}) {
  const { onAgentStart = () => {}, onAgentDone = () => {}, onError = () => {} } = callbacks;
  const results = {};

  async function step(id, fn) {
    onAgentStart(id);
    const t0 = performance.now();
    try {
      const out = await fn();
      const ms = Math.round(performance.now() - t0);
      results[id] = out;
      onAgentDone(id, out, ms);
      return out;
    } catch (e) {
      onError(id, e);
      throw e;
    }
  }

  await step("ingestion",       () => runIngestion(signals, mode));
  await step("themes",          () => runThemes(signals, results.ingestion, mode));
  await step("contradictions",  () => runContradictions(signals, results.themes, mode));
  await step("recommendations", () => runRecommendations(signals, results.themes, results.contradictions, mode));
  await step("critic",          () => runCritic(results.themes, results.contradictions, results.recommendations, signals, mode));
  await step("memo",            () => runMemo(results.ingestion, results.themes, results.contradictions, results.recommendations, results.critic, mode));

  return results;
}

/* -------------------------------------------------------------------------
   8. STYLES — airy, cool-white, gradient-kissed.
   Inter everywhere, JetBrains Mono for data, an indigo/lavender accent
   that echoes an iridescent brand gradient. Fully rounded pills, soft
   shadows, frosted-glass pills, a diffused gradient wash behind the
   whole surface.
   ------------------------------------------------------------------------- */

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

:root {
  /* Base surface palette — sky-blue gradient set, atmospheric */
  --ris-bg:            #F0F7FF;        /* gradient top — palest sky */
  --ris-bg-bottom:     #B9D9EB;        /* gradient bottom — saturated pastel sky */
  --ris-bg-elevated:   #FFFFFF;
  --ris-bg-subtle:     #E8F1FB;        /* card-tint, fits the new palette */
  --ris-bg-subtle-2:   #DCE8F5;

  /* Ink — dark navy, optimized for legibility on the gradient.
     Contrast on #B9D9EB (saturated end) = 11.5:1 (AAA). */
  --ris-ink:           #0B1929;
  --ris-ink-2:         #1F2D3D;
  --ris-ink-3:         #4A5868;
  --ris-mute:          #6B7A8C;
  --ris-mute-2:        #94A3B5;

  /* Lines & hairlines — navy-tinted to fit the cool palette */
  --ris-hair:          rgba(11,25,41,0.08);
  --ris-hair-strong:   rgba(11,25,41,0.13);
  --ris-line:          rgba(11,25,41,0.18);

  /* Accent — saturated sky-blue, native to the gradient family.
     Contrast on #F0F7FF = 5.4:1 (AA), on #FFFFFF = 6.1:1 (AA+). */
  --ris-accent:        #2C7DA8;
  --ris-accent-2:      #4D9DC7;
  --ris-accent-soft:   rgba(44,125,168,0.10);
  --ris-accent-softer: rgba(44,125,168,0.05);

  /* Semantic */
  --ris-flag:          #C0392B;        /* warmed slightly to coexist with cool palette */
  --ris-flag-soft:     rgba(192,57,43,0.08);
  --ris-ok:            #15803D;
  --ris-warn:          #B8860B;

  /* Shadows — slightly cooler tint to harmonize with the sky base */
  --ris-shadow-sm:     0 1px 2px rgba(11,25,41,0.05);
  --ris-shadow-md:     0 1px 2px rgba(11,25,41,0.05), 0 4px 16px rgba(11,25,41,0.04);
  --ris-shadow-lg:     0 1px 2px rgba(11,25,41,0.05), 0 16px 48px rgba(11,25,41,0.07);

  /* Legacy aliases — some inline JSX styles still reference these names.
     Map them onto the new palette so nothing breaks. */
  --ris-paper:         var(--ris-bg);
  --ris-paper-2:       var(--ris-bg-subtle);
  --ris-grid:          rgba(11,25,41,0.05);
  --ris-live:          var(--ris-flag);
}

.ris-root {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  color: var(--ris-ink);
  min-height: 100vh;
  letter-spacing: -0.005em;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;

  /* The backdrop — vertical linear gradient from very pale sky at the top
     to a more saturated (but still pastel) sky at the bottom. The transition
     is extremely subtle, evoking openness, clarity, and "the cloud."
     Fixed attachment so the gradient stays anchored as the user scrolls,
     preserving the atmospheric feel everywhere on the page. */
  background-color: var(--ris-bg-bottom);
  background-image: linear-gradient(180deg, var(--ris-bg) 0%, var(--ris-bg-bottom) 100%);
  background-attachment: fixed;
  background-repeat: no-repeat;
  background-size: 100% 100%;
}

.ris-root * { box-sizing: border-box; }

/* 'ris-serif' is the display class — now a bold, tight sans instead of a
   serif. Keeping the class name avoids touching every component. */
.ris-serif {
  font-family: 'Inter', sans-serif;
  font-weight: 700;
  letter-spacing: -0.028em;
}
.ris-serif em {
  font-style: normal;
  color: var(--ris-accent);
  font-weight: 700;
}

.ris-mono {
  font-family: 'JetBrains Mono', ui-monospace, 'SF Mono', monospace;
  font-variant-numeric: tabular-nums;
}

.ris-wordmark {
  font-family: 'Inter', sans-serif;
  font-weight: 700;
  font-size: 20px;
  letter-spacing: -0.028em;
  color: var(--ris-ink);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.ris-wordmark em {
  font-style: normal;
  color: var(--ris-accent);
  font-weight: 700;
  background: linear-gradient(135deg, #6366F1, #A78BFA);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.ris-eyebrow {
  font-family: 'Inter', sans-serif;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ris-mute);
}

.ris-divider        { height: 1px; background: var(--ris-hair); border: none; }
.ris-divider-strong { height: 1px; background: var(--ris-hair-strong); border: none; }

/* Pills — fully rounded, frosted-glass. This is the hero shape of the
   new design. */
.ris-pill {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 5px 12px;
  border-radius: 999px;
  font-family: 'Inter', sans-serif;
  font-size: 12px;
  font-weight: 500;
  color: var(--ris-ink-2);
  background: rgba(255,255,255,0.65);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid var(--ris-hair);
  transition: all 140ms ease;
}
.ris-pill.solid  { background: var(--ris-ink); color: #FFFFFF; border-color: var(--ris-ink); }
.ris-pill.accent { background: var(--ris-accent); color: #FFFFFF; border-color: var(--ris-accent); }

/* Primary button — black pill, soft lift on hover */
.ris-btn {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 11px 20px;
  border-radius: 999px;
  background: var(--ris-ink);
  color: #FFFFFF;
  font-family: 'Inter', sans-serif;
  font-weight: 500;
  font-size: 14px;
  letter-spacing: -0.005em;
  border: 1px solid var(--ris-ink);
  cursor: pointer;
  transition: all 200ms cubic-bezier(.2,.7,.2,1);
  box-shadow: var(--ris-shadow-sm);
}
.ris-btn:hover:not(:disabled) {
  background: #1E1E2A;
  border-color: #1E1E2A;
  transform: translateY(-1px);
  box-shadow: var(--ris-shadow-md);
}
.ris-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* Secondary button — white pill with a thin outline */
.ris-btn-ghost {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 9px 16px;
  border-radius: 999px;
  background: rgba(255,255,255,0.75);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: var(--ris-ink-2);
  border: 1px solid var(--ris-hair);
  font-family: 'Inter', sans-serif;
  font-weight: 500;
  font-size: 13px;
  cursor: pointer;
  transition: all 160ms ease;
}
.ris-btn-ghost:hover {
  background: #FFFFFF;
  border-color: var(--ris-hair-strong);
  color: var(--ris-ink);
}
.ris-btn-ghost:disabled { opacity: 0.4; cursor: not-allowed; }

/* Mode toggle — pill-shaped segmented control */
.ris-toggle {
  display: inline-flex;
  border: 1px solid var(--ris-hair);
  border-radius: 999px;
  background: rgba(255,255,255,0.70);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  padding: 3px;
}
.ris-toggle button {
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 500;
  font-family: 'Inter', sans-serif;
  background: transparent;
  border: none;
  border-radius: 999px;
  cursor: pointer;
  color: var(--ris-mute);
  letter-spacing: 0;
  transition: all 160ms ease;
}
.ris-toggle button.active {
  background: var(--ris-ink);
  color: #FFFFFF;
}

/* Cards — rounded, soft-shadowed, elevated white */
.ris-card {
  background: rgba(255,255,255,0.78);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--ris-hair);
  border-radius: 16px;
  padding: 22px;
  box-shadow: var(--ris-shadow-sm);
}
.ris-card.raised {
  background: rgba(255,255,255,0.88);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  box-shadow: var(--ris-shadow-md);
}
.ris-card.tint {
  background: rgba(255,255,255,0.50);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-color: var(--ris-hair);
}

/* Agent pipeline nodes — frosted cards that pulse when active */
.ris-node {
  position: relative;
  background: rgba(255,255,255,0.75);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid var(--ris-hair);
  border-radius: 14px;
  padding: 14px 14px 12px;
  transition: all 240ms cubic-bezier(.2,.7,.2,1);
  min-width: 0;
}
.ris-node.idle { opacity: 0.6; }
.ris-node.running {
  border-color: var(--ris-accent);
  background: #FFFFFF;
  box-shadow: 0 0 0 4px var(--ris-accent-soft), var(--ris-shadow-md);
}
.ris-node.running::before {
  content: "";
  position: absolute;
  inset: -1px;
  border: 1px solid var(--ris-accent);
  animation: risPulse 1.8s ease-in-out infinite;
  pointer-events: none;
  border-radius: 14px;
}
.ris-node.done {
  background: #FFFFFF;
  border-color: var(--ris-hair-strong);
  box-shadow: var(--ris-shadow-sm);
}
.ris-node.error {
  border-color: var(--ris-flag);
  background: var(--ris-flag-soft);
}

@keyframes risPulse {
  0%, 100% { opacity: 0; transform: scale(1); }
  50%      { opacity: 0.4; transform: scale(1.015); }
}

.ris-link {
  flex: 1 1 0;
  height: 2px;
  background: var(--ris-hair);
  position: relative;
  min-width: 12px;
  max-width: 48px;
  border-radius: 999px;
}
.ris-link.active { background: var(--ris-accent); }
.ris-link.done   { background: var(--ris-hair-strong); }

/* Evidence drawer */
.ris-drawer-scrim {
  position: fixed; inset: 0;
  background: rgba(11,25,41,0.22);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  opacity: 0; pointer-events: none;
  transition: opacity 220ms ease;
  z-index: 40;
}
.ris-drawer-scrim.open { opacity: 1; pointer-events: auto; }
.ris-drawer {
  position: fixed; top: 0; right: 0; height: 100vh;
  width: min(460px, 92vw);
  background: var(--ris-bg-elevated);
  border-left: 1px solid var(--ris-hair);
  transform: translateX(100%);
  transition: transform 280ms cubic-bezier(.2,.7,.2,1);
  z-index: 50;
  display: flex;
  flex-direction: column;
  box-shadow: -24px 0 64px rgba(11,25,41,0.10);
}
.ris-drawer.open { transform: translateX(0); }

/* Evidence chips — rounded pills */
.ris-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--ris-bg-subtle);
  color: var(--ris-ink-2);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.01em;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 140ms ease;
}
.ris-chip:hover {
  background: var(--ris-ink);
  color: #FFFFFF;
  border-color: var(--ris-ink);
}

/* Severity bar */
.ris-sev { display: inline-flex; gap: 2px; }
.ris-sev span {
  width: 4px; height: 12px;
  background: var(--ris-hair-strong);
  border-radius: 2px;
}
.ris-sev span.on { background: var(--ris-ink); }
.ris-sev.flag span.on { background: var(--ris-flag); }

/* Confidence bar — filled with the accent gradient */
.ris-conf { display: flex; align-items: center; gap: 10px; }
.ris-conf-track {
  flex: 1;
  height: 4px;
  background: var(--ris-hair);
  position: relative;
  border-radius: 999px;
  overflow: hidden;
}
.ris-conf-fill {
  position: absolute;
  left: 0; top: 0; bottom: 0;
  background: linear-gradient(90deg, var(--ris-accent), var(--ris-accent-2));
  border-radius: 999px;
}

/* Memo prose — reads like a well-typeset article */
.ris-memo {
  font-family: 'Inter', sans-serif;
  font-size: 15px;
  line-height: 1.7;
  color: var(--ris-ink-2);
}
.ris-memo h1 {
  font-family: 'Inter', sans-serif;
  font-weight: 700;
  font-size: 38px;
  line-height: 1.1;
  color: var(--ris-ink);
  margin: 0 0 14px;
  letter-spacing: -0.032em;
}
.ris-memo h2 {
  font-family: 'Inter', sans-serif;
  font-weight: 600;
  font-size: 24px;
  line-height: 1.25;
  color: var(--ris-ink);
  margin: 36px 0 12px;
  letter-spacing: -0.02em;
}
.ris-memo h3 {
  font-family: 'Inter', sans-serif;
  font-weight: 600;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ris-mute);
  margin: 28px 0 10px;
}
.ris-memo p { margin: 0 0 16px; }
.ris-memo ul { margin: 0 0 16px; padding-left: 20px; }
.ris-memo li { margin: 0 0 8px; }
.ris-memo strong { color: var(--ris-ink); font-weight: 600; }
.ris-memo em {
  font-style: normal;
  color: var(--ris-accent);
  font-weight: 500;
}
.ris-memo code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.9em;
  background: var(--ris-bg-subtle);
  padding: 1px 6px;
  border-radius: 4px;
}

/* Signals explorer table */
.ris-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.ris-table th {
  text-align: left;
  font-family: 'Inter', sans-serif;
  font-weight: 500;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ris-mute);
  padding: 12px 14px;
  border-bottom: 1px solid var(--ris-hair-strong);
  background: var(--ris-bg-subtle);
}
.ris-table td {
  padding: 12px 14px;
  border-bottom: 1px solid var(--ris-hair);
  color: var(--ris-ink-2);
  vertical-align: top;
}
.ris-table tr:hover td { background: var(--ris-bg-subtle); }
.ris-table tr { cursor: pointer; transition: background-color 120ms ease; }

/* JSON inspector — keep the dark panel for contrast, but rounder */
.ris-json {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  line-height: 1.6;
  background: #0E0E14;
  color: #D4D4E0;
  padding: 20px;
  border-radius: 12px;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 480px;
  overflow: auto;
}

/* Section collapse header */
.ris-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  user-select: none;
  padding: 20px 0;
}
.ris-section-head:hover .ris-section-title { color: var(--ris-accent); }

/* Utilities */
.ris-muted { color: var(--ris-mute); }
.ris-strong { color: var(--ris-ink); }
.ris-grid { display: grid; gap: 16px; }
.ris-stack { display: flex; flex-direction: column; }
.ris-row { display: flex; align-items: center; }
.ris-space-sm { gap: 8px; }
.ris-space-md { gap: 16px; }
.ris-space-lg { gap: 24px; }

/* Responsive */
@media (max-width: 900px) {
  .ris-hero-grid { grid-template-columns: 1fr !important; }
  .ris-pipeline  { flex-direction: column !important; align-items: stretch !important; }
  .ris-link      { width: 2px !important; height: 16px !important; flex: none !important; margin: 0 auto; }
  .ris-two-col   { grid-template-columns: 1fr !important; }
}
`;

/* -------------------------------------------------------------------------
   9. SMALL PRESENTATIONAL HELPERS
   ------------------------------------------------------------------------- */

function SeverityBar({ value, max = 5, flag = false }) {
  return (
    <span className={`ris-sev ${flag ? "flag" : ""}`} aria-label={`severity ${value}/${max}`}>
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={i < value ? "on" : ""} />
      ))}
    </span>
  );
}

function ConfidenceBar({ value }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className="ris-conf">
      <span className="ris-mono" style={{ fontSize: 11, minWidth: 34, color: "var(--ris-ink)" }}>{pct}%</span>
      <div className="ris-conf-track"><div className="ris-conf-fill" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

function EvidenceChip({ id, onClick }) {
  return (
    <button className="ris-chip" onClick={() => onClick(id)} title={`View signal ${id}`}>
      {id}
    </button>
  );
}

function SourceIcon({ source_type, size = 13 }) {
  const meta = SOURCE_META[source_type];
  if (!meta) return null;
  const Icon = meta.icon;
  return <Icon size={size} strokeWidth={1.75} style={{ color: "var(--ris-mute)" }} />;
}

function TrendGlyph({ trend }) {
  const map = {
    rising:     { char: "↑", color: "var(--ris-flag)",   label: "rising" },
    falling:    { char: "↓", color: "var(--ris-ok)",     label: "falling" },
    steady:     { char: "→", color: "var(--ris-mute)",   label: "steady" },
    new:        { char: "•", color: "var(--ris-accent)", label: "new" },
  };
  const g = map[trend] || map.steady;
  return (
    <span className="ris-mono" style={{ fontSize: 11, color: g.color, letterSpacing: "0.08em" }}>
      {g.char} {g.label}
    </span>
  );
}

// Tiny markdown renderer for the memo. Intentionally minimal — headings,
// bold, italics, inline code, lists, paragraphs. Avoids pulling a full
// markdown dep for a controlled-input case.
function MemoMarkdown({ markdown }) {
  const html = useMemo(() => mdToHtml(markdown || ""), [markdown]);
  return <div className="ris-memo" dangerouslySetInnerHTML={{ __html: html }} />;
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function inline(s) {
  let t = escapeHtml(s);
  t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/(^|[\s(])_([^_\n]+)_([\s).,;:!?]|$)/g, "$1<em>$2</em>$3");
  // Signal references → clickable chips (we leave them as plain for now;
  // the evidence drawer is driven from structured data, not memo parsing)
  return t;
}
function mdToHtml(md) {
  const lines = md.split(/\r?\n/);
  const out = [];
  let inList = false;
  let paraBuf = [];
  const flushPara = () => {
    if (paraBuf.length) {
      out.push(`<p>${inline(paraBuf.join(" "))}</p>`);
      paraBuf = [];
    }
  };
  const closeList = () => { if (inList) { out.push("</ul>"); inList = false; } };

  for (let raw of lines) {
    const line = raw;
    if (/^\s*$/.test(line)) { flushPara(); closeList(); continue; }
    if (/^#\s+/.test(line)) { flushPara(); closeList(); out.push(`<h1>${inline(line.replace(/^#\s+/, ""))}</h1>`); continue; }
    if (/^##\s+/.test(line)) { flushPara(); closeList(); out.push(`<h2>${inline(line.replace(/^##\s+/, ""))}</h2>`); continue; }
    if (/^###\s+/.test(line)) { flushPara(); closeList(); out.push(`<h3>${inline(line.replace(/^###\s+/, ""))}</h3>`); continue; }
    if (/^\s*[-*]\s+/.test(line)) {
      flushPara();
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`<li>${inline(line.replace(/^\s*[-*]\s+/, ""))}</li>`);
      continue;
    }
    closeList();
    paraBuf.push(line.trim());
  }
  flushPara(); closeList();
  return out.join("\n");
}

/* -------------------------------------------------------------------------
   10. MAJOR COMPONENTS
   ------------------------------------------------------------------------- */

function Header({ mode, setMode, onReset, hasRun }) {
  return (
    <header style={{ borderBottom: "1px solid var(--ris-hair)", background: "rgba(255,255,255,0.30)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", position: "sticky", top: 0, zIndex: 30 }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "18px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div className="ris-row ris-space-md">
          <div className="ris-wordmark">
            Remix <em>Discovery</em> Studio
          </div>
          <div className="ris-pill" style={{ marginLeft: 8 }}>
            <span style={{ width: 6, height: 6, background: "var(--ris-accent)", borderRadius: "50%" }} />
            MVP · v0.1
          </div>
        </div>
        <div className="ris-row ris-space-sm">
          <div className="ris-toggle" role="group" aria-label="Execution mode">
            <button className={mode === "demo" ? "active" : ""} onClick={() => setMode("demo")}>DEMO</button>
            <button className={mode === "live" ? "active" : ""} onClick={() => setMode("live")}>LIVE</button>
          </div>
          {hasRun && (
            <button className="ris-btn-ghost" onClick={onReset} title="Reset run state">
              <RefreshCw size={13} strokeWidth={1.75} />
              Reset
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

function HeroPanel({ onRun, running, hasRun, mode }) {
  // Source distribution for the mini-chart
  const dist = useMemo(() => {
    const counts = {};
    SIGNALS.forEach(s => { counts[s.source_type] = (counts[s.source_type] || 0) + 1; });
    const order = ["pain_observation", "behavior_observation", "desired_outcome", "workaround", "quote"];
    return order.map(k => ({ key: k, count: counts[k] || 0, meta: SOURCE_META[k] }));
  }, []);
  const total = SIGNALS.length;

  return (
    <section style={{ borderBottom: "1px solid var(--ris-hair)", background: "transparent" }}>
      <div className="ris-hero-grid" style={{ maxWidth: 1240, margin: "0 auto", padding: "48px 28px 36px", display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 48, alignItems: "start" }}>
        {/* Left: editorial narrative */}
        <div>
          <div className="ris-eyebrow" style={{ marginBottom: 14 }}>
            {PRODUCT.round_label}
          </div>
          <h1 className="ris-serif" style={{ fontSize: 58, lineHeight: 1.02, margin: "0 0 18px", letterSpacing: "-0.02em" }}>
            Fourteen interviews. <em style={{ color: "var(--ris-accent)" }}>One brief.</em><br/>
            The pattern beneath the noise.
          </h1>
          <p style={{ fontSize: 15.5, lineHeight: 1.6, color: "var(--ris-ink-2)", maxWidth: 560, margin: "0 0 20px" }}>
            Remix ingests a coded interview corpus — pain observations, behaviors, desired outcomes,
            workarounds, quotes — and returns what a senior PM would write after a week of careful synthesis:
            <span className="ris-strong"> user pain clusters that recur, said-vs-did contradictions that matter,
            recommendations to build / research / deprioritize, and the open questions for the next round.</span>
          </p>
          <div className="ris-row ris-space-md" style={{ flexWrap: "wrap" }}>
            <div className="ris-pill"><Layers size={12} strokeWidth={1.75} />{PRODUCT.name} · {PRODUCT.stage.split(" ")[0]} {PRODUCT.stage.split(" ")[1]}</div>
            <div className="ris-pill">{PRODUCT.category}</div>
          </div>
          <p style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--ris-mute)", marginTop: 18, fontStyle: "italic", maxWidth: 560 }}>
            Research question: {PRODUCT.research_question}
          </p>
        </div>

        {/* Right: corpus composition + run */}
        <div className="ris-card tint" style={{ padding: 24 }}>
          <div className="ris-eyebrow" style={{ marginBottom: 14 }}>The Corpus</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
            <span className="ris-serif" style={{ fontSize: 54, lineHeight: 1, letterSpacing: "-0.02em" }}>{total}</span>
            <span className="ris-muted" style={{ fontSize: 13 }}>coded chunks · 14 interviews</span>
          </div>
          <hr className="ris-divider" style={{ margin: "20px 0 14px" }} />

          <div className="ris-stack" style={{ gap: 10 }}>
            {dist.map(d => {
              const pct = (d.count / total) * 100;
              const Icon = d.meta.icon;
              return (
                <div key={d.key} className="ris-row" style={{ gap: 12 }}>
                  <Icon size={13} strokeWidth={1.75} style={{ color: "var(--ris-mute)", flex: "none" }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="ris-row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 12.5, color: "var(--ris-ink-2)" }}>{d.meta.label}</span>
                      <span className="ris-mono ris-muted" style={{ fontSize: 11 }}>{d.count}</span>
                    </div>
                    <div style={{ height: 2, background: "var(--ris-hair)", position: "relative" }}>
                      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct}%`, background: "var(--ris-ink)" }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <hr className="ris-divider" style={{ margin: "18px 0" }} />

          <div className="ris-row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 11.5, color: "var(--ris-mute)", maxWidth: 240, lineHeight: 1.5 }}>
              {mode === "live"
                ? <>Live mode · calls <span className="ris-mono">{MODEL}</span> for each agent.</>
                : <>Demo mode · plays back a hand-curated gold run.</>}
            </div>
            <button
              className="ris-btn"
              onClick={onRun}
              disabled={running}
              style={{ minWidth: 180, justifyContent: "center" }}
            >
              {running ? (<><Loader2 size={14} className="ris-spin" style={{ animation: "risSpin 1s linear infinite" }} />Running…</>)
                       : hasRun ? (<><RefreshCw size={13} strokeWidth={1.75} />Run again</>)
                               : (<><Play size={13} strokeWidth={2} fill="currentColor" />Run discovery synthesis</>)}
            </button>
          </div>
        </div>
      </div>

      <style>{`@keyframes risSpin { to { transform: rotate(360deg); } }`}</style>
    </section>
  );
}

function AgentNode({ agent, status, ms }) {
  const Icon = agent.icon;
  const state = status?.state || "idle";
  return (
    <div className={`ris-node ${state}`} style={{ flex: "3 1 0", minWidth: 0 }}>
      <div className="ris-row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
        <div className="ris-eyebrow" style={{ color: state === "done" ? "var(--ris-ink)" : undefined }}>
          {String(AGENT_SEQUENCE.findIndex(a => a.id === agent.id) + 1).padStart(2, "0")}
        </div>
        {state === "running" && <Loader2 size={13} style={{ color: "var(--ris-accent)", animation: "risSpin 1s linear infinite" }} />}
        {state === "done"    && <CheckCircle2 size={13} strokeWidth={2} style={{ color: "var(--ris-ink)" }} />}
        {state === "error"   && <XCircle      size={13} strokeWidth={2} style={{ color: "var(--ris-flag)" }} />}
        {state === "idle"    && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--ris-hair)" }} />}
      </div>
      <div className="ris-row ris-space-sm" style={{ marginBottom: 4, minWidth: 0, alignItems: "flex-start" }}>
        <Icon size={15} strokeWidth={1.75} style={{ color: state === "running" ? "var(--ris-accent)" : "var(--ris-ink)", flex: "none", marginTop: 1 }} />
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ris-ink)", minWidth: 0, flex: 1, lineHeight: 1.25, wordBreak: "break-word" }}>{agent.label}</div>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--ris-mute)", lineHeight: 1.4 }}>{agent.desc}</div>
      {state === "done" && typeof ms === "number" && (
        <div className="ris-mono" style={{ marginTop: 8, fontSize: 10.5, color: "var(--ris-mute)" }}>
          {(ms / 1000).toFixed(ms < 1000 ? 2 : 1)}s
        </div>
      )}
    </div>
  );
}

function Pipeline({ statuses, timings }) {
  return (
    <section style={{ borderBottom: "1px solid var(--ris-hair)", background: "transparent" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "28px 28px" }}>
        <div className="ris-row" style={{ justifyContent: "space-between", marginBottom: 16 }}>
          <div className="ris-eyebrow">The Pipeline</div>
          <div className="ris-eyebrow">Sequential · JSON-typed handoffs</div>
        </div>
        <div className="ris-pipeline ris-row" style={{ gap: 0, alignItems: "stretch" }}>
          {AGENT_SEQUENCE.map((agent, i) => {
            const status = statuses[agent.id];
            const next = AGENT_SEQUENCE[i + 1];
            const nextStatus = next ? statuses[next.id] : null;
            const linkCls = status?.state === "done" ? (nextStatus?.state === "running" ? "active" : "done") : "";
            return (
              <Fragment key={agent.id}>
                <AgentNode agent={agent} status={status} ms={timings[agent.id]} />
                {next && <div className={`ris-link ${linkCls}`} />}
              </Fragment>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ThemeCard({ theme, onEvidence }) {
  const evidence = theme.evidence || [];
  const sourceTypes = theme.source_types || [];
  const segments = theme.segments || [];
  const trendGlyph = {
    rising:  "↑", falling: "↓", steady: "→", new: "•"
  }[theme.trend] || "→";
  return (
    <article className="ris-card raised" style={{ marginBottom: 14 }}>
      <div className="ris-row" style={{ justifyContent: "space-between", gap: 16, marginBottom: 10, alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <div className="ris-row ris-space-sm" style={{ marginBottom: 6 }}>
            {theme.noise_flag && (
              <span className="ris-pill" style={{ background: "var(--ris-flag)", color: "var(--ris-paper)", borderColor: "var(--ris-flag)" }}>
                <AlertCircle size={11} /> Noise-flagged
              </span>
            )}
            <TrendGlyph trend={theme.trend} />
          </div>
          <h3 className="ris-serif" style={{ fontSize: 22, lineHeight: 1.25, margin: "0 0 6px", letterSpacing: "-0.01em" }}>
            {theme.title}
          </h3>
          <div className="ris-eyebrow">{theme.id}</div>
        </div>
        <div style={{ textAlign: "right", flex: "none" }}>
          <div className="ris-eyebrow" style={{ marginBottom: 4 }}>Strength</div>
          <SeverityBar value={theme.strength} />
          <div className="ris-mono" style={{ fontSize: 10.5, marginTop: 4, color: "var(--ris-mute)" }}>{theme.strength}/5</div>
        </div>
      </div>

      <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--ris-ink-2)", margin: "0 0 12px" }}>
        {theme.summary}
      </p>

      {theme.why_it_matters && (
        <>
          <div className="ris-eyebrow" style={{ marginBottom: 4 }}>Why it matters</div>
          <p style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--ris-ink-2)", margin: "0 0 14px" }}>{theme.why_it_matters}</p>
        </>
      )}

      <hr className="ris-divider" style={{ margin: "12px 0" }} />

      <div className="ris-row" style={{ gap: 18, flexWrap: "wrap", justifyContent: "space-between" }}>
        <div>
          <div className="ris-eyebrow" style={{ marginBottom: 6 }}>Evidence · {evidence.length} chunks</div>
          <div className="ris-row" style={{ gap: 4, flexWrap: "wrap" }}>
            {evidence.map(id => <EvidenceChip key={id} id={id} onClick={onEvidence} />)}
          </div>
        </div>
        <div style={{ minWidth: 200 }}>
          <div className="ris-eyebrow" style={{ marginBottom: 6 }}>Sources spanned</div>
          <div className="ris-row ris-space-sm" style={{ flexWrap: "wrap", marginBottom: 10 }}>
            {sourceTypes.map(st => (
              <span key={st} className="ris-row" style={{ gap: 4, fontSize: 11.5, color: "var(--ris-ink-2)" }}>
                <SourceIcon source_type={st} size={12} />
                {SOURCE_META[st]?.label}
              </span>
            ))}
          </div>
          {segments.length > 0 && (
            <>
              <div className="ris-eyebrow" style={{ marginBottom: 6 }}>Segments · {segments.length}</div>
              <div className="ris-row ris-space-sm" style={{ flexWrap: "wrap", gap: 4 }}>
                {segments.map(seg => (
                  <span key={seg} style={{ fontSize: 11, padding: "2px 8px", background: "var(--ris-paper-2)", color: "var(--ris-ink-2)", borderRadius: 999 }}>
                    {seg.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function ContradictionCard({ c, onEvidence }) {
  return (
    <article className="ris-card raised" style={{ marginBottom: 14 }}>
      <div className="ris-row" style={{ justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <div className="ris-row ris-space-sm" style={{ marginBottom: 6, flexWrap: "wrap" }}>
            <div className="ris-eyebrow">Contradiction · {c.id}</div>
            {c.type && (
              <span className="ris-pill" style={{ fontSize: 10.5, padding: "2px 9px", background: "var(--ris-paper-2)", color: "var(--ris-ink-2)", borderColor: "var(--ris-hair)" }}>
                {c.type === "said_vs_did" && "Said vs. did"}
                {c.type === "cross_segment" && "Cross-segment"}
                {c.type === "leading_question_artifact" && "Leading-question artifact"}
              </span>
            )}
          </div>
          <h3 className="ris-serif" style={{ fontSize: 22, lineHeight: 1.25, margin: "0 0 6px", letterSpacing: "-0.01em" }}>
            {c.title}
          </h3>
        </div>
        <div style={{ textAlign: "right", flex: "none" }}>
          <div className="ris-eyebrow" style={{ marginBottom: 4 }}>Severity</div>
          <SeverityBar value={c.severity} flag />
          <div className="ris-mono" style={{ fontSize: 10.5, marginTop: 4, color: "var(--ris-mute)" }}>{c.severity}/5</div>
        </div>
      </div>

      <div className="ris-two-col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 10 }}>
        <div style={{ borderLeft: "2px solid var(--ris-hair)", paddingLeft: 12 }}>
          <div className="ris-eyebrow" style={{ marginBottom: 4 }}>{c.side_a?.label || "Side A"}</div>
          <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--ris-ink-2)", marginBottom: 6 }}>{c.side_a?.claim}</div>
          <div className="ris-row" style={{ gap: 4, flexWrap: "wrap" }}>
            {(c.side_a?.evidence || []).map(id => <EvidenceChip key={id} id={id} onClick={onEvidence} />)}
          </div>
        </div>
        <div style={{ borderLeft: "2px solid var(--ris-flag)", paddingLeft: 12 }}>
          <div className="ris-eyebrow" style={{ marginBottom: 4, color: "var(--ris-flag)" }}>{c.side_b?.label || "Side B"}</div>
          <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--ris-ink-2)", marginBottom: 6 }}>{c.side_b?.claim}</div>
          <div className="ris-row" style={{ gap: 4, flexWrap: "wrap" }}>
            {(c.side_b?.evidence || []).map(id => <EvidenceChip key={id} id={id} onClick={onEvidence} />)}
          </div>
        </div>
      </div>

      {c.so_what && (
        <>
          <hr className="ris-divider" style={{ margin: "14px 0" }} />
          <div className="ris-row ris-space-sm" style={{ alignItems: "flex-start" }}>
            <Info size={14} strokeWidth={1.75} style={{ color: "var(--ris-accent)", marginTop: 2, flex: "none" }} />
            <p style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--ris-ink)", margin: 0 }}>
              <span className="ris-eyebrow" style={{ marginRight: 6 }}>So what</span>
              {c.so_what}
            </p>
          </div>
        </>
      )}
    </article>
  );
}

function RecommendationCard({ r, idx, onEvidence }) {
  return (
    <article className="ris-card raised" style={{ marginBottom: 14 }}>
      <div className="ris-row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 14, marginBottom: 12 }}>
        <div className="ris-row ris-space-sm" style={{ alignItems: "flex-start" }}>
          <div className="ris-serif" style={{ fontSize: 40, lineHeight: 1, color: "var(--ris-accent)", flex: "none", width: 42 }}>
            {String(idx + 1).padStart(2, "0")}
          </div>
          <div>
            <h3 className="ris-serif" style={{ fontSize: 22, lineHeight: 1.25, margin: "0 0 6px", letterSpacing: "-0.01em" }}>
              {r.title}
            </h3>
            <div className="ris-row ris-space-sm" style={{ flexWrap: "wrap" }}>
              {r.category === "build" && (
                <span className="ris-pill" style={{ background: "var(--ris-accent-soft)", color: "var(--ris-accent)", borderColor: "transparent" }}>
                  <Hammer size={11} strokeWidth={2} />Build
                </span>
              )}
              {r.category === "research" && (
                <span className="ris-pill" style={{ background: "var(--ris-paper-2)", color: "var(--ris-ink-2)", borderColor: "transparent" }}>
                  <Microscope size={11} strokeWidth={2} />Research
                </span>
              )}
              {r.category === "deprioritize" && (
                <span className="ris-pill" style={{ background: "transparent", color: "var(--ris-mute)", borderColor: "var(--ris-hair-strong)", borderStyle: "dashed" }}>
                  <MinusCircle size={11} strokeWidth={2} />Deprioritize
                </span>
              )}
              <span className="ris-pill">Owner · {r.owner}</span>
              <span className="ris-pill">{r.horizon}</span>
              {r.hard_call && <span className="ris-pill" style={{ background: "var(--ris-ink)", color: "var(--ris-paper)", borderColor: "var(--ris-ink)" }}>Hard call</span>}
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right", minWidth: 120, flex: "none" }}>
          <div className="ris-eyebrow" style={{ marginBottom: 4 }}>Confidence</div>
          <ConfidenceBar value={r.confidence} />
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <div className="ris-eyebrow" style={{ marginBottom: 4 }}>What</div>
        <p style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--ris-ink-2)", margin: 0 }}>{r.what}</p>
      </div>
      <div style={{ marginBottom: 10 }}>
        <div className="ris-eyebrow" style={{ marginBottom: 4 }}>Why</div>
        <p style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--ris-ink-2)", margin: 0 }}>{r.why}</p>
      </div>
      {r.risk_if_wrong && (
        <div style={{ marginBottom: 10 }}>
          <div className="ris-eyebrow" style={{ marginBottom: 4, color: "var(--ris-flag)" }}>Risk if wrong</div>
          <p style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--ris-ink-2)", margin: 0 }}>{r.risk_if_wrong}</p>
        </div>
      )}

      <hr className="ris-divider" style={{ margin: "12px 0 10px" }} />
      <div className="ris-row" style={{ gap: 14, flexWrap: "wrap", justifyContent: "space-between" }}>
        <div>
          <div className="ris-eyebrow" style={{ marginBottom: 6 }}>Draws from</div>
          <div className="ris-row" style={{ gap: 4, flexWrap: "wrap" }}>
            {(r.links_to_themes || []).map(id => <span key={id} className="ris-chip" style={{ cursor: "default" }}>{id}</span>)}
            {(r.links_to_contradictions || []).map(id => <span key={id} className="ris-chip" style={{ cursor: "default" }}>{id}</span>)}
          </div>
        </div>
        {r.evidence && r.evidence.length > 0 && (
          <div>
            <div className="ris-eyebrow" style={{ marginBottom: 6 }}>Evidence</div>
            <div className="ris-row" style={{ gap: 4, flexWrap: "wrap" }}>
              {r.evidence.map(id => <EvidenceChip key={id} id={id} onClick={onEvidence} />)}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

function CritiqueCard({ critique }) {
  return (
    <div className="ris-card raised">
      <div className="ris-row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 20, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <div className="ris-eyebrow" style={{ marginBottom: 6 }}>The Critic</div>
          <h3 className="ris-serif" style={{ fontSize: 24, margin: 0, letterSpacing: "-0.01em" }}>Where this memo could be wrong</h3>
        </div>
        <div style={{ minWidth: 220 }}>
          <div className="ris-eyebrow" style={{ marginBottom: 6 }}>Overall confidence</div>
          <ConfidenceBar value={critique.overall_confidence ?? 0} />
        </div>
      </div>

      {critique.caveats?.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div className="ris-eyebrow" style={{ marginBottom: 6 }}>Caveats</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.6, color: "var(--ris-ink-2)" }}>
            {critique.caveats.map((c, i) => <li key={i} style={{ marginBottom: 4 }}>{c}</li>)}
          </ul>
        </div>
      )}

      {critique.blind_spot && (
        <div style={{ padding: 14, background: "var(--ris-paper-2)", borderLeft: "2px solid var(--ris-accent)", marginBottom: 14 }}>
          <div className="ris-eyebrow" style={{ marginBottom: 6, color: "var(--ris-accent)" }}>Blind spot</div>
          <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--ris-ink)", margin: 0 }}>{critique.blind_spot}</p>
        </div>
      )}

      {critique.open_questions?.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div className="ris-row ris-space-sm" style={{ marginBottom: 8, alignItems: "baseline" }}>
            <HelpCircle size={14} strokeWidth={1.75} style={{ color: "var(--ris-mute)" }} />
            <div className="ris-eyebrow">For next research round</div>
          </div>
          <ol style={{ margin: 0, paddingLeft: 22, fontSize: 13.5, lineHeight: 1.6, color: "var(--ris-ink-2)" }}>
            {critique.open_questions.map((q, i) => <li key={i} style={{ marginBottom: 6 }}>{q}</li>)}
          </ol>
        </div>
      )}

      <details style={{ marginTop: 8 }}>
        <summary style={{ cursor: "pointer", fontSize: 12.5, color: "var(--ris-mute)", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.05em" }}>
          · Per-item notes
        </summary>
        <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
          {critique.theme_notes?.map((n, i) => (
            <div key={`tn${i}`} style={{ borderLeft: "2px solid var(--ris-hair)", paddingLeft: 10, fontSize: 12.5, color: "var(--ris-ink-2)" }}>
              <span className="ris-mono" style={{ color: "var(--ris-mute)" }}>{n.theme_id}</span> · {n.note}
            </div>
          ))}
          {critique.contradiction_notes?.map((n, i) => (
            <div key={`cn${i}`} style={{ borderLeft: "2px solid var(--ris-hair)", paddingLeft: 10, fontSize: 12.5, color: "var(--ris-ink-2)" }}>
              <span className="ris-mono" style={{ color: "var(--ris-mute)" }}>{n.contradiction_id}</span> · {n.note}
            </div>
          ))}
          {critique.recommendation_notes?.map((n, i) => (
            <div key={`rn${i}`} style={{ borderLeft: "2px solid var(--ris-hair)", paddingLeft: 10, fontSize: 12.5, color: "var(--ris-ink-2)" }}>
              <span className="ris-mono" style={{ color: "var(--ris-mute)" }}>{n.recommendation_id}</span> · {n.note}
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

function EvidenceDrawer({ signalId, onClose }) {
  const chunk = signalId ? SIGNAL_BY_ID[signalId] : null;
  return (
    <>
      <div className={`ris-drawer-scrim ${signalId ? "open" : ""}`} onClick={onClose} />
      <aside className={`ris-drawer ${signalId ? "open" : ""}`} aria-hidden={!signalId}>
        {chunk && (
          <>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--ris-hair)" }}>
              <div className="ris-row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
                <div className="ris-row ris-space-sm">
                  <SourceIcon source_type={chunk.source_type} size={14} />
                  <span className="ris-eyebrow">{SOURCE_META[chunk.source_type]?.label}</span>
                </div>
                <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--ris-mute)", padding: 4 }}>
                  <X size={16} />
                </button>
              </div>
              <div className="ris-serif" style={{ fontSize: 22, lineHeight: 1.25, letterSpacing: "-0.01em" }}>
                {chunk.summary}
              </div>
              <div className="ris-mono" style={{ fontSize: 11, color: "var(--ris-mute)", marginTop: 8 }}>
                {chunk.id} · {chunk.interview_id} · {chunk.date}
              </div>
            </div>

            <div style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>
              <DetailRow label="Participant">
                <div>{chunk.participant.role} · <span className="ris-muted">{(chunk.participant.segment || "").replace(/_/g, " ")}</span></div>
                <div className="ris-mono" style={{ fontSize: 11, color: "var(--ris-mute)", marginTop: 2 }}>
                  {chunk.participant.company_size} · {chunk.participant.tenure_months} months tenure
                </div>
              </DetailRow>

              {chunk.task_context && (
                <DetailRow label="Task context">
                  <div style={{ fontStyle: "italic", color: "var(--ris-ink-2)" }}>{chunk.task_context}</div>
                </DetailRow>
              )}

              <DetailRow label="Topics">
                <div className="ris-row" style={{ gap: 4, flexWrap: "wrap" }}>
                  {(chunk.topic_tags || []).map(t => (
                    <span key={t} className="ris-mono" style={{ fontSize: 10.5, padding: "2px 6px", background: "var(--ris-paper-2)", color: "var(--ris-ink-2)" }}>
                      {t}
                    </span>
                  ))}
                </div>
              </DetailRow>

              <DetailRow label="Sentiment / Evidence strength">
                <div className="ris-row ris-space-md" style={{ flexWrap: "wrap" }}>
                  <div><span className="ris-muted" style={{ fontSize: 11 }}>Sentiment</span><div>{chunk.sentiment}</div></div>
                  <div><span className="ris-muted" style={{ fontSize: 11 }}>Evidence</span><div><SeverityBar value={chunk.evidence_strength} /> <span className="ris-mono" style={{ fontSize: 11 }}>{chunk.evidence_strength}/5</span></div></div>
                </div>
              </DetailRow>

              {chunk.quote && chunk.quote.length > 0 && (
                <DetailRow label="Quote">
                  <blockquote style={{ margin: 0, padding: "10px 14px", borderLeft: "2px solid var(--ris-accent)", background: "var(--ris-accent-softer)", borderRadius: "0 8px 8px 0", fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 14, lineHeight: 1.55, color: "var(--ris-ink)" }}>
                    <Quote size={11} style={{ color: "var(--ris-accent)", marginRight: 4, verticalAlign: "baseline" }} />
                    {chunk.quote}
                  </blockquote>
                </DetailRow>
              )}

              {chunk.pm_note && chunk.pm_note.length > 0 && (
                <DetailRow label="PM note">
                  <div style={{ fontSize: 13, lineHeight: 1.5, color: "var(--ris-ink-2)", padding: "8px 12px", background: "var(--ris-paper-2)", borderRadius: 6 }}>
                    {chunk.pm_note}
                  </div>
                </DetailRow>
              )}
            </div>
          </>
        )}
      </aside>
    </>
  );
}

function DetailRow({ label, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div className="ris-eyebrow" style={{ marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 13.5, color: "var(--ris-ink-2)" }}>{children}</div>
    </div>
  );
}

function SignalsExplorer({ onEvidence }) {
  const [filter, setFilter] = useState("all");
  const filtered = useMemo(() => {
    if (filter === "all") return SIGNALS;
    return SIGNALS.filter(s => s.source_type === filter);
  }, [filter]);

  const filters = [
    { key: "all", label: `All · ${SIGNALS.length}` },
    ...Object.entries(SOURCE_META).map(([k, v]) => ({
      key: k,
      label: `${v.label} · ${SIGNALS.filter(s => s.source_type === k).length}`,
    })),
  ];

  return (
    <div>
      <div className="ris-row ris-space-sm" style={{ flexWrap: "wrap", marginBottom: 14 }}>
        {filters.map(f => (
          <button
            key={f.key}
            className={`ris-btn-ghost ${filter === f.key ? "" : ""}`}
            onClick={() => setFilter(f.key)}
            style={{
              borderColor: filter === f.key ? "var(--ris-ink)" : "var(--ris-hair)",
              color: filter === f.key ? "var(--ris-ink)" : "var(--ris-mute)",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div style={{ overflow: "auto", border: "1px solid var(--ris-hair)" }}>
        <table className="ris-table">
          <thead>
            <tr>
              <th style={{ width: 80 }}>ID</th>
              <th style={{ width: 44 }}>Src</th>
              <th style={{ width: 100 }}>Date</th>
              <th>Summary</th>
              <th style={{ width: 160 }}>Participant</th>
              <th style={{ width: 80 }}>Evidence</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id} onClick={() => onEvidence(s.id)}>
                <td><span className="ris-mono" style={{ fontSize: 11 }}>{s.id}</span></td>
                <td><SourceIcon source_type={s.source_type} /></td>
                <td className="ris-mono" style={{ fontSize: 11 }}>{s.date}</td>
                <td style={{ maxWidth: 420 }}>
                  <div style={{ color: "var(--ris-ink)", marginBottom: 2 }}>{s.summary}</div>
                  <div className="ris-mono" style={{ fontSize: 10.5, color: "var(--ris-mute)" }}>
                    {(s.topic_tags || []).slice(0, 3).join(" · ")}
                  </div>
                </td>
                <td style={{ fontSize: 12 }}>
                  <div>{s.participant?.role}</div>
                  <div className="ris-mono" style={{ fontSize: 10.5, color: "var(--ris-mute)" }}>
                    {(s.participant?.segment || "").replace(/_/g, " ")}
                  </div>
                </td>
                <td>
                  <div className="ris-row ris-space-sm">
                    <SeverityBar value={s.evidence_strength} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AgentInspector({ results, timings }) {
  const [active, setActive] = useState("ingestion");
  const agent = AGENT_SEQUENCE.find(a => a.id === active);
  const result = results[active];
  const ms = timings[active];

  return (
    <div>
      <div className="ris-row ris-space-sm" style={{ flexWrap: "wrap", marginBottom: 14 }}>
        {AGENT_SEQUENCE.map(a => {
          const has = !!results[a.id];
          return (
            <button
              key={a.id}
              className="ris-btn-ghost"
              onClick={() => setActive(a.id)}
              disabled={!has}
              style={{
                borderColor: active === a.id ? "var(--ris-ink)" : "var(--ris-hair)",
                color: active === a.id ? "var(--ris-ink)" : has ? "var(--ris-ink-2)" : "var(--ris-mute)",
                opacity: has ? 1 : 0.45,
              }}
            >
              {a.label}
              {has && timings[a.id] != null && (
                <span className="ris-mono" style={{ fontSize: 10.5, color: "var(--ris-mute)", marginLeft: 6 }}>
                  {(timings[a.id] / 1000).toFixed(1)}s
                </span>
              )}
            </button>
          );
        })}
      </div>

      {result != null ? (
        <>
          <div className="ris-row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <div className="ris-eyebrow">{agent?.label} · raw output</div>
            <button
              className="ris-btn-ghost"
              onClick={() => navigator.clipboard?.writeText(typeof result === "string" ? result : JSON.stringify(result, null, 2))}
              style={{ padding: "4px 8px" }}
            >
              <Copy size={11} /> Copy
            </button>
          </div>
          <pre className="ris-json">{typeof result === "string" ? result : JSON.stringify(result, null, 2)}</pre>
        </>
      ) : (
        <div className="ris-muted" style={{ fontSize: 13, padding: 24, textAlign: "center", border: "1px dashed var(--ris-hair)" }}>
          Run the pipeline to inspect {agent?.label} output.
        </div>
      )}
    </div>
  );
}

function CollapsibleSection({ title, eyebrow, defaultOpen = true, children, count }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section>
      <div className="ris-section-head" onClick={() => setOpen(o => !o)}>
        <div>
          {eyebrow && <div className="ris-eyebrow" style={{ marginBottom: 4 }}>{eyebrow}</div>}
          <div className="ris-row ris-space-sm">
            <h2 className="ris-serif ris-section-title" style={{ fontSize: 32, margin: 0, letterSpacing: "-0.015em", transition: "color 150ms ease" }}>
              {title}
            </h2>
            {count != null && (
              <span className="ris-mono" style={{ fontSize: 13, color: "var(--ris-mute)", marginLeft: 4 }}>[{count}]</span>
            )}
          </div>
        </div>
        {open ? <ChevronDown size={18} strokeWidth={1.5} style={{ color: "var(--ris-mute)" }} />
              : <ChevronRight size={18} strokeWidth={1.5} style={{ color: "var(--ris-mute)" }} />}
      </div>
      {open && <div style={{ paddingBottom: 28 }}>{children}</div>}
      <hr className="ris-divider" />
    </section>
  );
}

/* -------------------------------------------------------------------------
   11. APP — top-level orchestration
   ------------------------------------------------------------------------- */

export default function App() {
  const [mode, setMode] = useState("demo");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  // Per-agent status: { state: "idle"|"running"|"done"|"error" }
  const initialStatuses = useMemo(
    () => Object.fromEntries(AGENT_SEQUENCE.map(a => [a.id, { state: "idle" }])),
    []
  );
  const [statuses, setStatuses] = useState(initialStatuses);
  const [timings, setTimings] = useState({});
  const [results, setResults] = useState({});
  const [drawerSignal, setDrawerSignal] = useState(null);

  // Keep refs so orchestrator callbacks don't fight with stale closures
  const statusesRef = useRef(statuses);
  useEffect(() => { statusesRef.current = statuses; }, [statuses]);

  const hasRun = Object.keys(results).length > 0;

  const reset = () => {
    setStatuses(initialStatuses);
    setTimings({});
    setResults({});
    setError(null);
  };

  const run = async () => {
    reset();
    setRunning(true);
    try {
      await runPipeline(SIGNALS, mode, {
        onAgentStart: (id) => {
          setStatuses(prev => ({ ...prev, [id]: { state: "running" } }));
        },
        onAgentDone: (id, out, ms) => {
          setStatuses(prev => ({ ...prev, [id]: { state: "done" } }));
          setTimings(prev => ({ ...prev, [id]: ms }));
          setResults(prev => ({ ...prev, [id]: out }));
        },
        onError: (id, err) => {
          setStatuses(prev => ({ ...prev, [id]: { state: "error" } }));
          setError({ agent: id, message: err?.message || String(err) });
        },
      });
    } catch (e) {
      // onError already captured details with the correct agent name.
      // Use the functional form so we read React's current state, not
      // a stale closure value that will always be null here.
      setError(prev => prev ?? { agent: "unknown", message: e?.message || String(e) });
    } finally {
      setRunning(false);
    }
  };

  // Convenience derived slices
  const themes = results.themes?.themes || [];
  const contradictions = results.contradictions?.contradictions || [];
  const recommendations = results.recommendations?.recommendations || [];
  const critique = results.critic || null;
  const memo = results.memo || null;

  return (
    <div className="ris-root">
      <style>{STYLES}</style>

      <Header mode={mode} setMode={setMode} onReset={reset} hasRun={hasRun} />
      <HeroPanel onRun={run} running={running} hasRun={hasRun} mode={mode} />
      <Pipeline statuses={statuses} timings={timings} />

      {error && (
        <section style={{ maxWidth: 1240, margin: "0 auto", padding: "20px 28px 0" }}>
          <div className="ris-card" style={{ borderColor: "var(--ris-flag)", background: "rgba(166,75,42,0.04)" }}>
            <div className="ris-row ris-space-sm" style={{ alignItems: "flex-start" }}>
              <XCircle size={16} style={{ color: "var(--ris-flag)", flex: "none", marginTop: 2 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="ris-eyebrow" style={{ color: "var(--ris-flag)", marginBottom: 4 }}>
                  Pipeline error · {error.agent}
                </div>
                <div style={{
                  fontSize: 13, color: "var(--ris-ink-2)", marginBottom: 10,
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  wordBreak: "break-word", whiteSpace: "pre-wrap",
                  maxHeight: 200, overflow: "auto",
                }}>
                  {error.message}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--ris-mute)" }}>
                  Switch to <strong>DEMO</strong> to play back a hand-audited gold run, or
                  check the browser console for upstream-response diagnostics.
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <main style={{ maxWidth: 1240, margin: "0 auto", padding: "32px 28px 96px" }}>
        {/* THE MEMO — the headline deliverable */}
        {memo && (
          <CollapsibleSection eyebrow="Deliverable" title="The Brief" defaultOpen={true}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 260px", gap: 40 }} className="ris-two-col">
              <div className="ris-card raised" style={{ padding: "32px 40px", maxWidth: 780 }}>
                <MemoMarkdown markdown={memo} />
              </div>
              <aside style={{ position: "sticky", top: 20, alignSelf: "flex-start" }}>
                <div className="ris-eyebrow" style={{ marginBottom: 10 }}>At a glance</div>
                <div className="ris-stack" style={{ gap: 14 }}>
                  <StatLine label="Chunks audited"     value={SIGNALS.length} />
                  <StatLine label="Themes"             value={themes.length} />
                  <StatLine label="Contradictions"     value={contradictions.length} />
                  <StatLine label="Build"              value={recommendations.filter(r => r.category === "build").length} />
                  <StatLine label="Research"           value={recommendations.filter(r => r.category === "research").length} />
                  <StatLine label="Deprioritize"       value={recommendations.filter(r => r.category === "deprioritize").length} />
                  <StatLine label="Hard calls"         value={recommendations.filter(r => r.hard_call).length} />
                  <StatLine label="Confidence"         value={critique ? `${Math.round((critique.overall_confidence || 0) * 100)}%` : "—"} />
                </div>
                <hr className="ris-divider" style={{ margin: "16px 0" }} />
                <div style={{ fontSize: 11.5, color: "var(--ris-mute)", lineHeight: 1.5 }}>
                  Generated {mode === "demo" ? "from a hand-curated gold run" : `live via ${MODEL}`}.
                  Every claim ties to a chunk; click any <span className="ris-chip" style={{ cursor: "default" }}>chunk_000</span> chip below to see the source.
                </div>
              </aside>
            </div>
          </CollapsibleSection>
        )}

        {themes.length > 0 && (
          <CollapsibleSection eyebrow="Layer 2 · Theme agent" title="User pain clusters" count={themes.length} defaultOpen={true}>
            {themes.map(t => <ThemeCard key={t.id} theme={t} onEvidence={setDrawerSignal} />)}
          </CollapsibleSection>
        )}

        {contradictions.length > 0 && (
          <CollapsibleSection eyebrow="Layer 3 · Contradiction agent" title="Contradictions" count={contradictions.length} defaultOpen={true}>
            {contradictions.map(c => <ContradictionCard key={c.id} c={c} onEvidence={setDrawerSignal} />)}
          </CollapsibleSection>
        )}

        {recommendations.length > 0 && (
          <CollapsibleSection eyebrow="Layer 4 · Recommendation agent" title="What to build, research, deprioritize" count={recommendations.length} defaultOpen={true}>
            {(() => {
              // Group recommendations by category, preserve their order within each group.
              const groups = [
                { key: "build",        label: "Build",        Icon: Hammer,      desc: "Ship something concrete" },
                { key: "research",     label: "Research more", Icon: Microscope, desc: "Gather more signal first" },
                { key: "deprioritize", label: "Deprioritize",  Icon: MinusCircle, desc: "Stop or scale down a current bet" },
              ];
              // Track absolute index across all categories so card numbering stays continuous
              let absoluteIdx = 0;
              return groups.map(g => {
                const inGroup = recommendations.filter(r => r.category === g.key);
                if (inGroup.length === 0) return null;
                const Icon = g.Icon;
                return (
                  <div key={g.key} style={{ marginBottom: 24 }}>
                    <div className="ris-row ris-space-sm" style={{ marginBottom: 12, alignItems: "baseline" }}>
                      <Icon size={16} strokeWidth={1.75} style={{ color: "var(--ris-mute)" }} />
                      <h3 className="ris-serif" style={{ fontSize: 22, margin: 0, letterSpacing: "-0.01em", color: "var(--ris-ink)" }}>{g.label}</h3>
                      <span className="ris-mono" style={{ fontSize: 11, color: "var(--ris-mute)" }}>· {g.desc} · {inGroup.length}</span>
                    </div>
                    {inGroup.map(r => {
                      const card = <RecommendationCard key={r.id} r={r} idx={absoluteIdx} onEvidence={setDrawerSignal} />;
                      absoluteIdx++;
                      return card;
                    })}
                  </div>
                );
              });
            })()}
          </CollapsibleSection>
        )}

        {critique && (
          <CollapsibleSection eyebrow="Layer 5 · Critic agent" title="Self-critique" defaultOpen={true}>
            <CritiqueCard critique={critique} />
          </CollapsibleSection>
        )}

        <CollapsibleSection
          eyebrow="Raw input"
          title="Interview corpus"
          count={SIGNALS.length}
          defaultOpen={!hasRun}
        >
          <SignalsExplorer onEvidence={setDrawerSignal} />
        </CollapsibleSection>

        {hasRun && (
          <CollapsibleSection eyebrow="Debug" title="Agent Inspector" defaultOpen={false}>
            <AgentInspector results={results} timings={timings} />
          </CollapsibleSection>
        )}

        {!hasRun && !running && (
          <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--ris-mute)", fontSize: 13.5 }}>
            <Sparkles size={16} strokeWidth={1.5} style={{ marginBottom: 8, opacity: 0.6 }} />
            <div>Press <span className="ris-strong">Run discovery synthesis</span> to compile this round's brief.</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>
              Demo mode is preloaded. Live mode calls <span className="ris-mono">{MODEL}</span> in-browser.
            </div>
          </div>
        )}
      </main>

      <footer style={{ borderTop: "1px solid var(--ris-hair)", background: "rgba(255,255,255,0.30)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "20px 28px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div className="ris-eyebrow">Remix Discovery Studio · MVP · Synthetic data</div>
          <div className="ris-mono" style={{ fontSize: 11, color: "var(--ris-mute)" }}>
            {AGENT_SEQUENCE.length} agents · {SIGNALS.length} chunks · model: {MODEL}
          </div>
        </div>
      </footer>

      <EvidenceDrawer signalId={drawerSignal} onClose={() => setDrawerSignal(null)} />
    </div>
  );
}

function StatLine({ label, value }) {
  return (
    <div className="ris-row" style={{ justifyContent: "space-between", alignItems: "baseline", borderBottom: "1px solid var(--ris-hair)", paddingBottom: 8 }}>
      <span style={{ fontSize: 12, color: "var(--ris-mute)" }}>{label}</span>
      <span className="ris-serif" style={{ fontSize: 22, letterSpacing: "-0.01em" }}>{value}</span>
    </div>
  );
}
