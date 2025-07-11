import { createGraphClient, graphHelpers } from '@/lib/microsoft/graph-client';
import { getAuthenticatedAPI } from './authenticated-api';

export interface SharePointFile {
  id: string;
  name: string;
  size: number;
  webUrl: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
  createdBy?: {
    user: {
      displayName: string;
      email: string;
    };
  };
  file?: {
    mimeType: string;
    hashes?: {
      quickXorHash: string;
    };
  };
  folder?: {
    childCount: number;
  };
  parentReference?: {
    path: string;
    driveId: string;
  };
  '@microsoft.graph.downloadUrl'?: string;
}

export interface SharePointFolder {
  id: string;
  name: string;
  folder: {
    childCount: number;
  };
  webUrl: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
  parentReference?: {
    path: string;
    driveId: string;
  };
}

export interface SharePointPermission {
  id: string;
  roles: string[];
  grantedTo?: {
    user?: {
      displayName: string;
      email: string;
    };
  };
  grantedToIdentities?: Array<{
    user?: {
      displayName: string;
      email: string;
    };
  }>;
  link?: {
    scope: string;
    type: string;
    webUrl: string;
  };
}

export interface SharePointSite {
  id: string;
  name: string;
  displayName: string;
  webUrl: string;
  description?: string;
  createdDateTime: string;
}

export interface SharePointDrive {
  id: string;
  name: string;
  description?: string;
  driveType: string;
  owner?: {
    user?: {
      displayName: string;
      email: string;
    };
  };
  quota?: {
    used: number;
    total: number;
    remaining: number;
  };
}

export interface SharePointSearchResult {
  id: string;
  name: string;
  webUrl: string;
  parentReference?: {
    siteId?: string;
    driveId?: string;
  };
  file?: {
    mimeType: string;
  };
  folder?: {
    childCount: number;
  };
  createdDateTime: string;
  lastModifiedDateTime: string;
}

export class SharePointService {
  private userId: string;
  private encryptionKey: string;
  private refreshConfigs: any;

  constructor(userId: string, encryptionKey: string, refreshConfigs: any) {
    this.userId = userId;
    this.encryptionKey = encryptionKey;
    this.refreshConfigs = refreshConfigs;
  }

  private getAPI() {
    return getAuthenticatedAPI(this.encryptionKey, this.refreshConfigs);
  }

