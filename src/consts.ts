import type { Site, Metadata, Socials } from "@types";

export const SITE: Site = {
  NAME: "Claudiu Ivan",
  EMAIL: "contact@claudiu-ivan.com",
  NUM_POSTS_ON_HOMEPAGE: 3,
  NUM_WORKS_ON_HOMEPAGE: 0,
  NUM_PROJECTS_ON_HOMEPAGE: 0,
};

export const HOME: Metadata = {
  TITLE: "Principal System Architect",
  DESCRIPTION:
    "Technical writing by Claudiu Ivan on functional programming patterns, type-driven design, and building principled software systems.",
};

export const BLOG: Metadata = {
  TITLE: "Writing",
  DESCRIPTION: "Technical explorations in functional programming patterns, type-driven design, and principled software systems.",
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
