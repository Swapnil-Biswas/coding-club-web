import Database from "better-sqlite3";
const db = new Database("data.db");
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log("Tables:", tables.map(t => t.name));
const users = db.prepare("SELECT id, email, role FROM users").all();
console.log("Users:", users);
const events = db.prepare("SELECT id, title, status FROM events").all();
console.log("Events:", events);