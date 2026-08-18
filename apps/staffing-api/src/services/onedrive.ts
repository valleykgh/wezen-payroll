import axios from 'axios';
import fs from 'fs';
import path from 'path';

const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export async function getMicrosoftGraphAccessToken(): Promise<string> {
  const tenantId = getRequiredEnv('MS_TENANT_ID');
  const clientId = getRequiredEnv('MS_CLIENT_ID');
  const clientSecret = getRequiredEnv('MS_CLIENT_SECRET');

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const params = new URLSearchParams();
  params.set('client_id', clientId);
  params.set('client_secret', clientSecret);
  params.set('scope', 'https://graph.microsoft.com/.default');
  params.set('grant_type', 'client_credentials');

  const response = await axios.post(tokenUrl, params.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  const accessToken = response.data?.access_token;
  if (!accessToken) {
    throw new Error('Microsoft Graph token response did not include access_token');
  }

  return accessToken;
}

export async function getOneDriveInfo() {
  const accessToken = await getMicrosoftGraphAccessToken();
  const userPrincipalName = getRequiredEnv('MS_ONEDRIVE_USER');

  const response = await axios.get(
    `${GRAPH_BASE_URL}/users/${encodeURIComponent(userPrincipalName)}/drive`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  return response.data;
}

export async function listOneDriveRootChildren() {
  const accessToken = await getMicrosoftGraphAccessToken();
  const userPrincipalName = getRequiredEnv('MS_ONEDRIVE_USER');

  const response = await axios.get(
    `${GRAPH_BASE_URL}/users/${encodeURIComponent(userPrincipalName)}/drive/root/children`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  return response.data;
}

function sanitizeFolderSegment(value: string) {
  return value.replace(/[\/\\:*?"<>|#%]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function sanitizeFileName(value: string) {
  return value.replace(/[\/\\:*?"<>|#%]+/g, '_').trim();
}

async function getDriveRootPathPrefix() {
  const userPrincipalName = getRequiredEnv('MS_ONEDRIVE_USER');
  return `/users/${encodeURIComponent(userPrincipalName)}/drive/root`;
}

async function ensureFolderByPath(folderPath: string) {
  const accessToken = await getMicrosoftGraphAccessToken();
  const rootPrefix = await getDriveRootPathPrefix();

  const normalizedPath = folderPath
    .split('/')
    .map((part) => sanitizeFolderSegment(part))
    .filter(Boolean);

  let currentPath = '';

  for (const part of normalizedPath) {
    const nextPath = currentPath ? `${currentPath}/${part}` : part;

    try {
      await axios.get(
        `${GRAPH_BASE_URL}${rootPrefix}:/${encodeURIComponent(nextPath)}`
          .replace(/%2F/g, '/'),
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
    } catch (error: any) {
      const status = error?.response?.status;
      if (status !== 404) {
        throw error;
      }

      const parentPath = currentPath
        ? `${GRAPH_BASE_URL}${rootPrefix}:/${encodeURIComponent(currentPath)}:/children`.replace(/%2F/g, '/')
        : `${GRAPH_BASE_URL}${rootPrefix}/children`;

      await axios.post(
        parentPath,
        {
          name: part,
          folder: {},
          '@microsoft.graph.conflictBehavior': 'replace',
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    currentPath = nextPath;
  }

  return currentPath;
}

export async function uploadFileToCandidateFolder(params: {
  firstName?: string | null;
  lastName?: string | null;
  professionalId: string;
  originalFileName: string;
  localFilePath: string;
  mimeType?: string | null;
}) {
  const accessToken = await getMicrosoftGraphAccessToken();
  const rootPrefix = await getDriveRootPathPrefix();

  const displayName =
    `${params.firstName || ''} ${params.lastName || ''}`.trim() || params.professionalId;

  const candidateFolder = sanitizeFolderSegment(displayName);
  const folderPath = await ensureFolderByPath(`Candidate Documents - New/${candidateFolder}`);

  const safeFileName = sanitizeFileName(params.originalFileName);
  const fileBuffer = await fs.promises.readFile(params.localFilePath);

  const uploadUrl =
    `${GRAPH_BASE_URL}${rootPrefix}:/${encodeURIComponent(folderPath)}/${encodeURIComponent(safeFileName)}:/content`
      .replace(/%2F/g, '/');

  const response = await axios.put(uploadUrl, fileBuffer, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': params.mimeType || 'application/octet-stream',
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  const item = response.data;

  return {
    itemId: item.id as string,
    webUrl: item.webUrl as string,
    folderPath,
    name: item.name as string,
    mimeType: params.mimeType || 'application/octet-stream',
  };
}

export async function getOneDriveDownloadUrl(itemId: string) {
  const accessToken = await getMicrosoftGraphAccessToken();
  const userPrincipalName = getRequiredEnv('MS_ONEDRIVE_USER');

  const response = await axios.get(
    `${GRAPH_BASE_URL}/users/${encodeURIComponent(userPrincipalName)}/drive/items/${encodeURIComponent(itemId)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  return response.data?.['@microsoft.graph.downloadUrl'] as string | undefined;
}

export async function downloadOneDriveFileBuffer(itemId: string) {
  const downloadUrl = await getOneDriveDownloadUrl(itemId);

  if (!downloadUrl) {
    throw new Error(`No OneDrive download URL found for item ${itemId}`);
  }

  const response = await axios.get(downloadUrl, {
    responseType: 'arraybuffer',
  });

  return Buffer.from(response.data);
}

export async function deleteOneDriveFolderByPath(folderPath: string) {
  const accessToken = await getMicrosoftGraphAccessToken();
  const rootPrefix = await getDriveRootPathPrefix();
  let decodedPath = folderPath;
  try {
    decodedPath = decodeURIComponent(folderPath);
  } catch {
    // Keep the stored value when it is not URI encoded.
  }
  const parts = decodedPath
    .replace(/\\/g, '/')
    .split('/')
    .map((part) => sanitizeFolderSegment(part))
    .filter(Boolean);
  const candidateRootIndex = parts.findIndex(
    (part) => part.toLocaleLowerCase() === 'candidate documents - new'
  );
  if (candidateRootIndex < 0 && parts.length !== 1) {
    throw new Error('Refusing to delete a folder outside Candidate Documents - New');
  }
  if (candidateRootIndex === parts.length - 1) {
    throw new Error('Refusing to delete the Candidate Documents - New root folder');
  }
  const normalized = candidateRootIndex >= 0
    ? parts.slice(candidateRootIndex).join('/')
    : `Candidate Documents - New/${parts[0]}`;

  try {
    await axios.delete(
      `${GRAPH_BASE_URL}${rootPrefix}:/${encodeURIComponent(normalized)}`.replace(/%2F/g, '/'),
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    return true;
  } catch (error: any) {
    if (error?.response?.status === 404) return false;
    throw error;
  }
}

export async function uploadBufferToCandidatePackageFolder(params: {
  firstName?: string | null;
  lastName?: string | null;
  professionalId: string;
  fileName: string;
  buffer: Buffer;
  mimeType?: string;
}) {
  const accessToken = await getMicrosoftGraphAccessToken();
  const rootPrefix = await getDriveRootPathPrefix();

  const displayName =
    `${params.firstName || ''} ${params.lastName || ''}`.trim() ||
    params.professionalId;

  const candidateFolder = sanitizeFolderSegment(displayName);

  const folderPath = await ensureFolderByPath(
    `Candidate Documents - New/${candidateFolder}/Facility Packages`
  );

  const safeFileName = sanitizeFileName(params.fileName);

  const uploadUrl =
    `${GRAPH_BASE_URL}${rootPrefix}:/${encodeURIComponent(folderPath)}/${encodeURIComponent(safeFileName)}:/content`
      .replace(/%2F/g, '/');

  const response = await axios.put(uploadUrl, params.buffer, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': params.mimeType || 'application/zip',
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  return {
    itemId: response.data.id as string,
    webUrl: response.data.webUrl as string,
    folderPath,
    name: response.data.name as string,
  };
}
