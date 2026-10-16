import { defineCollection } from "astro:content";
import { docsSchema } from "@astrojs/starlight/schema";
import { docsLoaderWithDerivedTitles } from "./derived-title-loader.mjs";

export const collections = {
  docs: defineCollection({ loader: docsLoaderWithDerivedTitles(), schema: docsSchema() }),
};
