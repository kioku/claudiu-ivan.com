import type { Site, Metadata, Socials } from "@types";

export const SITE: Site = {
  NAME: "Claudiu Ivan",
  EMAIL: "contact@claudiu-ivan.com",
  NUM_POSTS_ON_HOMEPAGE: 3,
  NUM_WORKS_ON_HOMEPAGE: 0,
  NUM_PROJECTS_ON_HOMEPAGE: 0,
};

export const AUTHOR = {
  NAME: "Claudiu Ivan",
  JOB_TITLE: "Principal System Architect",
  DESCRIPTION:
    "Principal System Architect specializing in type-driven development, distributed systems, and deterministic architecture. Founder of Software Foundry, providing architectural consulting for data-intensive platforms.",
  EXPERTISE: [
    "System Architecture",
    "Distributed Systems",
    "Type Theory",
    "Functional Programming",
    "Platform Engineering",
    "Data-Intensive Applications",
  ],
  TWITTER_HANDLE: "@claudiuivan",
};

export const SOFTWARE_FOUNDRY = {
  NAME: "Software Foundry",
  URL: "https://softwarefoundry.ch",
  DESCRIPTION:
    "Architectural consulting practice specializing in mission-critical platform development for organizations building data-intensive systems.",
};

export const HOME: Metadata = {
  TITLE: "Principal System Architect",
  DESCRIPTION:
    "Claudiu Ivan is a Principal System Architect specializing in type-driven development and distributed systems. Founder of Software Foundry, providing architectural consulting for data-intensive platforms.",
};

export const BLOG: Metadata = {
  TITLE: "Writing",
  DESCRIPTION:
    "Technical articles by Claudiu Ivan on type-driven development, distributed systems, and software architecture.",
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
