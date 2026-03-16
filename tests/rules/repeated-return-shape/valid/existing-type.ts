// Shape matches an existing type — no need to suggest extracting one
interface PaginatedResult {
  hasMore: boolean;
  items: unknown[];
  nextCursor: string;
}

function paginateUsers(): PaginatedResult {
  return { hasMore: false, items: [], nextCursor: "" };
}

function paginatePosts() {
  return { hasMore: true, items: [1, 2], nextCursor: "abc" };
}

function paginateComments() {
  return { hasMore: false, items: [3], nextCursor: "def" };
}

function paginateTags() {
  return { hasMore: true, items: [], nextCursor: "ghi" };
}
