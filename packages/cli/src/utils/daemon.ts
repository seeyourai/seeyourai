import { execSync, spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const SEEYOURAI_DIR = path.join(os.homedir(), ".seeyourai");
const PID_FILE = path.join(SEEYOURAI_DIR, "seeyourai.pid");
const LOG_FILE = path.join(SEEYOURAI_DIR, "daemon.log");

export interface DaemonStatus {
	running: boolean;
	pid?: number;
}

export function getDaemonStatus(): DaemonStatus {
	if (!fs.existsSync(PID_FILE)) {
		return { running: false };
	}

	try {
		const pid = Number.parseInt(fs.readFileSync(PID_FILE, "utf-8").trim(), 10);
		// Check if process exists
		process.kill(pid, 0);
		return { running: true, pid };
	} catch (_e) {
		// Process not running, clean up stale PID file
		try {
			fs.unlinkSync(PID_FILE);
		} catch {}
		return { running: false };
	}
}

export function startDaemon(): number {
	const status = getDaemonStatus();
	if (status.running) {
		throw new Error(`seeyourai is already running (PID: ${status.pid})`);
	}

	if (!fs.existsSync(SEEYOURAI_DIR)) {
		fs.mkdirSync(SEEYOURAI_DIR, { recursive: true });
	}

	const logStream = fs.openSync(LOG_FILE, "a");

	// Spawn the CLI itself in trace mode
	const child = spawn(process.argv[0], [process.argv[1], "trace", "--super", "--daemon"], {
		detached: true,
		stdio: ["ignore", logStream, logStream],
	});

	if (!child.pid) {
		throw new Error("Failed to start seeyourai daemon");
	}

	fs.writeFileSync(PID_FILE, child.pid.toString());
	child.unref();

	return child.pid;
}

export function stopDaemon(): void {
	const status = getDaemonStatus();
	if (!status.running || !status.pid) {
		console.log("seeyourai is not running.");
		return;
	}

	try {
		process.kill(status.pid, "SIGTERM");
		// Wait a moment for graceful shutdown
		let attempts = 0;
		while (attempts < 10) {
			try {
				process.kill(status.pid, 0);
				// Still running
				execSync("sleep 0.1"); // Quick pause
				attempts++;
			} catch {
				// Process gone
				break;
			}
		}
		// Force kill if needed
		try {
			process.kill(status.pid, "SIGKILL");
		} catch {}
	} catch (e) {
		console.error(`Error stopping daemon: ${e}`);
	} finally {
		try {
			fs.unlinkSync(PID_FILE);
		} catch {}
	}
}

export function getLogPath(): string {
	return LOG_FILE;
}
