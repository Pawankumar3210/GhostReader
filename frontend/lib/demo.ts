import type { AnalysisResult, ScenarioInfo } from "@/types/api";

function paragraph(text: string) {
  return {
    type: "paragraph" as const,
    text,
    level: null,
    items: null,
    image_url: null,
    proxy_url: null,
    alt: null,
    caption: null,
    attribution: null,
  };
}

function heading(text: string, level = 2) {
  return {
    type: "heading" as const,
    text,
    level,
    items: null,
    image_url: null,
    proxy_url: null,
    alt: null,
    caption: null,
    attribution: null,
  };
}

export const demoArticle: AnalysisResult = {
  source_url: "https://ghostreader.app/demo/quiet-architecture",
  canonical_url: "https://ghostreader.app/demo/quiet-architecture",
  publisher: "The Ghost Review",
  title: "The quiet architecture of attention",
  subtitle: "Notes on reading, rooms and the shape of a page",
  author: "Mira Sen",
  published_at: "2026-09-14T08:00:00Z",
  updated_at: "2026-09-16T10:30:00Z",
  description:
    "A sample edition exploring how the design of a page shapes the quality of our attention — and what a humane reader might look like.",
  language: "en",
  content_type: "BLOG_ARTICLE",
  access_status: "PUBLIC_FULL",
  word_count: 912,
  reading_time_minutes: 5,
  fetched_via: "http",
  extractor: "ghost-reader-demo",
  source_metadata: {
    "og:site_name": "The Ghost Review",
    "article:published_time": "2026-09-14T08:00:00Z",
    "reader:fixture": "sample-edition",
  },
  access_assessment: {
    status: "PUBLIC_FULL",
    confidence: "high",
    explanation:
      "This is a bundled sample edition. In a live analysis, Ghost Reader would report the publisher's own public signals here — structured data, visible access notices, HTTP status and the amount of article text available.",
    evidence: [
      "The edition is bundled locally and requires no network request.",
      "The sample represents a fully public article with no account requirement.",
      "Access evidence and extraction notes travel with every real edition.",
    ],
  },
  notes: [
    "Sample edition: no third-party page was fetched.",
    "Images are bundled locally and are not proxied.",
    "Typography controls and themes behave exactly as they do in a live edition.",
  ],
  images: [
    {
      url: "/demo-illustration.svg",
      proxy_url: null,
      caption:
        "A reading room is mostly a negotiation between light, silence and the shape of a page. Illustration: The Ghost Review.",
      alt: "A quiet reading room with an arched window, an armchair and a stack of books",
      width: 1200,
      height: 640,
      attribution: "The Ghost Review archive",
    },
  ],
  newspaper_pages: [],
  content: [
    paragraph(
      "Attention is a place before it is a resource. We build rooms for it, then wonder why the walls keep moving. A page can be generous or hostile; most are merely loud. The average article arrives wrapped in eleven requests, four overlays and a small parliament of prompts asking us to stay, subscribe, share or consent. We call this reading, though it more closely resembles crowd control.",
    ),
    paragraph(
      "The quiet architecture begins with subtraction. A measure of text. A single column. A heading that knows its place. When the furniture of a page stops competing with the sentence, something old and ordinary returns: the feeling of being addressed by one mind to another, across a distance that does not need to be closed.",
    ),
    heading("The room and the rule"),
    paragraph(
      "Print taught us that a page is a room with rules. The margin is a hallway; the headline is a lintel; the caption is a whisper beneath a picture. None of these conventions are natural. They were invented, argued over, and refined by people who cared about the difference between reading and merely seeing words.",
    ),
    paragraph(
      "Digital layout inherited the vocabulary but not the patience. A webpage can resize itself, remember us, interrupt us, measure us. The capacity for infinite adjustment became an excuse for infinite adjustment. Somewhere between the breakpoint and the pop-up, the room forgot it was a room.",
    ),
    {
      type: "quote",
      text: "To read well is to choose a boundary — a column, a measure, a moment that does not ask to be shared.",
      level: null,
      items: null,
      image_url: null,
      proxy_url: null,
      alt: null,
      caption: null,
      attribution: "Mira Sen",
    },
    heading("What a reader owes the page"),
    paragraph(
      "A good reader is not neutral. It makes arguments about hierarchy, emphasis and sequence. It decides that a sidebar is noise and a footnote is treasure. It chooses a typeface with a pulse and a line length that respects the eye. These choices are editorial, not technical, and they should be visible.",
    ),
    paragraph(
      "That visibility matters because extraction is interpretation. When a machine removes a navigation bar and keeps a paragraph, it is making a judgement about what belongs to the article. When it stitches a caption to an image, or refuses to print a paywalled paragraph as though it were free, it is drawing a line between access and trespass.",
    ),
    {
      type: "image",
      text: null,
      level: null,
      items: null,
      image_url: "/demo-illustration.svg",
      proxy_url: null,
      alt: "A quiet reading room with an arched window, an armchair and a stack of books",
      caption:
        "The reading room at the end of the day. Good interfaces, like good rooms, make space before they make demands.",
      attribution: "The Ghost Review archive",
    },
    heading("Three habits of humane reading software"),
    {
      type: "list",
      text: null,
      level: null,
      items: [
        "Show the boundary: say clearly what is public, what is a preview and what requires access.",
        "Keep the evidence: let the reader inspect why a page was classified, extracted or refused.",
        "Remember locally: a reading history is intimate data and belongs with the reader, not a growth team.",
      ],
      image_url: null,
      proxy_url: null,
      alt: null,
      caption: null,
      attribution: null,
    },
    paragraph(
      "None of these habits are technically exotic. They are design decisions that follow from a single premise: the person reading is not the product. Once that premise is accepted, the interface becomes quieter almost by itself. Buttons lose their urgency. Notifications lose their claim on the present tense. The page becomes a place you can leave.",
    ),
    heading("The shape of enough"),
    paragraph(
      "There is a moment, at the end of a well-made page, when the text simply stops. No algorithmic tail of recommendations. No infinite scroll. Just the small, civil fact of an ending. We have spent two decades engineering ways to prevent that moment. It may be the most valuable thing a reader can restore.",
    ),
    paragraph(
      "This sample edition ends there too — not because there is nothing more to say, but because an ending is part of the architecture. The page is a room. The sentence is a guest. At some point, the light goes out.",
    ),
  ],
};

