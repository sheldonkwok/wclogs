import * as keys from "../lib/keys";

export const get = async () => {
  const reports = await keys.getKeys();
  return { body: JSON.stringify(reports) };
};
