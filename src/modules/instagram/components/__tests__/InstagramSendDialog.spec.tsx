/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { InstagramSendDialog } from "../InstagramSendDialog";

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("InstagramSendDialog", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const defaultProps = {
    leadId: "lead-1",
    leadName: "John Doe",
    instagramScopedId: "ig-scoped-123",
    instagramHandle: "@johndoe",
  };

  it("renders textarea and send button", () => {
    render(<InstagramSendDialog {...defaultProps} />);

    expect(
      screen.getByPlaceholderText(/escribí tu mensaje/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /enviar/i })
    ).toBeInTheDocument();
  });

  it("shows 'No Instagram connected' when no handle or scopedId", () => {
    render(
      <InstagramSendDialog
        leadId="lead-1"
        leadName="John Doe"
        instagramHandle={undefined}
        instagramScopedId={undefined}
      />
    );

    const messages = screen.getAllByText(/no hay instagram conectado/i);
    expect(messages).toHaveLength(2);
    expect(screen.getByRole("button", { name: /enviar/i })).toBeDisabled();
  });

  it("calls the API on send", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ messageId: "msg-1" }),
    });

    render(<InstagramSendDialog {...defaultProps} />);

    const textarea = screen.getByPlaceholderText(/escribí tu mensaje/i);
    fireEvent.change(textarea, { target: { value: "Hola, cómo estás?" } });

    const sendButton = screen.getByRole("button", { name: /enviar/i });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/leads/lead-1/instagram/send",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: "Hola, cómo estás?" }),
        })
      );
    });
  });

  it("shows success state after send", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ messageId: "msg-1" }),
    });

    render(<InstagramSendDialog {...defaultProps} />);

    const textarea = screen.getByPlaceholderText(/escribí tu mensaje/i);
    fireEvent.change(textarea, { target: { value: "Test message" } });

    const sendButton = screen.getByRole("button", { name: /enviar/i });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText(/mensaje enviado/i)).toBeInTheDocument();
    });
  });

  it("shows error state on failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    render(<InstagramSendDialog {...defaultProps} />);

    const textarea = screen.getByPlaceholderText(/escribí tu mensaje/i);
    fireEvent.change(textarea, { target: { value: "Test message" } });

    const sendButton = screen.getByRole("button", { name: /enviar/i });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText(/error al enviar/i)).toBeInTheDocument();
    });
  });

  it("clears textarea after successful send", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ messageId: "msg-1" }),
    });

    render(<InstagramSendDialog {...defaultProps} />);

    const textarea = screen.getByPlaceholderText(
      /escribí tu mensaje/i
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Test message" } });

    const sendButton = screen.getByRole("button", { name: /enviar/i });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(textarea.value).toBe("");
    });
  });

  it("shows loading state during send", async () => {
    // Don't resolve the fetch yet — keep it pending
    mockFetch.mockImplementationOnce(
      () =>
        new Promise(() => {
          /* never resolves */
        })
    );

    render(<InstagramSendDialog {...defaultProps} />);

    const textarea = screen.getByPlaceholderText(/escribí tu mensaje/i);
    fireEvent.change(textarea, { target: { value: "Test message" } });

    const sendButton = screen.getByRole("button", { name: /enviar/i });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText(/enviando/i)).toBeInTheDocument();
    });
  });
});
