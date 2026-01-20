import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { HOME, AUTHOR, SITE } from "@consts";

type Context = {
  site: string;
};

export async function GET(context: Context) {
  const writing = (await getCollection("writing")).filter(
    (article) => !article.data.draft
  );

  const projects = (await getCollection("projects")).filter(
    (project) => !project.data.draft
  );

  const items = [...writing, ...projects].sort(
    (a, b) => new Date(b.data.date).valueOf() - new Date(a.data.date).valueOf()
  );

  return rss({
    title: HOME.TITLE,
    description: HOME.DESCRIPTION,
    site: context.site,
    customData: `<language>en-us</language>
<managingEditor>${SITE.EMAIL} (${AUTHOR.NAME})</managingEditor>
<webMaster>${SITE.EMAIL} (${AUTHOR.NAME})</webMaster>`,
    items: items.map((item) => ({
      title: item.data.title,
      description: item.data.description,
      pubDate: item.data.date,
      link: `/${item.collection}/${item.slug}/`,
      author: `${SITE.EMAIL} (${AUTHOR.NAME})`,
    })),
  });
}
