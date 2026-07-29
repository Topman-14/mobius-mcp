// Cap on how many elements a single snapshot_page call will index — a runaway page (huge
// table, infinite-scroll feed) shouldn't turn one tool call into megabytes of tree.
export const MAX_SNAPSHOT_ELEMENTS = 500;

export const ACCESSIBLE_NAME_MAX_CHARS = 200;

export const INTERACTIVE_TAGS = new Set(["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA", "SUMMARY", "OPTION"]);

export const INTERACTIVE_ROLES = new Set([
  "button",
  "link",
  "checkbox",
  "radio",
  "textbox",
  "combobox",
  "listbox",
  "menuitem",
  "option",
  "switch",
  "tab",
  "slider",
  "spinbutton",
]);

export const ROLE_BY_TAG: Record<string, string> = {
  A: "link",
  BUTTON: "button",
  SUMMARY: "button",
  SELECT: "combobox",
  TEXTAREA: "textbox",
  OPTION: "option",
  IMG: "img",
  H1: "heading",
  H2: "heading",
  H3: "heading",
  H4: "heading",
  H5: "heading",
  H6: "heading",
};
