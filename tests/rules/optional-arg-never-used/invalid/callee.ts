export function send(message: string, urgent = false) { // @expect optional-arg-never-used
  return urgent ? `!${message}` : message;
}

export function format(text: string, prefix?: string) { // @expect optional-arg-never-used
  return `${prefix ?? ""}${text}`;
}