  // Sites Management
  async getSites(): Promise<SharePointSite[]> {
    const response = await this.getAPI().microsoftGraphAPI(
      this.userId,
      '/sites?search=*'
    );
    
    if (!response.ok) {
      throw new Error(`Failed to get sites: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.value || [];
  }

  async getSite(siteId: string): Promise<SharePointSite> {
    const response = await this.getAPI().microsoftGraphAPI(
      this.userId,
      `/sites/${siteId}`
    );
    
    if (!response.ok) {
      throw new Error(`Failed to get site: ${response.statusText}`);
    }
    
    return response.json();
  }

  async getSiteDrives(siteId: string): Promise<SharePointDrive[]> {
    const response = await this.getAPI().microsoftGraphAPI(
      this.userId,
      `/sites/${siteId}/drives`
    );
    
    if (!response.ok) {
      throw new Error(`Failed to get site drives: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.value || [];
  }

  // OneDrive Management
  async getMyDrive(): Promise<SharePointDrive> {
    const response = await this.getAPI().microsoftGraphAPI(
      this.userId,
      '/me/drive'
    );
    
    if (!response.ok) {
      throw new Error(`Failed to get OneDrive: ${response.statusText}`);
    }
    
    return response.json();
  }

  async getMyDriveRoot(): Promise<SharePointFile[]> {
    const response = await this.getAPI().microsoftGraphAPI(
      this.userId,
      '/me/drive/root/children'
    );
    
    if (!response.ok) {
      throw new Error(`Failed to get OneDrive root: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.value || [];
  }

  // File and Folder Operations
  async listItems(driveId: string, itemId?: string): Promise<(SharePointFile | SharePointFolder)[]> {
    const endpoint = itemId 
      ? `/drives/${driveId}/items/${itemId}/children`
      : `/drives/${driveId}/root/children`;
    
    const response = await this.getAPI().microsoftGraphAPI(
      this.userId,
      endpoint
    );
    
    if (!response.ok) {
      throw new Error(`Failed to list items: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.value || [];
  }

  async getItem(driveId: string, itemId: string): Promise<SharePointFile | SharePointFolder> {
    const response = await this.getAPI().microsoftGraphAPI(
      this.userId,
      `/drives/${driveId}/items/${itemId}`
    );
    
    if (!response.ok) {
      throw new Error(`Failed to get item: ${response.statusText}`);
    }
    
    return response.json();
  }

  async uploadFile(
    driveId: string, 
    parentId: string | null, 
    fileName: string, 
    content: ArrayBuffer | Blob
  ): Promise<SharePointFile> {
    const endpoint = parentId
      ? `/drives/${driveId}/items/${parentId}:/${fileName}:/content`
      : `/drives/${driveId}/root:/${fileName}:/content`;
    
    const response = await this.getAPI().microsoftGraphAPI(
      this.userId,
      endpoint,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/octet-stream'
        },
        body: content
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to upload file: ${response.statusText}`);
    }
    
    return response.json();
  }

  async uploadLargeFile(
    driveId: string,
    parentId: string | null,
    fileName: string,
    content: Blob,
    onProgress?: (progress: number) => void
  ): Promise<SharePointFile> {
    // Create upload session
    const endpoint = parentId
      ? `/drives/${driveId}/items/${parentId}:/${fileName}:/createUploadSession`
      : `/drives/${driveId}/root:/${fileName}:/createUploadSession`;
    
    const sessionResponse = await this.getAPI().microsoftGraphAPI(
      this.userId,
      endpoint,
      {
        method: 'POST',
        body: JSON.stringify({
          item: {
            "@microsoft.graph.conflictBehavior": "rename",
            name: fileName
          }
        })
      }
    );
    
    if (!sessionResponse.ok) {
      throw new Error(`Failed to create upload session: ${sessionResponse.statusText}`);
    }
    
    const session = await sessionResponse.json();
    const uploadUrl = session.uploadUrl;
    
    // Upload in chunks (5MB each)
    const chunkSize = 5 * 1024 * 1024; // 5MB
    const chunks = Math.ceil(content.size / chunkSize);
    
    for (let i = 0; i < chunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, content.size);
      const chunk = content.slice(start, end);
      
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Length': (end - start).toString(),
          'Content-Range': `bytes ${start}-${end - 1}/${content.size}`
        },
        body: chunk
      });
      
      if (!response.ok && response.status !== 202) {
        throw new Error(`Failed to upload chunk: ${response.statusText}`);
      }
      
      if (onProgress) {
        onProgress((i + 1) / chunks);
      }
      
      // If this was the last chunk, return the file
      if (response.status === 201 || response.status === 200) {
        return response.json();
      }
    }
    
    throw new Error('Upload completed but no file returned');
  }

  async downloadFile(driveId: string, itemId: string): Promise<Blob> {
    const response = await this.getAPI().microsoftGraphAPI(
      this.userId,
      `/drives/${driveId}/items/${itemId}/content`
    );
    
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }
    
    return response.blob();
  }

  async createFolder(
    driveId: string, 
    parentId: string | null, 
    folderName: string
  ): Promise<SharePointFolder> {
    const endpoint = parentId
      ? `/drives/${driveId}/items/${parentId}/children`
      : `/drives/${driveId}/root/children`;
    
    const response = await this.getAPI().microsoftGraphAPI(
      this.userId,
      endpoint,
      {
        method: 'POST',
        body: JSON.stringify({
          name: folderName,
          folder: {},
          "@microsoft.graph.conflictBehavior": "rename"
        })
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to create folder: ${response.statusText}`);
    }
    
    return response.json();
  }

  async deleteItem(driveId: string, itemId: string): Promise<void> {
    const response = await this.getAPI().microsoftGraphAPI(
      this.userId,
      `/drives/${driveId}/items/${itemId}`,
      {
        method: 'DELETE'
      }
    );
    
    if (!response.ok && response.status !== 204) {
      throw new Error(`Failed to delete item: ${response.statusText}`);
    }
  }

  async moveItem(
    driveId: string, 
    itemId: string, 
    newParentId: string,
    newName?: string
  ): Promise<SharePointFile | SharePointFolder> {
    const body: any = {
      parentReference: {
        driveId: driveId,
        id: newParentId
      }
    };
    
    if (newName) {
      body.name = newName;
    }
    
    const response = await this.getAPI().microsoftGraphAPI(
      this.userId,
      `/drives/${driveId}/items/${itemId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(body)
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to move item: ${response.statusText}`);
    }
    
    return response.json();
  }

  async copyItem(
    driveId: string, 
    itemId: string, 
    newParentId: string,
    newName?: string
  ): Promise<string> {
    const body: any = {
      parentReference: {
        driveId: driveId,
        id: newParentId
      }
    };
    
    if (newName) {
      body.name = newName;
    }
    
    const response = await this.getAPI().microsoftGraphAPI(
      this.userId,
      `/drives/${driveId}/items/${itemId}/copy`,
      {
        method: 'POST',
        body: JSON.stringify(body)
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to copy item: ${response.statusText}`);
    }
    
    // Copy operation is async, returns a monitor URL in Location header
    const monitorUrl = response.headers.get('Location');
    if (!monitorUrl) {
      throw new Error('No monitor URL returned');
    }
    
    return monitorUrl;
  }

  async renameItem(
    driveId: string, 
    itemId: string, 
    newName: string
  ): Promise<SharePointFile | SharePointFolder> {
    const response = await this.getAPI().microsoftGraphAPI(
      this.userId,
      `/drives/${driveId}/items/${itemId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          name: newName
        })
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to rename item: ${response.statusText}`);
    }
    
    return response.json();
  }

  // Permissions Management
  async getItemPermissions(driveId: string, itemId: string): Promise<SharePointPermission[]> {
    const response = await this.getAPI().microsoftGraphAPI(
      this.userId,
      `/drives/${driveId}/items/${itemId}/permissions`
    );
    
    if (!response.ok) {
      throw new Error(`Failed to get permissions: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.value || [];
  }

  async createShareLink(
    driveId: string, 
    itemId: string, 
    type: 'view' | 'edit' | 'embed',
    scope: 'anonymous' | 'organization',
    expirationDateTime?: string,
    password?: string
  ): Promise<SharePointPermission> {
    const body: any = {
      type,
      scope
    };
    
    if (expirationDateTime) {
      body.expirationDateTime = expirationDateTime;
    }
    
    if (password) {
      body.password = password;
    }
    
    const response = await this.getAPI().microsoftGraphAPI(
      this.userId,
      `/drives/${driveId}/items/${itemId}/createLink`,
      {
        method: 'POST',
        body: JSON.stringify(body)
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to create share link: ${response.statusText}`);
    }
    
    return response.json();
  }

  async grantPermission(
    driveId: string,
    itemId: string,
    emails: string[],
    roles: string[],
    message?: string
  ): Promise<SharePointPermission[]> {
    const response = await this.getAPI().microsoftGraphAPI(
      this.userId,
      `/drives/${driveId}/items/${itemId}/invite`,
      {
        method: 'POST',
        body: JSON.stringify({
          recipients: emails.map(email => ({
            email
          })),
          roles,
          requireSignIn: true,
          sendInvitation: true,
          message
        })
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to grant permission: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.value || [];
  }

  async removePermission(driveId: string, itemId: string, permissionId: string): Promise<void> {
    const response = await this.getAPI().microsoftGraphAPI(
      this.userId,
      `/drives/${driveId}/items/${itemId}/permissions/${permissionId}`,
      {
        method: 'DELETE'
      }
    );
    
    if (!response.ok && response.status !== 204) {
      throw new Error(`Failed to remove permission: ${response.statusText}`);
    }
  }

  // Search
  async search(query: string, scope: 'all' | 'myDrive' | 'sites' = 'all'): Promise<SharePointSearchResult[]> {
    let endpoint = '';
    
    switch (scope) {
      case 'myDrive':
        endpoint = `/me/drive/search(q='${encodeURIComponent(query)}')`;
        break;
      case 'sites':
        endpoint = `/sites?search=${encodeURIComponent(query)}`;
        break;
      default:
        // Use Microsoft Search API for comprehensive search
        const searchResponse = await this.getAPI().microsoftGraphAPI(
          this.userId,
          '/search/query',
          {
            method: 'POST',
            body: JSON.stringify({
              requests: [{
                entityTypes: ['driveItem', 'site', 'list', 'listItem'],
                query: {
                  queryString: query
                },
                from: 0,
                size: 50
              }]
            })
          }
        );
        
        if (!searchResponse.ok) {
          throw new Error(`Failed to search: ${searchResponse.statusText}`);
        }
        
        const searchData = await searchResponse.json();
        const results: SharePointSearchResult[] = [];
        
        if (searchData.value?.[0]?.hitsContainers) {
          for (const container of searchData.value[0].hitsContainers) {
            if (container.hits) {
              results.push(...container.hits.map((hit: any) => hit.resource));
            }
          }
        }
        
        return results;
    }
    
    const response = await this.getAPI().microsoftGraphAPI(this.userId, endpoint);
    
    if (!response.ok) {
      throw new Error(`Failed to search: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.value || [];
  }

  // Recent Files
  async getRecentFiles(limit: number = 20): Promise<SharePointFile[]> {
    const response = await this.getAPI().microsoftGraphAPI(
      this.userId,
      `/me/drive/recent?$top=${limit}`
    );
    
    if (!response.ok) {
      throw new Error(`Failed to get recent files: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.value || [];
  }

  // Shared Files
  async getSharedWithMe(): Promise<SharePointFile[]> {
    const response = await this.getAPI().microsoftGraphAPI(
      this.userId,
      '/me/drive/sharedWithMe'
    );
    
    if (!response.ok) {
      throw new Error(`Failed to get shared files: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.value || [];
  }

  // Get file preview/thumbnail
  async getFileThumbnail(driveId: string, itemId: string, size: 'small' | 'medium' | 'large' = 'medium'): Promise<string | null> {
    try {
      const response = await this.getAPI().microsoftGraphAPI(
        this.userId,
        `/drives/${driveId}/items/${itemId}/thumbnails/0/${size}`
      );
      
      if (!response.ok) {
        return null;
      }
      
      const data = await response.json();
      return data.url || null;
    } catch (error) {
      return null;
    }
  }

  // Get file metadata
  async getFileMetadata(driveId: string, itemId: string): Promise<any> {
    const response = await this.getAPI().microsoftGraphAPI(
      this.userId,
      `/drives/${driveId}/items/${itemId}?$expand=thumbnails,permissions`
    );
    
    if (!response.ok) {
      throw new Error(`Failed to get file metadata: ${response.statusText}`);
    }
    
    return response.json();
  }

  // Monitor async operation (for copy operations)
  async monitorAsyncOperation(monitorUrl: string): Promise<any> {
    const response = await fetch(monitorUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to monitor operation: ${response.statusText}`);
    }
    
    return response.json();
  }
}

// Helper function to create SharePoint service instance
export function createSharePointService(
  userId: string,
  encryptionKey: string,
  refreshConfigs: any
): SharePointService {
  return new SharePointService(userId, encryptionKey, refreshConfigs);
}