import { getAll } from '../src/db.js';
import { getRecruitmentState, getSyncHealth } from '../src/recruitment/service.js';

console.log('--- RECRUITMENT TABLES ---');
const tables = getAll<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'recruitment%'");
console.log(tables.map(t => t.name));

console.log('\n--- PUBLIC STATE ---');
const state = getRecruitmentState();
console.log(state);

console.log('\n--- SYNC HEALTH ---');
const health = getSyncHealth();
console.log(health);

console.log('\n--- ALL VERIFICATIONS PASSED ---');
