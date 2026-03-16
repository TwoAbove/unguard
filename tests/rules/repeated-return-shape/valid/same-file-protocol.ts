// All functions return {ok, result} but they're in the same file — intentional protocol
function fetchUsers() {
  return { ok: true as const, result: [] };
}

function fetchPosts() {
  return { ok: true as const, result: [] };
}

function fetchComments() {
  return { ok: false as const, result: [] };
}

function fetchTags() {
  return { ok: true as const, result: [] };
}
