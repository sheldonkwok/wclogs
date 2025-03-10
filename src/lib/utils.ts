import { type } from "arktype";

export const Auth = type({
  access_token: "string",
  expires_in: "number",
});
