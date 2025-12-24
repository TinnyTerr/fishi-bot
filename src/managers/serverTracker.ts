import fs from "node:fs/promises";
import type { Snowflake } from "discord.js";

class ServerTracker {
	// ===== Shared dataset =====
	static filePath = "./data/serverStats.json";
	static stats: Map<Snowflake, number> = new Map();
	static ignored: Set<Snowflake> = new Set();
	static loaded = false;

	static async loadStats() {
		if (this.loaded) return;
		this.loaded = true;

		try {
			const data = await fs.readFile(this.filePath, "utf-8");
			const parsed: { _ignored?: Snowflake[]; [key: Snowflake]: number | string[] | undefined } = JSON.parse(data);

			if (parsed._ignored) {
				this.ignored = new Set(parsed._ignored);
				delete parsed._ignored;
			}

			for (const [key, value] of Object.entries(parsed)) {
				this.stats.set(key as Snowflake, value as number);
			}
		} catch (err) {
			// file missing is fine
		}
	}

	static async saveStats() {
		const obj: Record<Snowflake, number> = {} as any;

		for (const [key, value] of this.stats) {
			if (this.ignored.has(key)) continue;
			obj[key] = value;
		}

		await fs.writeFile(
			this.filePath,
			JSON.stringify({ ...obj, _ignored: [...this.ignored] }, null, 2),
			"utf-8"
		);
	}

	// ===== Per-instance session state =====
	current: Snowflake | null = null;
	lastUpdate: number | null = null;
	start: Date | null = null;
	code: string | null = null;

	constructor() {
		void ServerTracker.loadStats();
	}

	newServer(ownerId: Snowflake, code: string, overwrite = false) {
		if (this.current && !overwrite) {
			throw new Error("Already tracking");
		}

		if (this.current && overwrite) {
			this.endSession();
		}

		this.current = ownerId;
		this.start = new Date();
		this.lastUpdate = 0;
		this.code = code;
	}

	updateTime(forced = false) {
		if (!this.current || !this.start || this.lastUpdate === null) return;

		const now = Date.now();
		const elapsed = Math.floor((now - this.start.getTime()) / 1000);

		const delta = elapsed - this.lastUpdate * (forced ? 0.1 : 1);
		if (delta <= 0) return;

		const prev = ServerTracker.stats.get(this.current) ?? 0;
		ServerTracker.stats.set(this.current, prev + delta);

		this.lastUpdate = elapsed;
		void ServerTracker.saveStats();
	}

	endSession() {
		this.current = null;
		this.lastUpdate = null;
		this.start = null;
	}
}

export default ServerTracker
