interface Message {
  role: string;
  content: string;
}

interface State {
  messages: Message[];
}

export function popLastAssistantMessage(state: State): Message | undefined {
  for (let i = state.messages.length - 1; i >= 0; i--) {
    if (state.messages[i]!.role === "assistant") {
      return state.messages.splice(i, 1)[0];
    }
  }
  return undefined;
}
