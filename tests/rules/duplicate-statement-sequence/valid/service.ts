declare function findById(id: string): { userId: string } | null;
declare function checkAccess(userId: string): boolean;
declare function getById(id: string): { ownerId: string } | null;
declare function verifyOwner(ownerId: string): boolean;

export function getResourceA(id: string): string {
  const result = findById(id);
  if (!result) throw new Error("not found");
  const ok = checkAccess(result.userId);
  if (!ok) throw new Error("access denied");
  return result.userId;
}

export function getResourceB(id: string): string {
  const result = getById(id);
  if (!result) throw new Error("missing");
  const ok = verifyOwner(result.ownerId);
  if (!ok) throw new Error("unauthorized");
  return result.ownerId;
}
