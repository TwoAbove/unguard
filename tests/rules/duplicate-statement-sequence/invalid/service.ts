declare function fromNullableOrFail<T>(value: T | null, msg: string): T;
declare function filterOrFail<T>(value: T, pred: (v: T) => boolean, msg: string): T;
declare function validateAccess(session: Session, userId: string): void;

interface Session {
  id: string;
  userId: string;
}

declare function findSession(id: string): Session | null;

export function assertOwnership(sessionId: string, userId: string): Session {
  const session = fromNullableOrFail(findSession(sessionId), "session not found");
  filterOrFail(session, (s) => s.userId === userId, "access denied");
  validateAccess(session, userId);
  return session;
}

export function assertAccess(sessionId: string, userId: string): Session {
  const session = fromNullableOrFail(findSession(sessionId), "session not found"); // @expect duplicate-statement-sequence
  filterOrFail(session, (s) => s.userId === userId, "access denied");
  validateAccess(session, userId);
  return session;
}
