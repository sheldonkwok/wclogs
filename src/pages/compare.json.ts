import * as compare from "../lib/compare";
import * as keys from "../lib/keys";

export async function get() {
  return {
    body: JSON.stringify(
      await compare.getCompareURL({
        reportId: "B38wrkVncvR4xNaW",
        fightId: 1,
        classSpec: "Monk-Mistweaver",
        mainAffix: keys.TYRANNICAL,
        encounterId: 12527,
      })
    ),
  };
}
