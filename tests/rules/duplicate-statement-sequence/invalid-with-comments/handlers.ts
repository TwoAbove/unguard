// Two functions with textually identical bodies after comment stripping —
// the only difference is the leading inline comment. Comments are metadata
// and shouldn't affect duplication detection.
declare function loadUser(id: string): { id: string; email: string; name: string } | null;
declare function validateUser(user: { id: string; email: string; name: string }): void;
declare function recordUser(user: { id: string; email: string; name: string }): void;
declare function notifyDownstreamSystem(user: { id: string; email: string; name: string }): void;
declare function recordEndpoint(url: string): void;

export function handleA(id: string): { id: string; email: string; name: string } {
  // step 1: load and validate
  const user = loadUser(id);
  if (!user) throw new Error("user not found in handler A path");
  validateUser(user);
  recordUser(user);
  recordEndpoint("http://service.example.com/path/*literal*/audit");
  notifyDownstreamSystem(user);
  return user;
}

export function handleB(id: string): { id: string; email: string; name: string } {
  // alternative entry — same flow as handleA
  const user = loadUser(id); // @expect duplicate-statement-sequence
  if (!user) throw new Error("user not found in handler A path");
  validateUser(user);
  recordUser(user);
  recordEndpoint("http://service.example.com/path/*literal*/audit");
  notifyDownstreamSystem(user);
  return user;
}
