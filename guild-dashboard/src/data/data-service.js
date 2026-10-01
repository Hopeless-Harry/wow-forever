import { diffMembers } from "../domain/members.js";
import { buildStats } from "../domain/stats.js";

export class DataService {
  constructor({ source, normalize, mapping, cacheStore, memberStore = null, normalizeMembers = null, nameHeader = "", refreshMs = 120_000, now = () => new Date(), logger = console }) {
    this.source = source;
    this.normalize = normalize;
    this.mapping = mapping;
    this.cacheStore = cacheStore;
    this.memberStore = memberStore;
    this.normalizeMembers = normalizeMembers;
    this.nameHeader = nameHeader;
    this.memberData = { members: [], events: [], fetchedAt: null };
    this.refreshMs = refreshMs;
    this.now = now;
    this.logger = logger;
    this.current = null;
    this.lastRefreshFailed = false;
    this.refreshPromise = null;
    this.timer = null;
  }

  async start({ schedule = true, immediate = true } = {}) {
    this.current = await this.cacheStore.read();
    if (this.memberStore) this.memberData = await this.memberStore.read();
    if (immediate) await this.refresh();
    if (schedule) {
      this.timer = setInterval(() => { void this.refresh(); }, this.refreshMs);
      this.timer.unref?.();
    }
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async refresh() {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = this.#performRefresh();
    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  async #performRefresh() {
    try {
      const rows = await this.source.fetchRows();
      const normalized = this.normalize(rows, this.mapping);
      const next = {
        records: normalized.records,
        fetchedAt: this.now().toISOString(),
        sourceRowCount: normalized.sourceRowCount,
        rejectedRows: normalized.rejectedRows
      };
      await this.cacheStore.write(next);
      await this.#recordMembers(rows, next.fetchedAt);
      this.current = next;
      this.lastRefreshFailed = false;
      this.logger.info?.({ rowCount: next.records.length, rejectedRows: next.rejectedRows }, "Guild data refreshed");
      return true;
    } catch (error) {
      this.lastRefreshFailed = true;
      this.logger.error?.({ errorType: error.name, message: error.message }, "Guild data refresh failed");
      return false;
    }
  }

  async #recordMembers(rows, at) {
    if (!this.memberStore || !this.normalizeMembers) return;
    try {
      const members = this.normalizeMembers(rows, this.mapping, this.nameHeader);
      const first = this.memberData.fetchedAt === null;
      const events = first
        ? (members.length ? [{ type: "baseline", at, name: String(members.length) }] : [])
        : diffMembers(this.memberData.members, members, at);
      this.memberData = await this.memberStore.write({ members, events: [...this.memberData.events, ...events], fetchedAt: at });
    } catch (error) {
      this.logger.error?.({ errorType: error.name, message: error.message }, "Member roster update failed");
    }
  }

  memberSnapshot() {
    return this.memberData;
  }

  snapshot() {
    const records = this.current?.records || [];
    return {
      records,
      stats: buildStats(records),
      fetchedAt: this.current?.fetchedAt || null,
      sourceRowCount: this.current?.sourceRowCount || 0,
      rejectedRows: this.current?.rejectedRows || 0,
      status: this.cacheStore.getStatus(this.current, this.now()),
      lastRefreshFailed: this.lastRefreshFailed
    };
  }
}
