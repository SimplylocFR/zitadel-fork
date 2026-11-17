import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { LoginOTP } from "./login-otp";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/lib/actions/session", () => ({
  updateOrCreateSession: vi.fn(),
}));

vi.mock("@/lib/actions/flow", () => ({
  handleServerActionResponse: vi.fn(),
  completeFlowOrGetUrl: vi.fn(),
}));

describe("LoginOTP", () => {
  let mockUpdateOrCreateSession: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { updateOrCreateSession } = await import("@/lib/actions/session");
    mockUpdateOrCreateSession = vi.mocked(updateOrCreateSession);
  });

  afterEach(cleanup);

  test("should autofocus the code input on mount", () => {
    const { getByTestId } = render(<LoginOTP method="time-based" />);
    expect(getByTestId("code-text-input")).toHaveFocus();
  });

  const cell = (i: number) => screen.getByTestId(i === 0 ? "code-text-input" : `code-text-input-${i}`);
  const type = (digits: string) => digits.split("").forEach((d, i) => fireEvent.change(cell(i), { target: { value: d } }));

  test("should render one cell per digit: 6 for a TOTP code, 8 for an email code", () => {
    const { unmount } = render(<LoginOTP method="time-based" />);
    expect(document.querySelectorAll("input[data-testid^='code-text-input']")).toHaveLength(6);
    unmount();

    mockUpdateOrCreateSession.mockResolvedValue({});
    render(<LoginOTP method="email" />);
    expect(document.querySelectorAll("input[data-testid^='code-text-input']")).toHaveLength(8);
  });

  test("should display translated fallback error when OTP verification request rejects", async () => {
    mockUpdateOrCreateSession.mockRejectedValueOnce(new Error("network down"));

    render(<LoginOTP method="time-based" />);

    // completing the last cell submits the code
    type("123456");

    await waitFor(() => {
      expect(screen.getByText("errors.couldNotVerifyCode")).toBeInTheDocument();
    });
  });

  test("should submit the TOTP code once its 6 digits are typed", async () => {
    mockUpdateOrCreateSession.mockResolvedValue({});

    render(<LoginOTP method="time-based" loginName="user@example.com" />);
    type("654321");

    await waitFor(() => expect(mockUpdateOrCreateSession).toHaveBeenCalledTimes(1));
    expect(mockUpdateOrCreateSession.mock.calls[0][0].checks.totp.code).toBe("654321");
  });

  test("should submit the typed code, not an empty one, when the submit button is used", async () => {
    mockUpdateOrCreateSession.mockResolvedValue({});

    render(<LoginOTP method="email" loginName="user@example.com" code="" />);
    await waitFor(() => expect(mockUpdateOrCreateSession).toHaveBeenCalledTimes(1)); // email challenge request
    mockUpdateOrCreateSession.mockClear();

    type("1234"); // incomplete: no automatic submission
    expect(mockUpdateOrCreateSession).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("submit-button"));

    await waitFor(() => expect(mockUpdateOrCreateSession).toHaveBeenCalledTimes(1));
    expect(mockUpdateOrCreateSession.mock.calls[0][0].checks.otpEmail.code).toBe("1234");
  });

  test("should fall back to the code from the email link when nothing is typed", async () => {
    mockUpdateOrCreateSession.mockResolvedValue({});

    render(<LoginOTP method="email" loginName="user@example.com" code="87654321" />);
    fireEvent.click(screen.getByTestId("submit-button"));

    await waitFor(() => expect(mockUpdateOrCreateSession).toHaveBeenCalledTimes(1));
    expect(mockUpdateOrCreateSession.mock.calls[0][0].checks.otpEmail.code).toBe("87654321");
  });

  test("should display translated fallback error when OTP challenge request rejects", async () => {
    mockUpdateOrCreateSession.mockRejectedValueOnce(new Error("challenge request failed"));

    render(<LoginOTP method="sms" />);

    expect(screen.getByRole("button", { name: "verify.resendCode" })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("errors.couldNotRequestChallenge")).toBeInTheDocument();
    });
  });
});
