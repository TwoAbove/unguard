export function send(message: string, urgent = false) {
  return urgent ? `!${message}` : message;
}

export function once(message: string, urgent = false) {
  return urgent ? `!${message}` : message;
}

export function spreadTarget(message: string, urgent = false) {
  return urgent ? `!${message}` : message;
}

export function rest(message: string, count = 0, ...extras: string[]) {
  return `${message}${count}${extras.join("")}`;
}
