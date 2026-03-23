import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  projects: defineTable({
    title: v.string(),
    description: v.string(),
    href: v.string(),
    order: v.number(),
  }).index("by_order", ["order"]),

  users: defineTable({
    email: v.optional(v.string()),
    role: v.optional(v.union(v.literal("admin"), v.literal("subscriber"))),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    emailVerificationTime: v.optional(v.float64()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.float64()),
    isAnonymous: v.optional(v.boolean()),
  }).index("by_email", ["email"]),

  resources: defineTable({
    title: v.string(),
    description: v.string(),
    content: v.string(),
    published: v.boolean(),
  }),
});
