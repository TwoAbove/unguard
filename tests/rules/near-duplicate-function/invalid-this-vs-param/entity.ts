interface Message {
  role: string;
  content: string;
}

export class Entity {
  messages: Message[] = [];

  popLastAssistantMessage(): Message | undefined { // @expect near-duplicate-function
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i]!.role === "assistant") {
        return this.messages.splice(i, 1)[0];
      }
    }
    return undefined;
  }
}
