import type { Site, Metadata, Socials } from "@types";

export const SITE: Site = {
  NAME: "Claudiu Ivan",
  EMAIL: "contact@claudiu-ivan.com",
  NUM_POSTS_ON_HOMEPAGE: 3,
  NUM_WORKS_ON_HOMEPAGE: 0,
  NUM_PROJECTS_ON_HOMEPAGE: 0,
};

export const HOME: Metadata = {
  TITLE: "Principal Architect of High-Performance Financial Platforms",
  DESCRIPTION:
    "Specialist consultant and architect designing resilient, scalable, and data-intensive systems for the FinTech and InsurTech industries.",
};

export const BLOG: Metadata = {
  TITLE: "Writing",
  DESCRIPTION: "A collection of articles that I have written.",
};

export const WORK: Metadata = {
  TITLE: "Work",
  DESCRIPTION: "Where I have worked and what I have done.",
};

export const PROJECTS: Metadata = {
  TITLE: "Projects",
  DESCRIPTION:
    "A collection of my projects, with links to repositories and demos.",
};

export const SOCIALS: Socials = [
  {
    NAME: "twitter-x",
    HREF: "https://twitter.com/claudiuivan",
  },
  {
    NAME: "bluesky",
    HREF: "https://bsky.app/profile/claudiu-ivan.com",
  },
  {
    NAME: "github",
    HREF: "https://github.com/kioku",
  },
];
