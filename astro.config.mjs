import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwind from "@astrojs/tailwind";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import remarkMermaid from "remark-mermaidjs";

export default defineConfig({
  site: "https://www.claudiu-ivan.com",
  integrations: [
    mdx({
      remarkPlugins: [remarkMath, remarkMermaid],
      rehypePlugins: [rehypeKatex],
    }),
    sitemap(),
    tailwind(),
  ],
});
