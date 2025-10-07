import { z } from 'zod';

import { GraphNodeTypeSchema, NonEmptyString, PositiveInt } from './common';

export const SearchScopeSchema = z
  .object({
    sourceIds: z.array(NonEmptyString).optional(),
    types: z.array(GraphNodeTypeSchema).optional(),
    limit: PositiveInt.max(50).default(10),
  })
  .partial();

export type SearchScope = z.infer<typeof SearchScopeSchema>;

export const SearchSemanticRequestSchema = z.object({
  q: NonEmptyString,
  scope: SearchScopeSchema.nullish(),
});

export type SearchSemanticRequest = z.infer<typeof SearchSemanticRequestSchema>;

export const SearchResultItemSchema = z.object({
  id: NonEmptyString,
  type: GraphNodeTypeSchema,
  score: z.number().min(0).max(1),
  title: NonEmptyString,
  description: z.string().optional(),
  sourceId: NonEmptyString.optional(),
});

export type SearchResultItem = z.infer<typeof SearchResultItemSchema>;

export const SearchResultsSchema = z.object({
  items: z.array(SearchResultItemSchema),
  query: NonEmptyString,
  scope: SearchScopeSchema.nullish(),
  total: PositiveInt.optional(),
});

export type SearchResults = z.infer<typeof SearchResultsSchema>;
