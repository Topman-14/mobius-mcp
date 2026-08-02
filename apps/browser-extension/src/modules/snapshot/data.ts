export const MAX_SNAPSHOT_ELEMENTS = 150;

export const ACCESSIBLE_NAME_MAX_CHARS = 200;

export const MAX_FIND_RESULTS = 20;

export const FIND_MIN_SCORE = 3;

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

export const FIND_STOP_WORDS = new Set(["a", "an", "the", "of", "for", "to", "in", "on", "with", "that", "this", "any", "some", "my"]);

export const FIND_ROLE_SYNONYMS: Record<string, string[]> = {
  button: ["button", "btn", "submit", "cta"],
  link: ["link", "anchor"],
  textbox: ["field", "input", "textbox", "box", "bar", "search", "email", "password", "textarea"],
  combobox: ["dropdown", "select", "combobox", "picker"],
  checkbox: ["checkbox", "check", "toggle"],
  radio: ["radio"],
  tab: ["tab"],
  heading: ["heading", "title", "header"],
  img: ["image", "img", "picture", "photo", "icon", "logo"],
};
