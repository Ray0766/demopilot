import { recipeSchema, type Recipe } from "./schema.js";

export function exampleRecipe(origin = "http://127.0.0.1:4310"): Recipe {
  return recipeSchema.parse({
    version: 1,
    title: "Create a project in Littleboard",
    url: `${origin}/sample`,
    template: "studio",
    steps: [
      {
        id: "create",
        action: "click",
        target: "role:button:New project",
        waitFor: "#dialog",
        caption: "Open the new project form.",
        holdMs: 2200,
        zoom: 1.35,
      },
      {
        id: "name",
        action: "fill",
        target: "label:Project name",
        value: "Launch a little sooner",
        caption: "Enter a project name.",
        holdMs: 1600,
        zoom: 1.3,
      },
      {
        id: "save",
        action: "click",
        target: "role:button:Create project",
        waitFor: "text:Launch a little sooner",
        caption: "Create the project and find it on the board.",
        holdMs: 2800,
        zoom: 1.35,
      },
    ],
  });
}
