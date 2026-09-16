import { buildIncorporationScheduleAlerts } from "../src/incorporation/reminders/incorporationSchedule.js";
import { formatReminderDigest } from "../src/core/reminders/digest.js";
import { buildSampleKabushikiKaishaCase, buildSampleGodoKaishaCase } from "./sampleIncorporationCase.js";

const kabuCase = buildSampleKabushikiKaishaCase();
kabuCase.ninshoYoteiIso = "2026-11-15";
kabuCase.funsoKigenIso = "2026-11-30";

const godoCase = buildSampleGodoKaishaCase();
godoCase.funsoKigenIso = "2026-10-10";

const alerts = buildIncorporationScheduleAlerts([kabuCase, godoCase]);
console.log(formatReminderDigest(alerts));
