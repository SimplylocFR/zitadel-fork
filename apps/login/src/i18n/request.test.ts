import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("next-intl/server", () => ({
  getRequestConfig: (fn: unknown) => fn,
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: () => undefined })),
  headers: vi.fn(async () => new Headers()),
}));

vi.mock("@/lib/server/service-url", () => ({
  getServiceConfig: vi.fn(() => ({ serviceConfig: { baseUrl: "https://example.com" } })),
}));

vi.mock("@/lib/server/zitadel", () => ({
  getAllowedLanguages: vi.fn(async () => ({ allowedLanguages: [], defaultLanguage: "fr" })),
  getHostedLoginTranslation: vi.fn(),
}));

import { getHostedLoginTranslation } from "@/lib/server/zitadel";
import frMessages from "../../locales/fr.json";
import getConfig from "./request";

const resolveMessages = async () => (await (getConfig as unknown as () => Promise<{ messages: any }>)()).messages;

describe("i18n request config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("the bundled locale wins over the default texts served by the API", async () => {
    vi.mocked(getHostedLoginTranslation).mockResolvedValue({
      loginname: { title: "Bienvenue!", description: "Entrez vos données de connexion." },
      register: { description: "Créez votre compte Zitadel." },
    } as never);

    const messages = await resolveMessages();

    expect(messages.loginname.title).toBe(frMessages.loginname.title);
    expect(messages.loginname.title).not.toBe("Bienvenue!");
    // an intentionally empty text must stay empty instead of being refilled by the API default
    expect(frMessages.register.description).toBe("");
    expect(messages.register.description).toBe("");
  });

  test("texts that only exist in the hosted translations are still served", async () => {
    vi.mocked(getHostedLoginTranslation).mockResolvedValue({ extra: { onlyInApi: "from API" } } as never);

    const messages = await resolveMessages();

    expect(messages.extra.onlyInApi).toBe("from API");
    expect(messages.loginname.title).toBe(frMessages.loginname.title);
  });

  test("falls back to the bundled locale when the hosted translations are unavailable", async () => {
    vi.mocked(getHostedLoginTranslation).mockRejectedValue(new Error("not found"));

    const messages = await resolveMessages();

    expect(messages.loginname.title).toBe(frMessages.loginname.title);
  });
});
