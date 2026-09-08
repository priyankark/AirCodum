import { setCurrentContext } from "../state/actions";
import { store } from "../state/store";
import { IMAGE_TO_TEXT_SYSTEM, IMAGE_TO_TEXT_USER } from "./prompts";

export async function transcribeImage(
  base64Image: string,
  apiKey: string
): Promise<string> {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  const payload = {
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: IMAGE_TO_TEXT_SYSTEM,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: IMAGE_TO_TEXT_USER,
          },
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${base64Image}`,
            },
          },
        ],
      },
    ],
    max_tokens: 300,
  };

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(30000),
      headers,
      body: JSON.stringify(payload),
    });
    const responseJson = await response.json();
    return (responseJson as IOpenAIResponse).choices[0].message.content;
  } catch (error) {
    console.error("Error calling OpenAI API:", error);
    throw error;
  }
}

export async function chatWithOpenAI(
  prompt: string,
  apiKey: string
): Promise<string> {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  const systemPrompt = [
    {
      role: "system",
      content:
        "You are an AI assistant who has been provided context around a file or image. Help the user in the best way possible.",
    },
  ];
  const currentContext = store.getState().currentContext;
  const additionalUserContext: any[] = [];
  if (currentContext.messageType === "image") {
    additionalUserContext.push({
      role: "user",
      content: [
        {
          type: "text",
          text: "The image I am providing you is as follows. Do a great job answering my question basis this image.",
        },
        {
          type: "image_url",
          image_url: {
            url: `data:image/jpeg;base64,${currentContext.image}`,
          },
        },
      ],
    });
  }
  const payload = {
    model: "gpt-4o",
    messages: [
      ...systemPrompt,
      ...additionalUserContext,
      {
        role: "user",
        content: `${prompt}\n\n##CURRENT FILE DETAILS\n${currentContext.message}`,
      },
    ],
    max_tokens: 1000,
  };

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(30000),
      headers,
      body: JSON.stringify(payload),
    });
    const responseJson: IOpenAIResponse =
      (await response.json()) as IOpenAIResponse;
    return responseJson.choices?.[0].message.content ?? "No response from AI";
  } catch (error: any) {
    console.error("Error in handleChat:", error);
    const panel = store.getState().webview.panel;
    panel?.webview.postMessage({
      type: "error",
      message: `Error chatting with AI: ${error.message}. Please check your API key and internet connection.`,
    });
  } finally {
    setCurrentContext({
      messageType: "none",
      message: undefined,
      image: undefined,
    });
  }
  return "No response from AI";
}

export async function handleChat(prompt: string, apiKey: string | undefined) {
    const panel = store.getState().webview.panel;
    if (!apiKey) {
      panel?.webview.postMessage({
        type: "error",
        message: "OpenAI API key not found. Please enter your API key.",
      });
      return;
    }
    try {
      const response = await chatWithOpenAI(prompt, apiKey);
      panel?.webview.postMessage({
        type: "chatResponse",
        response,
      });
    } catch (error: any) {
      panel?.webview.postMessage({
        type: "error",
        message: "Error chatting with AI: " + error.message,
      });
    }
  }
