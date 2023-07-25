import * as apiV1 from "./api-v1";

interface ClassSpecIds {
  class: number;
  spec: number;
}

async function getClassSpec(): Promise<Record<string, ClassSpecIds>> {
  const out: Record<string, ClassSpecIds> = {};
  const data = await apiV1.getClasses();

  for (const cl of data) {
    const name = cl.name.replace(/\s/g, "");

    for (const sp of cl.specs) {
      const key = `${name}-${sp.name.replace(/\s/g, "")}`;
      out[key] = { class: cl.id, spec: sp.id };
    }
  }

  return out;
}

export const CLASSES = await getClassSpec();