export const demoScenarios: ScenarioInfo[] = [
  {
    id: "public-content",
    title: "Public content, honestly extracted",
    category: "Transparency",
    summary:
      "A synthetic public article is fetched, classified and extracted with provenance kept intact.",
    expected_result: "PUBLIC_FULL · readable content · evidence attached",
    security_implications: [
      "Open content can still contain tracking pixels and misleading metadata.",
      "Provenance should travel with extracted text.",
    ],
    mitigation: ["Record the evidence used for access classification.", "Proxy remote images."],
  },
  {
    id: "client-side-restriction",
    title: "The overlay that only looks like a wall",
    category: "Access boundaries",
    summary:
      "A client-side overlay hides text that is already present in the response. Ghost Reader reports the mismatch instead of treating the overlay as permission.",
    expected_result: "PUBLIC_PARTIAL · overlay evidence · no bypass",
    security_implications: [
      "Client-side gates are not access control.",
      "Reporting visible restrictions without circumventing them preserves trust.",
    ],
    mitigation: ["Never remove overlays to reveal content.", "Attach evidence to the verdict."],
  },
  {
    id: "server-side-protection",
    title: "A wall that is actually a wall",
    category: "Access boundaries",
    summary:
      "The server returns a protected response without article text. The assessment stops at the boundary.",
    expected_result: "LOGIN_REQUIRED or SUBSCRIPTION_REQUIRED · no content",
    security_implications: [
      "Authenticated content must not be reconstructed from caches.",
      "Status codes and access notices must be respected.",
    ],
    mitigation: ["Refuse to render protected text.", "Explain the limit plainly to the reader."],
  },
  {
    id: "metadata-exposure",
    title: "Metadata has a shadow",
    category: "Exposure",
    summary:
      "A document carries author, software and revision fields that are not visible in the body. Ghost Reader surfaces them as metadata, not article content.",
    expected_result: "Metadata disclosed as evidence · body text respected",
    security_implications: [
      "PDF and image metadata can leak identities and internal paths.",
      "Metadata must not be confused with readable content.",
    ],
    mitigation: ["Expose metadata in a separate panel.", "Warn before exporting or sharing."],
  },
  {
    id: "secure-document-delivery",
    title: "The signed image",
    category: "Integrity",
    summary:
      "Images are delivered through short-lived signed URLs, preventing the reader from becoming an open proxy.",
    expected_result: "Unsigned requests rejected · signed requests proxied",
    security_implications: [
      "Open image proxies can be abused for SSRF and bandwidth laundering.",
      "Signed, expiring URLs keep delivery scoped to an analysis.",
    ],
    mitigation: ["HMAC-sign every image URL.", "Expire signatures and validate targets again."],
  },
];
