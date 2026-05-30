import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwind from "@astrojs/tailwind";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
export default defineConfig({
  site: "https://www.claudiu-ivan.com",
  integrations: [
    mdx({
      remarkPlugins: [remarkMath],
      rehypePlugins: [rehypeKatex],
    }),
    sitemap({
      filter: (page) => !page.includes("/writing/data-access-with-lenses/"),
    }),
    tailwind(),
  ],
});
