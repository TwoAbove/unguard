/**
 * Detect maximal duplicated runs of consecutive statements across all collected
 * blocks. "Maximal" means the run can't be extended in either direction without
 * breaking the match — this is the standard formulation used by CPD/Simian and
 * avoids the fragmentation a fixed-window sliding-hash approach produces (where
 * one underlying duplication shows up as many overlapping window matches at
 * different sizes).
 *
 * Algorithm:
 *   1. Each statement is hashed individually (text identity, comments and
 *      whitespace normalized). Per-statement hashes are indexed globally.
 *   2. For each anchor position p with a non-unique hash, collect candidate
 *      positions sharing the same hash whose left predecessor differs from p's
 *      (or one of them is at block start). This "left-distinct" filter ensures
 *      a match between two positions is only emitted from its leftmost
 *      starting point — anywhere else, it would be subsumed.
 *   3. Extend right one statement at a time. Whenever some candidates drop out
 *      (their next statement diverges), the cluster as it stood is recorded as
 *      a maximal match at the current length. Continue with the surviving
 *      subset for the longer match.
 *   4. Across anchors, dedupe by (sorted participant file:line, length).
 *   5. Drop matches whose participant set is a strict subset of a kept match
 *      at the same length — these are the same maximal run found from a less
 *      complete anchor.
 */
export interface StatementInBlock {
  hash: string;
  line: number;
  column: number;
  endLine: number;
  normalizedLength: number;
}

export interface MaximalMatchParticipant {
  file: string;
  line: number;
  column: number;
  endLine: number;
  /** Number of statements in this match (same for every participant). */
  statementCount: number;
}

export interface MaximalMatch {
  participants: MaximalMatchParticipant[];
  statementCount: number;
  /** Sum of per-statement normalized text lengths across the matched run. */
  normalizedBodyLength: number;
}

interface PositionRef {
  block: BlockData;
  pos: number;
}

interface BlockData {
  file: string;
  stmts: StatementInBlock[];
}

interface RecordedMatch {
  participants: PositionRef[];
  length: number;
}

export class StatementSequenceRegistry {
  private blocks: BlockData[] = [];
  private byHash = new Map<string, PositionRef[]>();

  addBlock(file: string, stmts: StatementInBlock[]): void {
    if (stmts.length === 0) return;
    const block: BlockData = { file, stmts };
    this.blocks.push(block);
    for (let pos = 0; pos < stmts.length; pos++) {
      const stmt = stmts[pos];
      if (stmt === undefined) continue;
      let list = this.byHash.get(stmt.hash);
      if (list === undefined) {
        list = [];
        this.byHash.set(stmt.hash, list);
      }
      list.push({ block, pos });
    }
  }

  getMaximalMatches(minStatementCount: number, minNormalizedBodyLength: number): MaximalMatch[] {
    const recorded = new Map<string, RecordedMatch>();

    for (const block of this.blocks) {
      for (let pos = 0; pos < block.stmts.length; pos++) {
        this.findMatchesFromAnchor(block, pos, minStatementCount, recorded);
      }
    }

    // Sort by (length desc, participant count desc) so subset filtering keeps
    // the larger participant set for any given length.
    const ordered = [...recorded.values()].sort((a, b) => {
      if (b.length !== a.length) return b.length - a.length;
      return b.participants.length - a.participants.length;
    });

    const kept: RecordedMatch[] = [];
    for (const match of ordered) {
      const subsumed = kept.some(
        (k) =>
          k.length === match.length &&
          isStrictParticipantSubset(match.participants, k.participants),
      );
      if (!subsumed) kept.push(match);
    }

    const out: MaximalMatch[] = [];
    for (const match of kept) {
      const materialized = materialize(match, minNormalizedBodyLength);
      if (materialized !== null) out.push(materialized);
    }
    return out;
  }

