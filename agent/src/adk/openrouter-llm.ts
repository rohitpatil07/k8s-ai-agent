
import {
  BaseLlm,
} from "@google/adk";
import type {
  BaseLlmConnection,
  LlmRequest,
  LlmResponse,
} from "@google/adk";

const OPENROUTER_URL =
  "https://openrouter.ai/api/v1/chat/completions";

type JsonObject = Record<string, unknown>;

type OpenRouterMessage =
  | {
      role: "system" | "user" | "assistant";
      content: string | null;
      tool_calls?: OpenRouterToolCall[];
    }
  | {
      role: "tool";
      tool_call_id: string;
      content: string;
    };

interface OpenRouterToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenRouterTool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: unknown;
  };
}

interface OpenRouterResponse {
  error?: {
    message?: string;
  };
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: Array<{
        id?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
  }>;
}

interface AdkPart {
  text?: unknown;
  functionCall?: {
    id?: unknown;
    name?: unknown;
    args?: unknown;
  };
  functionResponse?: {
    id?: unknown;
    name?: unknown;
    response?: unknown;
  };
}

function isObject(value: unknown): value is JsonObject {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function extractText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (!isObject(value) || !Array.isArray(value.parts)) {
    return "";
  }

  return value.parts
    .map((part: unknown) => {
      if (isObject(part) && typeof part.text === "string") {
        return part.text;
      }

      return "";
    })
    .filter(Boolean)
    .join("\n");
}

// ADK's schema may use uppercase Google GenAI type names.
// OpenRouter expects standard JSON Schema type names.
function normalizeSchema(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeSchema);
  }

  if (!isObject(value)) {
    return value;
  }

  const normalized: JsonObject = {};

  for (const [key, item] of Object.entries(value)) {
    if (key === "type" && typeof item === "string") {
      const types: Record<string, string> = {
        STRING: "string",
        NUMBER: "number",
        INTEGER: "integer",
        BOOLEAN: "boolean",
        ARRAY: "array",
        OBJECT: "object",
        NULL: "null",
      };

      normalized[key] = types[item] ?? item;
    } else {
      normalized[key] = normalizeSchema(item);
    }
  }

  return normalized;
}

function extractTools(request: LlmRequest): OpenRouterTool[] {
  const config = request.config as unknown as {
    tools?: unknown[];
  } | undefined;

  const tools = config?.tools ?? [];

  return tools.flatMap((rawTool) => {
    if (!isObject(rawTool) || !Array.isArray(rawTool.functionDeclarations)) {
      return [];
    }

    return rawTool.functionDeclarations.flatMap(
      (rawDeclaration: unknown) => {
        if (!isObject(rawDeclaration)) {
          return [];
        }

        const name = rawDeclaration.name;

        if (typeof name !== "string" || !name) {
          return [];
        }

        const description =
          typeof rawDeclaration.description === "string"
            ? rawDeclaration.description
            : undefined;

        const parameters = normalizeSchema(
          rawDeclaration.parametersJsonSchema ??
            rawDeclaration.parameters ?? {
              type: "object",
              properties: {},
            },
        );

        return [{
          type: "function" as const,
          function: {
            name,
            ...(description ? { description } : {}),
            parameters,
          },
        }];
      },
    );
  });
}

