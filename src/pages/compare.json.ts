import * as compare from "../lib/compare";

export async function get() {
  return { body: JSON.stringify(compare.CLASSES) };
}