  private findMatchesFromAnchor(
    anchorBlock: BlockData,
    anchorPos: number,
    minStatementCount: number,
    recorded: Map<string, RecordedMatch>,
  ): void {
    const anchorStmt = anchorBlock.stmts[anchorPos];
    if (anchorStmt === undefined) return;
    const candidates = this.byHash.get(anchorStmt.hash);
    if (candidates === undefined || candidates.length < 2) return;

    const anchorLeftHash = leftHash(anchorBlock, anchorPos);

    // Left-distinct filter: a candidate whose left predecessor matches the
    // anchor's would be discovered from the leftward position with a longer
    // match. Skip it here to avoid emitting subset matches.
    let active: PositionRef[] = [];
    for (const candidate of candidates) {
      if (candidate.block === anchorBlock && candidate.pos === anchorPos) continue;
      const cLeftHash = leftHash(candidate.block, candidate.pos);
      if (anchorLeftHash === null || cLeftHash === null || anchorLeftHash !== cLeftHash) {
        active.push(candidate);
      }
    }
    if (active.length === 0) return;

    let length = 1;
    while (true) {
      const nextAnchorStmt = anchorBlock.stmts[anchorPos + length];
      const anchorCanExtend = nextAnchorStmt !== undefined;
      const next: PositionRef[] = [];
      if (anchorCanExtend) {
        const targetHash = nextAnchorStmt.hash;
        for (const candidate of active) {
          const nextCandidateStmt = candidate.block.stmts[candidate.pos + length];
          if (nextCandidateStmt === undefined) continue;
          if (nextCandidateStmt.hash !== targetHash) continue;
          next.push(candidate);
        }
      }

      const shrank = next.length < active.length;
      if ((shrank || !anchorCanExtend) && length >= minStatementCount) {
        const participants: PositionRef[] = [{ block: anchorBlock, pos: anchorPos }, ...active];
        const key = matchKey(participants, length);
        if (!recorded.has(key)) {
          recorded.set(key, { participants, length });
        }
      }

      if (!anchorCanExtend || next.length === 0) break;
      active = next;
      length++;
    }
  }
}

function leftHash(block: BlockData, pos: number): string | null {
  if (pos === 0) return null;
  const prev = block.stmts[pos - 1];
  if (prev === undefined) return null;
  return prev.hash;
}

function materialize(match: RecordedMatch, minNormalizedBodyLength: number): MaximalMatch | null {
  const first = match.participants[0];
  if (first === undefined) return null;

  let normalizedBodyLength = 0;
  for (let k = 0; k < match.length; k++) {
    const stmt = first.block.stmts[first.pos + k];
    if (stmt === undefined) return null;
    normalizedBodyLength += stmt.normalizedLength;
  }
  if (normalizedBodyLength < minNormalizedBodyLength) return null;

  const participants: MaximalMatchParticipant[] = [];
  for (const p of match.participants) {
    const start = p.block.stmts[p.pos];
    const last = p.block.stmts[p.pos + match.length - 1];
    if (start === undefined || last === undefined) return null;
    participants.push({
      file: p.block.file,
      line: start.line,
      column: start.column,
      endLine: last.endLine,
      statementCount: match.length,
    });
  }
  return { participants, statementCount: match.length, normalizedBodyLength };
}

function matchKey(participants: PositionRef[], length: number): string {
  const parts: string[] = [];
  for (const p of participants) {
    const stmt = p.block.stmts[p.pos];
    if (stmt === undefined) continue;
    parts.push(`${p.block.file}:${stmt.line}`);
  }
  parts.sort();
  return `${parts.join("|")}#${length}`;
}

function isStrictParticipantSubset(small: PositionRef[], big: PositionRef[]): boolean {
  if (small.length >= big.length) return false;
  const bigSet = new Set<string>();
  for (const p of big) bigSet.add(`${p.block.file}:${p.pos}`);
  for (const p of small) {
    if (!bigSet.has(`${p.block.file}:${p.pos}`)) return false;
  }
  return true;
}