function extractMessages(request: LlmRequest): OpenRouterMessage[] {
  const config = request.config as unknown as {
    systemInstruction?: unknown;
  } | undefined;

  const messages: OpenRouterMessage[] = [];
  const lastToolCallIds = new Map<string, string>();

  const systemText = extractText(config?.systemInstruction);

  if (systemText) {
    messages.push({
      role: "system",
      content: systemText,
    });
  }

  for (const content of request.contents) {
    const parts = (content.parts ?? []) as AdkPart[];

    const text = parts
      .map((part) => typeof part.text === "string" ? part.text : "")
      .filter(Boolean)
      .join("\n");

    const functionResponses = parts.filter(
      (part) => part.functionResponse,
    );

    if (functionResponses.length > 0) {
      for (const part of functionResponses) {
        const result = part.functionResponse!;
        const name =
          typeof result.name === "string" ? result.name : "unknown_tool";

        const id =
          typeof result.id === "string"
            ? result.id
            : lastToolCallIds.get(name) ?? `call_${name}`;

        messages.push({
          role: "tool",
          tool_call_id: id,
          content: JSON.stringify(result.response ?? {}),
        });
      }

      if (text) {
        messages.push({
          role: content.role === "model" ? "assistant" : "user",
          content: text,
        });
      }

      continue;
    }

    const functionCalls = parts.filter((part) => part.functionCall);

    if (functionCalls.length > 0) {
      const toolCalls: OpenRouterToolCall[] = functionCalls.map(
        (part, index) => {
          const call = part.functionCall!;
          const name =
            typeof call.name === "string" ? call.name : "";

          if (!name) {
            throw new Error("ADK supplied a function call without a name.");
          }

          const id =
            typeof call.id === "string" && call.id
              ? call.id
              : `call_${Date.now()}_${index}`;

          const args = isObject(call.args) ? call.args : {};

          lastToolCallIds.set(name, id);

          return {
            id,
            type: "function",
            function: {
              name,
              arguments: JSON.stringify(args),
            },
          };
        },
      );

      messages.push({
        role: "assistant",
        content: text || null,
        tool_calls: toolCalls,
      });

      continue;
    }

    if (text) {
      messages.push({
        role: content.role === "model" ? "assistant" : "user",
        content: text,
      });
    }
  }

  if (messages.length === 0) {
    messages.push({
      role: "user",
      content: "Continue according to the system instructions.",
    });
  }

  return messages;
}

function parseArguments(raw: string): JsonObject {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("OpenRouter returned invalid JSON for tool arguments.");
  }

  if (!isObject(parsed)) {
    throw new Error("OpenRouter tool arguments must be a JSON object.");
  }

  return parsed;
}

export class OpenRouterLlm extends BaseLlm {
  constructor(model = process.env.OPENROUTER_MODEL) {
    if (!model) {
      throw new Error("OPENROUTER_MODEL is required.");
    }

    super({ model });
  }

  async *generateContentAsync(
    llmRequest: LlmRequest,
    _stream?: boolean,
    abortSignal?: AbortSignal,
  ): AsyncGenerator<LlmResponse, void> {
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY is required.");
    }

    const tools = extractTools(llmRequest);

    const body = {
      model: this.model,
      messages: extractMessages(llmRequest),
      max_tokens: 1200,
      reasoning: { enabled: false },
      ...(tools.length > 0
        ? {
            tools,
            tool_choice: "auto",
          }
        : {}),
    };

    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: abortSignal,
    });

    const data = await response.json() as OpenRouterResponse;

    if (!response.ok) {
      throw new Error(
        `OpenRouter request failed (${response.status}): ${
          data.error?.message ?? "Unknown API error"
        }`,
      );
    }

    const message = data.choices?.[0]?.message;

    if (!message) {
      throw new Error("OpenRouter returned no message.");
    }

    const parts: Array<
      | { text: string }
      | {
          functionCall: {
            id: string;
            name: string;
            args: JsonObject;
          };
        }
    > = [];

    if (typeof message.content === "string" && message.content.trim()) {
      parts.push({ text: message.content });
    }

    for (const toolCall of message.tool_calls ?? []) {
      const name = toolCall.function?.name;
      const args = toolCall.function?.arguments;

      if (!name || typeof args !== "string") {
        throw new Error("OpenRouter returned a malformed tool call.");
      }

      parts.push({
        functionCall: {
          id: toolCall.id || `call_${Date.now()}`,
          name,
          args: parseArguments(args),
        },
      });
    }

    if (parts.length === 0) {
      throw new Error("OpenRouter returned neither text nor tool calls.");
    }

    yield {
      content: {
        role: "model",
        parts,
      },
    };
  }

  async connect(
    _llmRequest: LlmRequest,
  ): Promise<BaseLlmConnection> {
    throw new Error(
      "OpenRouterLlm does not support live audio/video connections.",
    );
  }
}
