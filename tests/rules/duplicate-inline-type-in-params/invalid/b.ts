// Same inline shape as a.ts — this one gets reported
function updateUser(opts: { name: string; email: string }): void {} // @expect duplicate-inline-type-in-params
