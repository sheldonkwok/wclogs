import z from "zod";

export const ZAuth = z.object({
  access_token: z.string(),
  expires_in: z.number(),
});
