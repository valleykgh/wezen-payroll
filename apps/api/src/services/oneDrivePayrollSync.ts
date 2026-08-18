import { prisma } from "../prisma";
import { parsePayrollWorkbooks } from "./paystubGenerator";

const GRAPH = "https://graph.microsoft.com/v1.0";

function required(name: string) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

async function graphToken() {
  const body = new URLSearchParams({
    client_id: required("MS_CLIENT_ID"),
    client_secret: required("MS_CLIENT_SECRET"),
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(required("MS_TENANT_ID"))}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) throw new Error(`Microsoft sign-in failed (${response.status})`);
  const json: any = await response.json();
  if (!json.access_token) throw new Error("Microsoft did not return an access token");
  return String(json.access_token);
}

async function graphJson(url: string, token: string) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`Microsoft Graph request failed (${response.status})`);
  return response.json() as Promise<any>;
}

async function listPayrollFiles(token: string) {
  const owner = encodeURIComponent(required("MS_ONEDRIVE_USER"));
  const folder = String(process.env.PAYROLL_ONEDRIVE_FOLDER || "Payroll/Payroll Files/2026")
    .split("/").filter(Boolean).map(encodeURIComponent).join("/");
  let url = `${GRAPH}/users/${owner}/drive/root:/${folder}:/children?$select=id,name,eTag,webUrl,lastModifiedDateTime,file`;
  const files: any[] = [];
  while (url) {
    const page = await graphJson(url, token);
    files.push(...(page.value || []).filter((item: any) => item.file && /\.xlsx$/i.test(item.name)));
    url = page["@odata.nextLink"] || "";
  }
  return files;
}

async function download(itemId: string, token: string) {
  const owner = encodeURIComponent(required("MS_ONEDRIVE_USER"));
  const response = await fetch(`${GRAPH}/users/${owner}/drive/items/${encodeURIComponent(itemId)}/content`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Could not download payroll workbook (${response.status})`);
  return Buffer.from(await response.arrayBuffer());
}

export async function syncOneDrivePayroll() {
  const token = await graphToken();
  const files = await listPayrollFiles(token);
  const employees = await prisma.employee.findMany({
    where: { active: true, payrollSourceName: { not: null } },
    select: { id: true, payrollSourceName: true },
  });
  const mapping = new Map(employees.map((employee) => [employee.payrollSourceName!.trim().toLocaleLowerCase(), employee.id]));
  let importedPeriods = 0;
  const warnings: string[] = [];

  for (const item of files) {
    try {
      const buffer = await download(item.id, token);
      const parsed = await parsePayrollWorkbooks([{ originalname: item.name, buffer }]);
      warnings.push(...parsed.warnings);
      const source = await prisma.payrollSourceFile.upsert({
        where: { driveItemId: item.id },
        update: { name: item.name, eTag: item.eTag || null, webUrl: item.webUrl || null, lastModified: item.lastModifiedDateTime ? new Date(item.lastModifiedDateTime) : null, syncedAt: new Date() },
        create: { driveItemId: item.id, name: item.name, eTag: item.eTag || null, webUrl: item.webUrl || null, lastModified: item.lastModifiedDateTime ? new Date(item.lastModifiedDateTime) : null },
      });
      await prisma.importedPaystubPeriod.deleteMany({ where: { sourceFileId: source.id } });
      for (const record of parsed.records) {
        const employeeId = mapping.get(record.employee.trim().toLocaleLowerCase());
        if (!employeeId) continue;
        await prisma.importedPaystubPeriod.create({
          data: {
            employeeId,
            sourceFileId: source.id,
            periodStart: record.periodStart,
            periodEnd: record.periodEnd,
            payDate: record.payDate,
            record: JSON.parse(JSON.stringify(record)),
          },
        });
        importedPeriods += 1;
      }
    } catch (error: any) {
      warnings.push(`${item.name}: ${error?.message || "sync failed"}`);
    }
  }
  return { filesFound: files.length, mappedEmployees: mapping.size, importedPeriods, warnings };
}

let syncRunning = false;

export function queueOneDrivePayrollSync() {
  if (syncRunning) return false;
  syncRunning = true;
  void syncOneDrivePayroll()
    .then((result) => {
      console.log("OneDrive payroll synchronization complete", { filesFound: result.filesFound, importedPeriods: result.importedPeriods, warnings: result.warnings.length });
    })
    .catch((error) => {
      console.error("OneDrive payroll synchronization failed", error);
    })
    .finally(() => {
      syncRunning = false;
    });
  return true;
}

export function startOneDrivePayrollScheduler() {
  if (!process.env.MS_TENANT_ID || !process.env.MS_CLIENT_ID || !process.env.MS_CLIENT_SECRET || !process.env.MS_ONEDRIVE_USER) return;
  const configured = Number(process.env.PAYROLL_SYNC_INTERVAL_MINUTES || 1440);
  const intervalMs = Math.max(5, Number.isFinite(configured) ? configured : 1440) * 60_000;
  const run = () => queueOneDrivePayrollSync();
  const initial = setTimeout(run, 30_000);
  initial.unref();
  const timer = setInterval(run, intervalMs);
  timer.unref();
}
