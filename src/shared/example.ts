import { recipeSchema, type Recipe } from "./schema.js";

export function exampleRecipe(origin = "http://127.0.0.1:4310"): Recipe {
  return recipeSchema.parse({
    version: 1,
    title: "A little less busywork",
    url: `${origin}/sample`,
    template: "studio",
    steps: [
      {
        id: "create",
        action: "click",
        target: "role:button:New project",
        caption: "Make room for your next idea.",
        holdMs: 2200,
        zoom: 1,
      },
      {
        id: "name",
        action: "fill",
        target: "label:Project name",
        value: "Launch a little sooner",
        caption: "Give it a name worth shipping.",
        holdMs: 1600,
        zoom: 1.3,
      },
      {
        id: "save",
        action: "click",
        target: "role:button:Create project",
        waitFor: "text:Launch a little sooner",
        caption: "One place to move your work forward.",
        holdMs: 2800,
        zoom: 1,
      },
    ],
  });
}
