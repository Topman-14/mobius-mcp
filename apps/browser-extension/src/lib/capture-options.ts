import { defineSetting } from "./storage.js";

export interface CaptureOptions {
  console: boolean;
  network: boolean;
  errors: boolean;
  dom: boolean;
}

export interface PrivacyOptions {
  redactHeaders: boolean;
  redactCookies: boolean;
  redactLocalStorage: boolean;
  maskEmails: boolean;
  maskJwts: boolean;
}

export const DEFAULT_CAPTURE_OPTIONS: CaptureOptions = {
  console: true,
  network: true,
  errors: true,
  dom: false,
};

export const DEFAULT_PRIVACY_OPTIONS: PrivacyOptions = {
  redactHeaders: true,
  redactCookies: true,
  redactLocalStorage: false,
  maskEmails: false,
  maskJwts: true,
};

export const captureOptionsSetting = defineSetting("captureOptions", DEFAULT_CAPTURE_OPTIONS);
export const privacyOptionsSetting = defineSetting("privacyOptions", DEFAULT_PRIVACY_OPTIONS);
